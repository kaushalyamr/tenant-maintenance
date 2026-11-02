import mongoose from 'mongoose';

import { CASE_ACTION, CASE_STATE } from '../domain/case-state-machine.js';
import { matchContractors } from '../domain/contractor-matching.js';
import { ConflictError, NotFoundError } from '../http/errors.js';
import { Case } from '../models/case.js';
import { Contractor } from '../models/contractor.js';
import { Job, LIVE_JOB_STATUS } from '../models/job.js';
import { loadAccessibleCase, moveCase } from './cases.js';

const actorOf = (user) => ({ id: user.id, name: user.name, role: user.role });

async function liveJobCounts(contractorIds) {
  const rows = await Job.aggregate([
    { $match: { status: { $in: LIVE_JOB_STATUS }, contractor: { $in: contractorIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
    { $group: { _id: '$contractor', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

export function requirementFor(doc) {
  return {
    trades: doc.triage.requiredTrades,
    dispatchWindowMinutes: doc.triage.dispatchWindowMinutes,
    zone: doc.unit.zone,
    severity: doc.triage.severity,
  };
}

// Every dispatch decision re-runs the engine against live licence, insurance and
// capacity data, so a client cannot dispatch someone the server would reject.
export async function shortlistForCase(id, user) {
  const doc = await loadAccessibleCase(id, user);
  if (!doc.triage) throw new ConflictError('Triage this case before looking for a contractor.');

  const contractors = await Contractor.find({}).sort({ name: 1 });
  const counts = await liveJobCounts(contractors.map((contractor) => String(contractor._id)));
  const requirement = requirementFor(doc);

  const result = matchContractors(
    contractors.map((contractor) => contractor.toMatchInput(counts.get(String(contractor._id)) ?? 0)),
    requirement,
    {},
  );

  return {
    caseId: String(doc._id),
    reference: doc.reference,
    requirement,
    matched: result.matched,
    rejected: result.rejected,
    dueAt: new Date(Date.now() + requirement.dispatchWindowMinutes * 60_000).toISOString(),
  };
}

export async function dispatchCase(id, { contractorId }, user) {
  const doc = await loadAccessibleCase(id, user);
  const shortlist = await shortlistForCase(id, user);
  const selected = shortlist.matched.find((match) => match.contractorId === contractorId);

  if (!selected) {
    const rejection = shortlist.rejected.find((item) => item.contractorId === contractorId);
    throw new ConflictError(
      rejection
        ? `${rejection.name} cannot be sent to this job: ${rejection.reason}`
        : 'That contractor is not registered with this property portfolio.',
    );
  }

  const job = new Job({
    case: doc._id,
    contractor: contractorId,
    trade: selected.matchedTrades[0],
    severity: doc.triage.severity,
    dueAt: new Date(Date.now() + shortlist.requirement.dispatchWindowMinutes * 60_000),
    status: 'open',
    assignedBy: actorOf(user),
  });

  try {
    await job.save();
  } catch (error) {
    if (error?.code === 11000) {
      throw new ConflictError('A contractor is already on their way for this case.');
    }
    throw error;
  }

  doc.dispatch = {
    at: new Date(),
    windowMinutes: shortlist.requirement.dispatchWindowMinutes,
    dueAt: job.dueAt,
    requiredTrades: shortlist.requirement.trades,
    zone: shortlist.requirement.zone,
    selected: {
      contractorId: selected.contractorId,
      name: selected.name,
      score: selected.score,
      matchedTrades: selected.matchedTrades,
    },
    considered: shortlist.matched.length + shortlist.rejected.length,
    rejectedCount: shortlist.rejected.length,
    by: actorOf(user),
  };
  doc.job = job._id;

  try {
    await moveCase(doc, CASE_ACTION.DISPATCH, user, {
      data: { contractorId, contractorName: selected.name, dueAt: job.dueAt.toISOString() },
    });
  } catch (error) {
    await Job.deleteOne({ _id: job._id });
    throw error;
  }

  return { case: doc, job };
}

async function loadOwnJob(jobId, user) {
  const job = await Job.findById(jobId);
  if (!job) throw new NotFoundError('No such work order.');
  if (user.role === 'contractor' && String(job.contractor) !== user.contractorId) {
    throw new ConflictError('That work order was not sent to your business.');
  }
  return job;
}

export async function acceptJob(jobId, user) {
  const job = await loadOwnJob(jobId, user);
  if (job.status !== 'open') throw new ConflictError(`This job is already ${job.status}.`);
  job.status = 'accepted';
  job.acceptedAt = new Date();
  await job.save();
  const doc = await Case.findById(job.case);
  await moveCase(doc, CASE_ACTION.ACCEPT_JOB, user, { data: { jobId: String(job._id) } });
  return job;
}

export async function declineJob(jobId, user, reason) {
  const job = await loadOwnJob(jobId, user);
  if (job.status !== 'open') throw new ConflictError(`This job is already ${job.status}.`);
  job.status = 'declined';
  job.declineReason = reason;
  await job.save();
  const doc = await Case.findById(job.case);
  doc.job = null;
  await moveCase(doc, CASE_ACTION.WITHDRAW, user, { data: { jobId: String(job._id), reason } });
  return job;
}

export async function completeJob(jobId, user, outcome) {
  const job = await loadOwnJob(jobId, user);
  if (job.status !== 'accepted') throw new ConflictError('Accept the work order before completing it.');
  const doc = await Case.findById(job.case);
  await moveCase(doc, CASE_ACTION.RESOLVE, user, {
    data: { jobId: String(job._id) },
    set: { resolvedAt: new Date(), outcome },
  });
  job.status = 'completed';
  job.completedAt = new Date();
  job.workNotes.push({ body: outcome, author: actorOf(user) });
  await job.save();
  return job;
}

export async function addJobNote(jobId, user, body) {
  const job = await loadOwnJob(jobId, user);
  if (!['open', 'accepted'].includes(job.status)) throw new ConflictError('This job is no longer live.');
  job.workNotes.push({ body, author: actorOf(user) });
  await job.save();
  return job;
}

export async function jobsForContractor(user, status) {
  const filter = { contractor: user.contractorId };
  if (status) filter.status = status;
  return Job.find(filter)
    .sort({ severity: 1, dueAt: 1 })
    .populate({
      path: 'case',
      select: 'reference status escalated intake unit property triage dispatch evidence mitigation',
      populate: [
        { path: 'unit', select: 'label zone shutoffLocation' },
        { path: 'property', select: 'name street city' },
      ],
    })
    .lean();
}
