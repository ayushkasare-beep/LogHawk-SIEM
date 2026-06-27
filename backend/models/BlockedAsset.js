/**
 * LogHawk – BlockedAsset Model
 * models/BlockedAsset.js
 *
 * Records IP addresses blocked via the incident response "Block IP" action.
 * Populates the Blocked Assets view inside Incident Response.
 */

const mongoose = require('mongoose');

const blockedAssetSchema = new mongoose.Schema(
  {
    // The blocked IP address
    ip: {
      type: String,
      required: [true, 'IP address is required'],
      trim: true,
    },

    // Reason for the block
    reason: { type: String, default: 'Blocked via Incident Response' },

    // Link back to the originating incident
    incidentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Incident',
      default: null,
    },

    // Human-readable incident ID
    incidentRef: { type: String, default: '' },

    // User ObjectId for data isolation (multi-tenancy)
    blockedByUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // Display name of the analyst who triggered the block
    blockedBy: { type: String, default: 'SOC Analyst' },

    blockedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

blockedAssetSchema.index({ ip: 1 });
blockedAssetSchema.index({ incidentId: 1 });
blockedAssetSchema.index({ blockedByUser: 1 });

module.exports = mongoose.model('BlockedAsset', blockedAssetSchema);

