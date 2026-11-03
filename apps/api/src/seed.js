import { CASE_ACTION } from './domain/case-state-machine.js';
import { hashPassword } from './http/auth.js';
import { Case } from './models/case.js';
import { Contractor } from './models/contractor.js';
import { Job } from './models/job.js';
import { Property, Unit } from './models/property.js';
import { User } from './models/user.js';
import {
  acknowledgeScript,
  confirmStep,
  createCase,
  escalateCase,
  moveCase,
  reassessCase,
} from './services/cases.js';
import { acceptJob, completeJob, dispatchCase } from './services/dispatch.js';
import { attachEvidence } from './services/evidence.js';
import { connectDatabase } from './db.js';

const PASSWORD = process.env.SEED_PASSWORD || 'tenant1234';
const DAY = 86_400_000;
const inDays = (n) => new Date(Date.now() + n * DAY);

const actor = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role,
  unitId: user.unit ? String(user.unit) : null,
  contractorId: user.contractor ? String(user.contractor) : null,
});

await connectDatabase();
await Promise.all([Case.deleteMany({}), Job.deleteMany({}), User.deleteMany({}), Unit.deleteMany({}), Property.deleteMany({}), Contractor.deleteMany({})]);

const { property, units } = await createPropertyWithUnits();
const contractors = await createContractors();
const users = await createUsers(units, contractors);

await buildScenarios(units, contractors, users);

console.log(
  `\nSeeded ${property.name}: ${await Unit.countDocuments()} units, ${await Contractor.countDocuments()} contractors, ${await Case.countDocuments()} cases (${await Case.countDocuments({ escalated: true })} escalated).`,
);
console.log('\nDemo logins (password for all: %s)', PASSWORD);
for (const row of loginTable(users)) console.log(row);

async function createPropertyWithUnits() {
  const property = await Property.create({
    name: 'Green Meadows Apartments',
    street: '42 Ward Place',
    city: 'Colombo',
    postcode: '00560',
    timezone: 'Asia/Colombo',
    units: 6,
  });

  const rows = [
    { label: 'A-101', zone: 'north-block', occupants: 3, vulnerableOccupants: true, shutoffLocation: 'Riser cupboard at the north stairwell, first floor.', shutoffAccessible: 'yes' },
    { label: 'A-202', zone: 'north-block', occupants: 2, shutoffLocation: 'Under the kitchen sink.', shutoffAccessible: 'yes' },
    { label: 'A-302', zone: 'north-block', occupants: 4, shutoffLocation: 'Shared valve pit by the bin store — needs a key.', shutoffAccessible: 'no' },
    { label: 'B-105', zone: 'south-block', occupants: 1, shutoffLocation: 'Meter chamber at the south gate.', shutoffAccessible: 'unknown' },
    { label: 'B-204', zone: 'south-block', occupants: 2, shutoffLocation: 'Plant room, second floor.', shutoffAccessible: 'yes' },
    { label: 'B-310', zone: 'south-block', occupants: 5, vulnerableOccupants: true, shutoffLocation: 'Unknown to the building staff.', shutoffAccessible: 'unknown' },
  ];

  const units = await Unit.insertMany(rows.map((unit) => ({ ...unit, property: property._id })));
  return { property, units: Object.fromEntries(units.map((unit) => [unit.label, unit])) };
}

async function createContractors() {
  const rows = [
    {
      name: 'Rapid Reroute Plumbing',
      contactEmail: 'desk@rapidreroute.test',
      phone: '+94 77 100 2001',
      trades: ['plumbing'],
      licenceNumber: 'PL-4471',
      licenceExpiresAt: inDays(210),
      insuranceExpiresAt: inDays(180),
      status: 'active',
      maxConcurrentJobs: 4,
      avgResponseMinutes: 45,
      rating: 4.6,
      coverageZones: ['north-block', 'south-block'],
    },
    {
      name: 'DrainWorks Clogbusters',
      contactEmail: 'dispatch@drainworks.test',
      phone: '+94 77 100 2002',
      trades: ['drainage', 'plumbing'],
      licenceNumber: 'DR-1180',
      licenceExpiresAt: inDays(400),
      insuranceExpiresAt: inDays(320),
      status: 'active',
      maxConcurrentJobs: 2,
      avgResponseMinutes: 70,
      rating: 4.8,
      coverageZones: ['north-block', 'south-block'],
    },
    {
      name: 'Sparkworks Electrical',
      contactEmail: 'books@sparkworks.test',
      phone: '+94 77 100 2003',
      trades: ['electrical'],
      licenceNumber: 'EL-2205',
      licenceExpiresAt: inDays(150),
      insuranceExpiresAt: inDays(90),
      status: 'active',
      maxConcurrentJobs: 3,
      avgResponseMinutes: 60,
      rating: 4.4,
      coverageZones: ['north-block'],
    },
    {
      // Licence lapsing soon: eligible, but the board must show a renewal warning.
      name: 'Metro Emergency Plumbing',
      contactEmail: 'sos@metroemergency.test',
      phone: '+94 77 100 2004',
      trades: ['plumbing'],
      licenceNumber: 'PL-3310',
      licenceExpiresAt: inDays(18),
      insuranceExpiresAt: inDays(200),
      status: 'active',
      maxConcurrentJobs: 3,
      avgResponseMinutes: 40,
      rating: 4.7,
      coverageZones: ['north-block', 'south-block'],
    },
    {
      // Fully booked: must never be selectable for a new job.
      name: 'Old Town Plumbing',
      contactEmail: 'orders@oldtown.test',
      phone: '+94 77 100 2005',
      trades: ['plumbing', 'general'],
      licenceNumber: 'PL-0902',
      licenceExpiresAt: inDays(90),
      insuranceExpiresAt: inDays(120),
      status: 'active',
      maxConcurrentJobs: 1,
      avgResponseMinutes: 55,
      rating: 4.9,
      coverageZones: ['south-block'],
    },
    {
      // Expired licence: the compliance filter has to reject this business.
      name: 'Retired Trades Co',
      contactEmail: 'hello@retiredtrades.test',
      phone: '+94 77 100 2006',
      trades: ['plumbing'],
      licenceNumber: 'PL-0001',
      licenceExpiresAt: inDays(-14),
      insuranceExpiresAt: inDays(60),
      status: 'active',
      maxConcurrentJobs: 2,
      avgResponseMinutes: 30,
      rating: 5,
      coverageZones: ['north-block', 'south-block'],
    },
    {
      name: 'Harbourview Maintenance',
      contactEmail: 'team@harbourview.test',
      phone: '+94 77 100 2007',
      trades: ['general'],
      licenceNumber: 'GN-7731',
      licenceExpiresAt: inDays(300),
      insuranceExpiresAt: inDays(240),
      status: 'suspended',
      maxConcurrentJobs: 5,
      avgResponseMinutes: 90,
      rating: 3.9,
      coverageZones: ['north-block', 'south-block'],
    },
  ];

  const created = await Contractor.create(rows);
  return Object.fromEntries(created.map((contractor) => [slug(contractor.name), contractor]));
}

function slug(name) {
  return name.toLowerCase().split(' ')[0];
}

async function createUsers(units, contractors) {
  const passwordHash = hashPassword(PASSWORD);
  const rows = [
    { name: 'Nimali Perera', email: 'nimali@greenmeadows.test', role: 'tenant', unit: units['A-101'] },
    { name: 'Farhan Nadeem', email: 'farhan@greenmeadows.test', role: 'tenant', unit: units['B-204'] },
    { name: 'Amara Silva', email: 'amara@greenmeadows.test', role: 'tenant', unit: units['A-302'] },
    { name: 'Kasun Dias', email: 'kasun@greenmeadows.test', role: 'tenant', unit: units['A-202'] },
    { name: 'Priya Bandara', email: 'priya@greenmeadows.test', role: 'tenant', unit: units['B-310'] },
    { name: 'Dilhani Jayasekara', email: 'dispatcher@greenmeadows.test', role: 'dispatcher' },
    { name: 'Building Admin', email: 'admin@greenmeadows.test', role: 'admin' },
    { name: 'Rapid Reroute Desk', email: 'desk@rapidreroute.test', role: 'contractor', contractor: contractors['rapid'] },
    { name: 'DrainWorks Dispatch', email: 'dispatch@drainworks.test', role: 'contractor', contractor: contractors['drainworks'] },
    { name: 'Metro Emergency Desk', email: 'sos@metroemergency.test', role: 'contractor', contractor: contractors['metro'] },
    { name: 'Old Town Orders', email: 'orders@oldtown.test', role: 'contractor', contractor: contractors['old'] },
  ];

  const created = await User.create(
    rows.map(({ unit, contractor, ...user }) => ({
      ...user,
      passwordHash,
      unit: unit?._id,
      contractor: contractor?._id,
    })),
  );
  return Object.fromEntries(created.map((user) => [user.email.split('@')[0], user]));
}

function loginTable(users) {
  const width = Math.max(...Object.values(users).map((user) => user.email.length));
  return Object.values(users).map(
    (user) => `  ${user.email.padEnd(width)}  ${user.role.padEnd(11)} ${user.name}`,
  );
}

async function buildScenarios(units, contractors, users) {
  // 1. Burst pipe beside a socket, tenant cannot reach a valve: P1, escalated,
  //    walked through the shutoff script, then dispatched.
  const burst = actor(users.nimali);
  const burstCase = await createCase(
    {
      unitId: String(units['A-101']._id),
      channel: 'voice',
      reporterPhone: '+94 71 442 8890',
      signals: {
        waterPresent: true,
        flow: 'gushing',
        spreading: true,
        nearElectrical: true,
        ceilingOrWallDamage: true,
        sourceKnown: false,
        hotWaterOrBrown: true,
        sewage: false,
        gasOrSmoke: false,
        shutoffAccessible: 'no',
        vulnerableOccupant: true,
        affectedUnits: 2,
        callerSummary: 'Water spraying from under the kitchen sink and reaching the wall socket, grandmother at home.',
      },
    },
    burst,
  );
  await acknowledgeScript(String(burstCase._id), { scriptId: 'electrical-safety' }, burst);
  await confirmStep(String(burstCase._id), { scriptId: 'electrical-safety', stepId: 'dry-hands-path' }, burst);
  await confirmStep(String(burstCase._id), { scriptId: 'electrical-safety', stepId: 'kill-circuit' }, burst);
  await confirmStep(String(burstCase._id), { scriptId: 'electrical-safety', stepId: 'unplug-safe' }, burst);
  await confirmStep(String(burstCase._id), { scriptId: 'electrical-safety', stepId: 'power-off-confirmed' }, burst);
  await acknowledgeScript(String(burstCase._id), { scriptId: 'stop-water-main-shutoff' }, burst);
  await confirmStep(String(burstCase._id), { scriptId: 'stop-water-main-shutoff', stepId: 'locate-main' }, burst);
  await confirmStep(String(burstCase._id), { scriptId: 'stop-water-main-shutoff', stepId: 'identify-type' }, burst);
  await confirmStep(String(burstCase._id), { scriptId: 'stop-water-main-shutoff', stepId: 'turn-valve' }, burst);
  await confirmStep(String(burstCase._id), { scriptId: 'stop-water-main-shutoff', stepId: 'flow-stopped' }, burst);
  await attachEvidence(String(burstCase._id), burst, null, {
    kind: 'note',
    description: 'Main valve in the north riser cupboard was seized; water still running at the sink.',
  });
  await reassessCase(String(burstCase._id), burst);

  const dispatcher = actor(users.dispatcher);
  const dispatchedBurst = await dispatchCase(String(burstCase._id), { contractorId: String(contractors.rapid._id) }, dispatcher);
  const rapid = actor(users.desk);
  await acceptJob(String(dispatchedBurst.job._id), rapid);

  // 2. Steady leak from the hot-water line: dispatched, completed and resolved,
  //    so the board has a finished job with an audit trail.
  const kasun = actor(users.kasun);
  const steadyCase = await createCase(
    {
      unitId: String(units['A-202']._id),
      channel: 'voice',
      reporterPhone: '+94 71 555 2210',
      signals: {
        waterPresent: true,
        flow: 'steady',
        spreading: true,
        nearElectrical: false,
        ceilingOrWallDamage: false,
        sourceKnown: true,
        hotWaterOrBrown: true,
        sewage: false,
        gasOrSmoke: false,
        shutoffAccessible: 'yes',
        vulnerableOccupant: false,
        affectedUnits: 1,
        callerSummary: 'Hot water running steadily from the joint behind the shower mixer.',
      },
    },
    kasun,
  );
  const dispatchedSteady = await dispatchCase(String(steadyCase._id), { contractorId: String(contractors.rapid._id) }, dispatcher);
  await acceptJob(String(dispatchedSteady.job._id), rapid);
  await completeJob(
    String(dispatchedSteady.job._id),
    rapid,
    'Replaced the failed compression union behind the shower mixer and pressure-tested the line for ten minutes.',
  );

  // 3. Sewage backup: escalated and waiting for a drainage contractor.
  const amara = actor(users.amara);
  const sewageCase = await createCase(
    {
      unitId: String(units['A-302']._id),
      channel: 'voice',
      reporterPhone: '+94 71 208 4413',
      signals: {
        waterPresent: true,
        flow: 'pooling',
        spreading: true,
        nearElectrical: false,
        ceilingOrWallDamage: false,
        sourceKnown: false,
        hotWaterOrBrown: false,
        sewage: true,
        gasOrSmoke: false,
        shutoffAccessible: 'no',
        vulnerableOccupant: true,
        affectedUnits: 6,
        callerSummary: 'Toilet water backing up onto the bathroom floor, four people living in the unit.',
      },
    },
    amara,
  );
  await acknowledgeScript(String(sewageCase._id), { scriptId: 'sewage-avoid-contact' }, amara);
  await confirmStep(String(sewageCase._id), { scriptId: 'sewage-avoid-contact', stepId: 'stop-drains' }, amara);

  // 4. A contained drip: triaged as routine and left on the board for scheduling.
  const farhan = actor(users.farhan);
  await createCase(
    {
      unitId: String(units['B-204']._id),
      channel: 'web',
      reporterPhone: '+94 76 909 1120',
      signals: {
        waterPresent: true,
        flow: 'drip',
        spreading: false,
        nearElectrical: false,
        ceilingOrWallDamage: false,
        sourceKnown: true,
        hotWaterOrBrown: false,
        sewage: false,
        gasOrSmoke: false,
        shutoffAccessible: 'yes',
        vulnerableOccupant: false,
        affectedUnits: 1,
        callerSummary: 'Slow drip from the basin trap, caught in a jug, no damage yet.',
      },
    },
    farhan,
  );

  // 5. Old Town Plumbing holds the only job it can take, so the matcher must
  //    refuse them on every later case despite the five-star rating.
  const priya = actor(users.priya);
  const blockedCase = await createCase(
    {
      unitId: String(units['B-310']._id),
      channel: 'voice',
      reporterPhone: '+94 77 640 7712',
      signals: {
        waterPresent: true,
        flow: 'steady',
        spreading: false,
        nearElectrical: false,
        ceilingOrWallDamage: true,
        sourceKnown: false,
        hotWaterOrBrown: false,
        sewage: false,
        gasOrSmoke: false,
        shutoffAccessible: 'unknown',
        vulnerableOccupant: true,
        affectedUnits: 1,
        callerSummary: 'A damp patch growing on the bedroom ceiling above the en-suite.',
      },
    },
    priya,
  );
  await dispatchCase(String(blockedCase._id), { contractorId: String(contractors.old._id) }, dispatcher);

  // 6. Not water at all: a duplicate report, escalated then cancelled by the tenant.
  const noiseCase = await createCase(
    {
      unitId: String(units['B-105']._id),
      channel: 'web',
      signals: {
        waterPresent: false,
        flow: 'none',
        spreading: false,
        nearElectrical: false,
        ceilingOrWallDamage: false,
        sourceKnown: true,
        hotWaterOrBrown: false,
        sewage: false,
        gasOrSmoke: false,
        shutoffAccessible: 'unknown',
        vulnerableOccupant: false,
        affectedUnits: 1,
        callerSummary: 'Reporting the same ceiling patch as unit B-310, nothing wet here.',
      },
    },
    actor(users.kasun),
  );
  await escalateCase(String(noiseCase._id), dispatcher, 'Duplicate of B-310, kept for the audit trail.');
  await moveCase(await Case.findById(noiseCase._id), CASE_ACTION.CANCEL, dispatcher, {
    data: { reason: 'Duplicate report' },
    set: { closedAt: new Date(), outcome: 'Duplicate of the B-310 ceiling leak; no separate work ordered.' },
  });

  await moveCase(await Case.findById(steadyCase._id), CASE_ACTION.CLOSE, dispatcher, {
    set: { closedAt: new Date() },
  });
}

process.exit(0);
