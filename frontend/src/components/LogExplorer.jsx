/**
 * LogHawk – Log Explorer Component
 *
 * SIEM-style event table with:
 *   - Debounced search (IP, username, event type, status)
 *   - Status, event type, and source file filters
 *   - 25-per-page pagination
 *   - Row expansion for raw log viewer
 *   - Loading and empty states
 *
 * Manages its own query state and API calls.
 * Re-fetches automatically when selectedFileId changes.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../services/api'
import './LogExplorer.css'

const STATUS_COLORS = {
  Failed:  { bg: 'rgba(255,77,77,0.1)',   color: '#FF4D4D',  border: 'rgba(255,77,77,0.25)'  },
  Success: { bg: 'rgba(16,185,129,0.1)',  color: '#10B981',  border: 'rgba(16,185,129,0.25)' },
  Unknown: { bg: 'rgba(100,116,139,0.1)', color: '#64748B',  border: 'rgba(100,116,139,0.25)'},
}

const EVENT_TYPE_ICONS = {
  Login:          '🔑',
  Authentication: '🔐',
  Sudo:           '⚡',
  Session:        '🖥️',
  Other:          '📋',
}

function formatTimestamp(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
}

const PAGE_LIMIT = 25

function LogExplorer({ selectedFileId, files }) {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  // Search (raw input) + debounced query
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Filters
  const [filterStatus, setFilterStatus] = useState('')
  const [filterEventType, setFilterEventType] = useState('')

  // Which row (by _id) has its raw log expanded
  const [expandedRow, setExpandedRow] = useState(null)

  const abortRef = useRef(null)

  // ---- Debounce search input ----
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(timer)
  }, [search])

  // ---- Reset to page 1 when filters change ----
  useEffect(() => {
    setPage(1)
    setExpandedRow(null)
  }, [debouncedSearch, filterStatus, filterEventType, selectedFileId])

  // ---- Fetch logs ----
  const fetchLogs = useCallback(async () => {
    // Cancel in-flight request if any
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit: PAGE_LIMIT })
      if (debouncedSearch)  params.set('search', debouncedSearch)
      if (filterStatus)     params.set('status', filterStatus)
      if (filterEventType)  params.set('eventType', filterEventType)
      if (selectedFileId)   params.set('fileId', selectedFileId)

      const res = await api.get(`/api/logs?${params}`, {
        signal: controller.signal,
      })

      setLogs(res.data.logs)
      setTotal(res.data.total)
    } catch (err) {
      if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
        console.error('Log fetch error:', err.message)
        setLogs([])
        setTotal(0)
      }
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, filterStatus, filterEventType, selectedFileId])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const totalPages = Math.ceil(total / PAGE_LIMIT)

  const handleSearchChange = (e) => {
    setSearch(e.target.value)
  }

  const clearFilters = () => {
    setSearch('')
    setDebouncedSearch('')
    setFilterStatus('')
    setFilterEventType('')
  }

  const hasActiveFilters = search || filterStatus || filterEventType || selectedFileId

  return (
    <div className="log-explorer glass-card" id="log-explorer-section">

      {/* Header */}
      <div className="explorer-header">
        <div className="explorer-title-row">
          <h2 className="section-title">
            <span className="section-icon">🔎</span>
            Log Explorer
          </h2>
          {total > 0 && (
            <span className="explorer-total-badge">
              {total.toLocaleString()} events
            </span>
          )}
        </div>

        {/* Search bar */}
        <div className="explorer-search-row">
          <div className="explorer-search-box">
            <svg className="search-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              className="explorer-search-input"
              placeholder="Search by IP, username, event type, status..."
              value={search}
              onChange={handleSearchChange}
              id="log-search-input"
            />
            {search && (
              <button className="search-clear-btn" onClick={() => setSearch('')} title="Clear search">✕</button>
            )}
          </div>
        </div>

        {/* Filter row */}
        <div className="explorer-filters">
          <select
            className="filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            id="filter-status"
          >
            <option value="">All Statuses</option>
            <option value="Failed">Failed</option>
            <option value="Success">Success</option>
            <option value="Unknown">Unknown</option>
          </select>

          <select
            className="filter-select"
            value={filterEventType}
            onChange={(e) => setFilterEventType(e.target.value)}
            id="filter-event-type"
          >
            <option value="">All Event Types</option>
            <option value="Login">Login</option>
            <option value="Authentication">Authentication</option>
            <option value="Sudo">Sudo</option>
            <option value="Session">Session</option>
            <option value="Other">Other</option>
          </select>

          {hasActiveFilters && (
            <button
              className="btn btn-outline filter-clear-btn"
              onClick={clearFilters}
            >
              ✕ Clear All
            </button>
          )}

          <div className="filter-spacer" />

          <button
            className="btn btn-outline refresh-btn"
            onClick={fetchLogs}
            disabled={loading}
            title="Refresh"
            id="refresh-logs-btn"
          >
            {loading ? '...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="explorer-table-wrapper">
        {loading && logs.length === 0 ? (
          <div className="explorer-state">
            <div className="state-icon">⏳</div>
            <p>Loading events...</p>
          </div>
        ) : !loading && logs.length === 0 ? (
          <div className="explorer-state">
            <div className="state-icon">📭</div>
            <p>{hasActiveFilters ? 'No events match your search.' : 'No log events yet.'}</p>
            <p className="state-hint">
              {hasActiveFilters
                ? 'Try adjusting your filters or search query.'
                : 'Upload a log file above to start exploring events.'}
            </p>
          </div>
        ) : (
          <table className="explorer-table" id="log-events-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Username</th>
                <th>IP Address</th>
                <th>Event Type</th>
                <th>Status</th>
                <th>Source File</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <>
                  <tr
                    key={log._id}
                    className={`log-row ${expandedRow === log._id ? 'log-row-expanded' : ''}`}
                    onClick={() => setExpandedRow(expandedRow === log._id ? null : log._id)}
                  >
                    <td className="col-timestamp">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="col-username">
                      {log.username || <span className="null-value">—</span>}
                    </td>
                    <td className="col-ip">
                      {log.ipAddress || <span className="null-value">—</span>}
                    </td>
                    <td className="col-event-type">
                      <span className="event-type-chip">
                        {EVENT_TYPE_ICONS[log.eventType] || '📋'} {log.eventType}
                      </span>
                    </td>
                    <td className="col-status">
                      <StatusChip status={log.status} />
                    </td>
                    <td className="col-source">
                      <span className="source-file-name" title={log.sourceFile}>
                        {log.sourceFile || '—'}
                      </span>
                    </td>
                  </tr>

                  {/* Expandable raw log row */}
                  {expandedRow === log._id && (
                    <tr key={`${log._id}-raw`} className="raw-log-row">
                      <td colSpan={6}>
                        <div className="raw-log-box">
                          <span className="raw-log-label">Raw Log</span>
                          <code className="raw-log-text">{log.rawLog || 'No raw log available'}</code>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_LIMIT && (
        <div className="explorer-pagination">
          <span className="pagination-info">
            Showing {((page - 1) * PAGE_LIMIT) + 1}–{Math.min(page * PAGE_LIMIT, total)} of {total.toLocaleString()}
          </span>
          <div className="pagination-controls">
            <button
              className="page-btn"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
              id="prev-page-btn"
            >
              ← Prev
            </button>

            {/* Show up to 5 page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
              return (
                <button
                  key={pageNum}
                  className={`page-btn ${page === pageNum ? 'page-btn-active' : ''}`}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </button>
              )
            })}

            <button
              className="page-btn"
              onClick={() => setPage((p) => p + 1)}
              disabled={page === totalPages}
              id="next-page-btn"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusChip({ status }) {
  const style = STATUS_COLORS[status] || STATUS_COLORS.Unknown
  return (
    <span
      className="status-chip"
      style={{
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
      }}
    >
      {status === 'Failed' ? '✕' : status === 'Success' ? '✓' : '?'} {status}
    </span>
  )
}

export default LogExplorer
