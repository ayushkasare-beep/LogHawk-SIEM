/**
 * ====================================
 * LogHawk – StatCard Component
 * ====================================
 * Reusable metric card for the SOC Dashboard.
 * Displays a key metric with label, value, trend indicator,
 * and severity-based styling.
 * 
 * Props:
 *   @param {string} title       - Metric label (e.g., "Critical Alerts")
 *   @param {string|number} value - Metric value (e.g., "42")
 *   @param {string} icon        - Emoji or icon character
 *   @param {string} trend       - Trend direction: "up" | "down" | "neutral"
 *   @param {string} trendValue  - Trend percentage (e.g., "+12%")
 *   @param {string} severity    - Color coding: "critical" | "high" | "medium" | "low" | "accent"
 */

import './StatCard.css'

function StatCard({ title, value, icon, trend = 'neutral', trendValue, severity = 'accent' }) {
  const trendClass = trend === 'up' ? 'trend-up' : trend === 'down' ? 'trend-down' : 'trend-neutral'

  return (
    <div className={`stat-card stat-${severity}`} id={`stat-${title?.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="stat-header">
        <span className="stat-icon">{icon}</span>
        <span className="stat-title">{title}</span>
      </div>
      <div className="stat-body">
        <span className="stat-value">{value}</span>
        {trendValue && (
          <span className={`stat-trend ${trendClass}`}>
            {trend === 'up' && '↑'}
            {trend === 'down' && '↓'}
            {trend === 'neutral' && '→'}
            {trendValue}
          </span>
        )}
      </div>
    </div>
  )
}

export default StatCard
