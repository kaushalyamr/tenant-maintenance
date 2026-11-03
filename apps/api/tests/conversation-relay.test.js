import assert from 'node:assert/strict';
import test from 'node:test';

import { CLASSIFICATION, SEVERITY } from '../src/domain/constants.js';
import { interpretRelay, relayDirectives, RELAY_PROTOCOL } from '../src/services/conversation-relay.js';

const OPTIONS = { version: 'triage-v1', escalationThreshold: 0.6 };

test('a caller saying "spraying" is heard as a burst pipe, not an unknown flow', () => {
  const { signals } = interpretRelay({
    transcript: 'Water is spraying out from under the sink and there is a socket right there.',
  });
  assert.equal(signals.flow, 'gushing');
  assert.equal(signals.nearElectrical, true);

  const { triage } = relayDirectives(signals, OPTIONS);
  assert.equal(triage.classification, CLASSIFICATION.BURST_PIPE);
  assert.equal(triage.severity, SEVERITY.P1);
});

test('a dripping trap is graded as a slow leak', () => {
  const { signals } = interpretRelay({ transcript: 'It is just dripping into a bucket, no damage.' });
  assert.equal(signals.flow, 'drip');

  const { triage } = relayDirectives(signals, OPTIONS);
  assert.notEqual(triage.severity, SEVERITY.P1);
});

test('sewage coming back up is a P1 health hazard', () => {
  const { signals } = interpretRelay({ transcript: 'The toilet is overflowing and it smells like a drain.' });
  assert.equal(signals.sewage, true);

  const { triage, directives } = relayDirectives(signals, OPTIONS);
  assert.equal(triage.classification, CLASSIFICATION.SEWAGE_BACKUP);
  assert.equal(triage.severity, SEVERITY.P1);
  assert.ok(directives.some((directive) => directive.intent === 'guide'));
});

test('structured answers always beat wording from the transcript', () => {
  const { signals } = interpretRelay({
    transcript: 'It looks like a massive flood everywhere.',
    answers: { flow: 'drip', affectedUnits: 3 },
  });
  assert.equal(signals.flow, 'drip');
  assert.equal(signals.affectedUnits, 3);
});

test('a call the engine cannot classify is transferred to a human', () => {
  const { signals } = interpretRelay({ transcript: 'I am not sure, something feels damp.' });
  const { triage, directives } = relayDirectives(signals, OPTIONS);

  assert.equal(triage.escalateToHuman, true);
  assert.ok(directives.some((directive) => directive.intent === 'transfer'));
  assert.equal(directives.at(-1).intent, 'hold');
});

test('the relay reports its protocol so a telephony bridge can version-check', () => {
  const payload = interpretRelay({ callId: 'call-42', transcript: 'There is water on the floor.' });
  assert.equal(payload.protocol, RELAY_PROTOCOL);
  assert.equal(payload.callId, 'call-42');
});
