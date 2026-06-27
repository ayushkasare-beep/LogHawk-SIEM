/**
 * ====================================
 * LogHawk – Parser Service
 * ====================================
 * services/parserService.js
 *
 * Bridge between the Express backend and the Python analysis engine.
 * Calls the appropriate Python parser as a child process, collects
 * the JSON output, and bulk-inserts events into MongoDB.
 *
 * Called asynchronously from logController so the upload endpoint
 * can return 202 Accepted immediately while parsing happens in background.
 */

const { execFile } = require('child_process');
const path = require('path');
const ParsedLog = require('../models/ParsedLog');
const UploadedFile = require('../models/UploadedFile');
const Alert = require('../models/Alert');
const DetectionRule = require('../models/DetectionRule');

// Map each log type to its parser script
const PARSER_SCRIPTS = {
  linux_auth: path.join(__dirname, '..', '..', 'python-engine', 'parsers', 'linux_auth_parser.py'),
};

// How many ParsedLog documents to insert at once
const BATCH_SIZE = 500;

/**
 * runPythonParser – Spawns the Python parser and returns parsed JSON.
 * @param {string}   scriptPath   - Absolute path to the Python parser script
 * @param {string}   filePath     - Absolute path to the uploaded log file
 * @param {string[]} enabledRules - List of rule IDs that are currently enabled
 * @returns {Promise<Object>} - { status, total, events, threats, stats }
 */
function runPythonParser(scriptPath, filePath, enabledRules) {
  // Use PYTHON_PATH env variable if set; otherwise fall back to 'python' (or 'python3')
  const PYTHON_CMD = process.env.PYTHON_PATH || 'python';

  // Pass enabled rules as a JSON-encoded argument so Python can skip disabled ones
  const args = [scriptPath, '--file', filePath, '--output', 'json'];
  if (enabledRules && enabledRules.length > 0) {
    args.push('--enabled-rules', JSON.stringify(enabledRules));
  }

  return new Promise((resolve, reject) => {
    execFile(
      PYTHON_CMD,
      args,
      {
        timeout: 120000,           // 2-minute cap for large files
        maxBuffer: 50 * 1024 * 1024, // 50MB stdout buffer
      },
      (error, stdout, stderr) => {
        if (error) {
          // Check if Python itself wasn't found
          if (error.code === 'ENOENT') {
            return reject(new Error(
              'Python interpreter not found. Ensure Python is installed and in PATH.'
            ));
          }
          return reject(new Error(
            `Parser process failed: ${stderr || error.message}`
          ));
        }

        if (!stdout || stdout.trim() === '') {
          return reject(new Error('Parser produced no output'));
        }

        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch {
          reject(new Error('Could not parse JSON output from analysis engine'));
        }
      }
    );
  });
}

/**
 * parseAndStore – Full pipeline: run parser → insert events → update file status.
 *
 * Runs in the background after the upload response is sent.
 * Updates UploadedFile.status to 'complete' or 'error' when done.
 *
 * @param {string}   filePath       - Server path to the uploaded file
 * @param {ObjectId} uploadedFileId - UploadedFile document _id
 * @param {ObjectId} userId         - Authenticated user's _id
 * @param {string}   logType        - 'linux_auth' | 'apache' | etc.
 */
async function parseAndStore(filePath, uploadedFileId, userId, logType) {
  const scriptPath = PARSER_SCRIPTS[logType];

  if (!scriptPath) {
    throw new Error(`No parser found for log type: ${logType}`);
  }

  // Fetch the original filename so we can store it on each event
  const uploadedFile = await UploadedFile.findById(uploadedFileId).lean();
  const sourceFilename = uploadedFile ? uploadedFile.filename : 'unknown';

  // Load user's enabled detection rules from DB (default: all enabled)
  const storedRules = await DetectionRule.find({ user: userId }).lean();
  const disabledRules = storedRules.filter((r) => !r.enabled).map((r) => r.ruleId);
  // Pass only the IDs that are NOT disabled — Python will skip absent ones
  const ALL_RULE_IDS = ['brute_force', 'password_spray', 'account_enum', 'abnormal_login',
    'privilege_escalation', 'reconnaissance', 'suspicious_ip', 'port_scan'];
  const enabledRules = ALL_RULE_IDS.filter((id) => !disabledRules.includes(id));

  // Run Python parser with the enabled rule list
  const result = await runPythonParser(scriptPath, filePath, enabledRules);

  if (result.status !== 'success') {
    throw new Error(result.error || 'Parser returned an error status');
  }

  const events = result.events || [];
  const threats = result.threats || [];

  if (events.length === 0) {
    // File parsed but found no recognizable events — still mark complete
    await UploadedFile.findByIdAndUpdate(uploadedFileId, {
      status: 'complete',
      totalEvents: 0,
    });
    return { total: 0, failed: 0, successful: 0, unknown: 0 };
  }

  const allInsertedDocs = [];

  // Bulk-insert in batches to avoid hitting MongoDB's 16MB document limit
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE).map((evt) => ({
      uploadedFile: uploadedFileId,
      uploadedBy: userId,
      timestamp: evt.timestamp ? new Date(evt.timestamp) : null,
      username: evt.username || null,
      ipAddress: evt.ipAddress || null,
      eventType: evt.eventType || 'Other',
      status: evt.status || 'Unknown',
      rawLog: evt.rawLog || '',
      sourceFile: sourceFilename,
    }));

    // ordered: false means a single invalid doc won't block the whole batch
    const inserted = await ParsedLog.insertMany(batch, { ordered: false });
    allInsertedDocs.push(...inserted);
  }

  // Generate alerts from threats
  const alertsToInsert = threats.map((threat) => {
    // Determine alertType
    let alertType = 'Security Threat Detected';
    if (['brute_force', 'brute_force_success'].includes(threat.type)) {
      alertType = threat.type === 'brute_force_success' ? 'Possible Account Compromise' : 'Brute Force Attack';
    } else if (threat.type === 'password_spray') {
      alertType = 'Password Spray Attack';
    } else if (threat.type === 'account_enumeration') {
      alertType = 'Account Enumeration';
    } else if (threat.type === 'abnormal_login') {
      alertType = 'Suspicious Login Location';
    } else if (threat.type === 'privilege_escalation') {
      alertType = 'Privilege Escalation';
    } else if (threat.type === 'reconnaissance') {
      alertType = 'Reconnaissance Activity';
    } else if (threat.type === 'suspicious_ip') {
      alertType = 'Suspicious IP Activity';
    } else if (threat.type === 'port_scan') {
      alertType = 'Port Scan Detected';
    }

    // Map log entries
    const ip = threat.source_ip;
    let matchingLogs = [];
    if (threat.type === 'brute_force' || threat.type === 'brute_force_success') {
      matchingLogs = allInsertedDocs.filter(
        (log) => log.ipAddress === ip && (log.eventType === 'Login' || log.eventType === 'Authentication')
      );
    } else if (threat.type === 'password_spray') {
      // Match failed login logs from the spray IP
      matchingLogs = allInsertedDocs.filter(
        (log) => log.ipAddress === ip && log.status === 'Failed'
      );
    } else if (threat.type === 'account_enumeration') {
      // Match all auth attempts from the enumeration IP
      matchingLogs = allInsertedDocs.filter(
        (log) => log.ipAddress === ip
      ).slice(0, 50); // cap to 50 to keep document size manageable
    } else if (threat.type === 'abnormal_login') {
      // Match successful logins from the flagged IP
      matchingLogs = allInsertedDocs.filter(
        (log) => log.ipAddress === ip && log.status === 'Success'
      );
    } else if (threat.type === 'suspicious_ip' || threat.type === 'port_scan') {
      matchingLogs = allInsertedDocs.filter((log) => log.ipAddress === ip);
    } else if (threat.type === 'privilege_escalation') {
      const sudoRegex = /sudo.*FAILED|su\[\d+\]:\s+FAILED|NOT in sudoers|privilege\s+escalation|changed\s+password|useradd|usermod|groupadd|chmod\s+[47]/i;
      matchingLogs = allInsertedDocs.filter((log) => sudoRegex.test(log.rawLog));
    } else if (threat.type === 'reconnaissance') {
      const reconRegex = /\.\.|%2e%2e|\/etc\/passwd|\/etc\/shadow|\.env|wp-config|config\.php|\/admin|\/phpmyadmin|\/wp-admin|nmap|nikto|dirb|gobuster|masscan|invalid user/i;
      matchingLogs = allInsertedDocs.filter((log) => reconRegex.test(log.rawLog));
    }

    // Extract username if possible
    const firstLogWithUser = matchingLogs.find((l) => l.username);
    const username = firstLogWithUser ? firstLogWithUser.username : null;

    // Map severity to Title Case: Low, Medium, High, Critical
    let severity = 'Low';
    if (threat.severity) {
      severity = threat.severity.charAt(0).toUpperCase() + threat.severity.slice(1).toLowerCase();
      if (!['Low', 'Medium', 'High', 'Critical'].includes(severity)) {
        severity = 'Low';
      }
    }

    return {
      user: userId,
      alertType,
      severity,
      description: threat.description || `${alertType} detected`,
      sourceIP: threat.source_ip !== 'N/A' && threat.source_ip !== 'unknown' ? threat.source_ip : null,
      username,
      status: 'Open',
      sourceFile: sourceFilename,
      riskScore: threat.confidence || 75,
      recommendedAction: threat.recommendation || 'Verify source IP activity and check authorization.',
      relatedLogs: matchingLogs.map((l) => l._id),
    };
  });

  if (alertsToInsert.length > 0) {
    await Alert.insertMany(alertsToInsert);
  }

  // Mark file as processed
  await UploadedFile.findByIdAndUpdate(uploadedFileId, {
    status: 'complete',
    totalEvents: events.length,
  });

  return result.stats || { total: events.length };
}

module.exports = { parseAndStore };
