const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Provider = require('../models/Provider');
const { VALID_STATUSES, validateAppointmentInput, isValidDateKey, isObjectId } = require('../validators/appointments');
const { timeToMinutes, localDayKey, dateWeekday } = require('./providerController');

const ACTIVE_STATUSES = ['Pending', 'Confirmed'];

function newReferenceCode() {
  return `NS-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}

function publicAppointment(appointment) {
  return {
    referenceCode: appointment.referenceCode,
    status: appointment.status,
    serviceName: appointment.serviceName,
    providerName: appointment.providerName,
    appointmentDate: appointment.appointmentDay,
    timeSlot: appointment.timeSlot
  };
}

function adminAppointment(appointment) {
  return {
    id: appointment._id.toString(),
    referenceCode: appointment.referenceCode,
    customerName: appointment.customerName,
    contactNumber: appointment.contactNumber,
    providerName: appointment.providerName,
    serviceName: appointment.serviceName,
    appointmentDate: appointment.appointmentDay,
    timeSlot: appointment.timeSlot,
    notes: appointment.notes,
    status: appointment.status,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt
  };
}

async function createAppointment(req, res, next) {
  try {
    const { errors, value } = validateAppointmentInput(req.body || {});
    if (errors.length) return res.status(400).json({ message: 'Please correct the highlighted booking details.', errors });

    const provider = await Provider.findOne({ _id: value.providerId, active: true }).select('name serviceCategory schedule').lean();
    if (!provider) return res.status(404).json({ message: 'Provider not found or inactive.' });
    if (provider.serviceCategory !== value.serviceName) {
      return res.status(400).json({ message: 'Selected service does not match this provider.', errors: [{ field: 'serviceName', message: 'Choose this provider’s listed service.' }] });
    }
    if (!provider.schedule.daysOfWeek.includes(dateWeekday(value.appointmentDay))) {
      return res.status(400).json({ message: 'This provider is not available on that day.', errors: [{ field: 'appointmentDate', message: 'Choose an available clinic day.' }] });
    }
    if (!provider.schedule.slots.includes(value.timeSlot)) {
      return res.status(400).json({ message: 'Choose a time from the provider’s available schedule.', errors: [{ field: 'timeSlot', message: 'Choose an available time.' }] });
    }

    const now = new Date();
    if (value.appointmentDay === localDayKey(now) && timeToMinutes(value.timeSlot) <= now.getHours() * 60 + now.getMinutes()) {
      return res.status(400).json({ message: 'Choose a future time.' , errors: [{ field: 'timeSlot', message: 'Choose a time later today.' }] });
    }

    const activeSlotKey = `${value.providerId}:${value.appointmentDay}:${value.timeSlot}`;
    const existing = await Appointment.exists({ activeSlotKey, status: { $in: ACTIVE_STATUSES } });
    if (existing) return res.status(409).json({ message: 'That appointment time was just booked. Please choose another time.' });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const appointment = new Appointment({
        ...value,
        providerId: new mongoose.Types.ObjectId(value.providerId),
        providerName: provider.name,
        referenceCode: newReferenceCode(),
        activeSlotKey,
        status: 'Pending'
      });
      try {
        await appointment.save();
        return res.status(201).json({ appointment: publicAppointment(appointment) });
      } catch (error) {
        if (error.code !== 11000) throw error;
        if (error.keyPattern && error.keyPattern.referenceCode && attempt < 2) continue;
        if (error.keyPattern && error.keyPattern.activeSlotKey) {
          return res.status(409).json({ message: 'That appointment time was just booked. Please choose another time.' });
        }
        throw error;
      }
    }
    return res.status(500).json({ message: 'A booking reference could not be generated. Please try again.' });
  } catch (error) {
    return next(error);
  }
}

async function getPublicStatus(req, res, next) {
  try {
    const rawReference = req.params.referenceCode || req.query.reference;
    const referenceCode = typeof rawReference === 'string' ? rawReference.trim().toUpperCase() : '';
    if (!/^NS-[A-F0-9]{12}$/.test(referenceCode)) {
      return res.status(404).json({ message: 'No appointment was found for that reference.' });
    }
    const appointment = await Appointment.findOne({ referenceCode }).select('referenceCode status serviceName providerName appointmentDay timeSlot').lean();
    if (!appointment) return res.status(404).json({ message: 'No appointment was found for that reference.' });
    res.set('Cache-Control', 'no-store');
    return res.json({ appointment: publicAppointment(appointment) });
  } catch (error) {
    return next(error);
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function listAppointments(req, res, next) {
  try {
    const { search, status, providerId, date } = req.query;
    if (search !== undefined && (typeof search !== 'string' || search.length > 80)) {
      return res.status(400).json({ message: 'Search must be 80 characters or fewer.' });
    }
    if (status !== undefined && !VALID_STATUSES.includes(status)) return res.status(400).json({ message: 'Status filter is invalid.' });
    if (providerId !== undefined && !isObjectId(providerId)) return res.status(400).json({ message: 'Provider filter is invalid.' });
    if (date !== undefined && !isValidDateKey(date)) return res.status(400).json({ message: 'Date filter is invalid.' });

    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    const limit = req.query.limit === undefined ? 10 : Number(req.query.limit);
    if (!Number.isInteger(page) || page < 1 || page > 100000 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
      return res.status(400).json({ message: 'Page and limit must be valid positive integers; limit cannot exceed 50.' });
    }

    const query = {};
    if (search && search.trim()) {
      const escaped = escapeRegex(search.trim());
      query.$or = [{ customerName: { $regex: escaped, $options: 'i' } }, { referenceCode: { $regex: escaped, $options: 'i' } }];
    }
    if (status) query.status = status;
    if (providerId) query.providerId = providerId;
    if (date) query.appointmentDay = date;

    const [records, total] = await Promise.all([
      Appointment.find(query).sort({ appointmentDate: 1, timeSlot: 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Appointment.countDocuments(query)
    ]);
    const pages = Math.max(1, Math.ceil(total / limit));
    return res.json({ appointments: records.map(adminAppointment), total, page, pages, limit });
  } catch (error) {
    return next(error);
  }
}

async function updateAppointmentStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!isObjectId(id)) return res.status(400).json({ message: 'Appointment ID is invalid.' });
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ message: 'Status must be Pending, Confirmed, Completed, or Cancelled.' });

    const appointment = await Appointment.findById(id).select('+activeSlotKey');
    if (!appointment) return res.status(404).json({ message: 'Appointment not found.' });
    const update = { $set: { status } };
    if (ACTIVE_STATUSES.includes(status)) {
      update.$set.activeSlotKey = `${appointment.providerId}:${appointment.appointmentDay}:${appointment.timeSlot}`;
    } else {
      update.$unset = { activeSlotKey: 1 };
    }

    let updated;
    try {
      updated = await Appointment.findByIdAndUpdate(id, update, { new: true, runValidators: true }).lean();
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ message: 'That appointment time has already been reserved by another booking.' });
      throw error;
    }
    if (!updated) return res.status(404).json({ message: 'Appointment not found.' });
    return res.json({ appointment: adminAppointment(updated) });
  } catch (error) {
    return next(error);
  }
}

module.exports = { createAppointment, getPublicStatus, listAppointments, updateAppointmentStatus, publicAppointment, adminAppointment };