const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  createAppointment,
  getPublicStatus,
  listAppointments,
  updateAppointmentStatus
} = require('../controllers/appointmentController');

const router = express.Router();
const publicLookupLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many status checks. Please try again later.' }
});

router.post('/', createAppointment);
router.get('/status/:referenceCode', publicLookupLimit, getPublicStatus);
router.get('/', publicLookupLimit, (req, res, next) => {
  if (req.query.reference !== undefined) return getPublicStatus(req, res, next);
  return next('route');
});
router.get('/', authenticate, requireAdmin, listAppointments);
router.patch('/:id/status', authenticate, requireAdmin, updateAppointmentStatus);

module.exports = router;