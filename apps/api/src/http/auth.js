import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';

import { config } from '../config.js';
import { User } from '../models/user.js';
import { ForbiddenError, UnauthorizedError } from './errors.js';

const KEYLEN = 64;
export const COOKIE_NAME = 'tm_session';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, KEYLEN, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt}$${derived.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [scheme, n, r, p, salt, hash] = String(stored).split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const derived = scryptSync(password, salt, KEYLEN, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  const expected = Buffer.from(hash, 'hex');
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role, name: user.name }, config.jwt.secret, {
    expiresIn: `${config.jwt.sessionTtlHours}h`,
    algorithm: 'HS256',
  });
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.jwt.cookieSecure,
    path: '/',
    maxAge: config.jwt.sessionTtlHours * 3600 * 1000,
  };
}

function tokenFrom(req) {
  const header = req.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return req.cookies?.[COOKIE_NAME] ?? null;
}

async function resolveUser(token) {
  const claims = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
  const user = await User.findById(claims.sub).lean();
  if (!user || !user.active) throw new UnauthorizedError('That session is no longer valid. Sign in again.');
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    unitId: user.unit ? String(user.unit) : null,
    contractorId: user.contractor ? String(user.contractor) : null,
  };
}

export async function requireAuth(req, _res, next) {
  try {
    const token = tokenFrom(req);
    if (!token) throw new UnauthorizedError('Sign in to continue.');
    req.user = await resolveUser(token);
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) return next(error);
    next(new UnauthorizedError('Sign in again — this session has expired.'));
  }
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new UnauthorizedError());
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError(`${req.user.role} accounts cannot do this. Needs: ${roles.join(' or ')}.`));
    }
    next();
  };
}
