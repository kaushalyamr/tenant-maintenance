import { FLOW, SHUTOFF } from '../domain/constants.js';
import { getScript } from '../domain/mitigation.js';
import { triage } from '../domain/triage-v1.js';

export const RELAY_PROTOCOL = 'call-intake-v1';

// Deterministic lexical fallback: a telephony provider sends a transcript, and
// these phrases map it onto the same signals the on-screen questionnaire
// collects. Explicit `answers` always win over inferred wording.
const FLOW_PHRASES = [
  [FLOW.GUSHING, /\b(gush|spray|burst|jet|pouring|flood|shooting)\b/i],
  [FLOW.POOLING, /\b(pool|standing water|puddle|flooded floor|water everywhere)\b/i],
  [FLOW.STEADY, /\b(stream|trickle|running tap|steady|keeps coming)\b/i],
  [FLOW.DRIP, /\b(drip|drop|leak slowly|occasional|every few)\b/i],
  [FLOW.NONE, /\b(no water|not water|dry|stopped leaking)\b/i],
];

const YES = /^(y|yes|sure|correct|affirmative|it is|there is)\b/i;
const NO = /^(n|no|none|negative|not )\b/i;

function ternary(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return null;
  if (YES.test(value)) return true;
  if (NO.test(value)) return false;
  return null;
}

function inferFlow(transcript) {
  for (const [flow, pattern] of FLOW_PHRASES) {
    if (pattern.test(transcript)) return flow;
  }
  return null;
}

function readField(answers, transcript, name, pattern) {
  const explicit = ternary(answers?.[name]);
  if (explicit !== null) return explicit;
  return pattern.test(transcript);
}

export function interpretRelay(payload = {}) {
  const transcript = typeof payload.transcript === 'string' ? payload.transcript : '';
  const answers = payload.answers ?? {};

  const signals = {
    waterPresent: readField(answers, transcript, 'water', /\b(water|leak|flood|dripping)\b/i),
    flow: typeof answers.flow === 'string' ? answers.flow : inferFlow(transcript) ?? FLOW.UNSURE,
    spreading: readField(answers, transcript, 'spreading', /\b(spreading|rising|getting worse|more water)\b/i),
    nearElectrical: readField(answers, transcript, 'nearElectrical', /\b(socket|wiring|electric|power|appliance)\b/i),
    ceilingOrWallDamage: readField(answers, transcript, 'ceilingOrWallDamage', /\b(ceiling|wall|stain|bulge|plaster)\b/i),
    sourceKnown:
      ternary(answers.sourceKnown) ??
      !/\b(can'?t tell|cannot tell|hidden|no idea|not sure where|behind the wall)\b/i.test(transcript),
    hotWaterOrBrown: readField(answers, transcript, 'hotWaterOrBrown', /\b(hot|brown|rust|discolou?red)\b/i),
    sewage: readField(answers, transcript, 'sewage', /\b(sewage|sewer|toilet overflow|drain coming back|smells like a drain)\b/i),
    gasOrSmoke: readField(answers, transcript, 'gasOrSmoke', /\b(gas|smoke|burning smell|hissing)\b/i),
    shutoffAccessible: shutoffFrom(answers, transcript),
    vulnerableOccupant: readField(answers, transcript, 'vulnerableOccupant', /\b(child|baby|elderly|grandma|grandpa|wheelchair|cannot walk|alone)\b/i),
    affectedUnits: Number.isInteger(answers.affectedUnits) ? answers.affectedUnits : 1,
    evidenceUploaded: Boolean(answers.evidenceUploaded ?? payload.evidenceUploaded),
    callerSummary: transcript.slice(0, 1000) || null,
  };

  return { protocol: RELAY_PROTOCOL, callId: payload.callId ?? null, signals };
}

function shutoffFrom(answers, transcript) {
  if (typeof answers?.shutoffAccessible === 'string') return answers.shutoffAccessible;
  const explicit = ternary(answers?.shutoffAccessible);
  if (explicit === true) return SHUTOFF.YES;
  if (explicit === false) return SHUTOFF.NO;
  if (/\b(can'?t reach|cannot reach|valve is stuck|no valve|don'?t know where the valve)\b/i.test(transcript)) {
    return SHUTOFF.NO;
  }
  return SHUTOFF.UNKNOWN;
}

export function relayDirectives(signals, { version, escalationThreshold }) {
  const result = triage(signals, { version, escalationThreshold });
  const directives = [{ intent: 'speak', text: `${result.severity} — ${humanise(result)}` }];

  for (const scriptId of result.mitigationScriptIds) {
    const script = getScript(scriptId);
    if (script) directives.push({ intent: 'guide', scriptId, firstStep: script.steps[0].instruction });
  }
  for (const question of result.followUpQuestions) {
    directives.push({ intent: 'ask', text: question });
  }
  if (result.escalateToHuman) {
    directives.push({ intent: 'transfer', reason: `confidence ${result.confidence} below ${result.escalationThreshold}` });
  }
  directives.push({ intent: 'hold', dispatchWindowMinutes: result.dispatchWindowMinutes });
  return { triage: result, directives };
}

function humanise(result) {
  const label = result.classification.replaceAll('_', ' ');
  return `${label} with ${(result.confidence * 100).toFixed(0)}% confidence. A contractor is needed within ${Math.round(result.dispatchWindowMinutes / 60)} hours.`;
}
