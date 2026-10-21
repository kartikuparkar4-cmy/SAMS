process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-that-is-at-least-thirty-two-characters';
process.env.JWT_EXPIRES_IN = '1h';

const assert = require('node:assert/strict');
const { before, beforeEach, after, test } = require('node:test');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const Provider = require('../models/Provider');
const Admin = require('../models/Admin');
const Appointment = require('../models/Appointment');

let mongo;
let provider;
let inactiveProvider;
let admin;
let staff;
let clinicDay;

function nextWeekday(daysAhead) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function booking(overrides) {
  return {
    customerName: 'Taylor Sample',
    contactNumber: '+1 555 010 2040',
    providerId: provider.id,
    serviceName: 'Primary Care',
    appointmentDate: clinicDay,
    timeSlot: '09:30',
    notes: 'Please call if the time changes.',
    ...overrides
  };
}

async function authenticatedAgent() {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: admin.email, password: 'Correct-Horse-42!' }).expect(200);
  return agent;
}

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([Provider.init(), Admin.init(), Appointment.init()]);
});

beforeEach(async () => {
  await Promise.all([Appointment.deleteMany({}), Provider.deleteMany({}), Admin.deleteMany({})]);
  provider = await Provider.create({
    name: 'Dr. Demo Provider',
    serviceCategory: 'Primary Care',
    active: true,
    schedule: { daysOfWeek: [1, 2, 3, 4, 5], slots: ['08:30', '09:30', '10:30', '13:00'] }
  });
  inactiveProvider = await Provider.create({ name: 'Inactive Provider', serviceCategory: 'Cardiology', active: false });
  const passwordHash = await bcrypt.hash('Correct-Horse-42!', 12);
  admin = await Admin.create({ name: 'Test Administrator', email: 'admin@example.test', passwordHash, role: 'admin' });
  staff = await Admin.create({ name: 'Test Staff', email: 'staff@example.test', passwordHash, role: 'staff' });
  clinicDay = nextWeekday(7);
});

after(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

test('lists only active providers and returns available scheduled slots', async () => {
  const listed = await request(app).get('/api/providers').expect(200);
  assert.equal(listed.body.providers.length, 1);
  assert.equal(listed.body.providers[0].name, 'Dr. Demo Provider');
  assert.equal('active' in listed.body.providers[0], false);

  const availability = await request(app)
    .get(`/api/providers/${provider.id}/availability`)
    .query({ date: clinicDay })
    .expect(200);
  assert.deepEqual(availability.body.availableSlots, ['08:30', '09:30', '10:30', '13:00']);
});

test('creates a valid appointment and returns a non-predictable reference', async () => {
  const response = await request(app).post('/api/appointments').send(booking()).expect(201);
  assert.match(response.body.appointment.referenceCode, /^NS-[A-F0-9]{12}$/);
  assert.equal(response.body.appointment.status, 'Pending');
  assert.equal(response.body.appointment.serviceName, 'Primary Care');
  assert.equal(await Appointment.countDocuments(), 1);
});

test('rejects missing required appointment fields', async () => {
  const response = await request(app).post('/api/appointments').send({}).expect(400);
  assert.ok(response.body.errors.some((error) => error.field === 'customerName'));
  assert.ok(response.body.errors.some((error) => error.field === 'contactNumber'));
  assert.equal(await Appointment.countDocuments(), 0);
});

test('rejects invalid contact details, dates, and times', async () => {
  const invalidContact = await request(app).post('/api/appointments').send(booking({ contactNumber: 'abc' })).expect(400);
  assert.ok(invalidContact.body.errors.some((error) => error.field === 'contactNumber'));

  const pastDay = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const invalidDate = await request(app).post('/api/appointments').send(booking({ appointmentDate: pastDay })).expect(400);
  assert.ok(invalidDate.body.errors.some((error) => error.field === 'appointmentDate'));

  const invalidTime = await request(app).post('/api/appointments').send(booking({ timeSlot: '12:00' })).expect(400);
  assert.match(invalidTime.body.message, /schedule|time/i);

  const invalidNotes = await request(app).post('/api/appointments').send(booking({ notes: { private: true } })).expect(400);
  assert.ok(invalidNotes.body.errors.some((error) => error.field === 'notes'));
});

test('rejects nonexistent and inactive providers', async () => {
  await request(app).post('/api/appointments').send(booking({ providerId: new mongoose.Types.ObjectId().toString() })).expect(404);
  await request(app).post('/api/appointments').send(booking({ providerId: inactiveProvider.id, serviceName: 'Cardiology' })).expect(404);
  await request(app).get(`/api/providers/${inactiveProvider.id}/availability`).query({ date: clinicDay }).expect(404);
});

test('rejects a provider and service mismatch', async () => {
  const response = await request(app).post('/api/appointments').send(booking({ serviceName: 'Cardiology' })).expect(400);
  assert.ok(response.body.errors.some((error) => error.field === 'serviceName'));
});

test('prevents a second active appointment from reserving the same slot', async () => {
  await request(app).post('/api/appointments').send(booking()).expect(201);
  await request(app).post('/api/appointments').send(booking({ customerName: 'Another Patient' })).expect(409);
  assert.equal(await Appointment.countDocuments(), 1);
});

test('allows only one of two simultaneous requests to reserve a slot', async () => {
  const [first, second] = await Promise.all([
    request(app).post('/api/appointments').send(booking({ customerName: 'First Patient' })),
    request(app).post('/api/appointments').send(booking({ customerName: 'Second Patient' }))
  ]);
  assert.deepEqual([first.status, second.status].sort(), [201, 409]);
  assert.equal(await Appointment.countDocuments(), 1);
});

test('public status lookup exposes only limited booking details', async () => {
  const created = await request(app).post('/api/appointments').send(booking()).expect(201);
  const reference = created.body.appointment.referenceCode;
  const response = await request(app).get(`/api/appointments/status/${reference}`).expect(200);
  assert.equal(response.body.appointment.status, 'Pending');
  assert.equal('customerName' in response.body.appointment, false);
  assert.equal('contactNumber' in response.body.appointment, false);
  assert.equal('notes' in response.body.appointment, false);

  const queryLookup = await request(app).get('/api/appointments').query({ reference }).expect(200);
  assert.deepEqual(queryLookup.body.appointment, response.body.appointment);
  await request(app).get('/api/appointments/status/NS-000000000000').expect(404);
});

test('logs in with a valid administrator and rejects incorrect credentials', async () => {
  const response = await request(app).post('/api/auth/login').send({ email: 'ADMIN@example.test', password: 'Correct-Horse-42!' }).expect(200);
  assert.equal(response.body.admin.email, 'admin@example.test');
  assert.equal('passwordHash' in response.body.admin, false);
  assert.match(response.headers['set-cookie'][0], /HttpOnly/i);
  assert.match(response.headers['set-cookie'][0], /SameSite=Strict/i);

  await request(app).post('/api/auth/login').send({ email: admin.email, password: 'wrong-password' }).expect(401);
  await request(app).post('/api/auth/login').send({ email: 'missing@example.test', password: 'wrong-password' }).expect(401);
});

test('protects appointment list, status updates, and summary from anonymous requests', async () => {
  await request(app).get('/api/appointments').expect(401);
  await request(app).get('/api/dashboard/summary').expect(401);
  await request(app).patch(`/api/appointments/${new mongoose.Types.ObjectId()}/status`).send({ status: 'Confirmed' }).expect(401);
});

test('denies staff-role tokens access to administrator APIs', async () => {
  const token = jwt.sign({ sub: staff.id, role: 'staff' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  await request(app).get('/api/dashboard/summary').set('Cookie', `northstar_admin=${token}`).expect(403);
  await request(app).get('/api/appointments').set('Cookie', `northstar_admin=${token}`).expect(403);
});

test('updates status, rejects unsupported values, and releases canceled slots', async () => {
  const created = await request(app).post('/api/appointments').send(booking()).expect(201);
  const agent = await authenticatedAgent();
  const appointment = (await Appointment.findOne({ referenceCode: created.body.appointment.referenceCode })).toObject();

  await agent.patch(`/api/appointments/${appointment._id}/status`).send({ status: 'Confirmed' }).expect(200);
  await agent.patch(`/api/appointments/${appointment._id}/status`).send({ status: 'Booked' }).expect(400);
  await agent.patch(`/api/appointments/${appointment._id}/status`).send({ status: 'Cancelled' }).expect(200);
  const replacement = await request(app).post('/api/appointments').send(booking({ customerName: 'Replacement Patient' })).expect(201);
  assert.notEqual(replacement.body.appointment.referenceCode, created.body.appointment.referenceCode);
});

test('returns 404 for a missing appointment and validates administrator filters', async () => {
  const agent = await authenticatedAgent();
  await agent.patch(`/api/appointments/${new mongoose.Types.ObjectId()}/status`).send({ status: 'Completed' }).expect(404);
  await agent.get('/api/appointments').query({ status: 'Unknown' }).expect(400);
  await agent.get('/api/appointments').query({ limit: 500 }).expect(400);
});

test('searches and filters appointments by name, provider, date, and status', async () => {
  const first = await request(app).post('/api/appointments').send(booking({ customerName: 'Alice North' })).expect(201);
  await request(app).post('/api/appointments').send(booking({ customerName: 'Morgan South', timeSlot: '10:30' })).expect(201);
  const agent = await authenticatedAgent();
  const appointmentId = (await Appointment.findOne({ referenceCode: first.body.appointment.referenceCode })).id;
  await agent.patch(`/api/appointments/${appointmentId}/status`).send({ status: 'Confirmed' }).expect(200);

  const result = await agent.get('/api/appointments').query({ search: 'alice', providerId: provider.id, date: clinicDay, status: 'Confirmed' }).expect(200);
  assert.equal(result.body.total, 1);
  assert.equal(result.body.appointments[0].customerName, 'Alice North');
});

test('dashboard totals match database records for each supported status', async () => {
  const first = await request(app).post('/api/appointments').send(booking({ timeSlot: '08:30' })).expect(201);
  const second = await request(app).post('/api/appointments').send(booking({ timeSlot: '09:30' })).expect(201);
  const third = await request(app).post('/api/appointments').send(booking({ timeSlot: '10:30' })).expect(201);
  const agent = await authenticatedAgent();
  for (const [referenceCode, status] of [[first.body.appointment.referenceCode, 'Confirmed'], [second.body.appointment.referenceCode, 'Completed'], [third.body.appointment.referenceCode, 'Cancelled']]) {
    const appointment = await Appointment.findOne({ referenceCode });
    await agent.patch(`/api/appointments/${appointment.id}/status`).send({ status }).expect(200);
  }
  const response = await agent.get('/api/dashboard/summary').expect(200);
  assert.deepEqual(response.body.summary, { total: 3, pending: 0, confirmed: 1, completed: 1, cancelled: 1 });
});