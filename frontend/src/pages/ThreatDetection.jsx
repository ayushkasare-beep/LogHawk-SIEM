/**
 * LogHawk – Threat Detection Rules Page
 *
 * Displays active detection signatures running within the Python backend engine.
 * Allows analysts to review trigger thresholds, MITRE ATT&CK tactics, severity,
 * and toggle rules. State is persisted in MongoDB (per-user) via the API.
 */

import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import useDocumentTitle from '../hooks/useDocumentTitle'
import './ThreatDetection.css'

const DETECTION_RULES = [
  {
    id: 'brute_force',
    name: 'Brute Force Attack Detection',
    tactic: 'Credential Access',
    mitreId: 'T1110',
    severity: 'High',
    description: 'Identifies high volumes of sequential authentication failures from a single source IP targeting a specific account within a short timeframe.',
    logic: 'Failed auth attempts > 5 from same IP in 5 min',
    source: 'linux_auth',
  },
  {
    id: 'password_spray',
    name: 'Password Spray Attack Detection',
    tactic: 'Credential Access',
    mitreId: 'T1110.003',
    severity: 'High',
    description: 'Identifies credential guessing attempts targeting multiple accounts across the system from a single source IP using identical passwords.',
    logic: 'Failed auth attempts against > 3 unique accounts from same IP in 10 min',
    source: 'linux_auth',
  },
  {
    id: 'account_enum',
    name: 'Account Enumeration Detection',
    tactic: 'Discovery',
    mitreId: 'T1087',
    severity: 'Medium',
    description: 'Flags traffic where an IP repeatedly attempts access using non-existent or invalid usernames, indicative of user discovery probes.',
    logic: 'Failed logins targeting > 5 unique invalid usernames from same IP',
    source: 'linux_auth',
  },
  {
    id: 'abnormal_login',
    name: 'Suspicious Login Location Detection',
    tactic: 'Initial Access',
    mitreId: 'T1078',
    severity: 'Medium',
    description: 'Flags successful authentications originating from unrecognized CIDR ranges, abnormal IP geolocations, or local alert history watchlists.',
    logic: 'Successful auth from IP matched in threat intelligence list',
    source: 'linux_auth',
  },
  {
    id: 'privilege_escalation',
    name: 'Privilege Escalation Detection',
    tactic: 'Privilege Escalation',
    mitreId: 'T1068',
    severity: 'Critical',
    description: 'Detects attempts to execute unauthorized commands with root permissions, su command failures, or suspicious sudo configurations changes.',
    logic: 'su/sudo authentication failure or execution by non-sudoers',
    source: 'linux_auth',
  },
  {
    id: 'reconnaissance',
    name: 'Reconnaissance & Scan Detection',
    tactic: 'Reconnaissance',
    mitreId: 'T1595',
    severity: 'Medium',
    description: 'Flags connections attempting access to common vulnerability endpoints, configuration files (e.g. .env), or known automated scanners.',
    logic: 'Raw log string matches scan keywords (e.g. wp-admin, config.php, etc/passwd)',
    source: 'linux_auth',
  },
  {
    id: 'suspicious_ip',
    name: 'Suspicious IP Network Activity',
    tactic: 'Impact',
    mitreId: 'T1090',
    severity: 'Medium',
    description: 'Identifies connection activity originating from IP addresses matching previous historical system alerts or local incident files.',
    logic: 'Connection matches source IP listed in active Alert collection',
    source: 'linux_auth',
  },
  {
    id: 'port_scan',
    name: 'Network Port Scanning Detection',
    tactic: 'Discovery',
    mitreId: 'T1046',
    severity: 'Medium',
    description: 'Identifies reconnaissance scanning traffic mapping open host listening ports in a short duration.',
    logic: 'Connections targeting multiple unique ports from single IP in 1 min',
    source: 'linux_auth',
  },
]

function ThreatDetection() {
  useDocumentTitle('Threat Detection')
  const [rules, setRules] = useState([])
  const [loadingRules, setLoadingRules] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [syncError, setSyncError] = useState(null)

  // Fetch rule states from backend on mount
  const fetchRules = useCallback(async () => {
    setLoadingRules(true)
    setSyncError(null)
    try {
      const res = await api.get('/api/detection-rules')
      const stateMap = {}
      res.data.rules.forEach((r) => { stateMap[r.ruleId] = r.enabled })
      const initialized = DETECTION_RULES.map((rule) => ({
        ...rule,
        enabled: stateMap[rule.id] !== undefined ? stateMap[rule.id] : true,
      }))
      setRules(initialized)
    } catch {
      // Graceful fallback: show all rules enabled if API unavailable
      setSyncError('Could not sync rule states from server — showing defaults.')
      setRules(DETECTION_RULES.map((rule) => ({ ...rule, enabled: true })))
    } finally {
      setLoadingRules(false)
    }
  }, [])

  useEffect(() => { fetchRules() }, [fetchRules])

  // Toggle rule and persist to backend
  const handleToggle = async (id) => {
    const rule = rules.find((r) => r.id === id)
    if (!rule || savingId) return

    const newEnabled = !rule.enabled
    // Optimistic update
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, enabled: newEnabled } : r))
    setSavingId(id)

    try {
      await api.patch(`/api/detection-rules/${id}`, { enabled: newEnabled })
    } catch {
      // Revert on error
      setRules((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !newEnabled } : r))
      setSyncError('Failed to save rule state — please try again.')
    } finally {
      setSavingId(null)
    }
  }

  const activeCount = rules.filter(r => r.enabled).length
  const criticalCount = rules.filter(r => r.severity === 'Critical' && r.enabled).length
  const highCount = rules.filter(r => r.severity === 'High' && r.enabled).length

  return (
    <div className="detection-page" id="threat-detection-page">
      {/* Header */}
      <div className="detection-header">
        <h1 className="detection-title">Threat Detection Rules</h1>
        <p className="detection-desc">
          Review and configure active detection signatures executed during log ingestion.
          Rule states are saved per-analyst and applied at next log upload.
        </p>
      </div>

      {/* Sync error banner */}
      {syncError && (
        <div className="rules-sync-error" role="alert">
          ⚠️ {syncError}
        </div>
      )}

      {/* Rules Overview Stats */}
      <div className="rules-stats-row">
        <div className="rules-stat-card glass-card">
          <span className="rules-stat-icon" style={{ color: 'var(--color-accent)' }}>🛡️</span>
          <div>
            <div className="rules-stat-value">{rules.length}</div>
            <div className="rules-stat-label">Total Signatures</div>
          </div>
        </div>
        <div className="rules-stat-card glass-card">
          <span className="rules-stat-icon" style={{ color: 'var(--color-info)' }}>⚡</span>
          <div>
            <div className="rules-stat-value">{loadingRules ? '—' : activeCount}</div>
            <div className="rules-stat-label">Enabled Rules</div>
          </div>
        </div>
        <div className="rules-stat-card glass-card">
          <span className="rules-stat-icon" style={{ color: 'var(--color-danger)' }}>🔥</span>
          <div>
            <div className="rules-stat-value">{loadingRules ? '—' : criticalCount}</div>
            <div className="rules-stat-label">Active Critical Rules</div>
          </div>
        </div>
        <div className="rules-stat-card glass-card">
          <span className="rules-stat-icon" style={{ color: '#F97316' }}>🟠</span>
          <div>
            <div className="rules-stat-value">{loadingRules ? '—' : highCount}</div>
            <div className="rules-stat-label">Active High Rules</div>
          </div>
        </div>
      </div>

      {/* Rules Grid */}
      <div className="rules-grid">
        {loadingRules
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rule-card glass-card rule-card-skeleton">
                <div className="skeleton-line skeleton-short" />
                <div className="skeleton-line skeleton-long" />
                <div className="skeleton-line skeleton-medium" />
              </div>
            ))
          : rules.map((rule) => (
          <div key={rule.id} className="rule-card glass-card" id={`rule-${rule.id}`}>
            <div className="rule-card-header">
              <span className="rule-tactic" title={`MITRE ATT&CK: ${rule.mitreId}`}>
                {rule.tactic} ({rule.mitreId})
              </span>
              <span className={`rule-severity-badge severity-${rule.severity.toLowerCase()}`}>
                {rule.severity}
              </span>
            </div>

            <div className="rule-name-row">
              <h3 className="rule-name">{rule.name}</h3>
            </div>

            <p className="rule-desc">{rule.description}</p>

            <div className="rule-meta-section">
              <div className="rule-meta-title">Trigger Criteria</div>
              <div className="rule-logic-code">{rule.logic}</div>
            </div>

            <div className="rule-card-footer">
              <span className="rule-status-label">
                Status:{' '}
                {savingId === rule.id ? (
                  <span className="status-saving-text">Saving…</span>
                ) : rule.enabled ? (
                  <span className="status-active-text">Active</span>
                ) : (
                  <span className="status-inactive-text">Disabled</span>
                )}
              </span>
              <label className="switch-control" title={savingId ? 'Saving…' : undefined}>
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={() => handleToggle(rule.id)}
                  disabled={savingId === rule.id}
                  aria-label={`Toggle ${rule.name}`}
                />
                <span className="switch-slider" />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ThreatDetection

