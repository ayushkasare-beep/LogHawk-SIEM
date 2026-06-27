/**
 * ====================================
 * LogHawk – Log Controller
 * ====================================
 * controllers/logController.js
 *
 * Handles log file upload, file listing, log querying, and deletion.
 * Upload responds with 202 Accepted immediately; parsing runs in background.
 * All operations are scoped to the authenticated user (req.user._id).
 */

const fs = require('fs');
const UploadedFile = require('../models/UploadedFile');
const ParsedLog = require('../models/ParsedLog');
const Alert = require('../models/Alert');
const parserService = require('../services/parserService');

// ============================================================
// POST /api/logs/upload
// Upload a log file and trigger background parsing.
// ============================================================

exports.uploadLog = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const logType = req.body.logType || 'linux_auth';

    // Persist file metadata before parsing starts
    const uploadedFile = await UploadedFile.create({
      filename: req.file.originalname,
      storedFilename: req.file.filename,
      filepath: req.file.path,
      filesize: req.file.size,
      filetype: logType,
      uploadedBy: req.user._id,
      status: 'processing',
    });

    // Respond immediately — parsing is async and may take several seconds
    res.status(202).json({
      message: 'File uploaded. Parsing started in the background.',
      fileId: uploadedFile._id,
      filename: uploadedFile.filename,
    });

    // Fire-and-forget: run parser in background, update status when done
    parserService
      .parseAndStore(req.file.path, uploadedFile._id, req.user._id, logType)
      .catch(async (err) => {
        console.error(`[LogHawk] Parser failed for ${req.file.originalname}:`, err.message);
        await UploadedFile.findByIdAndUpdate(uploadedFile._id, {
          status: 'error',
          errorMessage: err.message,
        });
      });

  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET /api/logs/files
// List all uploaded files for the authenticated user.
// ============================================================

exports.getFiles = async (req, res, next) => {
  try {
    const files = await UploadedFile.find({ uploadedBy: req.user._id })
      .sort({ createdAt: -1 })
      .select('-filepath -storedFilename -__v'); // Keep server paths private

    res.json({ files });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// DELETE /api/logs/files/:id
// Remove a file from disk, delete its parsed events, and delete the metadata.
// ============================================================

exports.deleteFile = async (req, res, next) => {
  try {
    const file = await UploadedFile.findOne({
      _id: req.params.id,
      uploadedBy: req.user._id,
    });

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Delete from disk (sync is fine for small files; async for production)
    if (file.filepath && fs.existsSync(file.filepath)) {
      fs.unlinkSync(file.filepath);
    }

    // Find all parsed log ids for this file
    const parsedLogIds = await ParsedLog.find({ uploadedFile: file._id }).distinct('_id');
    // Remove all alerts containing these log references
    if (parsedLogIds.length > 0) {
      await Alert.deleteMany({ relatedLogs: { $in: parsedLogIds } });
    }

    // Remove all parsed events associated with this file
    await ParsedLog.deleteMany({ uploadedFile: file._id });

    // Remove the file record
    await UploadedFile.findByIdAndDelete(file._id);

    res.json({ message: 'File and associated log events deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET /api/logs
// Query parsed log events with search, filters, and pagination.
//
// Query params:
//   page        – page number (default 1)
//   limit       – results per page (default 25)
//   search      – substring match on username, ip, eventType, status
//   status      – 'Success' | 'Failed' | 'Unknown'
//   eventType   – 'Login' | 'Authentication' | 'Sudo' | 'Session' | 'Other'
//   fileId      – filter by a specific uploaded file
// ============================================================

exports.getLogs = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 25,
      search,
      status,
      eventType,
      fileId,
    } = req.query;

    const filter = { uploadedBy: req.user._id };

    if (fileId) filter.uploadedFile = fileId;
    if (status) filter.status = status;
    if (eventType) filter.eventType = eventType;

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      filter.$or = [
        { username: searchRegex },
        { ipAddress: searchRegex },
        { eventType: searchRegex },
        { status: searchRegex },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      ParsedLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-__v'),
      ParsedLog.countDocuments(filter),
    ]);

    res.json({
      logs,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET /api/logs/stats
// Return aggregate statistics for the Log Management page header.
// ============================================================

exports.getLogStats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [
      totalFiles,
      totalEvents,
      failedLogins,
      successfulLogins,
      totalAlerts,
      openAlerts,
      criticalAlerts,
      highAlerts,
      suspiciousIPs
    ] = await Promise.all([
      UploadedFile.countDocuments({ uploadedBy: userId }),
      ParsedLog.countDocuments({ uploadedBy: userId }),
      ParsedLog.countDocuments({ uploadedBy: userId, status: 'Failed' }),
      ParsedLog.countDocuments({ uploadedBy: userId, status: 'Success' }),
      Alert.countDocuments({ user: userId }),
      Alert.countDocuments({ user: userId, status: 'Open' }),
      Alert.countDocuments({ user: userId, severity: 'Critical', status: { $ne: 'Resolved' } }),
      Alert.countDocuments({ user: userId, severity: 'High', status: { $ne: 'Resolved' } }),
      Alert.find({ user: userId }).distinct('sourceIP'),
    ]);

    res.json({
      totalFiles,
      totalEvents,
      failedLogins,
      successfulLogins,
      totalAlerts,
      openAlerts,
      criticalAlerts,
      highAlerts,
      suspiciousIPs: suspiciousIPs.filter(Boolean).length,
    });
  } catch (error) {
    next(error);
  }
};
