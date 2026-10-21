const Appointment = require('../models/Appointment');
const Provider = require('../models/Provider');
const { isValidDateKey, isObjectId } = require('../validators/appointments');

const ACTIVE_STATUSES = ['Pending', 'Confirmed'];

function dateWeekday(day) {
  return new Date(`${day}T00:00:00.000Z`).getUTCDay();
}

function timeToMinutes(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : Number.POSITIVE_INFINITY;
}

function localDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function listProviders(req, res, next) {
  try {
    const providers = await Provider.find({ active: true }).select('name serviceCategory schedule').sort({ serviceCategory: 1, name: 1 }).lean();
    return res.json({
      providers: providers.map((provider) => ({
        id: provider._id.toString(),
        name: provider.name,
        serviceCategory: provider.serviceCategory,
        schedule: { daysOfWeek: provider.schedule.daysOfWeek, slots: provider.schedule.slots }
      }))
    });
  } catch (error) {
    return next(error);
  }
}

async function getAvailability(req, res, next) {
  try {
    const { providerId } = req.params;
    const { date } = req.query;
    if (!isObjectId(providerId)) return res.status(400).json({ message: 'Provider ID is invalid.' });
    if (!isValidDateKey(date)) return res.status(400).json({ message: 'Choose a valid date.' });
    if (date < new Date().toISOString().slice(0, 10)) return res.status(400).json({ message: 'Appointment date cannot be in the past.' });

    const provider = await Provider.findOne({ _id: providerId, active: true }).select('schedule').lean();
    if (!provider) return res.status(404).json({ message: 'Provider not found or inactive.' });
    if (!provider.schedule.daysOfWeek.includes(dateWeekday(date))) return res.json({ availableSlots: [] });

    const occupied = await Appointment.find({ providerId, appointmentDay: date, status: { $in: ACTIVE_STATUSES } }).select('timeSlot -_id').lean();
    const occupiedSlots = new Set(occupied.map((appointment) => appointment.timeSlot));
    const now = new Date();
    const pastToday = date === localDayKey(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const availableSlots = provider.schedule.slots.filter((slot) => {
      return !occupiedSlots.has(slot) && (!pastToday || timeToMinutes(slot) > currentMinutes);
    });
    return res.json({ availableSlots });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listProviders, getAvailability, timeToMinutes, dateWeekday, localDayKey };