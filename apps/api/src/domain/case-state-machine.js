export const CASE_STATE = Object.freeze({
  INTAKE: 'intake',
  TRIAGED: 'triaged',
  MITIGATING: 'mitigating',
  DISPATCHED: 'dispatched',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
});

export const CASE_ACTION = Object.freeze({
  TRIAGE: 'triage',
  START_MITIGATION: 'start_mitigation',
  ABORT_MITIGATION: 'abort_mitigation',
  DISPATCH: 'dispatch',
  ACCEPT_JOB: 'accept_job',
  WITHDRAW: 'withdraw',
  RESOLVE: 'resolve',
  REOPEN: 'reopen',
  CLOSE: 'close',
  CANCEL: 'cancel',
});

const ROLE = Object.freeze({
  TENANT: 'tenant',
  DISPATCHER: 'dispatcher',
  CONTRACTOR: 'contractor',
  ADMIN: 'admin',
  SYSTEM: 'system',
});

export { ROLE };

const TRANSITIONS = Object.freeze([
  { action: CASE_ACTION.TRIAGE, from: [CASE_STATE.INTAKE], to: CASE_STATE.TRIAGED, roles: [ROLE.TENANT, ROLE.DISPATCHER, ROLE.SYSTEM] },
  { action: CASE_ACTION.START_MITIGATION, from: [CASE_STATE.TRIAGED], to: CASE_STATE.MITIGATING, roles: [ROLE.TENANT, ROLE.DISPATCHER] },
  { action: CASE_ACTION.ABORT_MITIGATION, from: [CASE_STATE.MITIGATING], to: CASE_STATE.TRIAGED, roles: [ROLE.TENANT, ROLE.DISPATCHER, ROLE.SYSTEM] },
  { action: CASE_ACTION.DISPATCH, from: [CASE_STATE.TRIAGED, CASE_STATE.MITIGATING], to: CASE_STATE.DISPATCHED, roles: [ROLE.DISPATCHER, ROLE.ADMIN] },
  { action: CASE_ACTION.ACCEPT_JOB, from: [CASE_STATE.DISPATCHED], to: CASE_STATE.IN_PROGRESS, roles: [ROLE.CONTRACTOR, ROLE.DISPATCHER] },
  { action: CASE_ACTION.WITHDRAW, from: [CASE_STATE.DISPATCHED], to: CASE_STATE.TRIAGED, roles: [ROLE.DISPATCHER, ROLE.ADMIN, ROLE.CONTRACTOR] },
  { action: CASE_ACTION.RESOLVE, from: [CASE_STATE.IN_PROGRESS], to: CASE_STATE.RESOLVED, roles: [ROLE.CONTRACTOR, ROLE.DISPATCHER] },
  { action: CASE_ACTION.REOPEN, from: [CASE_STATE.RESOLVED], to: CASE_STATE.IN_PROGRESS, roles: [ROLE.DISPATCHER, ROLE.ADMIN] },
  { action: CASE_ACTION.CLOSE, from: [CASE_STATE.RESOLVED], to: CASE_STATE.CLOSED, roles: [ROLE.DISPATCHER, ROLE.ADMIN] },
  {
    action: CASE_ACTION.CANCEL,
    from: [CASE_STATE.INTAKE, CASE_STATE.TRIAGED, CASE_STATE.MITIGATING, CASE_STATE.DISPATCHED],
    to: CASE_STATE.CLOSED,
    roles: [ROLE.TENANT, ROLE.DISPATCHER, ROLE.ADMIN],
  },
]);

// A contractor counts against capacity while a job sits in either of these.
export const ACTIVE_JOB_STATES = Object.freeze([CASE_STATE.DISPATCHED, CASE_STATE.IN_PROGRESS]);

export const CASE_STATES = Object.freeze(Object.values(CASE_STATE));
export const CASE_ACTIONS = Object.freeze(Object.values(CASE_ACTION));

export class IllegalTransitionError extends Error {}
export class NotPermittedError extends Error {}

export function transition({ state, action, actorRoles }) {
  const rule = TRANSITIONS.find((candidate) => candidate.action === action);
  if (!rule) throw new IllegalTransitionError(`Unknown case action: ${action}`);
  if (!rule.from.includes(state)) {
    throw new IllegalTransitionError(
      `A case in state '${state}' cannot be moved by '${action}' (allowed from: ${rule.from.join(', ')})`,
    );
  }
  if (!actorRoles.some((role) => rule.roles.includes(role))) {
    throw new NotPermittedError(`${actorRoles.join(' or ')} may not run '${action}' on a case`);
  }
  return rule.to;
}

export function allowedActions(state, actorRoles) {
  return TRANSITIONS.filter(
    (rule) => rule.from.includes(state) && actorRoles.some((role) => rule.roles.includes(role)),
  ).map((rule) => rule.action);
}
