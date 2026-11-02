function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optional(name, fallback) {
  return process.env[name] || fallback;
}

function integer(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be an integer, received '${raw}'`);
  return parsed;
}

function float(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number, received '${raw}'`);
  return parsed;
}

function boolean(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw === 'true' || raw === '1';
}

const production = process.env.NODE_ENV === 'production';

export const config = Object.freeze({
  production,
  port: integer('PORT', 4000),
  mongoUri: required('MONGODB_URI'),
  jwt: Object.freeze({
    secret: required('JWT_SECRET'),
    sessionTtlHours: integer('SESSION_TTL_HOURS', 12),
    cookieSecure: boolean('COOKIE_SECURE', production),
  }),
  // The browser and the API are different origins in development, so CORS is
  // restricted to exactly the one front end we expect.
  webOrigin: optional('WEB_ORIGIN', 'http://localhost:3000'),
  evidence: Object.freeze({
    dir: optional('EVIDENCE_DIR', './storage/evidence'),
    maxBytes: integer('EVIDENCE_MAX_BYTES', 15_728_640),
  }),
  triage: Object.freeze({
    version: optional('TRIAGE_VERSION', 'triage-v1'),
    escalationThreshold: float('TRIAGE_ESCALATION_THRESHOLD', 0.6),
  }),
});
