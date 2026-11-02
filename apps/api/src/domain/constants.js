export const FLOW = Object.freeze({
  NONE: 'none',
  DRIP: 'drip',
  STEADY: 'steady',
  GUSHING: 'gushing',
  POOLING: 'pooling',
  UNSURE: 'unsure',
});

export const SHUTOFF = Object.freeze({
  YES: 'yes',
  NO: 'no',
  UNKNOWN: 'unknown',
});

export const CLASSIFICATION = Object.freeze({
  BURST_PIPE: 'burst_pipe',
  ACTIVE_LEAK: 'active_leak',
  SLOW_LEAK: 'slow_leak',
  SEWAGE_BACKUP: 'sewage_backup',
  ELECTRICAL_HAZARD: 'electrical_hazard',
  NOT_WATER: 'not_water',
  LIFE_SAFETY: 'life_safety',
  UNKNOWN: 'unknown',
});

export const SEVERITY = Object.freeze({ P1: 'P1', P2: 'P2', P3: 'P3', P4: 'P4' });

export const SEVERITY_RANK = Object.freeze({ P1: 1, P2: 2, P3: 3, P4: 4 });

// Minutes from triage to a contractor on site.
export const DISPATCH_WINDOW_MINUTES = Object.freeze({ P1: 60, P2: 240, P3: 1440, P4: 4320 });

export const TRADES = Object.freeze({
  PLUMBING: 'plumbing',
  DRAINAGE: 'drainage',
  ELECTRICAL: 'electrical',
  GENERAL: 'general',
});

export const REQUIRED_TRADES = Object.freeze({
  [CLASSIFICATION.BURST_PIPE]: [TRADES.PLUMBING],
  [CLASSIFICATION.ACTIVE_LEAK]: [TRADES.PLUMBING],
  [CLASSIFICATION.SLOW_LEAK]: [TRADES.PLUMBING],
  [CLASSIFICATION.SEWAGE_BACKUP]: [TRADES.DRAINAGE, TRADES.PLUMBING],
  [CLASSIFICATION.ELECTRICAL_HAZARD]: [TRADES.ELECTRICAL, TRADES.PLUMBING],
  [CLASSIFICATION.NOT_WATER]: [TRADES.GENERAL],
  [CLASSIFICATION.LIFE_SAFETY]: [TRADES.GENERAL],
  [CLASSIFICATION.UNKNOWN]: [TRADES.GENERAL],
});
