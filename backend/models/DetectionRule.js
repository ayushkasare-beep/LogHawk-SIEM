/**
 * LogHawk – DetectionRule Model
 * models/DetectionRule.js
 *
 * Persists the enabled/disabled state of each detection signature
 * per user. Created on first toggle; defaults to enabled = true.
 */

const mongoose = require('mongoose');

const detectionRuleSchema = new mongoose.Schema(
  {
    // The authenticated user who owns these rule settings
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Rule ID as defined in the frontend DETECTION_RULES constant
    ruleId: {
      type: String,
      required: true,
      trim: true,
    },

    // Whether the rule is currently active
    enabled: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Compound index — one record per user per rule
detectionRuleSchema.index({ user: 1, ruleId: 1 }, { unique: true });

module.exports = mongoose.model('DetectionRule', detectionRuleSchema);
