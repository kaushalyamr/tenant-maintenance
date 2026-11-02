import { createReadStream } from 'node:fs';
import { Router } from 'express';
import { z } from 'zod';

import { CASE_ACTION } from '../domain/case-state-machine.js';
import { requireAuth, requireRole } from '../http/auth.js';
import { asyncHandler } from '../http/errors.js';
import { validateBody, validateParams, validateQuery } from '../http/validate.js';
import {
  acknowledgeScript,
  confirmStep,
  createCase,
  escalateCase,
  listCases,
  loadAccessibleCase,
  moveCase,
  reassessCase,
} from '../services/cases.js';
import { dispatchCase, shortlistForCase } from '../services/dispatch.js';
import { attachEvidence, evidenceFile, evidenceUpload } from '../services/evidence.js';
import {
  caseListSchema,
  dispatchSchema,
  evidenceNoteSchema,
  intakeSchema,
  outcomeSchema,
  scriptAckSchema,
  stepConfirmSchema,
} from '../validation/schemas.js';

const idParam = validateParams(z.object({ id: z.string().length(24, 'That is not a case reference.') }));

export const caseRouter = Router();

caseRouter.use(requireAuth);

caseRouter.post(
  '/',
  requireRole('tenant', 'dispatcher'),
  validateBody(intakeSchema),
  asyncHandler(async (req, res) => {
    const doc = await createCase(req.body, req.user);
    res.status(201).json({ case: doc.toJSON() });
  }),
);

caseRouter.get(
  '/',
  validateQuery(caseListSchema),
  asyncHandler(async (req, res) => {
    res.json({ cases: await listCases(req.query, req.user) });
  }),
);

caseRouter.get(
  '/:id',
  idParam,
  asyncHandler(async (req, res) => {
    res.json({ case: (await loadAccessibleCase(req.params.id, req.user)).toJSON() });
  }),
);

caseRouter.post(
  '/:id/reassess',
  idParam,
  asyncHandler(async (req, res) => {
    res.json({ case: (await reassessCase(req.params.id, req.user)).toJSON() });
  }),
);

caseRouter.post(
  '/:id/mitigation/acknowledge',
  idParam,
  validateBody(scriptAckSchema),
  asyncHandler(async (req, res) => {
    const doc = await acknowledgeScript(req.params.id, req.body, req.user);
    res.json({ case: doc.toJSON() });
  }),
);

caseRouter.post(
  '/:id/mitigation/steps',
  idParam,
  validateBody(stepConfirmSchema),
  asyncHandler(async (req, res) => {
    const doc = await confirmStep(req.params.id, req.body, req.user);
    res.json({ case: doc.toJSON() });
  }),
);

caseRouter.post(
  '/:id/evidence',
  idParam,
  evidenceUpload.single('evidence'),
  validateBody(evidenceNoteSchema),
  asyncHandler(async (req, res) => {
    const doc = await attachEvidence(req.params.id, req.user, req.file, req.body);
    res.status(201).json({ case: doc.toJSON() });
  }),
);

caseRouter.get(
  '/:id/evidence/:evidenceId',
  idParam,
  asyncHandler(async (req, res) => {
    const item = await evidenceFile(req.params.id, req.params.evidenceId, req.user);
    res.setHeader('Content-Type', item.mime);
    res.setHeader('Content-Length', item.bytes);
    res.setHeader('Cache-Control', 'private, max-age=300');
    createReadStream(item.path).on('error', () => res.destroy()).pipe(res);
  }),
);

caseRouter.post(
  '/:id/escalate',
  idParam,
  asyncHandler(async (req, res) => {
    const doc = await escalateCase(req.params.id, req.user, req.body?.reason ?? 'Requested from the call screen.');
    res.json({ case: doc.toJSON() });
  }),
);

caseRouter.get(
  '/:id/matches',
  idParam,
  requireRole('dispatcher', 'admin'),
  asyncHandler(async (req, res) => {
    res.json(await shortlistForCase(req.params.id, req.user));
  }),
);

caseRouter.post(
  '/:id/dispatch',
  idParam,
  requireRole('dispatcher', 'admin'),
  validateBody(dispatchSchema),
  asyncHandler(async (req, res) => {
    const { case: doc, job } = await dispatchCase(req.params.id, req.body, req.user);
    res.status(201).json({ case: doc.toJSON(), job: job.toJSON() });
  }),
);

caseRouter.post(
  '/:id/cancel',
  idParam,
  asyncHandler(async (req, res) => {
    const doc = await loadAccessibleCase(req.params.id, req.user);
    await moveCase(doc, CASE_ACTION.CANCEL, req.user, { set: { closedAt: new Date() } });
    res.json({ case: doc.toJSON() });
  }),
);

caseRouter.post(
  '/:id/close',
  idParam,
  requireRole('dispatcher', 'admin'),
  validateBody(outcomeSchema),
  asyncHandler(async (req, res) => {
    const doc = await loadAccessibleCase(req.params.id, req.user);
    await moveCase(doc, CASE_ACTION.CLOSE, req.user, {
      set: { closedAt: new Date(), outcome: req.body.outcome },
    });
    res.json({ case: doc.toJSON() });
  }),
);

caseRouter.post(
  '/:id/reopen',
  idParam,
  requireRole('dispatcher', 'admin'),
  asyncHandler(async (req, res) => {
    const doc = await loadAccessibleCase(req.params.id, req.user);
    await moveCase(doc, CASE_ACTION.REOPEN, req.user, { set: { resolvedAt: null } });
    res.json({ case: doc.toJSON() });
  }),
);
