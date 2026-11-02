import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACTIVE_JOB_STATES,
  CASE_ACTION,
  CASE_STATE,
  ROLE,
  allowedActions,
  transition,
} from '../src/domain/case-state-machine.js';

const dispatcher = [ROLE.DISPATCHER];
const tenant = [ROLE.TENANT];

test('a case walks the full happy path from intake to closed', () => {
  let state = CASE_STATE.INTAKE;
  state = transition({ state, action: CASE_ACTION.TRIAGE, actorRoles: [ROLE.SYSTEM] });
  assert.equal(state, CASE_STATE.TRIAGED);
  state = transition({ state, action: CASE_ACTION.START_MITIGATION, actorRoles: tenant });
  assert.equal(state, CASE_STATE.MITIGATING);
  state = transition({ state, action: CASE_ACTION.DISPATCH, actorRoles: dispatcher });
  assert.equal(state, CASE_STATE.DISPATCHED);
  state = transition({ state, action: CASE_ACTION.ACCEPT_JOB, actorRoles: [ROLE.CONTRACTOR] });
  assert.equal(state, CASE_STATE.IN_PROGRESS);
  state = transition({ state, action: CASE_ACTION.RESOLVE, actorRoles: [ROLE.CONTRACTOR] });
  assert.equal(state, CASE_STATE.RESOLVED);
  state = transition({ state, action: CASE_ACTION.CLOSE, actorRoles: dispatcher });
  assert.equal(state, CASE_STATE.CLOSED);
});

test('dispatching a case that is still being mitigated is allowed', () => {
  assert.equal(
    transition({ state: CASE_STATE.MITIGATING, action: CASE_ACTION.DISPATCH, actorRoles: dispatcher }),
    CASE_STATE.DISPATCHED,
  );
});

test('a tenant cannot dispatch their own contractor', () => {
  assert.throws(
    () => transition({ state: CASE_STATE.TRIAGED, action: CASE_ACTION.DISPATCH, actorRoles: tenant }),
    /tenant may not run 'dispatch'/,
  );
});

test('a contractor cannot close a case', () => {
  assert.throws(
    () => transition({ state: CASE_STATE.RESOLVED, action: CASE_ACTION.CLOSE, actorRoles: [ROLE.CONTRACTOR] }),
    /contractor may not run 'close'/,
  );
});

test('a case cannot be triaged twice', () => {
  assert.throws(
    () => transition({ state: CASE_STATE.TRIAGED, action: CASE_ACTION.TRIAGE, actorRoles: dispatcher }),
    /cannot be moved by 'triage'/,
  );
});

test('a closed case is terminal, even for an admin', () => {
  for (const action of [CASE_ACTION.TRIAGE, CASE_ACTION.DISPATCH, CASE_ACTION.RESOLVE, CASE_ACTION.REOPEN]) {
    assert.throws(
      () => transition({ state: CASE_STATE.CLOSED, action, actorRoles: [ROLE.ADMIN] }),
      /cannot be moved/,
      `${action} should not be possible once closed`,
    );
  }
});

test('work can be reopened before the case is closed', () => {
  assert.equal(
    transition({ state: CASE_STATE.RESOLVED, action: CASE_ACTION.REOPEN, actorRoles: dispatcher }),
    CASE_STATE.IN_PROGRESS,
  );
});

test('cancelling from the open stages lands on closed', () => {
  for (const state of [CASE_STATE.INTAKE, CASE_STATE.TRIAGED, CASE_STATE.MITIGATING, CASE_STATE.DISPATCHED]) {
    assert.equal(transition({ state, action: CASE_ACTION.CANCEL, actorRoles: tenant }), CASE_STATE.CLOSED);
  }
});

test('a job counts against contractor capacity until the work is resolved', () => {
  assert.deepEqual(ACTIVE_JOB_STATES, [CASE_STATE.DISPATCHED, CASE_STATE.IN_PROGRESS]);
});

test('allowed actions are the exact set the API will accept for a role', () => {
  assert.deepEqual(allowedActions(CASE_STATE.TRIAGED, tenant), [
    CASE_ACTION.START_MITIGATION,
    CASE_ACTION.CANCEL,
  ]);
  assert.deepEqual(allowedActions(CASE_STATE.DISPATCHED, [ROLE.CONTRACTOR]), [
    CASE_ACTION.ACCEPT_JOB,
    CASE_ACTION.WITHDRAW,
  ]);
});

test('a declined dispatch sends the case back to the queue, not to closed', () => {
  assert.equal(
    transition({ state: CASE_STATE.DISPATCHED, action: CASE_ACTION.WITHDRAW, actorRoles: [ROLE.CONTRACTOR] }),
    CASE_STATE.TRIAGED,
  );
});

test('an unrecognised action is rejected instead of ignored', () => {
  assert.throws(
    () => transition({ state: CASE_STATE.TRIAGED, action: 'teleport', actorRoles: dispatcher }),
    /Unknown case action: teleport/,
  );
});
