/**
 * ====================================
 * LogHawk – ParsedLog Model
 * ====================================
 * models/ParsedLog.js
 *
 * Stores individual security events extracted from uploaded log files.
 * Each document represents one parsed log line with structured fields
 * extracted by the Python analysis engine.
 *
 * Note: The more advanced LogEntry model (with threat tags and AI analysis)
 * is reserved for Phase 4 when the full detection pipeline runs.
 */

const mongoose = require('mongoose');

const parsedLogSchema = new mongoose.Schema({
  // Which uploaded file produced this event
  uploadedFile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UploadedFile',
    required: true,
  },
  // The analyst who owns this data
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // When the event happened (from the log line itself, not upload time)
  timestamp: {
    type: Date,
  },
  username: {
    type: String,
  },
  ipAddress: {
    type: String,
  },
  eventType: {
    type: String,
    enum: ['Login', 'Authentication', 'Sudo', 'Session', 'Other'],
    default: 'Other',
  },
  status: {
    type: String,
    enum: ['Success', 'Failed', 'Unknown'],
    default: 'Unknown',
  },
  // Preserved original line for raw log viewer
  rawLog: {
    type: String,
  },
  // Original filename (denormalized for query convenience)
  sourceFile: {
    type: String,
  },
}, {
  timestamps: true,
});

// Query performance indexes
parsedLogSchema.index({ uploadedBy: 1, timestamp: -1 });
parsedLogSchema.index({ uploadedFile: 1 });
parsedLogSchema.index({ status: 1 });
parsedLogSchema.index({ ipAddress: 1 });
parsedLogSchema.index({ username: 1 });

module.exports = mongoose.model('ParsedLog', parsedLogSchema);
