/**
 * ====================================
 * LogHawk – UploadedFile Model
 * ====================================
 * models/UploadedFile.js
 *
 * Tracks every log file uploaded by a user.
 * Status progresses: processing → complete | error
 * totalEvents is populated after the Python parser finishes.
 */

const mongoose = require('mongoose');

const uploadedFileSchema = new mongoose.Schema({
  // What the user sees
  filename: {
    type: String,
    required: true,
  },
  // What's stored on disk (timestamp-prefixed to avoid name collisions)
  storedFilename: {
    type: String,
    required: true,
  },
  // Absolute path on the server — NOT exposed to clients
  filepath: {
    type: String,
    required: true,
  },
  filesize: {
    type: Number,
    required: true,
  },
  // Log format type — determines which parser to use
  filetype: {
    type: String,
    enum: ['linux_auth', 'windows_event', 'apache', 'nginx', 'firewall'],
    required: true,
    default: 'linux_auth',
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Parsing lifecycle state
  status: {
    type: String,
    enum: ['processing', 'complete', 'error'],
    default: 'processing',
  },
  totalEvents: {
    type: Number,
    default: 0,
  },
  // Set only when status = 'error'
  errorMessage: {
    type: String,
  },
}, {
  timestamps: true,
});

uploadedFileSchema.index({ uploadedBy: 1, createdAt: -1 });

module.exports = mongoose.model('UploadedFile', uploadedFileSchema);
