/**
 * routes/logRoutes.js
 *
 * Log file upload, listing, deletion, query, and stats endpoints.
 * Multer is configured here to accept .log and .txt files.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
  uploadLog,
  getFiles,
  deleteFile,
  getLogs,
  getLogStats,
} = require('../controllers/logController');
const { protect } = require('../middleware/auth');

// ---- Multer Storage Configuration ----

const UPLOADS_DIR = path.join(__dirname, '../uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    // Prefix with timestamp to avoid name collisions
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

// Accepted log file extensions
const ALLOWED_EXTENSIONS = ['.log', '.txt'];

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(
        `File type "${ext}" not supported. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
      ));
    }
  },
});

// ---- Route Definitions ----

// POST  /api/logs/upload            Upload a log file
router.post('/upload', protect, upload.single('logfile'), uploadLog);

// GET   /api/logs/files             List uploaded files
router.get('/files', protect, getFiles);

// DELETE /api/logs/files/:id        Delete file + its parsed events
router.delete('/files/:id', protect, deleteFile);

// GET   /api/logs/stats             Aggregate stats (total files, events, etc.)
router.get('/stats', protect, getLogStats);

// GET   /api/logs                   Query parsed log events (search/filter/paginate)
router.get('/', protect, getLogs);

module.exports = router;
