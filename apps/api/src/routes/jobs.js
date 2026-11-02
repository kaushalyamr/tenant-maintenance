import { Router } from 'express';
import { z } from 'zod';

import { requireAuth, requireRole } from '../http/auth.js';
import { asyncHandler } from '../http/errors.js';
import { validateBody, validateParams } from '../http/validate.js';
import { acceptJob, addJobNote, completeJob, declineJob, jobsForContractor } from '../services/dispatch.js';
import { JOB_STATUS } from '../models/job.js';
import { declineSchema, jobNoteSchema, outcomeSchema } from '../validation/schemas.js';

const idParam = validateParams(z.object({ id: z.string().length(24, 'That is not a work order id.') }));
const statusFilter = z.enum(JOB_STATUS);

export const jobRouter = Router();

jobRouter.use(requireAuth);

jobRouter.get(
  '/mine',
  requireRole('contractor'),
  asyncHandler(async (req, res) => {
    const status = req.query.status ? statusFilter.parse(req.query.status) : undefined;
    res.json({ jobs: await jobsForContractor(req.user, status) });
  }),
);

jobRouter.post(
  '/:id/accept',
  idParam,
  requireRole('contractor', 'dispatcher'),
  asyncHandler(async (req, res) => {
    res.json({ job: (await acceptJob(req.params.id, req.user)).toJSON() });
  }),
);

jobRouter.post(
  '/:id/decline',
  idParam,
  requireRole('contractor', 'dispatcher'),
  validateBody(declineSchema),
  asyncHandler(async (req, res) => {
    res.json({ job: (await declineJob(req.params.id, req.user, req.body.reason)).toJSON() });
  }),
);

jobRouter.post(
  '/:id/complete',
  idParam,
  requireRole('contractor', 'dispatcher'),
  validateBody(outcomeSchema),
  asyncHandler(async (req, res) => {
    res.json({ job: (await completeJob(req.params.id, req.user, req.body.outcome)).toJSON() });
  }),
);

jobRouter.post(
  '/:id/notes',
  idParam,
  requireRole('contractor', 'dispatcher'),
  validateBody(jobNoteSchema),
  asyncHandler(async (req, res) => {
    res.json({ job: (await addJobNote(req.params.id, req.user, req.body.body)).toJSON() });
  }),
);
