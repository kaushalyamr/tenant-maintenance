import mongoose from 'mongoose';

// Evidence is stored next to the case when the API has a persistent disk, but
// serverless hosts have none. There the bytes live in their own collection and
// are keyed by the same random stored name the case already points at.
const schema = new mongoose.Schema(
  {
    storedName: { type: String, required: true, unique: true },
    mime: { type: String, required: true },
    bytes: { type: Number, required: true, min: 1 },
    data: { type: Buffer, required: true },
  },
  { timestamps: true },
);

export const EvidenceFile = mongoose.model('EvidenceFile', schema);
