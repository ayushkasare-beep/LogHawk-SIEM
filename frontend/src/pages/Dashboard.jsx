/**
 * LogHawk – Dashboard Page
 *
 * Main SOC Dashboard. Shows a welcome banner, key metric cards,
 * recent alerts, quick actions, system health, and a threat overview
 * widget aggregating live data from the backend.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import StatCard from '../components/StatCard'
import useDocumentTitle from '../hooks/useDocumentTitle'
import './Dashboard.css'

function Dashboard() {
  useDocumentTitle('Dashboard')
  const { user } = useAuth()
  const navigate = useNavigate()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalFiles: 0,
    totalEvents: 0,
    failedLogins: 0,
    successfulLogins: 0,
    totalAlerts: 0,
    openAlerts: 0,
    criticalAlerts: 0,
    highAlerts: 0,
    suspiciousIPs: 0,
  })
  const [incidentStats, setIncidentStats] = useState({ open: 0, inProgress: 0, total: 0 })
  const [recentAlerts, setRecentAlerts] = useState([])
  const [threatOverview, setThreatOverview] = useState([
    { label: 'Brute Force', count: 0, color: '#FF4D4D', alertType: 'Brute Force Attack' },
    { label: 'Password Spray', count: 0, color: '#FF6B6B', alertType: 'Password Spray Attack' },
    { label: 'Acct Enumeration', count: 0, color: '#FFC107', alertType: 'Account Enumeration' },
    { label: 'Port Scanning', count: 0, color: '#F97316', alertType: 'Port Scan Detected' },
    { label: 'Priv. Escalation', count: 0, color: '#EF4444', alertType: 'Privilege Escalation' },
    { label: 'Reconnaissance', count: 0, color: '#3B82F6', alertType: 'Reconnaissance Activity' },
    { label: 'Suspicious IP', count: 0, color: '#8B5CF6', alertType: 'Suspicious IP Activity' },
    { label: 'Account Compromise', count: 0, color: '#EC4899', alertType: 'Possible Account Compromise' },
  ])

  // Tick the live clock every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // Fetch all dashboard data from the backend
  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      // 1. Fetch live metrics stats
      const statsRes = await api.get('/api/logs/stats')
      setStats(statsRes.data)

      // 2. Fetch recent Open alerts
      const alertsRes = await api.get('/api/alerts?status=Open&limit=6')
      setRecentAlerts(alertsRes.data.alerts || [])

      // 3. Fetch all active alerts to compile Threat Overview categories dynamically
      const activeAlertsRes = await api.get('/api/alerts?limit=200')
      const activeAlerts = activeAlertsRes.data.alerts || []

      // Aggregate counts by category alertType
      const counts = {
        'Brute Force Attack': 0,
        'Password Spray Attack': 0,
        'Account Enumeration': 0,
        'Port Scan Detected': 0,
        'Privilege Escalation': 0,
        'Reconnaissance Activity': 0,
        'Suspicious IP Activity': 0,
        'Possible Account Compromise': 0,
      }
      activeAlerts.forEach(alert => {
        if (alert.alertType && counts[alert.alertType] !== undefined) {
          counts[alert.alertType]++
        }
      })

      setThreatOverview(prev => prev.map(cat => ({
        ...cat,
        count: counts[cat.alertType] || 0
      })))

      // 4. Fetch incident stats
      const incidentStatsRes = await api.get('/api/incidents/stats')
      setIncidentStats(incidentStatsRes.data)

    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const todayDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  // Format numbers for display (e.g. 1500 -> 1.5K)
  const formatNumber = (num) => {
    if (num === undefined || num === null) return '0'
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toLocaleString()
  }

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return ''
    const diffMs = new Date() - new Date(timestamp)
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours} hr ago`
    return `${diffDays} days ago`
  }

  // Find max count for the Threat Overview chart bar sizing
  const maxThreatCount = Math.max(...threatOverview.map(t => t.count), 1)

  // System Health statistics (simulated/health metrics)
  const systemHealth = [
    { label: 'CPU Usage',      value: 24, status: 'good' },
    { label: 'Memory Usage',   value: 48, status: 'good' },
    { label: 'Disk Space',     value: 62, status: 'good' },
    { label: 'Log Ingestion',  value: stats.totalEvents > 0 ? 100 : 0, status: stats.totalEvents > 0 ? 'good' : 'warning' },
  ]

  return (
    <div className="dashboard-page" id="dashboard-page">

      {/* Welcome Banner */}
      <div className="welcome-banner">
        <div className="welcome-text">
          <h1 className="welcome-greeting">
            {greeting()}, {user?.name?.split(' ')[0] || 'Analyst'} 👋
          </h1>
          <p className="welcome-date">{todayDate} — SOC Dashboard</p>
        </div>
        <div className="welcome-right">
          <div className="live-indicator">
            <span className="pulse-dot"></span>
            <span>Live — {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <button
            className="btn btn-outline"
            id="refresh-dashboard"
            onClick={fetchDashboardData}
            style={{ padding: '0.375rem 0.875rem', fontSize: '0.8rem' }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <StatCard
          title="Total Logs"
          value={formatNumber(stats.totalEvents)}
          icon="📁"
          trend="neutral"
          trendValue="Live"
          severity="accent"
        />
        <StatCard
          title="Total Alerts"
          value={stats.totalAlerts.toString()}
          icon="🚨"
          trend={stats.totalAlerts > 0 ? "up" : "neutral"}
          trendValue={stats.totalAlerts > 0 ? "Flagged Threats" : "0"}
          severity="medium"
        />
        <StatCard
          title="Open Alerts"
          value={stats.openAlerts.toString()}
          icon="⚠️"
          trend={stats.openAlerts > 0 ? "up" : "neutral"}
          trendValue={stats.openAlerts > 0 ? "Triage Needed" : "Resolved"}
          severity={stats.openAlerts > 0 ? "critical" : "low"}
        />
        <StatCard
          title="Critical Alerts"
          value={stats.criticalAlerts.toString()}
          icon="🔥"
          trend={stats.criticalAlerts > 0 ? "up" : "neutral"}
          trendValue={stats.criticalAlerts > 0 ? "Immediate Action" : "None"}
          severity={stats.criticalAlerts > 0 ? "critical" : "low"}
        />
        <StatCard
          title="High Alerts"
          value={stats.highAlerts.toString()}
          icon="🟠"
          trend={stats.highAlerts > 0 ? "up" : "neutral"}
          trendValue={stats.highAlerts > 0 ? "Review Needed" : "None"}
          severity={stats.highAlerts > 0 ? "medium" : "low"}
        />
        <StatCard
          title="Suspicious IPs"
          value={stats.suspiciousIPs.toString()}
          icon="🌐"
          trend={stats.suspiciousIPs > 0 ? "up" : "neutral"}
          trendValue={stats.suspiciousIPs > 0 ? "Flagged IPs" : "0"}
          severity={stats.suspiciousIPs > 0 ? "medium" : "low"}
        />
      </div>

      {/* Main two-column grid */}
      <div className="dashboard-grid">

        {/* Left column — alerts feed */}
        <div className="dashboard-section glass-card">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">🔔</span>
              Recent Active Alerts
            </h2>
            <button
              className="btn btn-outline"
              onClick={() => navigate('/alerts')}
              style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
            >
              View All
            </button>
          </div>

          <div className="alerts-list">
            {recentAlerts.length === 0 ? (
              <div className="empty-alerts-placeholder">
                <span className="shield-ok-icon">🛡️</span>
                <p>No active security threats detected. System is secure.</p>
              </div>
            ) : (
              recentAlerts.map((alert) => (
                <div
                  key={alert._id}
                  className="alert-row"
                  id={`alert-${alert._id}`}
                  onClick={() => navigate('/alerts')}
                  style={{ cursor: 'pointer' }}
                >
                  <span className={`alert-severity-dot severity-dot-${alert.severity?.toLowerCase()}`}></span>
                  <div className="alert-content">
                    <span className="alert-title">{alert.alertType}</span>
                    <span className="alert-meta">
                      IP: {alert.sourceIP || 'N/A'} · {formatTimeAgo(alert.createdAt)}
                    </span>
                  </div>
                  <span className={`alert-badge severity-${alert.severity?.toLowerCase()}`}>
                    {alert.severity}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="dashboard-sidebar-section">

          {/* Quick Actions */}
          <div className="dashboard-section glass-card">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-icon">⚡</span>
                Quick Actions
              </h2>
            </div>
            <div className="quick-actions-grid">
              <button className="quick-action-btn" id="qa-upload-logs" onClick={() => navigate('/logs')}>
                <span className="qa-icon">📤</span>
                <span className="qa-label">Upload Logs</span>
              </button>
              <button className="quick-action-btn" id="qa-run-scan" onClick={() => navigate('/logs')}>
                <span className="qa-icon">🔍</span>
                <span className="qa-label">Log Explorer</span>
              </button>
              <button className="quick-action-btn" id="qa-create-rule" onClick={() => navigate('/detection')}>
                <span className="qa-icon">🛡️</span>
                <span className="qa-label">Threat Detection</span>
              </button>
              <button className="quick-action-btn" id="qa-export-report" onClick={() => navigate('/settings')}>
                <span className="qa-icon">⚙️</span>
                <span className="qa-label">Settings</span>
              </button>
            </div>
          </div>

          {/* Incident Response Summary */}
          <div className="dashboard-section glass-card">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-icon">🛡️</span>
                Incident Response Summary
              </h2>
              <button
                className="btn btn-outline"
                onClick={() => navigate('/incidents')}
                style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
              >
                View All
              </button>
            </div>
            <div className="incident-summary-widget">
              <div className="incident-summary-metric">
                <span className="metric-value text-accent">{incidentStats.open || 0}</span>
                <span className="metric-label">Open Cases</span>
              </div>
              <div className="incident-summary-metric">
                <span className="metric-value text-warning">{incidentStats.inProgress || 0}</span>
                <span className="metric-label">In Progress</span>
              </div>
            </div>
          </div>

          {/* Threat Overview */}
          <div className="dashboard-section glass-card">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-icon">🛡️</span>
                Active Threats Overview
              </h2>
              <span className="threat-overview-badge">Unresolved</span>
            </div>
            <div className="threat-overview-list">
              {threatOverview.every(t => t.count === 0) ? (
                <div className="empty-threats-note">
                  <p>No active threats to display by classification.</p>
                </div>
              ) : (
                threatOverview.map((threat) => (
                  <div key={threat.label} className="threat-row">
                    <div className="threat-label-row">
                      <span className="threat-label">{threat.label}</span>
                      <span className="threat-count" style={{ color: threat.color }}>{threat.count}</span>
                    </div>
                    <div className="threat-bar-track">
                      <div
                        className="threat-bar"
                        style={{
                          width: `${(threat.count / maxThreatCount) * 100}%`,
                          background: threat.color,
                        }}
                      ></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* System Health */}
          <div className="dashboard-section glass-card">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-icon">💚</span>
                System Health
              </h2>
            </div>
            <div className="health-items">
              {systemHealth.map((metric) => (
                <div key={metric.label} className="health-item">
                  <span className="health-label">{metric.label}</span>
                  <div className="health-bar-track">
                    <div
                      className={`health-bar health-bar-${metric.status}`}
                      style={{ width: `${metric.value}%` }}
                    ></div>
                  </div>
                  <span className="health-value">{metric.value}%</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

export default Dashboard
