import assert from 'node:assert/strict';
import test from 'node:test';

import { CLASSIFICATION, SEVERITY } from '../src/domain/constants.js';
import { MITIGATION_SCRIPTS, SCRIPT_ORDER } from '../src/domain/mitigation.js';
import { AGGRAVATORS_V1, RULES_V1, TRIAGE_V1, triage } from '../src/domain/triage-v1.js';

const base = {
  waterPresent: false,
  flow: 'none',
  spreading: false,
  nearElectrical: false,
  ceilingOrWallDamage: false,
  sourceKnown: true,
  hotWaterOrBrown: false,
  sewage: false,
  gasOrSmoke: false,
  shutoffAccessible: 'yes',
  vulnerableOccupant: false,
  affectedUnits: 1,
  evidenceUploaded: false,
};

const signals = (overrides) => ({ ...base, ...overrides });

test('a gushing supply line is triaged as a burst pipe and a P1 emergency', () => {
  const result = triage(signals({ waterPresent: true, flow: 'gushing' }));
  assert.equal(result.classification, CLASSIFICATION.BURST_PIPE);
  assert.equal(result.severity, SEVERITY.P1);
  assert.equal(result.dispatchWindowMinutes, 60);
  assert.deepEqual(result.requiredTrades, ['plumbing']);
  assert.ok(result.mitigationScriptIds.includes('stop-water-main-shutoff'));
});

test('a contained drip is a slow leak, not an emergency', () => {
  const result = triage(signals({ waterPresent: true, flow: 'drip' }));
  assert.equal(result.classification, CLASSIFICATION.SLOW_LEAK);
  assert.equal(result.severity, SEVERITY.P3);
  assert.equal(result.dispatchWindowMinutes, 1440);
  assert.equal(result.escalateToHuman, false);
});

test('a burst pipe next to a socket adds the electrical trade and script', () => {
  const result = triage(
    signals({ waterPresent: true, flow: 'gushing', nearElectrical: true, sourceKnown: true, evidenceUploaded: true }),
  );
  assert.equal(result.classification, CLASSIFICATION.BURST_PIPE);
  assert.deepEqual(result.requiredTrades, ['plumbing', 'electrical']);
  assert.equal(result.mitigationScriptIds[0], 'electrical-safety');
  assert.ok(result.matchedRuleIds.includes('v1-near-electrical'));
});

test('gas or smoke outranks every water diagnosis', () => {
  const result = triage(signals({ waterPresent: true, flow: 'gushing', gasOrSmoke: true }));
  assert.equal(result.classification, CLASSIFICATION.LIFE_SAFETY);
  assert.equal(result.severity, SEVERITY.P1);
  assert.equal(result.mitigationScriptIds[0], 'life-safety-evacuate');
});

test('sewage routes to drainage and raises a health script', () => {
  const result = triage(signals({ waterPresent: true, flow: 'pooling', sewage: true }));
  assert.equal(result.classification, CLASSIFICATION.SEWAGE_BACKUP);
  assert.ok(result.requiredTrades.includes('drainage'));
  assert.ok(result.mitigationScriptIds.includes('sewage-avoid-contact'));
});

test('an unreachable shutoff escalates a steady leak to P1', () => {
  const result = triage(
    signals({ waterPresent: true, flow: 'steady', shutoffAccessible: 'no', evidenceUploaded: true }),
  );
  assert.equal(result.classification, CLASSIFICATION.ACTIVE_LEAK);
  assert.equal(result.severity, SEVERITY.P1);
  assert.equal(result.dispatchWindowMinutes, 60);
});

test('a call with no water at all leaves the emergency queue', () => {
  const result = triage(signals({}));
  assert.equal(result.classification, CLASSIFICATION.NOT_WATER);
  assert.equal(result.severity, SEVERITY.P4);
  assert.equal(result.escalateToHuman, false);
});

test('an undeterminable flow is classified unknown and handed to a human', () => {
  const result = triage(signals({ waterPresent: true, flow: 'unsure' }));
  assert.equal(result.classification, CLASSIFICATION.UNKNOWN);
  assert.ok(result.confidence < 0.6);
  assert.equal(result.escalateToHuman, true);
  assert.ok(result.followUpQuestions.length > 0);
});

test('uploaded camera evidence raises confidence and asks for fewer follow-ups', () => {
  const blind = triage(signals({ waterPresent: true, flow: 'steady', sourceKnown: false, shutoffAccessible: 'unknown' }));
  const seen = triage(
    signals({ waterPresent: true, flow: 'steady', sourceKnown: false, shutoffAccessible: 'unknown', evidenceUploaded: true }),
  );
  assert.ok(seen.confidence > blind.confidence);
  assert.equal(
    seen.followUpQuestions.some((question) => question.startsWith('Send me one photo')),
    false,
  );
});

test('a shared riser affecting eight units is a P1 decision', () => {
  const result = triage(signals({ waterPresent: true, flow: 'drip', affectedUnits: 8 }));
  assert.equal(result.severity, SEVERITY.P1);
});

test('every script the ruleset can recommend actually exists and steps are confirmable', () => {
  for (const rule of [...RULES_V1, ...AGGRAVATORS_V1]) {
    for (const id of rule.scripts) {
      const script = MITIGATION_SCRIPTS[id];
      assert.ok(script, `${rule.id} recommends the missing script '${id}'`);
      assert.ok(script.steps.length > 0, `${id} has no steps`);
      for (const step of script.steps) {
        assert.ok(['done', 'observed'].includes(step.confirmation), `${id}/${step.id} has a bad confirmation`);
      }
    }
  }
});

test('recommended scripts come back in the safety order, not rule order', () => {
  const result = triage(
    signals({ waterPresent: true, flow: 'pooling', spreading: true, nearElectrical: true, sewage: true }),
  );
  const positions = result.mitigationScriptIds.map((id) => SCRIPT_ORDER.indexOf(id));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});

test('triage is deterministic and reports the version it used', () => {
  const input = signals({ waterPresent: true, flow: 'steady', spreading: true });
  assert.deepEqual(triage(input), triage(input));
  assert.equal(triage(input).version, TRIAGE_V1);
});

test('an unknown ruleset version is refused rather than silently guessed', () => {
  assert.throws(() => triage(base, { version: 'triage-v2' }), /Unknown triage ruleset version/);
});

test('the escalation threshold is honoured and reported back', () => {
  const strict = triage(signals({ waterPresent: true, flow: 'steady', sourceKnown: false }), {
    escalationThreshold: 0.95,
  });
  assert.equal(strict.escalationThreshold, 0.95);
  assert.equal(strict.escalateToHuman, true);
});
