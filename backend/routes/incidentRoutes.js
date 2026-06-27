/**
 * LogHawk – Incident Routes
 * routes/incidentRoutes.js
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getIncidentStats,
  getIncidents,
  createIncident,
  getIncidentById,
  updateIncident,
  assignIncident,
  addNote,
  respondToIncident,
  resolveIncident,
  getBlockedAssets,
} = require('../controllers/incidentController');

// Stats must come before /:id
router.get('/stats', protect, getIncidentStats);

// Incident CRUD
router.get('/', protect, getIncidents);
router.post('/', protect, createIncident);
router.get('/:id', protect, getIncidentById);
router.put('/:id', protect, updateIncident);

// Incident actions
router.post('/:id/assign', protect, assignIncident);
router.post('/:id/note', protect, addNote);
router.post('/:id/respond', protect, respondToIncident);
router.post('/:id/resolve', protect, resolveIncident);

module.exports = router;
