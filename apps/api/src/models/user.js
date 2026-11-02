import mongoose from 'mongoose';

export const ROLES = ['tenant', 'dispatcher', 'contractor', 'admin'];

const schema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required.'],
      trim: true,
      maxlength: [120, 'Name must be 120 characters or fewer.'],
    },
    email: {
      type: String,
      required: [true, 'Email is required.'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Enter a valid email address.'],
    },
    phone: { type: String, trim: true, maxlength: [32, 'Phone numbers must be 32 characters or fewer.'] },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'tenant', index: true },
    unit: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit' },
    contractor: { type: mongoose.Schema.Types.ObjectId, ref: 'Contractor' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

schema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', schema);
