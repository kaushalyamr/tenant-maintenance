import { NotFoundError } from '../http/errors.js';
import { Contractor } from '../models/contractor.js';
import { Property, Unit } from '../models/property.js';

export async function createPropertyWithUnits(input) {
  const property = await Property.create({
    name: input.name,
    street: input.street,
    city: input.city,
    postcode: input.postcode,
    timezone: input.timezone,
    units: input.units.length,
  });

  const units = await Unit.insertMany(
    input.units.map((unit) => ({ ...unit, property: property._id })),
  );
  return { property, units };
}

export async function listProperties() {
  const properties = await Property.find().sort({ name: 1 }).lean();
  const counts = await Unit.aggregate([{ $group: { _id: '$property', units: { $sum: 1 } } }]);
  const byId = new Map(counts.map((row) => [String(row._id), row.units]));
  return properties.map((property) => ({ ...property, unitCount: byId.get(String(property._id)) ?? 0 }));
}

export async function listUnits() {
  return Unit.find().sort({ label: 1 }).populate('property', 'name city').lean();
}

export const listContractors = () => Contractor.find().sort({ name: 1 }).lean();

export async function createContractor(input) {
  return Contractor.create(input);
}

export async function updateContractor(id, patch) {
  const contractor = await Contractor.findByIdAndUpdate(id, patch, { new: true, runValidators: true });
  if (!contractor) throw new NotFoundError('No contractor with that id.');
  return contractor;
}
