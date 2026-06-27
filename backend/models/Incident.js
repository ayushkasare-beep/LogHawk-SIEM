/**
 * LogHawk – Incident Model
 * models/Incident.js
 *
 * MongoDB schema for security incidents created from alerts.
 * Supports full case management: notes, timeline, response actions, and status tracking.
 */

const mongoose = require('mongoose');

// Sub-document: analyst notes
const noteSchema = new mongoose.Schema({
  text: { type: String, required: true },
  author: { type: String, default: 'SOC Analyst' },
  createdAt: { type: Date, default: Date.now },
});

// Sub-document: timeline events (auto-appended on status changes, actions, etc.)
const timelineEventSchema = new mongoose.Schema({
  event: { type: String, required: true },
  actor: { type: String, default: 'System' },
  timestamp: { type: Date, default: Date.now },
});

const incidentSchema = new mongoose.Schema(
  {
    // Human-readable ID: INC-1001, INC-1002, ...
    incidentId: {
      type: String,
      unique: true,
      index: true,
    },

    title: {
      type: String,
      required: [true, 'Incident title is required'],
      trim: true,
    },

    severity: {
      type: String,
      enum: ['Critical', 'High', 'Medium', 'Low'],
      required: true,
    },

    status: {
      type: String,
      enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
      default: 'Open',
    },

    assignedTo: {
      type: String,
      default: 'Unassigned',
    },

    sourceIp: { type: String, default: null },
    username: { type: String, default: null },

    // Link to the originating alert
    alertId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Alert',
      default: null,
    },

    // Detection type (e.g., "Brute Force Attack")
    threatType: { type: String, default: '' },

    // Risk score inherited from the alert
    riskScore: { type: Number, default: 0 },

    // Related parsed log entries
    relatedLogs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ParsedLog' }],

    // Investigation notes added by analysts
    notes: [noteSchema],

    // Chronological audit trail
    timeline: [timelineEventSchema],

    // Flagged as false positive by an analyst
    isFalsePositive: { type: Boolean, default: false },

    // The analyst who owns / created this incident
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Pre-save hook to auto-assign incidentId if not set
incidentSchema.pre('save', async function (next) {
  if (!this.incidentId) {
    const count = await this.constructor.countDocuments();
    this.incidentId = `INC-${String(count + 1001).padStart(4, '0')}`;
  }
  next();
});

incidentSchema.index({ createdBy: 1, status: 1 });
incidentSchema.index({ severity: 1 });

module.exports = mongoose.model('Incident', incidentSchema);
