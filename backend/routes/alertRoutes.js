const express = require('express');
const router = express.Router();
const { getAlerts, getAlertById, updateAlertStatus, getAlertStats } = require('../controllers/alertController');
const { protect } = require('../middleware/auth');

// Stats must come before /:id so it isn't swallowed by the parameterised route
router.get('/stats', protect, getAlertStats);
router.get('/', protect, getAlerts);
router.get('/:id', protect, getAlertById);
router.patch('/:id/status', protect, updateAlertStatus);

module.exports = router;
