/**
 * LogHawk – Detection Rules Routes
 * routes/detectionRulesRoutes.js
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getRules, updateRule } = require('../controllers/detectionRulesController');

router.get('/', protect, getRules);
router.patch('/:ruleId', protect, updateRule);

module.exports = router;
