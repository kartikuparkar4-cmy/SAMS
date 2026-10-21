const mongoose = require('mongoose');

const VALID_STATUSES = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];
const CONTACT_PATTERN = /^\+?[0-9][0-9\s().-]{6,22}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validateAppointmentInput(input) {
  const errors = [];
  const customerName = typeof input.customerName === 'string' ? input.customerName.trim() : '';
  const contactNumber = typeof input.contactNumber === 'string' ? input.contactNumber.trim() : '';
  const serviceName = typeof input.serviceName === 'string' ? input.serviceName.trim() : '';
  const providerId = typeof input.providerId === 'string' ? input.providerId.trim() : '';
  const appointmentDay = typeof input.appointmentDate === 'string' ? input.appointmentDate.trim() : '';
  const timeSlot = typeof input.timeSlot === 'string' ? input.timeSlot.trim() : '';
  const notes = typeof input.notes === 'string' ? input.notes.trim() : '';

  if (input.notes !== undefined && typeof input.notes !== 'string') errors.push({ field: 'notes', message: 'Notes must be text.' });
  if (customerName.length < 2 || customerName.length > 80) errors.push({ field: 'customerName', message: 'Name must be between 2 and 80 characters.' });
  if (!CONTACT_PATTERN.test(contactNumber)) errors.push({ field: 'contactNumber', message: 'Enter a valid contact number.' });
  if (!mongoose.isValidObjectId(providerId)) errors.push({ field: 'providerId', message: 'Choose a valid provider.' });
  if (!serviceName || serviceName.length > 60) errors.push({ field: 'serviceName', message: 'Choose a valid service.' });

  const parsedDate = DATE_PATTERN.test(appointmentDay) ? new Date(`${appointmentDay}T00:00:00.000Z`) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== appointmentDay) {
    errors.push({ field: 'appointmentDate', message: 'Choose a valid appointment date.' });
  } else if (appointmentDay < new Date().toISOString().slice(0, 10)) {
    errors.push({ field: 'appointmentDate', message: 'Appointment date cannot be in the past.' });
  }
  if (!timeSlot || timeSlot.length > 30) errors.push({ field: 'timeSlot', message: 'Choose an available time.' });
  if (notes.length > 500) errors.push({ field: 'notes', message: 'Notes must be 500 characters or fewer.' });

  return {
    errors,
    value: { customerName, contactNumber, providerId, serviceName, appointmentDay, appointmentDate: parsedDate, timeSlot, notes }
  };
}

function isValidDateKey(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isObjectId(value) {
  return typeof value === 'string' && mongoose.isValidObjectId(value);
}

module.exports = { VALID_STATUSES, CONTACT_PATTERN, validateAppointmentInput, isValidDateKey, isObjectId };