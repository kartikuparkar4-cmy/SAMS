const express = require('express');
const { listProviders, getAvailability } = require('../controllers/providerController');

const router = express.Router();

router.get('/', listProviders);
router.get('/:providerId/availability', getAvailability);

module.exports = router;