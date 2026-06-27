/**
 * LogHawk – Incident Response Page
 *
 * SOC Analyst case management workspace allowing:
 *   - Overview stats of security incidents
 *   - Dynamic incident queue with searching, filtering, and sorting
 *   - Live right-drawer investigation panel containing incident details,
 *     associated alert metadata, triggering logs, response action execution,
 *     analyst notes, and chronological audit timelines.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../services/api'
import useDocumentTitle from '../hooks/useDocumentTitle'
import './IncidentResponse.css'

// Analysts list for assignments
const ANALYSTS = ['Unassigned', 'SOC Analyst 1', 'SOC Analyst 2', 'SOC Analyst 3']

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

function IncidentResponse() {
  useDocumentTitle('Incident Response')
  // Stats & incidents data
  const [incidents, setIncidents] = useState([])
  const [stats, setStats] = useState({ open: 0, inProgress: 0, resolved: 0, closed: 0, critical: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Selected incident details
  const [selectedIncidentId, setSelectedIncidentId] = useState(null)
  const [detailData, setDetailData] = useState(null) // { incident, actions }
  const [detailLoading, setDetailLoading] = useState(false)
  
  // Interaction/action states
  const [expandedLogId, setExpandedLogId] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [actionReason, setActionReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast] = useState(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Sort
  const [sortField, setSortField] = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc')

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const PAGE_SIZE = 25

  // Toast notifier
  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4500)
  }

  // ── Fetch Stats ────────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/api/incidents/stats')
      setStats(res.data)
    } catch (err) {
      console.error('Failed to fetch incident stats:', err)
    }
  }, [])

  // ── Fetch Incident List ────────────────────────────────────────────────────
  const fetchIncidents = useCallback(async (resetPage = false) => {
    setLoading(true)
    setError(null)
    const targetPage = resetPage ? 1 : page
    if (resetPage) setPage(1)

    try {
      const params = { page: targetPage, limit: PAGE_SIZE }
      if (statusFilter) params.status = statusFilter
      if (severityFilter) params.severity = severityFilter
      if (searchQuery.trim()) params.search = searchQuery

      const res = await api.get('/api/incidents', { params })
      setIncidents(res.data.incidents || [])
      setTotalCount(res.data.total || 0)
      setTotalPages(res.data.pages || 1)
    } catch (err) {
      console.error('Failed to fetch incidents:', err)
      setError('Could not retrieve incident list. Please ensure the backend is running.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, severityFilter, searchQuery, page])

  // ── Fetch Detailed Incident ───────────────────────────────────────────────
  const fetchIncidentDetails = useCallback(async (id) => {
    if (!id) return
    setDetailLoading(true)
    try {
      const res = await api.get(`/api/incidents/${id}`)
      setDetailData(res.data) // { incident, actions }
    } catch (err) {
      console.error('Failed to fetch incident details:', err)
      showToast('Error loading incident details', 'error')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  // Initial loads
  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    fetchIncidents(true)
  }, [statusFilter, severityFilter, searchQuery])

  useEffect(() => {
    fetchIncidents(false)
  }, [page])

  useEffect(() => {
    if (selectedIncidentId) {
      fetchIncidentDetails(selectedIncidentId)
    } else {
      setDetailData(null)
    }
  }, [selectedIncidentId, fetchIncidentDetails])

  // ── Client-side Sort ───────────────────────────────────────────────────────
  const sortedIncidents = useMemo(() => {
    return [...incidents].sort((a, b) => {
      let valA = a[sortField] || ''
      let valB = b[sortField] || ''

      if (sortField === 'createdAt') {
        valA = new Date(a.createdAt).getTime()
        valB = new Date(b.createdAt).getTime()
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1
      if (valA > valB) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [incidents, sortField, sortDir])

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  // ── Assign Analyst ────────────────────────────────────────────────────────
  const handleAssignIncident = async (id, analyst) => {
    try {
      const res = await api.post(`/api/incidents/${id}/assign`, { analyst })
      showToast(`Incident assigned to ${analyst}`, 'success')
      
      // Update local item
      setIncidents(prev => prev.map(inc => inc._id === id ? { ...inc, assignedTo: analyst, status: res.data.incident.status } : inc))
      if (selectedIncidentId === id) {
        setDetailData(prev => prev ? { ...prev, incident: res.data.incident } : null)
      }
      fetchStats()
    } catch (err) {
      console.error('Failed to assign incident:', err)
      showToast('Error assigning incident', 'error')
    }
  }

  // ── Transition Status ──────────────────────────────────────────────────────
  const handleTransitionStatus = async (id, newStatus) => {
    try {
      const res = await api.put(`/api/incidents/${id}`, { status: newStatus })
      showToast(`Status transitioned to ${newStatus}`, 'success')

      // Update local item
      setIncidents(prev => prev.map(inc => inc._id === id ? { ...inc, status: newStatus } : inc))
      if (selectedIncidentId === id) {
        setDetailData(prev => prev ? { ...prev, incident: res.data.incident } : null)
      }
      fetchStats()
    } catch (err) {
      console.error('Failed to transition status:', err)
      showToast('Error transitioning status', 'error')
    }
  }

  // ── Add Note ──────────────────────────────────────────────────────────────
  const handleAddNote = async (e) => {
    e.preventDefault()
    if (!noteText.trim()) return
    try {
      const res = await api.post(`/api/incidents/${selectedIncidentId}/note`, { text: noteText })
      setDetailData(prev => prev ? { ...prev, incident: res.data.incident } : null)
      setNoteText('')
      showToast('Analyst note saved', 'success')
    } catch (err) {
      console.error('Failed to add note:', err)
      showToast('Error saving note', 'error')
    }
  }

  // ── Execute Response Action ────────────────────────────────────────────────
  const handleExecuteAction = async (actionType) => {
    setActionLoading(true)
    try {
      const res = await api.post(`/api/incidents/${selectedIncidentId}/respond`, {
        action: actionType,
        reason: actionReason || `Analyst containment action via Incident Workspace`
      })
      
      showToast(res.data.message || 'Action executed successfully', 'success')
      setActionReason('')
      
      // Refresh detailed view & status
      await fetchIncidentDetails(selectedIncidentId)
      
      // Update entry in the list
      setIncidents(prev => prev.map(inc => inc._id === selectedIncidentId ? res.data.incident : inc))
      fetchStats()
    } catch (err) {
      console.error('Failed to execute response action:', err)
      showToast(err.response?.data?.message || 'Error executing action', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Helper date formatter
  const formatTimestamp = (ts) => {
    if (!ts) return 'N/A'
    return new Date(ts).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    })
  }

  return (
    <div className="incidents-page" id="incident-workspace-page">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="incidents-page-header">
        <div>
          <h1 className="incidents-page-title">Incident Response Workspace</h1>
          <p className="incidents-page-desc">Investigate security incidents, document audit logs, and trigger automated threat containment.</p>
        </div>
        <button
          className="btn btn-outline"
          id="refresh-incidents-btn"
          onClick={() => { fetchIncidents(false); fetchStats() }}
          style={{ height: '38px', fontSize: '0.8rem' }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* ── Stats Cards Row ──────────────────────────────────────────────── */}
      <div className="incidents-stats-row">
        <div className="incidents-stat-card stat-neutral">
          <span className="incidents-stat-icon">🗂️</span>
          <div className="incidents-stat-content">
            <span className="incidents-stat-value">{stats.total || 0}</span>
            <span className="incidents-stat-label">Total Cases</span>
          </div>
        </div>
        <div className="incidents-stat-card stat-info">
          <span className="incidents-stat-icon">🆕</span>
          <div className="incidents-stat-content">
            <span className="incidents-stat-value">{stats.open || 0}</span>
            <span className="incidents-stat-label">Open</span>
          </div>
        </div>
        <div className="incidents-stat-card stat-warning">
          <span className="incidents-stat-icon">⚡</span>
          <div className="incidents-stat-content">
            <span className="incidents-stat-value">{stats.inProgress || 0}</span>
            <span className="incidents-stat-label">In Progress</span>
          </div>
        </div>
        <div className="incidents-stat-card stat-success">
          <span className="incidents-stat-icon">✅</span>
          <div className="incidents-stat-content">
            <span className="incidents-stat-value">{(stats.resolved || 0) + (stats.closed || 0)}</span>
            <span className="incidents-stat-label">Resolved / Closed</span>
          </div>
        </div>
      </div>

      {/* ── Filter & Search Control Bar ──────────────────────────────────── */}
      <div className="incidents-control-bar glass-card">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            id="incident-search-input"
            placeholder="Search by ID, title, IP or analyst..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>

        <div className="filter-dropdowns">
          <div className="filter-group">
            <label>Severity</label>
            <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
              <option value="">All Severities</option>
              <option value="Critical">🔴 Critical</option>
              <option value="High">🟠 High</option>
              <option value="Medium">🟡 Medium</option>
              <option value="Low">🔵 Low</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="Open">🆕 Open</option>
              <option value="In Progress">⚡ In Progress</option>
              <option value="Resolved">✅ Resolved</option>
              <option value="Closed">🔒 Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Main Workspace ───────────────────────────────────────────────── */}
      <div className={`incidents-workspace ${selectedIncidentId ? 'drawer-open' : ''}`}>
        
        {/* Left/Main Queue Table */}
        <div className="incidents-list-panel glass-card">
          {loading && incidents.length === 0 ? (
            <div className="incidents-loading-state">
              <div className="spinner" />
              <p>Loading security cases...</p>
            </div>
          ) : error ? (
            <div className="incidents-error-state">
              <span className="error-icon">⚠️</span>
              <p>{error}</p>
            </div>
          ) : sortedIncidents.length === 0 ? (
            <div className="incidents-empty-state">
              <span className="empty-icon">🛡️</span>
              <p>No incidents found matching current filters.</p>
            </div>
          ) : (
            <>
              <div className="incidents-table-container">
                <table className="incidents-table">
                  <thead>
                    <tr>
                      <th style={{ width: '6px', padding: '0.75rem 0.5rem' }}></th>
                      <th onClick={() => handleSort('incidentId')} className="sortable-th">
                        ID {sortField === 'incidentId' && (sortDir === 'asc' ? '↑' : '↓')}
                      </th>
                      <th>Title</th>
                      <th>Severity</th>
                      <th>Status</th>
                      <th>Assigned To</th>
                      <th onClick={() => handleSort('createdAt')} className="sortable-th">
                        Created At {sortField === 'createdAt' && (sortDir === 'asc' ? '↑' : '↓')}
                      </th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedIncidents.map(inc => (
                      <tr
                        key={inc._id}
                        id={`incident-row-${inc.incidentId}`}
                        className={`incident-table-row ${selectedIncidentId === inc._id ? 'selected' : ''}`}
                        onClick={() => setSelectedIncidentId(inc._id)}
                      >
                        <td style={{ padding: '0', width: '6px' }}>
                          <span className={`severity-indicator severity-${inc.severity?.toLowerCase()}`} />
                        </td>
                        <td className="monospace-text font-bold text-accent">{inc.incidentId}</td>
                        <td className="incident-title-cell">
                          <div className="incident-title-main">{inc.title}</div>
                          {inc.sourceIp && (
                            <div className="incident-ip-sub">IP: {inc.sourceIp} {inc.username && `| User: ${inc.username}`}</div>
                          )}
                        </td>
                        <td><SeverityBadge severity={inc.severity} /></td>
                        <td><StatusChip status={inc.status} /></td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <select
                            className="table-assign-select"
                            value={inc.assignedTo}
                            onChange={(e) => handleAssignIncident(inc._id, e.target.value)}
                          >
                            {ANALYSTS.map(name => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="monospace-text" style={{ fontSize: '0.78rem' }}>
                          {formatTimestamp(inc.createdAt)}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <button
                            className="btn btn-table-action"
                            onClick={() => setSelectedIncidentId(inc._id)}
                          >
                            👁️ View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="incidents-pagination">
                <span className="pagination-info">
                  Showing {sortedIncidents.length} of {totalCount} cases
                </span>
                <div className="pagination-controls">
                  <button
                    className="pagination-btn"
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                  >«</button>
                  <button
                    className="pagination-btn"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >‹</button>
                  <span className="pagination-page-display">
                    Page <strong>{page}</strong> of <strong>{totalPages}</strong>
                  </span>
                  <button
                    className="pagination-btn"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >›</button>
                  <button
                    className="pagination-btn"
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                  >»</button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Detail Pane Drawer */}
        {selectedIncidentId && (
          <div className="incidents-detail-drawer glass-card">
            {detailLoading ? (
              <div className="drawer-loading">
                <div className="spinner" />
                <p>Loading case investigation details...</p>
              </div>
            ) : detailData ? (
              <div className="drawer-inner">
                {/* Header */}
                <div className="drawer-header-row">
                  <div>
                    <span className="drawer-case-id monospace-text">{detailData.incident.incidentId}</span>
                    <h2 className="drawer-case-title">{detailData.incident.title}</h2>
                  </div>
                  <button className="btn-drawer-close" onClick={() => setSelectedIncidentId(null)} title="Close Panel">✕</button>
                </div>

                {/* Section 1: Summary */}
                <div className="drawer-section">
                  <h3>Incident Summary</h3>
                  <div className="drawer-summary-grid">
                    <div className="summary-grid-item">
                      <span className="grid-label">Status</span>
                      <StatusChip status={detailData.incident.status} />
                    </div>
                    <div className="summary-grid-item">
                      <span className="grid-label">Severity</span>
                      <SeverityBadge severity={detailData.incident.severity} />
                    </div>
                    <div className="summary-grid-item">
                      <span className="grid-label">Assigned To</span>
                      <select
                        className="drawer-assign-select"
                        value={detailData.incident.assignedTo}
                        onChange={(e) => handleAssignIncident(detailData.incident._id, e.target.value)}
                      >
                        {ANALYSTS.map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="summary-grid-item">
                      <span className="grid-label">Source IP</span>
                      <span className="monospace-text">{detailData.incident.sourceIp || 'None'}</span>
                    </div>
                    <div className="summary-grid-item">
                      <span className="grid-label">Target Username</span>
                      <span className="monospace-text">{detailData.incident.username || 'None'}</span>
                    </div>
                    <div className="summary-grid-item">
                      <span className="grid-label">Threat Type</span>
                      <span>{detailData.incident.threatType || 'Unclassified'}</span>
                    </div>
                  </div>
                </div>

                {/* Section 2: Related Alert Details */}
                {detailData.incident.alertId && (
                  <div className="drawer-section">
                    <h3>Originating Alert Info</h3>
                    <div className="drawer-alert-card">
                      <div className="alert-card-header">
                        <h4>{detailData.incident.alertId.alertType}</h4>
                        <span className="alert-risk-badge">Risk: {detailData.incident.alertId.riskScore || 0}%</span>
                      </div>
                      <p className="alert-card-desc">{detailData.incident.alertId.description}</p>
                      {detailData.incident.alertId.recommendedAction && (
                        <div className="alert-card-recommendation">
                          <strong>Recommended Action:</strong>
                          <p>{detailData.incident.alertId.recommendedAction}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Section 5: Response Actions Containment Pane */}
                <div className="drawer-section">
                  <h3>Threat Containment Actions</h3>
                  
                  {/* Action execution form */}
                  <div className="containment-actions-form">
                    <div className="form-group-item">
                      <label htmlFor="action-reason">Containment Reason / Justification</label>
                      <input
                        type="text"
                        id="action-reason"
                        value={actionReason}
                        onChange={(e) => setActionReason(e.target.value)}
                        placeholder="Provide details/reasoning for containment..."
                      />
                    </div>
                    <div className="actions-button-grid">
                      <button
                        className="btn btn-action-contain block-ip-btn"
                        disabled={actionLoading || detailData.incident.status === 'Closed'}
                        onClick={() => handleExecuteAction('block_ip')}
                      >
                        🚫 Block Source IP
                      </button>
                      <button
                        className="btn btn-action-contain disable-user-btn"
                        disabled={actionLoading || detailData.incident.status === 'Closed'}
                        onClick={() => handleExecuteAction('disable_user')}
                      >
                        👤 Disable User account
                      </button>
                      <button
                        className="btn btn-action-contain escalate-btn"
                        disabled={actionLoading || detailData.incident.status === 'Closed'}
                        onClick={() => handleExecuteAction('escalate')}
                      >
                        ⚠️ Escalate Case
                      </button>
                      <button
                        className="btn btn-action-contain false-positive-btn"
                        disabled={actionLoading || detailData.incident.status === 'Closed'}
                        onClick={() => handleExecuteAction('false_positive')}
                      >
                        🛡️ False Positive (Close)
                      </button>
                    </div>
                  </div>

                  {/* Executed response actions log */}
                  {detailData.actions && detailData.actions.length > 0 && (
                    <div className="executed-actions-history">
                      <h4>Containment History</h4>
                      <div className="actions-history-list">
                        {detailData.actions.map((act) => (
                          <div key={act._id} className="history-action-card">
                            <div className="action-history-header">
                              <span className="action-tag">{act.action.toUpperCase()}</span>
                              <span className="action-time">{formatTimestamp(act.timestamp)}</span>
                            </div>
                            <p className="action-reason-text">
                              <strong>Justification:</strong> {act.reason || 'No justification provided'}
                            </p>
                            <span className="action-author">Performed by: {act.performedBy}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 3: Related Logs */}
                {detailData.incident.relatedLogs && detailData.incident.relatedLogs.length > 0 && (
                  <div className="drawer-section">
                    <h3>Evidence Log Events ({detailData.incident.relatedLogs.length})</h3>
                    <div className="drawer-evidence-list">
                      {detailData.incident.relatedLogs.map((log, idx) => (
                        <div key={log._id || idx} className="timeline-item">
                          <div
                            className="timeline-header"
                            onClick={() => setExpandedLogId(expandedLogId === (log._id || idx) ? null : (log._id || idx))}
                          >
                            <div className="timeline-marker-col">
                              <div className={`timeline-dot tl-dot-${log.status?.toLowerCase()}`} />
                            </div>
                            <div className="timeline-content-col">
                              <div className="timeline-top-row">
                                <span className="monospace-text timeline-ts">
                                  {formatTimestamp(log.timestamp)}
                                </span>
                                <span className="trigger-log-event-type">{log.eventType}</span>
                                <span className={`trigger-log-status log-status-${log.status?.toLowerCase()}`}>
                                  {log.status}
                                </span>
                                <span className="trigger-log-toggle">
                                  {expandedLogId === (log._id || idx) ? '▼' : '▶'}
                                </span>
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
                              <div className="log-detail-code">
                                <strong>Raw Log:</strong>
                                <pre className="monospace-text">{log.rawLog}</pre>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section 4: Investigation Notes */}
                <div className="drawer-section">
                  <h3>Investigation Notes</h3>
                  <form className="drawer-notes-form" onSubmit={handleAddNote}>
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Add case observation, mitigation updates, or analyst details..."
                      rows={3}
                    />
                    <button type="submit" className="btn btn-save-note" disabled={!noteText.trim()}>
                      💾 Save Note
                    </button>
                  </form>

                  {detailData.incident.notes && detailData.incident.notes.length > 0 && (
                    <div className="drawer-notes-list">
                      {detailData.incident.notes.slice().reverse().map((note) => (
                        <div key={note._id} className="note-card">
                          <div className="note-header">
                            <span className="note-author">👤 {note.author}</span>
                            <span className="note-time">{formatTimestamp(note.createdAt)}</span>
                          </div>
                          <p className="note-text">{note.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 6: Chronological Audit Timeline */}
                {detailData.incident.timeline && detailData.incident.timeline.length > 0 && (
                  <div className="drawer-section">
                    <h3>Incident Audit Trail</h3>
                    <div className="audit-timeline">
                      {detailData.incident.timeline.slice().reverse().map((evt) => (
                        <div key={evt._id} className="audit-item">
                          <div className="audit-dot"></div>
                          <div className="audit-content">
                            <p className="audit-event-desc">{evt.event}</p>
                            <div className="audit-meta">
                              <span className="audit-actor">Actor: {evt.actor}</span>
                              <span className="audit-time">{formatTimestamp(evt.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status Transitions Panel */}
                <div className="drawer-workflow-actions">
                  <h4>Workflow Transitions</h4>
                  <div className="workflow-button-row">
                    <button
                      className="btn btn-workflow btn-wf-progress"
                      disabled={detailData.incident.status === 'In Progress'}
                      onClick={() => handleTransitionStatus(detailData.incident._id, 'In Progress')}
                    >
                      ⚡ In Progress
                    </button>
                    <button
                      className="btn btn-workflow btn-wf-resolve"
                      disabled={detailData.incident.status === 'Resolved'}
                      onClick={() => handleTransitionStatus(detailData.incident._id, 'Resolved')}
                    >
                      ✅ Resolve
                    </button>
                    <button
                      className="btn btn-workflow btn-wf-close"
                      disabled={detailData.incident.status === 'Closed'}
                      onClick={() => handleTransitionStatus(detailData.incident._id, 'Closed')}
                    >
                      🔒 Close Case
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="drawer-error">
                <p>Failed to retrieve incident telemetry details.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast Notification Container */}
      {toast && (
        <div className="toast-container" id="incidents-toast-container">
          <div className={`toast toast-${toast.type}`}>
            {toast.type === 'success' ? '✅' : '❌'} {toast.message}
          </div>
        </div>
      )}
    </div>
  )
}

export default IncidentResponse
