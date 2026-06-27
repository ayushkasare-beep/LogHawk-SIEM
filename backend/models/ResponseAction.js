/**
 * LogHawk – ResponseAction Model
 * models/ResponseAction.js
 *
 * Records analyst response actions taken against an incident.
 * Used for the incident timeline, audit trail, and metrics charts.
 */

const mongoose = require('mongoose');

const responseActionSchema = new mongoose.Schema(
  {
    // Parent incident
    incidentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Incident',
      required: true,
    },

    // Human-readable incident ID for quick display
    incidentRef: { type: String },

    // Action type
    action: {
      type: String,
      enum: ['block_ip', 'disable_user', 'false_positive', 'escalate'],
      required: true,
    },

    // For block_ip
    ip: { type: String, default: null },

    // For disable_user
    username: { type: String, default: null },

    // Optional reason or note from analyst
    reason: { type: String, default: '' },

    // Analyst who performed the action
    performedBy: { type: String, default: 'SOC Analyst' },

    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

responseActionSchema.index({ incidentId: 1 });
responseActionSchema.index({ action: 1 });

module.exports = mongoose.model('ResponseAction', responseActionSchema);
