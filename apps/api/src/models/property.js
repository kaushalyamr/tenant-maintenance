import mongoose from 'mongoose';

const propertySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Property name is required.'],
      trim: true,
      maxlength: [140, 'Property name must be 140 characters or fewer.'],
      index: true,
    },
    street: { type: String, required: [true, 'Street address is required.'], trim: true },
    city: { type: String, required: [true, 'City is required.'], trim: true },
    postcode: { type: String, trim: true, maxlength: 20 },
    timezone: { type: String, required: true, default: 'Asia/Colombo' },
    units: { type: Number, min: 1, max: 5000, default: 1 },
  },
  { timestamps: true },
);

const unitSchema = new mongoose.Schema(
  {
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
    label: {
      type: String,
      required: [true, 'Unit label is required.'],
      trim: true,
      maxlength: [24, 'Unit label must be 24 characters or fewer.'],
    },
    // The dispatch radius a contractor must serve; matching rejects anyone who
    // does not list this zone.
    zone: { type: String, required: [true, 'Coverage zone is required.'], trim: true, index: true },
    occupants: { type: Number, min: 0, max: 40, default: 2 },
    vulnerableOccupants: { type: Boolean, default: false },
    shutoffLocation: { type: String, trim: true, maxlength: 400 },
    shutoffAccessible: { type: String, enum: ['yes', 'no', 'unknown'], default: 'unknown' },
  },
  { timestamps: true },
);

unitSchema.index({ property: 1, label: 1 }, { unique: true });

export const Property = mongoose.model('Property', propertySchema);
export const Unit = mongoose.model('Unit', unitSchema);
