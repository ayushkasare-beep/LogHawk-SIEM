const express = require('express');
const router = express.Router();
const { getBlockedAssets } = require('../controllers/incidentController');
const { protect } = require('../middleware/auth');

// GET /api/blocked-assets — List blocked IPs for the authenticated user
router.get('/', protect, getBlockedAssets);

module.exports = router;
