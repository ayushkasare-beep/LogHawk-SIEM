/**
 * LogHawk – Logs Page
 *
 * Phase 2 Log Management page. Orchestrates:
 *   1. Stats row — live counts from the API
 *   2. Upload section — drag-and-drop log file upload
 *   3. Uploaded Files panel — file history with status tracking
 *   4. Log Explorer — searchable, filterable SIEM event table
 *
 * State management is centralized here. Child components receive
 * data and callbacks as props, keeping them simple and testable.
 */

import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import LogUpload from '../components/LogUpload'
import FileList from '../components/FileList'
import LogExplorer from '../components/LogExplorer'
import useDocumentTitle from '../hooks/useDocumentTitle'
import './Logs.css'

const DEFAULT_STATS = {
  totalFiles: 0,
  totalEvents: 0,
  failedLogins: 0,
  successfulLogins: 0,
}

function StatItem({ icon, label, value, color }) {
  return (
    <div className="log-stat-card glass-card">
      <div className="log-stat-icon" style={{ color }}>{icon}</div>
      <div className="log-stat-body">
        <div className="log-stat-value" style={{ color }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        <div className="log-stat-label">{label}</div>
      </div>
    </div>
  )
}

function Logs() {
  useDocumentTitle('Logs')
  const [stats, setStats] = useState(DEFAULT_STATS)
  const [statsLoading, setStatsLoading] = useState(true)

  const [files, setFiles] = useState([])
  const [filesLoading, setFilesLoading] = useState(true)

  // Track which file is selected in FileList to filter the explorer
  const [selectedFileId, setSelectedFileId] = useState('')

  // ---- Fetch stats ----
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/api/logs/stats')
      setStats(res.data)
    } catch (err) {
      console.error('Stats fetch failed:', err.message)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  // ---- Fetch uploaded files ----
  const fetchFiles = useCallback(async () => {
    try {
      const res = await api.get('/api/logs/files')
      setFiles(res.data.files)
    } catch (err) {
      console.error('Files fetch failed:', err.message)
    } finally {
      setFilesLoading(false)
    }
  }, [])

  // Initial data load
  useEffect(() => {
    fetchStats()
    fetchFiles()
  }, [fetchStats, fetchFiles])

  // Poll every 3 seconds while any file is still processing
  useEffect(() => {
    const isProcessing = files.some((f) => f.status === 'processing')
    if (!isProcessing) return

    const interval = setInterval(() => {
      fetchFiles()
      fetchStats()
    }, 3000)

    return () => clearInterval(interval)
  }, [files, fetchFiles, fetchStats])

  // ---- Callbacks ----
  const handleUploadSuccess = (fileId) => {
    fetchFiles()
    fetchStats()
  }

  const handleDeleteFile = async (fileId) => {
    try {
      await api.delete(`/api/logs/files/${fileId}`)
      // Clear selection if the deleted file was selected
      if (selectedFileId === fileId) setSelectedFileId('')
      fetchFiles()
      fetchStats()
    } catch (err) {
      console.error('Delete failed:', err.message)
      alert(err.response?.data?.message || 'Failed to delete file')
    }
  }

  return (
    <div className="logs-page" id="logs-page">

      {/* Page header */}
      <div className="logs-page-header">
        <div>
          <h1 className="logs-page-title">Log Management</h1>
          <p className="logs-page-subtitle">
            Upload, parse, and explore security logs in real time.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="log-stats-row">
        <StatItem
          icon="📂"
          label="Uploaded Files"
          value={statsLoading ? '…' : stats.totalFiles}
          color="var(--color-accent)"
        />
        <StatItem
          icon="📋"
          label="Total Events"
          value={statsLoading ? '…' : stats.totalEvents}
          color="var(--color-info)"
        />
        <StatItem
          icon="✕"
          label="Failed Logins"
          value={statsLoading ? '…' : stats.failedLogins}
          color="var(--color-danger)"
        />
        <StatItem
          icon="✓"
          label="Successful Logins"
          value={statsLoading ? '…' : stats.successfulLogins}
          color="var(--color-success)"
        />
      </div>

      {/* Upload */}
      <LogUpload onSuccess={handleUploadSuccess} />

      {/* Uploaded Files */}
      <FileList
        files={files}
        loading={filesLoading}
        selectedFileId={selectedFileId}
        onSelect={setSelectedFileId}
        onDelete={handleDeleteFile}
      />

      {/* Log Explorer */}
      <LogExplorer
        selectedFileId={selectedFileId}
        files={files}
      />

    </div>
  )
}

export default Logs
