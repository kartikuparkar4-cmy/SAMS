const Appointment = require('../models/Appointment');

async function getSummary(req, res, next) {
  try {
    const [groups, total] = await Promise.all([
      Appointment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Appointment.countDocuments()
    ]);
    const counts = Object.fromEntries(groups.map((group) => [group._id.toLowerCase(), group.count]));
    return res.json({
      summary: {
        total,
        pending: counts.pending || 0,
        confirmed: counts.confirmed || 0,
        completed: counts.completed || 0,
        cancelled: counts.cancelled || 0
      }
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getSummary };