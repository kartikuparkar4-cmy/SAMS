const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  serviceCategory: { type: String, required: true, trim: true, maxlength: 60 },
  active: { type: Boolean, default: true, index: true },
  schedule: {
    daysOfWeek: { type: [Number], default: [1, 2, 3, 4, 5] },
    slots: { type: [String], default: ['08:30', '09:30', '10:30', '13:00', '14:00', '15:00'] }
  }
}, { timestamps: true });

providerSchema.index({ active: 1, serviceCategory: 1 });

module.exports = mongoose.model('Provider', providerSchema);