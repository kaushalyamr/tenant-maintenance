import { hashPassword, signToken, verifyPassword } from '../http/auth.js';
import { UnauthorizedError, ValidationError, ConflictError, NotFoundError } from '../http/errors.js';
import { Contractor } from '../models/contractor.js';
import { User } from '../models/user.js';
import { Unit } from '../models/property.js';

export async function registerTenant(input) {
  const unit = await Unit.findById(input.unitId).populate('property', 'name');
  if (!unit) throw new NotFoundError('That unit is not in the property register.');
  if (await User.exists({ email: input.email.toLowerCase() })) {
    throw new ConflictError('An account already uses that email address.');
  }

  const user = await User.create({
    name: input.name,
    email: input.email,
    phone: input.phone,
    passwordHash: hashPassword(input.password),
    role: 'tenant',
    unit: unit._id,
  });
  return { user, token: signToken(user) };
}

export async function login({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  // The same message for a bad address and a bad password keeps sign-in probing quiet.
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new UnauthorizedError('Email or password is incorrect.');
  }
  if (!user.active) throw new UnauthorizedError('This account has been deactivated.');
  return { user, token: signToken(user) };
}

export async function createStaffAccount(input) {
  if (await User.exists({ email: input.email.toLowerCase() })) {
    throw new ConflictError('An account already uses that email address.');
  }
  if (input.role === 'contractor') {
    if (!input.contractorId) throw new ValidationError('A contractor account must be linked to a registered business.');
    if (!(await Contractor.exists({ _id: input.contractorId }))) throw new NotFoundError('That contractor is not registered.');
  }
  const user = await User.create({
    name: input.name,
    email: input.email,
    passwordHash: hashPassword(input.password),
    role: input.role,
    contractor: input.role === 'contractor' ? input.contractorId : undefined,
  });
  return user;
}

export async function describeSession(userId) {
  const user = await User.findById(userId).populate('unit').populate('contractor', 'name trades');
  if (!user) throw new UnauthorizedError('Sign in to continue.');
  return user.toJSON();
}
