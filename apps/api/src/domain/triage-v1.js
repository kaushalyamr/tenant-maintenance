import {
  CLASSIFICATION,
  DISPATCH_WINDOW_MINUTES,
  FLOW,
  REQUIRED_TRADES,
  SEVERITY,
  SEVERITY_RANK,
  SHUTOFF,
  TRADES,
} from './constants.js';
import { MITIGATION_VERSION, orderScriptIds } from './mitigation.js';

export const TRIAGE_V1 = 'triage-v1';

// priority decides the headline classification: the lowest number wins.
// Aggravators use `decides: false` — they can raise severity, add trades and
// add scripts, but never rename the diagnosis.
export const RULES_V1 = Object.freeze([
  {
    id: 'v1-life-safety-gas-smoke',
    priority: 10,
    decides: true,
    classification: CLASSIFICATION.LIFE_SAFETY,
    severity: SEVERITY.P1,
    confidence: 0.9,
    trades: [TRADES.GENERAL],
    scripts: ['life-safety-evacuate'],
    when: (s) => s.gasOrSmoke,
    reason: 'Gas smell or smoke was reported, so this is a life-safety call before it is a plumbing call.',
  },
  {
    id: 'v1-sewage-backup',
    priority: 20,
    decides: true,
    classification: CLASSIFICATION.SEWAGE_BACKUP,
    severity: SEVERITY.P1,
    confidence: 0.85,
    trades: [TRADES.DRAINAGE, TRADES.PLUMBING],
    scripts: ['sewage-avoid-contact', 'stop-water-main-shutoff', 'document-damage'],
    when: (s) => s.sewage,
    reason: 'Sewage is backing up: a blocked or collapsed line, which is a health hazard and cannot wait for a routine booking.',
  },
  {
    id: 'v1-burst-pipe',
    priority: 30,
    decides: true,
    classification: CLASSIFICATION.BURST_PIPE,
    severity: SEVERITY.P1,
    confidence: 0.88,
    trades: [TRADES.PLUMBING],
    scripts: ['stop-water-main-shutoff', 'contain-water', 'document-damage'],
    when: (s) => s.waterPresent && s.flow === FLOW.GUSHING,
    reason: 'Water is discharging under full pressure, which means a ruptured supply line rather than a failing joint.',
  },
  {
    id: 'v1-active-leak-steady',
    priority: 40,
    decides: true,
    classification: CLASSIFICATION.ACTIVE_LEAK,
    severity: SEVERITY.P2,
    confidence: 0.82,
    trades: [TRADES.PLUMBING],
    scripts: ['stop-water-angle-stop', 'contain-water', 'document-damage'],
    when: (s) => s.waterPresent && s.flow === FLOW.STEADY,
    reason: 'A steady stream that is not spraying points to a failed connection or a cracked fitting.',
  },
  {
    id: 'v1-concealed-leak',
    priority: 50,
    decides: true,
    classification: CLASSIFICATION.ACTIVE_LEAK,
    severity: SEVERITY.P2,
    confidence: 0.7,
    trades: [TRADES.PLUMBING, TRADES.GENERAL],
    scripts: ['contain-water', 'document-damage'],
    when: (s) => s.waterPresent && s.ceilingOrWallDamage,
    reason: 'Ceiling or wall damage means water has been escaping inside the structure for some time, well beyond the visible drip.',
  },
  {
    id: 'v1-spreading-or-pooling',
    priority: 60,
    decides: true,
    classification: CLASSIFICATION.ACTIVE_LEAK,
    severity: SEVERITY.P2,
    confidence: 0.75,
    trades: [TRADES.PLUMBING],
    scripts: ['stop-water-main-shutoff', 'contain-water', 'document-damage'],
    when: (s) => s.waterPresent && (s.flow === FLOW.POOLING || s.spreading),
    reason: 'The water is pooling or still spreading, so damage keeps growing until the supply is isolated.',
  },
  {
    id: 'v1-slow-leak',
    priority: 70,
    decides: true,
    classification: CLASSIFICATION.SLOW_LEAK,
    severity: SEVERITY.P3,
    confidence: 0.8,
    trades: [TRADES.PLUMBING],
    scripts: ['contain-water', 'document-damage'],
    when: (s) => s.waterPresent && s.flow === FLOW.DRIP && !s.spreading && !s.ceilingOrWallDamage,
    reason: 'An isolated drip that is not spreading is a slow leak — urgent enough to book, not urgent enough to declare an emergency.',
  },
  {
    id: 'v1-flow-unclear',
    priority: 80,
    decides: true,
    classification: CLASSIFICATION.UNKNOWN,
    severity: SEVERITY.P2,
    confidence: 0.35,
    trades: [TRADES.PLUMBING],
    scripts: ['contain-water'],
    when: (s) => s.waterPresent && s.flow === FLOW.UNSURE,
    reason: 'Water is present but the caller cannot describe the flow, so the severity is not determinable from the answers alone.',
  },
  {
    id: 'v1-not-water',
    priority: 90,
    decides: true,
    classification: CLASSIFICATION.NOT_WATER,
    severity: SEVERITY.P4,
    confidence: 0.7,
    trades: [TRADES.GENERAL],
    scripts: ['document-damage'],
    when: (s) => !s.waterPresent && !s.sewage && !s.gasOrSmoke,
    reason: 'No water, sewage or gas was reported, so this routes to general maintenance instead of emergency plumbing.',
  },
  {
    id: 'v1-no-match',
    priority: 100,
    decides: true,
    classification: CLASSIFICATION.UNKNOWN,
    severity: SEVERITY.P3,
    confidence: 0.25,
    trades: [TRADES.GENERAL],
    scripts: ['document-damage'],
    when: () => true,
    reason: 'The answers do not fit any rule in this ruleset, so a human dispatcher must read the case.',
  },
]);

export const AGGRAVATORS_V1 = Object.freeze([
  {
    id: 'v1-near-electrical',
    severity: SEVERITY.P1,
    trades: [TRADES.ELECTRICAL],
    scripts: ['electrical-safety'],
    when: (s) => s.waterPresent && s.nearElectrical,
    reason: 'Water is running near wiring, sockets or an appliance: electrocution risk, so the circuit must be isolated before anything else.',
  },
  {
    id: 'v1-shutoff-unreachable',
    severity: SEVERITY.P1,
    trades: [TRADES.PLUMBING],
    scripts: ['stop-water-main-shutoff'],
    when: (s) => s.waterPresent && s.shutoffAccessible === SHUTOFF.NO,
    reason: 'The caller cannot reach or operate a shutoff, so water keeps flowing until a contractor isolates it.',
  },
  {
    id: 'v1-vulnerable-occupant',
    severity: SEVERITY.P2,
    trades: [],
    scripts: [],
    when: (s) => s.vulnerableOccupant,
    reason: 'A child, an older person or someone with limited mobility is in the affected unit, so tolerable wait times are reduced.',
  },
  {
    id: 'v1-many-units',
    severity: SEVERITY.P2,
    trades: [TRADES.PLUMBING],
    scripts: ['stop-water-main-shutoff'],
    when: (s) => s.affectedUnits >= 4,
    reason: 'Four or more units are affected, which points at a shared riser rather than one fixture.',
  },
  {
    id: 'v1-whole-block',
    severity: SEVERITY.P1,
    trades: [TRADES.PLUMBING],
    scripts: ['stop-water-main-shutoff'],
    when: (s) => s.affectedUnits >= 8,
    reason: 'Eight or more units are affected: isolating the building supply is a P1 decision, not a per-unit one.',
  },
  {
    id: 'v1-hot-or-discoloured',
    severity: null,
    trades: [TRADES.PLUMBING],
    scripts: [],
    when: (s) => s.waterPresent && s.hotWaterOrBrown,
    reason: 'The water is hot or rust-coloured, so the hot-water circuit or a corroded riser is involved.',
  },
  {
    id: 'v1-source-hidden',
    severity: null,
    trades: [],
    scripts: ['document-damage'],
    when: (s) => s.waterPresent && !s.sourceKnown,
    reason: 'The caller cannot identify where the water comes from, so the contractor must be allowed time to trace it on site.',
  },
]);

function worst(severities) {
  return severities.reduce(
    (worst, next) => (SEVERITY_RANK[next] < SEVERITY_RANK[worst] ? next : worst),
    SEVERITY.P4,
  );
}

function confidenceAdjustment(signals) {
  let adjustment = 0;
  if (signals.evidenceUploaded) adjustment += 0.1;
  if (signals.flow === FLOW.UNSURE) adjustment -= 0.15;
  if (!signals.sourceKnown) adjustment -= 0.08;
  if (signals.shutoffAccessible === SHUTOFF.UNKNOWN) adjustment -= 0.05;
  return adjustment;
}

function clampConfidence(value) {
  return Math.min(0.97, Math.max(0.05, value));
}

function followUpQuestions(signals) {
  const questions = [];
  if (signals.flow === FLOW.UNSURE) {
    questions.push('Point the camera at the leak and tell me whether the water falls in drops, runs as a stream, or sprays out.');
  }
  if (!signals.sourceKnown) {
    questions.push('Can you see which pipe, joint or fixture the water is coming from, or is it hidden behind a surface?');
  }
  if (signals.shutoffAccessible === SHUTOFF.UNKNOWN) {
    questions.push('Do you know where the main shutoff valve for this unit is, and can you reach it without going through water?');
  }
  if (signals.waterPresent && !signals.evidenceUploaded) {
    questions.push('Send me one photo of the wet area so I can confirm how much water we are dealing with.');
  }
  return questions.slice(0, 3);
}

export function triage(signals, options = {}) {
  const { version = TRIAGE_V1, escalationThreshold = 0.6 } = options;
  if (version !== TRIAGE_V1) {
    throw new RangeError(`Unknown triage ruleset version: ${version}`);
  }

  const matchedRules = RULES_V1.filter((rule) => rule.when(signals));
  const decisive = [...matchedRules].sort((a, b) => a.priority - b.priority)[0];
  const matchedAggravators = AGGRAVATORS_V1.filter((aggravator) => aggravator.when(signals));

  const severity = worst([
    decisive.severity,
    ...matchedAggravators.map((aggravator) => aggravator.severity).filter(Boolean),
  ]);

  const confidence = clampConfidence(
    Number((decisive.confidence + confidenceAdjustment(signals)).toFixed(2)),
  );

  const trades = [...new Set([...decisive.trades, ...matchedAggravators.flatMap((a) => a.trades)])];
  if (REQUIRED_TRADES[decisive.classification]) {
    trades.push(...REQUIRED_TRADES[decisive.classification].filter((t) => !trades.includes(t)));
  }

  const reasons = [
    { ruleId: decisive.id, text: decisive.reason },
    ...matchedAggravators.map((aggravator) => ({ ruleId: aggravator.id, text: aggravator.reason })),
  ];

  const escalate =
    confidence < escalationThreshold ||
    decisive.classification === CLASSIFICATION.UNKNOWN ||
    severity === SEVERITY.P1;

  return Object.freeze({
    version,
    mitigationVersion: MITIGATION_VERSION,
    classification: decisive.classification,
    severity,
    confidence,
    escalationThreshold,
    escalateToHuman: escalate,
    dispatchWindowMinutes: DISPATCH_WINDOW_MINUTES[severity],
    requiredTrades: trades,
    mitigationScriptIds: orderScriptIds([
      ...decisive.scripts,
      ...matchedAggravators.flatMap((aggravator) => aggravator.scripts),
    ]),
    matchedRuleIds: [decisive.id, ...matchedAggravators.map((aggravator) => aggravator.id)],
    reasons,
    followUpQuestions: followUpQuestions(signals),
  });
}
