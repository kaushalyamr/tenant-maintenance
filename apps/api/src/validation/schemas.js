import { z } from 'zod';

import { CASE_STATES } from '../domain/case-state-machine.js';
import { FLOW, SEVERITY, SHUTOFF, TRADES } from '../domain/constants.js';
import { CONTRACTOR_STATUS } from '../models/contractor.js';
import { ROLES } from '../models/user.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const email = z
  .string()
  .trim()
  .min(3)
  .max(160)
  .regex(EMAIL_PATTERN, 'Enter a valid email address.');
const phone = z.string().trim().regex(/^\+?[\d\s-]{7,20}$/, 'Enter a reachable phone number.');

export const loginSchema = z.object({
  email,
  password: z.string().min(8, 'Passwords are at least 8 characters.'),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email,
  phone,
  password: z.string().min(10, 'Choose a password of at least 10 characters.').max(200),
  unitId: z.string().length(24, 'Select the unit you live in.'),
});

export const staffSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email,
  password: z.string().min(10).max(200),
  role: z.enum(ROLES.filter((r) => r !== 'tenant')),
  contractorId: z.string().length(24).optional(),
});

export const signalsSchema = z.object({
  waterPresent: z.boolean({ message: 'Answer whether water is present.' }),
  flow: z.enum([FLOW.NONE, FLOW.DRIP, FLOW.STEADY, FLOW.GUSHING, FLOW.POOLING, FLOW.UNSURE]),
  spreading: z.boolean(),
  nearElectrical: z.boolean(),
  ceilingOrWallDamage: z.boolean(),
  sourceKnown: z.boolean(),
  hotWaterOrBrown: z.boolean(),
  sewage: z.boolean(),
  gasOrSmoke: z.boolean(),
  shutoffAccessible: z.enum([SHUTOFF.YES, SHUTOFF.NO, SHUTOFF.UNKNOWN]),
  vulnerableOccupant: z.boolean(),
  affectedUnits: z.coerce.number().int().min(1).max(5000),
  callerSummary: z.string().trim().max(1000).optional(),
});

export const intakeSchema = z.object({
  unitId: z.string().length(24, 'Choose the affected unit.'),
  channel: z.enum(['voice', 'web']).default('voice'),
  reporterPhone: phone.optional(),
  signals: signalsSchema,
});

export const scriptAckSchema = z.object({ scriptId: z.string().min(1).max(60) });

export const stepConfirmSchema = z.object({
  scriptId: z.string().min(1).max(60),
  stepId: z.string().min(1).max(60),
});

export const evidenceNoteSchema = z.object({
  description: z.string().trim().min(3, 'Describe what the photo shows.').max(500),
  kind: z.enum(['photo', 'video', 'note']).default('photo'),
});

export const dispatchSchema = z.object({ contractorId: z.string().length(24, 'Choose a contractor.') });

export const jobNoteSchema = z.object({ body: z.string().trim().min(3).max(2000) });

export const declineSchema = z.object({
  reason: z.string().trim().min(5, 'Tell the dispatcher why you cannot take this job.').max(500),
});

export const outcomeSchema = z.object({ outcome: z.string().trim().min(5).max(2000) });

export const caseListSchema = z
  .object({
    status: z.enum(CASE_STATES).optional(),
    severity: z.enum([SEVERITY.P1, SEVERITY.P2, SEVERITY.P3, SEVERITY.P4]).optional(),
    escalated: z.enum(['true', 'false']).optional(),
    q: z.string().trim().max(80).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const propertySchema = z.object({
  name: z.string().trim().min(2).max(140),
  street: z.string().trim().min(3).max(200),
  city: z.string().trim().min(1).max(120),
  postcode: z.string().trim().max(20).optional(),
  timezone: z.string().trim().min(1).max(60).default('Asia/Colombo'),
  units: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(24),
        zone: z.string().trim().min(1).max(60),
        occupants: z.coerce.number().int().min(0).max(40).default(2),
        vulnerableOccupants: z.boolean().default(false),
        shutoffLocation: z.string().trim().max(400).optional(),
        shutoffAccessible: z.enum([SHUTOFF.YES, SHUTOFF.NO, SHUTOFF.UNKNOWN]).default('unknown'),
      }),
    )
    .min(1, 'Add at least one unit.')
    .max(200),
});

export const contractorSchema = z.object({
  name: z.string().trim().min(2).max(140),
  contactEmail: email,
  phone,
  trades: z.array(z.enum(Object.values(TRADES))).min(1, 'Select at least one licensed trade.'),
  licenceNumber: z.string().trim().min(3).max(60),
  licenceExpiresAt: z.coerce.date(),
  insuranceExpiresAt: z.coerce.date(),
  status: z.enum(CONTRACTOR_STATUS).default('active'),
  maxConcurrentJobs: z.coerce.number().int().min(1).max(50).default(4),
  avgResponseMinutes: z.coerce.number().int().min(5).max(1440).default(120),
  rating: z.coerce.number().min(0).max(5).default(4.5),
  coverageZones: z.array(z.string().trim().min(1).max(60)).min(1, 'List at least one coverage zone.'),
});
