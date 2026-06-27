/**
 * LogHawk – Detection Rules Controller
 * controllers/detectionRulesController.js
 *
 * Manages per-user detection rule configurations.
 * Rules default to enabled=true if no override exists.
 */

const DetectionRule = require('../models/DetectionRule');

// All valid rule IDs (must stay in sync with frontend DETECTION_RULES)
const ALL_RULE_IDS = [
  'brute_force',
  'password_spray',
  'account_enum',
  'abnormal_login',
  'privilege_escalation',
  'reconnaissance',
  'suspicious_ip',
  'port_scan',
];

/**
 * GET /api/detection-rules
 * Returns enabled/disabled state for all 8 rules for the authenticated user.
 * Rules not yet stored in the DB are returned as enabled=true (default).
 */
exports.getRules = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const stored = await DetectionRule.find({ user: userId }).lean();
    const storedMap = {};
    stored.forEach((r) => { storedMap[r.ruleId] = r.enabled; });

    // Merge stored states with defaults
    const rules = ALL_RULE_IDS.map((id) => ({
      ruleId: id,
      enabled: storedMap[id] !== undefined ? storedMap[id] : true,
    }));

    res.json({ rules });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/detection-rules/:ruleId
 * Toggle a single rule on or off. Upserts a record for this user + ruleId.
 */
exports.updateRule = async (req, res, next) => {
  try {
    const { ruleId } = req.params;
    const { enabled } = req.body;

    if (!ALL_RULE_IDS.includes(ruleId)) {
      return res.status(400).json({ message: `Unknown rule ID: ${ruleId}` });
    }
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: '`enabled` must be a boolean' });
    }

    const rule = await DetectionRule.findOneAndUpdate(
      { user: req.user._id, ruleId },
      { enabled },
      { upsert: true, new: true }
    );

    res.json({ rule: { ruleId: rule.ruleId, enabled: rule.enabled } });
  } catch (error) {
    next(error);
  }
};
