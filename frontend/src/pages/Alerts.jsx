/**
 * LogHawk – Alert Center Page
 *
 * Full SOC Alert Triage Center with:
 *   - Stats dashboard cards (total, open, investigating, resolved, critical, high)
 *   - Filterable/sortable alert table with attack type, severity, status, search
 *   - Pagination with configurable page size
 *   - Alert Detail Panel: detection reason, event timeline, related logs
 *   - Status management: Open → Investigating → Resolved
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../services/api'
import useDocumentTitle from '../hooks/useDocumentTitle'
import './Alerts.css'

// ─── Severity helpers ──────────────────────────────────────────────────────────
const SEVERITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 }
const ATTACK_TYPES = [
  'Brute Force Attack',
  'Password Spray Attack',
  'Account Enumeration',
  'Possible Account Compromise',
  'Suspicious Login Location',
  'Privilege Escalation',
  'Reconnaissance Activity',
  'Suspicious IP Activity',
  'Port Scan Detected',
]

function SeverityBadge({ severity }) {
  return (
    <span className={`severity-chip severity-chip-${severity?.toLowerCase()}`}>
      {severity}
    </span>
  )
}

function StatusChip({ status }) {
  return (
    <span className={`status-chip status-chip-${status?.toLowerCase().replace(' ', '_')}`}>
      {status}
    </span>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function AlertStatCard({ label, value, colorClass, icon }) {
  return (
    <div className={`alert-stat-card ${colorClass}`}>
      <span className="alert-stat-icon">{icon}</span>
      <div className="alert-stat-content">
        <span className="alert-stat-value">{value ?? 0}</span>
        <span className="alert-stat-label">{label}</span>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
function Alerts() {
  useDocumentTitle('Alerts')
  // Data state
  const [alerts, setAlerts] = useState([])
  const [stats, setStats] = useState({ total: 0, open: 0, investigating: 0, resolved: 0, critical: 0, high: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [expandedLogId, setExpandedLogId] = useState(null)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Filters
  const [statusFilter, setStatusFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [attackTypeFilter, setAttackTypeFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Sort
  const [sortField, setSortField] = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc') // 'asc' | 'desc'

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const PAGE_SIZE = 25

  // ── Fetch stats ────────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/api/alerts/stats')
      setStats(res.data)
    } catch (err) {
      console.error('Failed to fetch alert stats:', err)
    }
  }, [])

  // ── Fetch alerts ───────────────────────────────────────────────────────────
  const fetchAlerts = useCallback(async (resetPage = false) => {
    setLoading(true)
    setError(null)
    const targetPage = resetPage ? 1 : page
    if (resetPage) setPage(1)

    try {
      const params = { page: targetPage, limit: PAGE_SIZE }
      if (statusFilter) params.status = statusFilter
      if (severityFilter) params.severity = severityFilter

      const response = await api.get('/api/alerts', { params })
      let data = response.data.alerts || []

      // Client-side filter: attack type + search (backend doesn't expose these as query params yet)
      if (attackTypeFilter) {
        data = data.filter(a => a.alertType === attackTypeFilter)
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        data = data.filter(a =>
          a.alertType?.toLowerCase().includes(q) ||
          a.description?.toLowerCase().includes(q) ||
          a.sourceIP?.toLowerCase().includes(q) ||
          a.username?.toLowerCase().includes(q)
        )
      }

      setAlerts(data)
      setTotalCount(response.data.total || data.length)
      setTotalPages(response.data.pages || Math.ceil((response.data.total || data.length) / PAGE_SIZE))

      // Keep selected alert in sync
      if (selectedAlert) {
        const updated = data.find(a => a._id === selectedAlert._id)
        if (updated) setSelectedAlert(updated)
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err)
      setError('Could not retrieve alerts. Please ensure the backend is running.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, severityFilter, attackTypeFilter, searchQuery, page, selectedAlert])

  // Initial load + re-fetch on filter/page change
  useEffect(() => {
    fetchStats()
  }, [])

  useEffect(() => {
    fetchAlerts(true) // reset to page 1 when filters change
  }, [statusFilter, severityFilter, attackTypeFilter, searchQuery])

  useEffect(() => {
    fetchAlerts(false)
  }, [page])

  // ── Sorted alerts ──────────────────────────────────────────────────────────
  const sortedAlerts = useMemo(() => {
    return [...alerts].sort((a, b) => {
      let valA, valB
      if (sortField === 'severity') {
        valA = SEVERITY_ORDER[a.severity] ?? 99
        valB = SEVERITY_ORDER[b.severity] ?? 99
      } else if (sortField === 'createdAt') {
        valA = new Date(a.createdAt).getTime()
        valB = new Date(b.createdAt).getTime()
      } else if (sortField === 'alertType') {
        valA = a.alertType || ''
        valB = b.alertType || ''
      } else {
        valA = a[sortField] || ''
        valB = b[sortField] || ''
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1
      if (valA > valB) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [alerts, sortField, sortDir])

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="sort-icon sort-icon-neutral">↕</span>
    return <span className="sort-icon sort-icon-active">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // ── Update status ──────────────────────────────────────────────────────────
  const handleUpdateStatus = async (alertId, newStatus) => {
    setStatusUpdating(true)
    try {
      await api.patch(`/api/alerts/${alertId}/status`, { status: newStatus })
      setAlerts(prev => prev.map(a => a._id === alertId ? { ...a, status: newStatus } : a))
      if (selectedAlert?._id === alertId) {
        setSelectedAlert(prev => ({ ...prev, status: newStatus }))
      }
      showToast(`Alert status updated to ${newStatus}`, 'success')
      fetchStats() // refresh stat cards
    } catch (err) {
      console.error('Failed to update status:', err)
      showToast('Error updating alert status.', 'error')
    } finally {
      setStatusUpdating(false)
    }
  }

  // ── Create Incident ────────────────────────────────────────────────────────
  const handleCreateIncident = async (alert) => {
    setStatusUpdating(true)
    try {
      const title = `${alert.alertType} - ${alert.sourceIP || alert.username || 'Threat'}`
      const res = await api.post('/api/incidents', {
        alertId: alert._id,
        title,
        severity: alert.severity,
        sourceIp: alert.sourceIP,
        username: alert.username,
        threatType: alert.alertType,
        riskScore: alert.riskScore,
        relatedLogs: alert.relatedLogs?.map(log => log._id) || []
      })

      const incidentId = res.data.incident._id
      setAlerts(prev => prev.map(a => a._id === alert._id ? { ...a, status: 'Investigating', incidentId } : a))
      if (selectedAlert?._id === alert._id) {
        setSelectedAlert(prev => ({ ...prev, status: 'Investigating', incidentId }))
      }
      showToast('Incident created successfully!', 'success')
      fetchStats()
    } catch (err) {
      console.error('Failed to create incident:', err)
      showToast(err.response?.data?.message || 'Error creating incident', 'error')
    } finally {
      setStatusUpdating(false)
    }
  }

  // ── Formatters ─────────────────────────────────────────────────────────────
  const formatTimestamp = (ts) => {
    if (!ts) return 'N/A'
    return new Date(ts).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    })
  }

  const formatTimeAgo = (ts) => {
    if (!ts) return ''
    const ms = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(ms / 60000)
    const hrs = Math.floor(mins / 60)
    const days = Math.floor(hrs / 24)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    if (hrs < 24) return `${hrs}h ago`
    return `${days}d ago`
  }

  // ── Detection reason builder ───────────────────────────────────────────────
  const getDetectionReason = (alert) => {
    const ip = alert.sourceIP || 'unknown IP'
    const user = alert.username || 'unknown user'
    const count = alert.relatedLogs?.length || 0

    const reasons = {
      'Brute Force Attack': `Detected ${count} failed login attempt${count !== 1 ? 's' : ''} from ${ip} within the analysis window, exceeding the brute force threshold of 5 failures.`,
      'Password Spray Attack': `Source IP ${ip} attempted authentication against multiple unique accounts with failed logins, indicating a low-and-slow password spray pattern designed to evade account lockout.`,
      'Account Enumeration': `IP ${ip} probed a large number of unique usernames in authentication requests. This volume of unique account targets indicates systematic user discovery activity.`,
      'Possible Account Compromise': `A successful login from ${ip} was detected following multiple prior failed attempts. This pattern suggests a successful brute force or credential stuffing attack for user ${user}.`,
      'Suspicious Login Location': `A login event for ${user} originated from ${ip}, which is classified as an unexpected or unusual source address. This may indicate unauthorized access or lateral movement.`,
      'Privilege Escalation': `Log events indicate an attempt to escalate system privileges (e.g., sudo failure, forbidden command, or unauthorized user modification) by ${user}.`,
      'Reconnaissance Activity': `Log patterns matching known reconnaissance signatures (path traversal, admin probing, scanner user-agents) were detected from ${ip}.`,
      'Suspicious IP Activity': `IP address ${ip} exhibited unusual access patterns flagged by the threat detection engine. Activity volume or pattern is atypical for legitimate users.`,
      'Port Scan Detected': `Rapid sequential connection attempts to multiple ports were detected from ${ip}, characteristic of automated port scanning activity.`,
    }
    return reasons[alert.alertType] || `${alert.alertType} detected. ${count} related log events identified.`
  }

  // ── Timeline: sort related logs by timestamp ───────────────────────────────
  const getTimeline = (alert) => {
    if (!alert.relatedLogs?.length) return []
    return [...alert.relatedLogs].sort((a, b) =>
      new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="alerts-page" id="alerts-center-page">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="alerts-page-header">
        <div>
          <h1 className="alerts-page-title">SOC Alert Center</h1>
          <p className="alerts-page-desc">Triage, investigate, and mitigate security threats in real-time.</p>
        </div>
        <button
          className="btn btn-outline"
          id="refresh-alerts-btn"
          onClick={() => { fetchAlerts(false); fetchStats() }}
          style={{ height: '38px', fontSize: '0.8rem' }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* ── Stats Cards ─────────────────────────────────────────────────── */}
      <div className="alerts-stats-row">
        <AlertStatCard label="Total Alerts" value={stats.total} icon="🔔" colorClass="stat-neutral" />
        <AlertStatCard label="Open" value={stats.open} icon="🆕" colorClass="stat-info" />
        <AlertStatCard label="Investigating" value={stats.investigating} icon="⚡" colorClass="stat-warning" />
        <AlertStatCard label="Resolved" value={stats.resolved} icon="✅" colorClass="stat-success" />
        <AlertStatCard label="Critical" value={stats.critical} icon="🔥" colorClass="stat-critical" />
        <AlertStatCard label="High" value={stats.high} icon="⚠️" colorClass="stat-high" />
      </div>

      {/* ── Filter & Search Bar ──────────────────────────────────────────── */}
      <div className="alerts-control-bar glass-card">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            id="alert-search-input"
            placeholder="Search by IP, username, alert type..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value) }}
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery('')} title="Clear search">✕</button>
          )}
        </div>

        <div className="filter-dropdowns">
          <div className="filter-group">
            <label>Attack Type</label>
            <select id="filter-attack-type" value={attackTypeFilter} onChange={e => setAttackTypeFilter(e.target.value)}>
              <option value="">All Types</option>
              {ATTACK_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Severity</label>
            <select id="filter-severity" value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
              <option value="">All Severities</option>
              <option value="Critical">🔴 Critical</option>
              <option value="High">🟠 High</option>
              <option value="Medium">🟡 Medium</option>
              <option value="Low">🔵 Low</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Status</label>
            <select id="filter-status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="Open">🆕 Open</option>
              <option value="Investigating">⚡ Investigating</option>
              <option value="Resolved">✅ Resolved</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Main Workspace ───────────────────────────────────────────────── */}
      <div className="alerts-workspace">

        {/* Left: Alert Table */}
        <div className="alerts-list-panel glass-card">
          {loading && alerts.length === 0 ? (
            <div className="alerts-loading-state">
              <div className="spinner" />
              <p>Loading security alerts...</p>
            </div>
          ) : error ? (
            <div className="alerts-error-state">
              <span className="error-icon">⚠️</span>
              <p>{error}</p>
            </div>
          ) : sortedAlerts.length === 0 ? (
            <div className="alerts-empty-state">
              <span className="empty-icon">🛡️</span>
              <p>No alerts match the current filter criteria.</p>
              {(statusFilter || severityFilter || attackTypeFilter || searchQuery) && (
                <button className="btn btn-outline" style={{ marginTop: '1rem', fontSize: '0.8rem' }}
                  onClick={() => { setStatusFilter(''); setSeverityFilter(''); setAttackTypeFilter(''); setSearchQuery('') }}>
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="alerts-table-container">
                <table className="alerts-table">
                  <thead>
                    <tr>
                      <th style={{ width: '6px', padding: '0.75rem 0.5rem' }}></th>
                      <th onClick={() => handleSort('createdAt')} className="sortable-th">
                        Timestamp <SortIcon field="createdAt" />
                      </th>
                      <th onClick={() => handleSort('alertType')} className="sortable-th">
                        Attack Type <SortIcon field="alertType" />
                      </th>
                      <th onClick={() => handleSort('severity')} className="sortable-th">
                        Severity <SortIcon field="severity" />
                      </th>
                      <th>Source IP</th>
                      <th>User</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAlerts.map(alert => (
                      <tr
                        key={alert._id}
                        id={`alert-row-${alert._id}`}
                        className={`alert-table-row ${selectedAlert?._id === alert._id ? 'selected' : ''}`}
                        onClick={() => { setSelectedAlert(alert); setExpandedLogId(null) }}
                      >
                        <td style={{ padding: '0', width: '6px' }}>
                          <span className={`severity-indicator severity-${alert.severity?.toLowerCase()}`} />
                        </td>
                        <td className="monospace-text" style={{ fontSize: '0.78rem' }}>
                          <div>{formatTimestamp(alert.createdAt)}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                            {formatTimeAgo(alert.createdAt)}
                          </div>
                        </td>
                        <td className="alert-name-cell">
                          <div className="alert-title-main">{alert.alertType}</div>
                          <div className="alert-description-sub">
                            {alert.description?.substring(0, 72)}{alert.description?.length > 72 ? '...' : ''}
                          </div>
                        </td>
                        <td><SeverityBadge severity={alert.severity} /></td>
                        <td className="monospace-text">{alert.sourceIP || '—'}</td>
                        <td className="monospace-text" style={{ fontSize: '0.8rem' }}>
                          {alert.username || '—'}
                        </td>
                        <td><StatusChip status={alert.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="alerts-pagination">
                <span className="pagination-info">
                  Showing {sortedAlerts.length} of {totalCount} alerts
                  {(statusFilter || severityFilter || attackTypeFilter || searchQuery) ? ' (filtered)' : ''}
                </span>
                <div className="pagination-controls">
                  <button
                    className="pagination-btn"
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    title="First page"
                  >«</button>
                  <button
                    className="pagination-btn"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    title="Previous page"
                  >‹</button>
                  <span className="pagination-page-display">
                    Page <strong>{page}</strong> of <strong>{totalPages}</strong>
                  </span>
                  <button
                    className="pagination-btn"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    title="Next page"
                  >›</button>
                  <button
                    className="pagination-btn"
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    title="Last page"
                  >»</button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right: Alert Detail Panel */}
        <div className="alerts-detail-panel glass-card">
          {selectedAlert ? (
            <div className="alert-details-container">

              {/* Header */}
              <div className="alert-details-header">
                <div className="alert-detail-header-top">
                  <SeverityBadge severity={selectedAlert.severity} />
                  <StatusChip status={selectedAlert.status} />
                </div>
                <h2>{selectedAlert.alertType}</h2>
                <div className="detail-meta-row">
                  <span className="detail-meta-item">
                    <strong>Source IP:</strong>
                    <span className="monospace-text">{selectedAlert.sourceIP || 'N/A'}</span>
                  </span>
                  <span className="detail-meta-item">
                    <strong>User:</strong>
                    <span className="monospace-text">{selectedAlert.username || 'N/A'}</span>
                  </span>
                  <span className="detail-meta-item">
                    <strong>Detected:</strong>
                    <span className="monospace-text">{formatTimestamp(selectedAlert.createdAt)}</span>
                  </span>
                  <span className="detail-meta-item">
                    <strong>File:</strong>
                    <span className="monospace-text">{selectedAlert.sourceFile || 'N/A'}</span>
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="alert-action-bar">
                <button
                  id={`btn-investigate-${selectedAlert._id}`}
                  className="btn alert-action-btn btn-investigate"
                  disabled={statusUpdating || selectedAlert.status === 'Investigating'}
                  onClick={() => handleUpdateStatus(selectedAlert._id, 'Investigating')}
                >
                  ⚡ Investigate
                </button>
                <button
                  id={`btn-create-incident-${selectedAlert._id}`}
                  className="btn alert-action-btn btn-create-incident"
                  disabled={statusUpdating || !!selectedAlert.incidentId}
                  onClick={() => handleCreateIncident(selectedAlert)}
                >
                  {selectedAlert.incidentId ? '🛡️ Incident Created' : '⚠️ Create Incident'}
                </button>
                <button
                  id={`btn-resolve-${selectedAlert._id}`}
                  className="btn alert-action-btn btn-resolve"
                  disabled={statusUpdating || selectedAlert.status === 'Resolved'}
                  onClick={() => handleUpdateStatus(selectedAlert._id, 'Resolved')}
                >
                  ✅ Dismiss
                </button>
              </div>

              {/* Risk Score + Status Widgets */}
              <div className="detail-widgets-grid">
                <div className="detail-widget">
                  <h4>Risk Score</h4>
                  <div className="confidence-meter-container">
                    <div className="confidence-meter-bar-track">
                      <div
                        className="confidence-meter-bar"
                        style={{
                          width: `${selectedAlert.riskScore || 75}%`,
                          backgroundColor:
                            (selectedAlert.riskScore || 75) > 85 ? 'var(--color-danger)' :
                            (selectedAlert.riskScore || 75) > 60 ? 'var(--color-warning)' :
                            'var(--color-success)',
                        }}
                      />
                    </div>
                    <span className="confidence-value">{selectedAlert.riskScore || 75}%</span>
                  </div>
                </div>
                <div className="detail-widget">
                  <h4>Related Events</h4>
                  <div className="classification-value">
                    {selectedAlert.relatedLogs?.length || 0}
                    <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: '0.25rem' }}>logs</span>
                  </div>
                </div>
              </div>

              {/* Detection Reason */}
              <div className="alert-details-body">
                <div className="detail-section-header">
                  <span className="detail-section-icon">🔎</span>
                  <h3>Detection Reason</h3>
                </div>
                <div className="detection-reason-box">
                  <p>{getDetectionReason(selectedAlert)}</p>
                </div>

                {/* Threat Summary */}
                <div className="detail-section-header" style={{ marginTop: '1rem' }}>
                  <span className="detail-section-icon">📋</span>
                  <h3>Threat Summary</h3>
                </div>
                <div className="detail-summary-text">{selectedAlert.description}</div>

                {/* Recommended Action */}
                <div className="detail-section-header" style={{ marginTop: '1rem' }}>
                  <span className="detail-section-icon">🛡️</span>
                  <h3>Recommended Action</h3>
                </div>
                <div className="mitigation-guide-box">
                  <p>{selectedAlert.recommendedAction || 'Verify source IP activity and containment.'}</p>
                </div>

                {/* Event Timeline */}
                {selectedAlert.relatedLogs?.length > 0 && (
                  <>
                    <div className="detail-section-header" style={{ marginTop: '1rem' }}>
                      <span className="detail-section-icon">📅</span>
                      <h3>Event Timeline ({selectedAlert.relatedLogs.length})</h3>
                    </div>
                    <div className="event-timeline">
                      {getTimeline(selectedAlert).map((log, idx) => (
                        <div key={log._id || idx} className="timeline-item">
                          <div
                            className="timeline-header"
                            onClick={() => setExpandedLogId(expandedLogId === (log._id || idx) ? null : (log._id || idx))}
                          >
                            <div className="timeline-marker-col">
                              <div className={`timeline-dot tl-dot-${log.status?.toLowerCase()}`} />
                              {idx < selectedAlert.relatedLogs.length - 1 && <div className="timeline-line" />}
                            </div>
                            <div className="timeline-content-col">
                              <div className="timeline-top-row">
                                <span className="monospace-text timeline-ts">
                                  {formatTimestamp(log.timestamp)}
                                </span>
                                <span className={`trigger-log-event-type`}>{log.eventType}</span>
                                <span className={`trigger-log-status log-status-${log.status?.toLowerCase()}`}>
                                  {log.status}
                                </span>
                                <span className="trigger-log-toggle">
                                  {expandedLogId === (log._id || idx) ? '▼' : '▶'}
                                </span>
                              </div>
                              <div className="timeline-ip-row">
                                {log.username && <span>👤 {log.username}</span>}
                                {log.ipAddress && <span>🌐 {log.ipAddress}</span>}
                              </div>
                            </div>
                          </div>

                          {expandedLogId === (log._id || idx) && (
                            <div className="trigger-log-body">
                              <div className="log-detail-row">
                                <strong>Username:</strong>
                                <span>{log.username || 'unknown'}</span>
                              </div>
                              <div className="log-detail-row">
                                <strong>IP Address:</strong>
                                <span className="monospace-text">{log.ipAddress || 'N/A'}</span>
                              </div>
                              <div className="log-detail-row">
                                <strong>Source File:</strong>
                                <span>{log.sourceFile || 'unknown'}</span>
                              </div>
                              <div className="log-detail-code">
                                <strong>Raw Log:</strong>
                                <pre className="monospace-text">{log.rawLog}</pre>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="alert-details-placeholder">
              <span className="placeholder-icon">👁️</span>
              <h3>Select a Security Alert</h3>
              <p>Click on any alert from the list to view detailed telemetry, triggering logs, detection reasoning, and mitigation guidance.</p>
            </div>
          )}
        </div>
      </div>
      {toast && (
        <div className="toast-container" id="alerts-toast-container">
          <div className={`toast toast-${toast.type}`}>
            {toast.type === 'success' ? '✅' : '❌'} {toast.message}
          </div>
        </div>
      )}
    </div>
  )
}

export default Alerts
