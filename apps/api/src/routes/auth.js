import { Router } from 'express';

import { COOKIE_NAME, cookieOptions, requireAuth, requireRole, signToken } from '../http/auth.js';
import { asyncHandler } from '../http/errors.js';
import { validateBody } from '../http/validate.js';
import { createStaffAccount, describeSession, login, registerTenant } from '../services/auth.js';
import { staffSchema, loginSchema, registerSchema } from '../validation/schemas.js';

export const authRouter = Router();

authRouter.post(
  '/register',
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { user, token } = await registerTenant(req.body);
    res.cookie(COOKIE_NAME, token, cookieOptions()).status(201).json({ user: user.toJSON() });
  }),
);

authRouter.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { user, token } = await login(req.body);
    res.cookie(COOKIE_NAME, token, cookieOptions()).json({ user: user.toJSON() });
  }),
);

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' }).json({ signedOut: true });
});

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: await describeSession(req.user.id) });
  }),
);

authRouter.post(
  '/staff',
  requireAuth,
  requireRole('admin'),
  validateBody(staffSchema),
  asyncHandler(async (req, res) => {
    const user = await createStaffAccount(req.body);
    res.status(201).json({ user: user.toJSON(), token: signToken(user) });
  }),
);
