import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

// Point the app at a throwaway database before anything reads the config.
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/tenant_maintenance_test';
process.env.JWT_SECRET = 'integration-test-secret';
process.env.WEB_ORIGIN = 'http://localhost:3000';
process.env.EVIDENCE_DIR = './storage/test-evidence';

const { connectDatabase, mongoose } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { hashPassword } = await import('../src/http/auth.js');
const { Case } = await import('../src/models/case.js');
const { Contractor } = await import('../src/models/contractor.js');
const { Job } = await import('../src/models/job.js');
const { Property, Unit } = await import('../src/models/property.js');
const { User } = await import('../src/models/user.js');

const PASSWORD = 'tenant1234';
let server;
let base;

const DAY = 86_400_000;
const inDays = (n) => new Date(Date.now() + n * DAY);

const SIGNALS = {
  waterPresent: true,
  flow: 'gushing',
  spreading: true,
  nearElectrical: false,
  ceilingOrWallDamage: false,
  sourceKnown: true,
  hotWaterOrBrown: false,
  sewage: false,
  gasOrSmoke: false,
  shutoffAccessible: 'yes',
  vulnerableOccupant: false,
  affectedUnits: 1,
};

let units;
let cookies;

before(async () => {
  await connectDatabase();
  await mongoose.connection.dropDatabase();

  const property = await Property.create({ name: 'Test Court', street: '1 Test Lane', city: 'Colombo', timezone: 'Asia/Colombo' });
  const created = await Unit.create([
    { property: property._id, label: 'T-1', zone: 'north-block', shutoffLocation: 'Riser cupboard', shutoffAccessible: 'yes' },
    { property: property._id, label: 'T-2', zone: 'north-block', shutoffLocation: 'Under the sink', shutoffAccessible: 'yes' },
  ]);
  units = { a: created[0], b: created[1] };

  const good = await Contractor.create({
    name: 'Test Plumbers',
    contactEmail: 'jobs@testplumbers.test',
    phone: '+94 77 000 0001',
    trades: ['plumbing'],
    licenceNumber: 'PL-9001',
    licenceExpiresAt: inDays(200),
    insuranceExpiresAt: inDays(200),
    status: 'active',
    maxConcurrentJobs: 2,
    avgResponseMinutes: 30,
    rating: 4.5,
    coverageZones: ['north-block'],
  });
  const lapsed = await Contractor.create({
    name: 'Lapsed Plumbers',
    contactEmail: 'jobs@lapsed.test',
    phone: '+94 77 000 0002',
    trades: ['plumbing'],
    licenceNumber: 'PL-0000',
    licenceExpiresAt: inDays(-5),
    insuranceExpiresAt: inDays(100),
    status: 'active',
    maxConcurrentJobs: 2,
    avgResponseMinutes: 30,
    rating: 4.5,
    coverageZones: ['north-block'],
  });

  const passwordHash = hashPassword(PASSWORD);
  await User.create([
    { name: 'Tenant A', email: 'a@test.test', phone: '+94 77 111 1111', role: 'tenant', unit: units.a._id, passwordHash },
    { name: 'Tenant B', email: 'b@test.test', phone: '+94 77 222 2222', role: 'tenant', unit: units.b._id, passwordHash },
    { name: 'Dispatcher', email: 'desk@test.test', role: 'dispatcher', passwordHash },
    { name: 'Ops', email: 'ops@testplumbers.test', role: 'contractor', contractor: good._id, passwordHash },
  ]);
  test.contractors = { good: String(good._id), lapsed: String(lapsed._id) };

  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;

  cookies = {
    tenantA: await login('a@test.test'),
    tenantB: await login('b@test.test'),
    dispatcher: await login('desk@test.test'),
  };
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  server?.close();
});

async function login(email) {
  const response = await call('/api/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
  assert.equal(response.status, 200, `login failed for ${email}`);
  return response.headers.get('set-cookie').split(';')[0];
}

function call(path, { method = 'GET', body, cookie } = {}) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function raiseCase(cookie, unitId = units.a._id, signals = SIGNALS) {
  const response = await call('/api/cases', { method: 'POST', cookie, body: { unitId: String(unitId), signals } });
  assert.equal(response.status, 201);
  return (await response.json()).case;
}

test('an unauthenticated request is refused before any work is done', async () => {
  const response = await call('/api/cases');
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, 'unauthorized');
});

test('the server rejects an incomplete intake with per-field messages', async () => {
  const response = await call('/api/cases', {
    method: 'POST',
    cookie: cookies.tenantA,
    body: { unitId: String(units.a._id), signals: { waterPresent: true } },
  });

  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.code, 'validation_failed');
  assert.ok(payload.details.some((detail) => detail.field === 'signals.flow'));
});

test('a tenant never sees another tenant’s case', async () => {
  const tenantCase = await raiseCase(cookies.tenantA);

  const own = await call(`/api/cases/${tenantCase._id}`, { cookie: cookies.tenantA });
  assert.equal(own.status, 200);

  const theirs = await call(`/api/cases/${tenantCase._id}`, { cookie: cookies.tenantB });
  assert.equal(theirs.status, 403);

  const list = await (await call('/api/cases', { cookie: cookies.tenantB })).json();
  assert.equal(list.cases.length, 0);
});

test('a tenant cannot dispatch their own job', async () => {
  const tenantCase = await raiseCase(cookies.tenantA);
  const response = await call(`/api/cases/${tenantCase._id}/dispatch`, {
    method: 'POST',
    cookie: cookies.tenantA,
    body: { contractorId: test.contractors.good },
  });
  assert.equal(response.status, 403);
});

test('the matcher refuses a contractor whose licence has lapsed', async () => {
  const tenantCase = await raiseCase(cookies.tenantA);

  const matches = await (await call(`/api/cases/${tenantCase._id}/matches`, { cookie: cookies.dispatcher })).json();
  assert.deepEqual(
    matches.rejected.map((item) => item.code),
    ['licence_expired'],
  );

  const response = await call(`/api/cases/${tenantCase._id}/dispatch`, {
    method: 'POST',
    cookie: cookies.dispatcher,
    body: { contractorId: test.contractors.lapsed },
  });
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /expired/i);
});

test('a case can hold only one live work order at a time', async () => {
  const tenantCase = await raiseCase(cookies.tenantA);

  const first = await call(`/api/cases/${tenantCase._id}/dispatch`, {
    method: 'POST',
    cookie: cookies.dispatcher,
    body: { contractorId: test.contractors.good },
  });
  assert.equal(first.status, 201);

  const second = await call(`/api/cases/${tenantCase._id}/dispatch`, {
    method: 'POST',
    cookie: cookies.dispatcher,
    body: { contractorId: test.contractors.good },
  });
  assert.equal(second.status, 409);

  const live = await Job.countDocuments({ case: tenantCase._id, status: { $in: ['open', 'accepted'] } });
  assert.equal(live, 1);

  const stored = await Case.findById(tenantCase._id);
  assert.equal(stored.status, 'dispatched');
  assert.equal(stored.events.at(-1).type, 'case.dispatch');
});
