import mongoose from 'mongoose';

import { TRADES } from '../domain/constants.js';

export const CONTRACTOR_STATUS = ['active', 'pending', 'suspended'];

const schema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Business name is required.'],
      trim: true,
      maxlength: [140, 'Business name must be 140 characters or fewer.'],
      index: true,
    },
    contactEmail: {
      type: String,
      required: [true, 'Contact email is required.'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Enter a valid contact email address.'],
    },
    phone: { type: String, required: [true, 'Phone is required.'], trim: true, maxlength: 32 },
    trades: {
      type: [{ type: String, enum: Object.values(TRADES) }],
      validate: [(value) => value.length > 0, 'Select at least one licensed trade.'],
    },
    licenceNumber: { type: String, required: [true, 'Licence number is required.'], trim: true, maxlength: 60 },
    licenceExpiresAt: { type: Date, required: [true, 'Licence expiry date is required.'] },
    insuranceExpiresAt: { type: Date, required: [true, 'Insurance expiry date is required.'] },
    status: { type: String, enum: CONTRACTOR_STATUS, default: 'pending', index: true },
    maxConcurrentJobs: { type: Number, required: true, min: 1, max: 50, default: 4 },
    avgResponseMinutes: { type: Number, required: true, min: 5, max: 1440, default: 120 },
    rating: { type: Number, min: 0, max: 5, default: 4.5 },
    coverageZones: {
      type: [String],
      required: [true, 'List the zones this contractor serves.'],
      validate: [(value) => value.length > 0, 'List at least one coverage zone.'],
    },
  },
  { timestamps: true },
);

// The matching engine is pure, so the document is flattened here and the live
// job count is passed in by the caller rather than trusted from the document.
schema.methods.toMatchInput = function toMatchInput(activeJobs = 0) {
  return {
    id: String(this._id),
    name: this.name,
    status: this.status,
    trades: this.trades,
    licenceNumber: this.licenceNumber,
    licenceExpiresAt: this.licenceExpiresAt,
    insuranceExpiresAt: this.insuranceExpiresAt,
    activeJobs,
    maxConcurrentJobs: this.maxConcurrentJobs,
    avgResponseMinutes: this.avgResponseMinutes,
    rating: this.rating,
    coverageZones: this.coverageZones,
  };
};

export const Contractor = mongoose.model('Contractor', schema);
