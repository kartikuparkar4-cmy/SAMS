const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  referenceCode: { type: String, required: true, unique: true, trim: true, uppercase: true, index: true },
  customerName: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  contactNumber: { type: String, required: true, trim: true, maxlength: 24 },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true, index: true },
  providerName: { type: String, required: true, trim: true, maxlength: 80 },
  serviceName: { type: String, required: true, trim: true, maxlength: 60 },
  appointmentDate: { type: Date, required: true },
  appointmentDay: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  timeSlot: { type: String, required: true, trim: true, maxlength: 30 },
  notes: { type: String, trim: true, maxlength: 500, default: '' },
  status: { type: String, enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled'], default: 'Pending', index: true },
  activeSlotKey: { type: String, select: false }
}, { timestamps: true });

appointmentSchema.index({ activeSlotKey: 1 }, { unique: true, sparse: true });
appointmentSchema.index({ appointmentDay: 1, status: 1 });
appointmentSchema.index({ providerId: 1, appointmentDay: 1, status: 1 });
appointmentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Appointment', appointmentSchema);