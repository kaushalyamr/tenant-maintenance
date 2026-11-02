import { Router } from 'express';
import { z } from 'zod';

import { requireAuth, requireRole } from '../http/auth.js';
import { asyncHandler } from '../http/errors.js';
import { validateBody, validateParams } from '../http/validate.js';
import {
  createContractor,
  createPropertyWithUnits,
  listContractors,
  listProperties,
  listUnits,
  updateContractor,
} from '../services/registry.js';
import { contractorSchema, propertySchema } from '../validation/schemas.js';

const idParam = validateParams(z.object({ id: z.string().length(24, 'That is not a valid id.') }));

export const registryRouter = Router();

// Tenants must pick their unit while signing up, so the unit list is readable
// before sign-in. It exposes labels and zones only.
registryRouter.get(
  '/units',
  asyncHandler(async (_req, res) => {
    res.json({ units: await listUnits() });
  }),
);

registryRouter.use(requireAuth);

registryRouter.get(
  '/properties',
  asyncHandler(async (_req, res) => {
    res.json({ properties: await listProperties() });
  }),
);

registryRouter.post(
  '/properties',
  requireRole('dispatcher', 'admin'),
  validateBody(propertySchema),
  asyncHandler(async (req, res) => {
    const { property, units } = await createPropertyWithUnits(req.body);
    res.status(201).json({ property: property.toJSON(), units: units.map((unit) => unit.toJSON()) });
  }),
);

registryRouter.get(
  '/contractors',
  requireRole('dispatcher', 'admin'),
  asyncHandler(async (_req, res) => {
    res.json({ contractors: await listContractors() });
  }),
);

registryRouter.post(
  '/contractors',
  requireRole('dispatcher', 'admin'),
  validateBody(contractorSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ contractor: (await createContractor(req.body)).toJSON() });
  }),
);

registryRouter.patch(
  '/contractors/:id',
  idParam,
  requireRole('dispatcher', 'admin'),
  validateBody(contractorSchema.partial()),
  asyncHandler(async (req, res) => {
    res.json({ contractor: (await updateContractor(req.params.id, req.body)).toJSON() });
  }),
);
