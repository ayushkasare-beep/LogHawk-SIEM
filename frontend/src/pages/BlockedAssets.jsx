/**
 * LogHawk – Blocked Assets Page
 *
 * Displays all IP addresses blocked via Incident Response actions.
 * Supports search, pagination, and status indicators.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../services/api'
import useDocumentTitle from '../hooks/useDocumentTitle'
import './BlockedAssets.css'

// ── Debounce helper ──────────────────────────────────────────────────────────
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ── Utility: format dates ─────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

// ── Shield icon ───────────────────────────────────────────────────────────────
function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ba-icon">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function BlockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ba-icon">
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, value, label, accentColor }) {
  return (
    <div className="ba-stat-card glass-card" style={{ borderTop: `3px solid ${accentColor}` }}>
      <span className="ba-stat-icon" style={{ color: accentColor }}>{icon}</span>
      <div>
        <div className="ba-stat-value">{value}</div>
        <div className="ba-stat-label">{label}</div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
function BlockedAssets() {
  useDocumentTitle('Blocked Assets')
  const [assets, setAssets] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const debouncedSearch = useDebounce(search, 350)

  const fetchAssets = useCallback(async (pageNum, searchVal) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: pageNum, limit: 25 })
      if (searchVal) params.set('search', searchVal)
      const res = await api.get(`/api/blocked-assets?${params}`)
      setAssets(res.data.assets || [])
      setTotal(res.data.total || 0)
      setPages(res.data.pages || 1)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load blocked assets.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setPage(1)
    fetchAssets(1, debouncedSearch)
  }, [debouncedSearch, fetchAssets])

  const handlePageChange = (newPage) => {
    setPage(newPage)
    fetchAssets(newPage, debouncedSearch)
  }

  const todayCount = assets.filter((a) => {
    const d = new Date(a.blockedAt)
    const now = new Date()
    return d.toDateString() === now.toDateString()
  }).length

  return (
    <div className="ba-page" id="blocked-assets-page">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="ba-header">
        <div>
          <h1 className="ba-title">
            <BlockIcon />
            Blocked Assets
          </h1>
          <p className="ba-desc">
            IP addresses quarantined via Incident Response containment actions.
          </p>
        </div>
        <div className="ba-header-badge">
          <span className="ba-total-badge">{total} Total</span>
        </div>
      </div>

      {/* ── Stat Cards ──────────────────────────────────────────────────── */}
      <div className="ba-stats-row">
        <StatCard
          icon="🚫"
          value={total}
          label="Total Blocked IPs"
          accentColor="var(--color-danger)"
        />
        <StatCard
          icon="📅"
          value={todayCount}
          label="Blocked Today"
          accentColor="var(--color-warning)"
        />
        <StatCard
          icon="🛡️"
          value={assets.length > 0 ? assets.length : '—'}
          label="Shown on Page"
          accentColor="var(--color-info)"
        />
      </div>

      {/* ── Search Bar ──────────────────────────────────────────────────── */}
      <div className="ba-toolbar glass-card">
        <div className="ba-search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ba-search-icon">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            id="blocked-assets-search"
            type="text"
            className="ba-search-input"
            placeholder="Search IP, reason, or incident ref…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="ba-search-clear" onClick={() => setSearch('')} title="Clear search">
              ×
            </button>
          )}
        </div>
        <span className="ba-result-count">
          {loading ? 'Loading…' : `${total} result${total !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="ba-table-wrap glass-card">
        {error ? (
          <div className="ba-empty-state">
            <ShieldIcon />
            <p className="ba-empty-title">Failed to load blocked assets</p>
            <p className="ba-empty-sub">{error}</p>
            <button className="ba-retry-btn" onClick={() => fetchAssets(page, debouncedSearch)}>
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="ba-loading-state">
            <div className="ba-spinner" />
            <p>Loading blocked assets…</p>
          </div>
        ) : assets.length === 0 ? (
          <div className="ba-empty-state">
            <ShieldIcon />
            <p className="ba-empty-title">
              {search ? 'No results match your search' : 'No blocked assets yet'}
            </p>
            <p className="ba-empty-sub">
              {search
                ? 'Try a different IP address, reason, or incident reference.'
                : 'When you trigger "Block IP" from an incident, the address will appear here.'}
            </p>
          </div>
        ) : (
          <>
            <div className="ba-table-scroll">
              <table className="ba-table" aria-label="Blocked Assets">
                <thead>
                  <tr>
                    <th>IP Address</th>
                    <th>Reason</th>
                    <th>Incident Ref</th>
                    <th>Blocked By</th>
                    <th>Blocked At</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr key={asset._id} className="ba-table-row">
                      <td>
                        <span className="ba-ip-badge">
                          <span className="ba-ip-dot" />
                          {asset.ip}
                        </span>
                      </td>
                      <td className="ba-reason-cell" title={asset.reason}>
                        {asset.reason || '—'}
                      </td>
                      <td>
                        {asset.incidentRef ? (
                          <span className="ba-incident-ref">{asset.incidentRef}</span>
                        ) : '—'}
                      </td>
                      <td>{asset.blockedBy || '—'}</td>
                      <td className="ba-date-cell">{fmtDate(asset.blockedAt)}</td>
                      <td>
                        <span className="ba-status-badge ba-status-blocked">
                          🚫 Blocked
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ────────────────────────────────────────────── */}
            {pages > 1 && (
              <div className="ba-pagination" id="blocked-assets-pagination">
                <button
                  className="ba-page-btn"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                >
                  ← Prev
                </button>
                <div className="ba-page-numbers">
                  {Array.from({ length: pages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1)
                    .reduce((acc, p, idx, arr) => {
                      if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…')
                      acc.push(p)
                      return acc
                    }, [])
                    .map((p, idx) =>
                      p === '…' ? (
                        <span key={`ellipsis-${idx}`} className="ba-page-ellipsis">…</span>
                      ) : (
                        <button
                          key={p}
                          className={`ba-page-num ${p === page ? 'ba-page-num-active' : ''}`}
                          onClick={() => handlePageChange(p)}
                        >
                          {p}
                        </button>
                      )
                    )}
                </div>
                <button
                  className="ba-page-btn"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= pages}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default BlockedAssets
