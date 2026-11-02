import mongoose from 'mongoose';

import { TRADES } from '../domain/constants.js';

export const JOB_STATUS = ['open', 'accepted', 'completed', 'declined'];
export const LIVE_JOB_STATUS = ['open', 'accepted'];

const noteSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    author: { id: String, name: String, role: String },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { _id: false },
);

const schema = new mongoose.Schema(
  {
    case: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },
    contractor: { type: mongoose.Schema.Types.ObjectId, ref: 'Contractor', required: true, index: true },
    trade: { type: String, enum: Object.values(TRADES), required: true },
    status: { type: String, enum: JOB_STATUS, default: 'open', index: true },
    severity: { type: String, enum: ['P1', 'P2', 'P3', 'P4'], required: true },
    dueAt: { type: Date, required: true },
    dispatchedAt: { type: Date, default: Date.now },
    acceptedAt: Date,
    completedAt: Date,
    declineReason: { type: String, trim: true, maxlength: 500 },
    workNotes: { type: [noteSchema], default: [] },
    assignedBy: { id: String, name: String, role: String },
  },
  { timestamps: true },
);

// One live work order per case: a dispatcher double-clicking dispatch cannot
// create two contractors chasing the same job.
schema.index(
  { case: 1 },
  { unique: true, partialFilterExpression: { status: { $in: LIVE_JOB_STATUS } }, name: 'uq_live_job_per_case' },
);

export const Job = mongoose.model('Job', schema);
