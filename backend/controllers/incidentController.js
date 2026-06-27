/**
 * LogHawk – Incident Controller
 * controllers/incidentController.js
 *
 * Full CRUD + response actions for the Incident Response module.
 * All endpoints are protected (require authenticated user via JWT middleware).
 */

const Incident = require('../models/Incident');
const ResponseAction = require('../models/ResponseAction');
const BlockedAsset = require('../models/BlockedAsset');
const Alert = require('../models/Alert');

// Analyst list (configurable — no real auth required for this demo platform)
const ANALYSTS = ['SOC Analyst 1', 'SOC Analyst 2', 'SOC Analyst 3'];

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/incidents/stats
// ─────────────────────────────────────────────────────────────────────────────
exports.getIncidentStats = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const [open, inProgress, resolved, closed, critical] = await Promise.all([
      Incident.countDocuments({ createdBy: userId, status: 'Open' }),
      Incident.countDocuments({ createdBy: userId, status: 'In Progress' }),
      Incident.countDocuments({ createdBy: userId, status: 'Resolved' }),
      Incident.countDocuments({ createdBy: userId, status: 'Closed' }),
      Incident.countDocuments({ createdBy: userId, severity: 'Critical' }),
    ]);
    res.json({ open, inProgress, resolved, closed, critical, total: open + inProgress + resolved + closed });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/incidents
// ─────────────────────────────────────────────────────────────────────────────
exports.getIncidents = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { status, severity, search, page = 1, limit = 25 } = req.query;

    const query = { createdBy: userId };
    if (status) query.status = status;
    if (severity) query.severity = severity;
    if (search) {
      const re = new RegExp(search, 'i');
      query.$or = [{ title: re }, { incidentId: re }, { sourceIp: re }, { assignedTo: re }];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [incidents, total] = await Promise.all([
      Incident.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Incident.countDocuments(query),
    ]);

    res.json({ incidents, total, pages: Math.ceil(total / Number(limit)), page: Number(page) });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/incidents  — create from alert
// ─────────────────────────────────────────────────────────────────────────────
exports.createIncident = async (req, res, next) => {
  try {
    const { alertId, title, severity, sourceIp, username, threatType, riskScore, relatedLogs } = req.body;

    // Build the incident
    const incident = new Incident({
      title: title || 'Security Incident',
      severity: severity || 'Medium',
      status: 'Open',
      assignedTo: 'Unassigned',
      sourceIp: sourceIp || null,
      username: username || null,
      alertId: alertId || null,
      threatType: threatType || '',
      riskScore: riskScore || 0,
      relatedLogs: relatedLogs || [],
      notes: [],
      timeline: [{ event: 'Incident created', actor: req.user.name || 'SOC Analyst', timestamp: new Date() }],
      createdBy: req.user._id,
    });

    await incident.save();

    // Link the alert to this incident and set status to Investigating
    if (alertId) {
      await Alert.findByIdAndUpdate(alertId, {
        incidentId: incident._id,
        status: 'Investigating',
      });
    }

    res.status(201).json({ incident });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/incidents/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.getIncidentById = async (req, res, next) => {
  try {
    const incident = await Incident.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
    })
      .populate({ path: 'alertId', select: 'alertType severity riskScore recommendedAction description sourceIP status' })
      .populate({ path: 'relatedLogs', select: 'rawLog timestamp eventType status username ipAddress', options: { limit: 50 } })
      .lean();

    if (!incident) return res.status(404).json({ message: 'Incident not found' });

    // Fetch response actions for this incident
    const actions = await ResponseAction.find({ incidentId: incident._id }).sort({ timestamp: 1 }).lean();

    res.json({ incident, actions });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/incidents/:id   — update title / severity / status
// ─────────────────────────────────────────────────────────────────────────────
exports.updateIncident = async (req, res, next) => {
  try {
    const { title, severity, status } = req.body;
    const incident = await Incident.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!incident) return res.status(404).json({ message: 'Incident not found' });

    if (title) incident.title = title;
    if (severity) incident.severity = severity;

    if (status && status !== incident.status) {
      incident.status = status;
      incident.timeline.push({ event: `Status changed to ${status}`, actor: req.user.name || 'SOC Analyst' });
    }

    await incident.save();
    res.json({ incident });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/incidents/:id/assign
// ─────────────────────────────────────────────────────────────────────────────
exports.assignIncident = async (req, res, next) => {
  try {
    const { analyst } = req.body;
    if (!analyst) return res.status(400).json({ message: 'analyst name is required' });

    const incident = await Incident.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!incident) return res.status(404).json({ message: 'Incident not found' });

    incident.assignedTo = analyst;
    incident.timeline.push({ event: `Assigned to ${analyst}`, actor: req.user.name || 'SOC Analyst' });

    // Also set status to In Progress if still Open
    if (incident.status === 'Open') {
      incident.status = 'In Progress';
      incident.timeline.push({ event: 'Status changed to In Progress', actor: 'System' });
    }

    await incident.save();
    res.json({ incident });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/incidents/:id/note
// ─────────────────────────────────────────────────────────────────────────────
exports.addNote = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: 'Note text is required' });

    const incident = await Incident.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!incident) return res.status(404).json({ message: 'Incident not found' });

    const note = { text: text.trim(), author: req.user.name || 'SOC Analyst', createdAt: new Date() };
    incident.notes.push(note);
    incident.timeline.push({ event: 'Investigation note added', actor: req.user.name || 'SOC Analyst' });

    await incident.save();
    res.json({ incident });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/incidents/:id/respond   — execute a response action
// ─────────────────────────────────────────────────────────────────────────────
exports.respondToIncident = async (req, res, next) => {
  try {
    const { action, ip, username, reason } = req.body;
    const allowed = ['block_ip', 'disable_user', 'false_positive', 'escalate'];
    if (!allowed.includes(action)) {
      return res.status(400).json({ message: `Invalid action. Allowed: ${allowed.join(', ')}` });
    }

    const incident = await Incident.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!incident) return res.status(404).json({ message: 'Incident not found' });

    const analyst = req.user.name || 'SOC Analyst';

    // Create the response action record
    const responseAction = await ResponseAction.create({
      incidentId: incident._id,
      incidentRef: incident.incidentId,
      action,
      ip: ip || incident.sourceIp || null,
      username: username || incident.username || null,
      reason: reason || '',
      performedBy: analyst,
    });

    let timelineEvent = '';
    let message = '';

    if (action === 'block_ip') {
      const targetIp = ip || incident.sourceIp;
      if (!targetIp) return res.status(400).json({ message: 'IP address is required for block_ip action' });

      // Create blocked asset record
      await BlockedAsset.create({
        ip: targetIp,
        reason: reason || `Blocked from incident ${incident.incidentId}`,
        incidentId: incident._id,
        incidentRef: incident.incidentId,
        blockedByUser: req.user._id,
        blockedBy: analyst,
      });

      timelineEvent = `Block IP action executed on ${targetIp}`;
      message = `IP ${targetIp} has been blocked and added to the Blocked Assets list.`;

    } else if (action === 'disable_user') {
      const targetUser = username || incident.username || 'unknown';
      timelineEvent = `Disable User action executed for ${targetUser}`;
      message = `User account "${targetUser}" has been flagged for disablement. Update your AD/IAM system accordingly.`;

    } else if (action === 'false_positive') {
      incident.isFalsePositive = true;
      incident.status = 'Closed';
      incident.timeline.push({ event: 'Status changed to Closed', actor: 'System' });

      // Close the linked alert too
      if (incident.alertId) {
        await Alert.findByIdAndUpdate(incident.alertId, { status: 'Resolved' });
      }

      timelineEvent = 'Marked as False Positive — Incident closed';
      message = 'Incident has been marked as a false positive and closed. The linked alert has been resolved.';

    } else if (action === 'escalate') {
      timelineEvent = 'Incident escalated to Tier 2/Management';
      message = 'Incident has been escalated. Notify the appropriate team for further investigation.';
    }

    incident.timeline.push({ event: timelineEvent, actor: analyst });
    await incident.save();

    res.json({ incident, responseAction, message });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/incidents/:id/resolve
// ─────────────────────────────────────────────────────────────────────────────
exports.resolveIncident = async (req, res, next) => {
  try {
    const { status = 'Resolved' } = req.body;
    if (!['Resolved', 'Closed'].includes(status)) {
      return res.status(400).json({ message: 'status must be Resolved or Closed' });
    }

    const incident = await Incident.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!incident) return res.status(404).json({ message: 'Incident not found' });

    incident.status = status;
    incident.timeline.push({ event: `Incident ${status}`, actor: req.user.name || 'SOC Analyst' });
    await incident.save();

    res.json({ incident });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/blocked-assets
// ─────────────────────────────────────────────────────────────────────────────
exports.getBlockedAssets = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { search, page = 1, limit = 25 } = req.query;

    const query = { blockedByUser: userId };
    if (search) {
      const re = new RegExp(search, 'i');
      query.$or = [{ ip: re }, { reason: re }, { incidentRef: re }];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [assets, total] = await Promise.all([
      BlockedAsset.find(query)
        .sort({ blockedAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      BlockedAsset.countDocuments(query),
    ]);

    res.json({
      assets,
      total,
      pages: Math.ceil(total / Number(limit)),
      page: Number(page),
    });
  } catch (error) {
    next(error);
  }
};
