import mongoose from 'mongoose';
import { Router } from 'express';

import { config } from '../config.js';
import { AGGRAVATORS_V1, RULES_V1 } from '../domain/triage-v1.js';
import { requireAuth, requireRole } from '../http/auth.js';
import { asyncHandler } from '../http/errors.js';
import { MITIGATION_SCRIPTS, SCRIPT_ORDER } from '../domain/mitigation.js';
import { interpretRelay, relayDirectives } from '../services/conversation-relay.js';

export const metaRouter = Router();

metaRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    res.json({
      status: mongoose.connection.readyState === 1 ? 'ok' : 'degraded',
      database: mongoose.connection.readyState === 1 ? 'connected' : 'offline',
      triage: config.triage,
    });
  }),
);

metaRouter.get(
  '/mitigation-scripts',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json({
      order: SCRIPT_ORDER,
      scripts: SCRIPT_ORDER.map((id) => MITIGATION_SCRIPTS[id]),
    });
  }),
);

// Exposing the ruleset keeps the automation explainable: anyone signed in can
// read why a call was graded the way it was.
metaRouter.get(
  '/triage-rules',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json({
      version: config.triage.version,
      escalationThreshold: config.triage.escalationThreshold,
      rules: RULES_V1.map(({ id, priority, classification, severity, confidence, trades, scripts, reason }) => ({
        id,
        priority,
        classification,
        severity,
        confidence,
        trades,
        scripts,
        reason,
      })),
      aggravators: AGGRAVATORS_V1.map(({ id, severity, trades, scripts, reason }) => ({
        id,
        severity,
        trades,
        scripts,
        reason,
      })),
    });
  }),
);

// Contract endpoint for a telephony bridge: a transcript (or structured answers)
// in, speak/guide/ask/transfer directives out. See docs/conversation-relay.md.
metaRouter.post(
  '/call/relay',
  requireAuth,
  requireRole('dispatcher', 'admin'),
  asyncHandler(async (req, res) => {
    const interpreted = interpretRelay(req.body);
    res.json({ ...interpreted, ...relayDirectives(interpreted.signals, config.triage) });
  }),
);
