import assert from 'node:assert/strict';
import test from 'node:test';

import { REJECTION, matchContractors } from '../src/domain/contractor-matching.js';

const now = new Date('2026-11-02T10:00:00.000Z');
const days = (n) => new Date(now.getTime() + n * 86_400_000).toISOString();

const plumber = (overrides = {}) => ({
  id: 'c1',
  name: 'Rapid Reroute Plumbing',
  status: 'active',
  trades: ['plumbing'],
  licenceNumber: 'PL-4471',
  licenceExpiresAt: days(200),
  insuranceExpiresAt: days(180),
  activeJobs: 1,
  maxConcurrentJobs: 4,
  avgResponseMinutes: 45,
  rating: 4.6,
  coverageZones: ['north-block'],
  ...overrides,
});

const emergency = { trades: ['plumbing'], dispatchWindowMinutes: 60, zone: 'north-block' };

test('a licensed, available plumber in range is matched', () => {
  const result = matchContractors([plumber()], emergency, { now });
  assert.equal(result.matched.length, 1);
  assert.equal(result.matched[0].contractorId, 'c1');
  assert.ok(result.matched[0].score > 0);
  assert.equal(result.matched[0].slackMinutes, 15);
});

test('an expired licence disqualifies a contractor outright', () => {
  const result = matchContractors([plumber({ licenceExpiresAt: days(-3) })], emergency, { now });
  assert.equal(result.matched.length, 0);
  assert.equal(result.rejected[0].code, REJECTION.LICENCE_EXPIRED);
  assert.match(result.rejected[0].reason, /expired 3 days ago/);
});

test('expired insurance disqualifies a contractor even with a valid licence', () => {
  const result = matchContractors([plumber({ insuranceExpiresAt: days(-1) })], emergency, { now });
  assert.equal(result.rejected[0].code, REJECTION.INSURANCE_EXPIRED);
});

test('a fully booked contractor is rejected with the capacity shown', () => {
  const result = matchContractors([plumber({ activeJobs: 4, maxConcurrentJobs: 4 })], emergency, { now });
  assert.equal(result.rejected[0].code, REJECTION.CAPACITY_FULL);
  assert.match(result.rejected[0].reason, /4 of 4 open jobs/);
});

test('the right trade is required, not just any licence', () => {
  const result = matchContractors(
    [plumber({ trades: ['electrical'], name: 'Sparkworks Electrical' })],
    emergency,
    { now },
  );
  assert.equal(result.rejected[0].code, REJECTION.TRADE_MISMATCH);
  assert.match(result.rejected[0].reason, /needs plumbing/);
});

test('a contractor outside the property zone is not offered the job', () => {
  const result = matchContractors([plumber({ coverageZones: ['south-block'] })], emergency, { now });
  assert.equal(result.rejected[0].code, REJECTION.OUT_OF_COVERAGE);
});

test('someone who cannot reach the site inside the window is refused on a P1', () => {
  const result = matchContractors([plumber({ avgResponseMinutes: 240 })], emergency, { now });
  assert.equal(result.rejected[0].code, REJECTION.SLA_OUT_OF_RANGE);
});

test('a suspended account is excluded regardless of everything else', () => {
  const result = matchContractors([plumber({ status: 'suspended' })], emergency, { now });
  assert.equal(result.rejected[0].code, REJECTION.INACTIVE);
});

test('the best-placed contractor ranks first and every score is explained', () => {
  const busy = plumber({ id: 'c2', name: 'Slow Burn Plumbing', avgResponseMinutes: 90, rating: 4.9, activeJobs: 0 });
  const result = matchContractors([busy, plumber()], { trades: ['plumbing'], dispatchWindowMinutes: 240, zone: 'north-block' }, { now });
  assert.equal(result.matched.length, 2);
  const scores = result.matched.map((match) => match.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  assert.equal(result.matched[0].reasons.length, 4);
});

test('a licence about to lapse still matches but is flagged for renewal', () => {
  const result = matchContractors([plumber({ licenceExpiresAt: days(12) })], emergency, { now });
  assert.equal(result.matched.length, 1);
  assert.equal(result.matched[0].renewalDueSoon, true);
  assert.equal(result.matched[0].licenceDaysRemaining, 12);
});

test('a case needing two trades prefers the contractor that covers both', () => {
  const both = plumber({ id: 'c3', name: 'Hydro Drain Co', trades: ['plumbing', 'drainage'] });
  const single = plumber({ id: 'c1', name: 'Rapid Reroute Plumbing' });
  const result = matchContractors([single, both], { trades: ['plumbing', 'drainage'], dispatchWindowMinutes: 240, zone: 'north-block' }, { now });
  assert.equal(result.rejected.length, 0);
  assert.equal(result.matched[0].contractorId, 'c3');
  assert.deepEqual(result.matched[0].matchedTrades, ['plumbing', 'drainage']);
  assert.deepEqual(result.matched[1].matchedTrades, ['plumbing']);
});

test('a contractor for the wrong trade never reaches the shortlist', () => {
  const result = matchContractors([plumber({ trades: ['electrical'] })], { trades: ['drainage'], dispatchWindowMinutes: 240 }, { now });
  assert.equal(result.rejected[0].code, REJECTION.TRADE_MISMATCH);
});

test('matching is deterministic for identical input', () => {
  const contractors = [plumber({ id: 'b', name: 'Beta Plumbing' }), plumber({ id: 'a', name: 'Alpha Plumbing' })];
  assert.deepEqual(matchContractors(contractors, emergency, { now }), matchContractors(contractors, emergency, { now }));
});
