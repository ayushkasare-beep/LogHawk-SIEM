/**
 * ====================================
 * LogHawk – Alert Controller
 * ====================================
 * controllers/alertController.js
 * 
 * Handles operations for security alerts including listing, retrieval,
 * and status updates (Open, Investigating, Resolved).
 */

const Alert = require('../models/Alert');

/**
 * @route   GET /api/alerts
 * @desc    Get all alerts for the authenticated user (with filters & pagination)
 * @access  Private
 */
exports.getAlerts = async (req, res, next) => {
  try {
    const { status, severity, page = 1, limit = 50 } = req.query;
    const filter = { user: req.user._id };
    
    // Status can be Open, Investigating, Resolved
    if (status) filter.status = status;
    if (severity) filter.severity = severity;

    const limitVal = parseInt(limit);
    const pageVal = parseInt(page);
    const skipVal = (pageVal - 1) * limitVal;

    const [alerts, total] = await Promise.all([
      Alert.find(filter)
        .sort({ createdAt: -1 })
        .skip(skipVal)
        .limit(limitVal)
        .populate('relatedLogs'),
      Alert.countDocuments(filter),
    ]);

    res.json({
      alerts,
      total,
      page: pageVal,
      pages: Math.ceil(total / limitVal),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/alerts/:id
 * @desc    Get a single security alert by ID
 * @access  Private
 */
exports.getAlertById = async (req, res, next) => {
  try {
    const alert = await Alert.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).populate('relatedLogs');

    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    res.json({ alert });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/alerts/:id/status
 * @desc    Update alert status (triage workflow: Open -> Investigating -> Resolved)
 * @access  Private
 */
exports.updateAlertStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    
    if (!['Open', 'Investigating', 'Resolved'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Allowed: Open, Investigating, Resolved' });
    }

    const alert = await Alert.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { status },
      { new: true }
    ).populate('relatedLogs');

    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    res.json({ alert });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/alerts/stats
 * @desc    Get alert counts by status and severity for the dashboard
 * @access  Private
 */
exports.getAlertStats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [
      total,
      open,
      investigating,
      resolved,
      critical,
      high,
      medium,
      low,
    ] = await Promise.all([
      Alert.countDocuments({ user: userId }),
      Alert.countDocuments({ user: userId, status: 'Open' }),
      Alert.countDocuments({ user: userId, status: 'Investigating' }),
      Alert.countDocuments({ user: userId, status: 'Resolved' }),
      Alert.countDocuments({ user: userId, severity: 'Critical' }),
      Alert.countDocuments({ user: userId, severity: 'High' }),
      Alert.countDocuments({ user: userId, severity: 'Medium' }),
      Alert.countDocuments({ user: userId, severity: 'Low' }),
    ]);

    res.json({ total, open, investigating, resolved, critical, high, medium, low });
  } catch (error) {
    next(error);
  }
};
