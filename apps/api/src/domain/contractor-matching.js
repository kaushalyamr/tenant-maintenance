export const REJECTION = Object.freeze({
  INACTIVE: 'inactive',
  TRADE_MISMATCH: 'trade_mismatch',
  LICENCE_EXPIRED: 'licence_expired',
  INSURANCE_EXPIRED: 'insurance_expired',
  CAPACITY_FULL: 'capacity_full',
  OUT_OF_COVERAGE: 'out_of_coverage',
  SLA_OUT_OF_RANGE: 'sla_out_of_range',
});

const DAY_MS = 86_400_000;

function daysUntil(date, now) {
  return Math.floor((new Date(date).getTime() - now.getTime()) / DAY_MS);
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function assess(contractor, requirement, { now, renewalWarnDays }) {
  const required = requirement.trades;
  const held = contractor.trades ?? [];
  const matchedTrades = required.filter((trade) => held.includes(trade));

  if (contractor.status !== 'active') {
    return { ok: false, code: REJECTION.INACTIVE, reason: `${contractor.name} is ${contractor.status}.` };
  }
  if (matchedTrades.length === 0) {
    return {
      ok: false,
      code: REJECTION.TRADE_MISMATCH,
      reason: `Holds ${held.join(', ') || 'no trades'}; this case needs ${required.join(' or ')}.`,
    };
  }
  const licenceDays = daysUntil(contractor.licenceExpiresAt, now);
  if (licenceDays < 0) {
    return { ok: false, code: REJECTION.LICENCE_EXPIRED, reason: `Licence ${contractor.licenceNumber} expired ${Math.abs(licenceDays)} days ago.` };
  }
  const insuranceDays = daysUntil(contractor.insuranceExpiresAt, now);
  if (insuranceDays < 0) {
    return { ok: false, code: REJECTION.INSURANCE_EXPIRED, reason: `Public liability insurance expired ${Math.abs(insuranceDays)} days ago.` };
  }
  if (contractor.activeJobs >= contractor.maxConcurrentJobs) {
    return {
      ok: false,
      code: REJECTION.CAPACITY_FULL,
      reason: `Already carrying ${contractor.activeJobs} of ${contractor.maxConcurrentJobs} open jobs.`,
    };
  }
  if (requirement.zone && !contractor.coverageZones.includes(requirement.zone)) {
    return {
      ok: false,
      code: REJECTION.OUT_OF_COVERAGE,
      reason: `Does not serve ${requirement.zone}; covers ${contractor.coverageZones.join(', ')}.`,
    };
  }
  if (contractor.avgResponseMinutes > requirement.dispatchWindowMinutes) {
    return {
      ok: false,
      code: REJECTION.SLA_OUT_OF_RANGE,
      reason: `Typical arrival in ${contractor.avgResponseMinutes} min will miss the ${requirement.dispatchWindowMinutes} min window.`,
    };
  }

  const tradeFit = (matchedTrades.length / required.length) * 30;
  const responseFit = clamp01(1 - contractor.avgResponseMinutes / requirement.dispatchWindowMinutes) * 25;
  const capacityFit = ((contractor.maxConcurrentJobs - contractor.activeJobs) / contractor.maxConcurrentJobs) * 20;
  const ratingFit = (contractor.rating / 5) * 15;
  const complianceBuffer = (clamp01(Math.min(licenceDays, insuranceDays, 90) / 90)) * 10;

  return {
    ok: true,
    match: {
      contractorId: contractor.id,
      name: contractor.name,
      score: Math.round(tradeFit + responseFit + capacityFit + ratingFit + complianceBuffer),
      matchedTrades,
      slackMinutes: requirement.dispatchWindowMinutes - contractor.avgResponseMinutes,
      licenceDaysRemaining: licenceDays,
      insuranceDaysRemaining: insuranceDays,
      renewalDueSoon: Math.min(licenceDays, insuranceDays) < renewalWarnDays,
      activeJobs: contractor.activeJobs,
      maxConcurrentJobs: contractor.maxConcurrentJobs,
      reasons: [
        `Covers ${matchedTrades.join(' and ')}`,
        `Usually on site in ${contractor.avgResponseMinutes} min (${requirement.dispatchWindowMinutes - contractor.avgResponseMinutes} min inside the window)`,
        `${contractor.maxConcurrentJobs - contractor.activeJobs} of ${contractor.maxConcurrentJobs} job slots free`,
        `Rated ${contractor.rating.toFixed(1)}/5`,
      ],
    },
  };
}

export function matchContractors(contractors, requirement, options = {}) {
  const now = options.now ?? new Date();
  const renewalWarnDays = options.renewalWarnDays ?? 30;

  const matched = [];
  const rejected = [];
  for (const contractor of contractors) {
    const outcome = assess(contractor, requirement, { now, renewalWarnDays });
    if (outcome.ok) matched.push(outcome.match);
    else rejected.push({ contractorId: contractor.id, name: contractor.name, code: outcome.code, reason: outcome.reason });
  }

  matched.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  rejected.sort((a, b) => a.name.localeCompare(b.name));

  return {
    requirement: { trades: requirement.trades, dispatchWindowMinutes: requirement.dispatchWindowMinutes, zone: requirement.zone ?? null },
    matched,
    rejected,
  };
}
