import { randomBytes } from 'node:crypto';

import { config } from '../config.js';
import {
  CASE_ACTION,
  CASE_STATE,
  IllegalTransitionError,
  NotPermittedError,
  transition,
} from '../domain/case-state-machine.js';
import { getScript } from '../domain/mitigation.js';
import { triage } from '../domain/triage-v1.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../http/errors.js';
import { Case } from '../models/case.js';
import { Job } from '../models/job.js';
import { Unit } from '../models/property.js';

const POPULATE = [
  { path: 'unit', select: 'label zone occupants vulnerableOccupants shutoffLocation shutoffAccessible property' },
  { path: 'property', select: 'name street city postcode timezone' },
];

const actorOf = (user) => ({ id: user.id, name: user.name, role: user.role });

function reference(now = new Date()) {
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `TM-${stamp}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

async function persist(doc, event) {
  doc.events.push({ at: new Date(), ...event });
  await doc.save();
  return doc;
}

export async function moveCase(doc, action, user, { data = {}, set = {} } = {}) {
  let next;
  try {
    next = transition({ state: doc.status, action, actorRoles: [user.role] });
  } catch (error) {
    if (error instanceof NotPermittedError) throw new ForbiddenError(error.message);
    if (error instanceof IllegalTransitionError) throw new ConflictError(error.message);
    throw error;
  }
  const from = doc.status;
  doc.status = next;
  Object.assign(doc, set);
  return persist(doc, { type: `case.${action}`, actor: actorOf(user), data: { ...data, from, to: next } });
}

export async function loadAccessibleCase(id, user) {
  const doc = await Case.findById(id).populate(POPULATE);
  if (!doc) throw new NotFoundError('No case with that reference.');

  if (user.role === 'dispatcher' || user.role === 'admin') return doc;
  if (user.role === 'tenant' && String(doc.reportedBy) === user.id) return doc;
  if (user.role === 'contractor' && user.contractorId) {
    const live = await Job.exists({ case: doc._id, contractor: user.contractorId, status: { $in: ['open', 'accepted'] } });
    if (live) return doc;
  }
  throw new ForbiddenError('This case belongs to someone else.');
}

function currentTriage(doc, evidenceUploaded) {
  return triage({ ...doc.intake.toObject(), evidenceUploaded }, config.triage);
}

export async function createCase(input, user) {
  const unit = await Unit.findById(input.unitId).populate('property', 'name street city timezone');
  if (!unit) throw new NotFoundError('That unit is not in the property register.');

  const signals = { ...input.signals, evidenceUploaded: false };
  const result = triage(signals, config.triage);

  const doc = new Case({
    reference: reference(),
    status: CASE_STATE.INTAKE,
    channel: input.channel,
    property: unit.property._id,
    unit: unit._id,
    reportedBy: user.id,
    reportedByName: user.name,
    reporterPhone: input.reporterPhone,
    intake: signals,
    events: [
      {
        type: 'case.created',
        actor: actorOf(user),
        data: { unit: unit.label, zone: unit.zone, channel: input.channel, summary: input.signals.callerSummary ?? null },
      },
    ],
  });

  await doc.save();
  return runTriage(doc, user, result, 'triage.completed');
}

async function runTriage(doc, user, result, eventType) {
  doc.triage = result;
  doc.triagedAt = new Date();
  doc.escalated = result.escalateToHuman;
  if (doc.status === CASE_STATE.INTAKE) doc.status = CASE_STATE.TRIAGED;
  await persist(doc, {
    type: eventType,
    actor: actorOf(user),
    data: {
      engine: result.version,
      classification: result.classification,
      severity: result.severity,
      confidence: result.confidence,
      escalateToHuman: result.escalateToHuman,
      matchedRuleIds: result.matchedRuleIds,
    },
  });
  return doc;
}

export async function reassessCase(id, user) {
  const doc = await loadAccessibleCase(id, user);
  if (![CASE_STATE.INTAKE, CASE_STATE.TRIAGED, CASE_STATE.MITIGATING].includes(doc.status)) {
    throw new ConflictError('Only an undispatched case can be re-triaged.');
  }
  const result = currentTriage(doc, doc.evidence.length > 0);
  const before = `${doc.triage?.classification}:${doc.triage?.severity}`;
  const after = `${result.classification}:${result.severity}`;
  await runTriage(doc, user, result, 'triage.reassessed');
  return persist(doc, { type: 'triage.compared', actor: actorOf(user), data: { before, after } });
}

export async function acknowledgeScript(id, { scriptId }, user) {
  const doc = await loadAccessibleCase(id, user);
  if (!doc.triage?.mitigationScriptIds.includes(scriptId)) {
    throw new ValidationError('That guidance was not recommended for this case.');
  }
  const script = getScript(scriptId);
  if (!script) throw new NotFoundError('No such guidance script.');
  if (doc.mitigation.some((entry) => entry.scriptId === scriptId)) {
    throw new ConflictError('That guidance is already open on this case.');
  }
  if (![CASE_STATE.TRIAGED, CASE_STATE.MITIGATING].includes(doc.status)) {
    throw new ConflictError('Guidance can only be worked through before the job is closed out.');
  }

  doc.mitigation.push({
    scriptId,
    title: script.title,
    acknowledgedBy: actorOf(user),
    steps: [],
  });
  if (doc.status === CASE_STATE.TRIAGED) {
    await moveCase(doc, CASE_ACTION.START_MITIGATION, user, { data: { scriptId } });
  } else {
    await persist(doc, { type: 'mitigation.acknowledged', actor: actorOf(user), data: { scriptId } });
  }
  return doc;
}

export async function confirmStep(id, { scriptId, stepId }, user) {
  const doc = await loadAccessibleCase(id, user);
  const entry = doc.mitigation.find((candidate) => candidate.scriptId === scriptId);
  if (!entry) throw new ConflictError('Acknowledge the safety guidance before recording steps.');

  const script = getScript(scriptId);
  const step = script?.steps.find((candidate) => candidate.id === stepId);
  if (!step) throw new ValidationError('That step is not part of this guidance script.');
  if (entry.steps.some((confirmed) => confirmed.stepId === stepId)) {
    throw new ConflictError('That step is already recorded.');
  }

  const index = script.steps.findIndex((candidate) => candidate.id === stepId);
  const missing = script.steps.slice(0, index).filter((candidate) => !entry.steps.some((s) => s.stepId === candidate.id));
  if (missing.length > 0) {
    throw new ConflictError(`Finish '${missing[0].instruction}' before recording this step.`);
  }

  entry.steps.push({
    stepId: step.id,
    instruction: step.instruction,
    confirmation: step.confirmation,
    confirmedAt: new Date(),
    confirmedBy: actorOf(user),
  });
  return persist(doc, {
    type: step.confirmation === 'observed' ? 'mitigation.result_observed' : 'mitigation.step_done',
    actor: actorOf(user),
    data: { scriptId, stepId, instruction: step.instruction },
  });
}

export async function escalateCase(id, user, reason) {
  const doc = await loadAccessibleCase(id, user);
  if (doc.escalated) throw new ConflictError('A dispatcher is already on this case.');
  doc.escalated = true;
  return persist(doc, { type: 'case.escalated', actor: actorOf(user), data: { reason } });
}

export async function listCases(query, user) {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.severity) filter['triage.severity'] = query.severity;
  if (query.escalated) filter.escalated = query.escalated === 'true';
  if (user.role === 'tenant') filter.reportedBy = user.id;
  if (user.role === 'contractor') {
    const jobs = await Job.find({ contractor: user.contractorId, status: { $in: ['open', 'accepted'] } }).select('case');
    filter._id = { $in: jobs.map((job) => job.case) };
  }
  if (query.q) {
    filter.$or = [{ reference: new RegExp(`^${escapeRegex(query.q)}`, 'i') }, { reportedByName: new RegExp(escapeRegex(query.q), 'i') }];
  }

  return Case.find(filter).sort({ createdAt: -1 }).limit(query.limit).populate(POPULATE).lean({ virtuals: false });
}

export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
