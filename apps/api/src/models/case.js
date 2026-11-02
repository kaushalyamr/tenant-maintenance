import mongoose from 'mongoose';

import { CASE_STATES } from '../domain/case-state-machine.js';
import { CLASSIFICATION, FLOW, SEVERITY, SHUTOFF, TRADES } from '../domain/constants.js';

const reasonSchema = new mongoose.Schema(
  { ruleId: { type: String, required: true }, text: { type: String, required: true } },
  { _id: false },
);

// Every intake answer the voice agent collects is stored with its own type, so a
// case can be re-read years later without guessing what `true` meant.
const signalsSchema = new mongoose.Schema(
  {
    waterPresent: { type: Boolean, required: true },
    flow: { type: String, enum: Object.values(FLOW), required: true },
    spreading: { type: Boolean, required: true },
    nearElectrical: { type: Boolean, required: true },
    ceilingOrWallDamage: { type: Boolean, required: true },
    sourceKnown: { type: Boolean, required: true },
    hotWaterOrBrown: { type: Boolean, required: true },
    sewage: { type: Boolean, required: true },
    gasOrSmoke: { type: Boolean, required: true },
    shutoffAccessible: { type: String, enum: Object.values(SHUTOFF), required: true },
    vulnerableOccupant: { type: Boolean, required: true },
    affectedUnits: { type: Number, required: true, min: 1, max: 5000 },
    evidenceUploaded: { type: Boolean, required: true, default: false },
    callerSummary: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: false },
);

const triageSchema = new mongoose.Schema(
  {
    version: { type: String, required: true },
    mitigationVersion: { type: String, required: true },
    classification: { type: String, enum: Object.values(CLASSIFICATION), required: true },
    severity: { type: String, enum: Object.values(SEVERITY), required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    escalationThreshold: { type: Number, required: true, min: 0, max: 1 },
    escalateToHuman: { type: Boolean, required: true },
    dispatchWindowMinutes: { type: Number, required: true, min: 1 },
    requiredTrades: { type: [{ type: String, enum: Object.values(TRADES) }], default: [] },
    mitigationScriptIds: { type: [String], default: [] },
    matchedRuleIds: { type: [String], default: [] },
    reasons: { type: [reasonSchema], default: [] },
    followUpQuestions: { type: [String], default: [] },
  },
  { _id: false },
);

const stepConfirmationSchema = new mongoose.Schema(
  {
    stepId: { type: String, required: true },
    instruction: { type: String, required: true },
    confirmation: { type: String, enum: ['done', 'observed'], required: true },
    confirmedAt: { type: Date, default: Date.now },
    confirmedBy: { id: String, name: String, role: String },
  },
  { _id: false },
);

const mitigationSchema = new mongoose.Schema({
  scriptId: { type: String, required: true },
  title: { type: String, required: true },
  acknowledgedAt: { type: Date, default: Date.now },
  acknowledgedBy: { id: String, name: String, role: String },
  steps: { type: [stepConfirmationSchema], default: [] },
});

const evidenceSchema = new mongoose.Schema({
  kind: { type: String, enum: ['photo', 'video', 'note'], required: true },
  originalName: { type: String, required: true },
  // Null for a typed note; only photo and video evidence has a stored file.
  storedName: { type: String, default: null },
  mime: { type: String, required: true },
  bytes: { type: Number, required: true, min: 1 },
  sha256: { type: String, required: true },
  description: { type: String, trim: true, maxlength: 500 },
  capturedAt: { type: Date, default: Date.now },
  uploadedBy: { id: String, name: String, role: String },
});

// Snapshot of the shortlist at the moment of dispatch: if a licence lapses the
// next week, the audit trail still shows who was eligible when the choice was made.
const dispatchSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    windowMinutes: { type: Number, required: true },
    dueAt: { type: Date, required: true },
    requiredTrades: { type: [String], default: [] },
    zone: { type: String },
    selected: { contractorId: String, name: String, score: Number, matchedTrades: [String] },
    considered: { type: Number, default: 0 },
    rejectedCount: { type: Number, default: 0 },
    by: { id: String, name: String, role: String },
  },
  { _id: false },
);

const eventSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    type: { type: String, required: true },
    actor: { id: String, name: String, role: String },
    data: { type: Object, default: {} },
  },
  { _id: true },
);

const schema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: CASE_STATES, required: true, default: 'intake', index: true },
    channel: { type: String, enum: ['voice', 'web'], default: 'voice' },
    escalated: { type: Boolean, default: false, index: true },
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
    unit: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true, index: true },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reportedByName: { type: String, required: true },
    reporterPhone: { type: String, trim: true, maxlength: 32 },
    intake: { type: signalsSchema, required: true },
    triage: { type: triageSchema },
    triagedAt: Date,
    mitigation: { type: [mitigationSchema], default: [] },
    evidence: { type: [evidenceSchema], default: [] },
    dispatch: { type: dispatchSchema },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    events: { type: [eventSchema], default: [] },
    outcome: { type: String, trim: true, maxlength: 2000 },
    resolvedAt: Date,
    closedAt: Date,
  },
  { timestamps: true },
);

schema.index({ status: 1, createdAt: -1 });
schema.index({ escalated: 1, status: 1 });

export const Case = mongoose.model('Case', schema);
