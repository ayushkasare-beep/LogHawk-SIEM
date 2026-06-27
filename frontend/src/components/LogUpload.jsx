/**
 * LogHawk – Log Upload Component
 *
 * Drag-and-drop + browse file upload with progress bar.
 * Sends multipart POST to /api/logs/upload.
 * Calls onSuccess(fileId) when the server accepts the file.
 */

import { useState, useRef } from 'react'
import api from '../services/api'
import './LogUpload.css'

const LOG_TYPES = [
  { value: 'linux_auth', label: 'Linux Auth Log (auth.log / secure)' },
]

function LogUpload({ onSuccess }) {
  const [dragging, setDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [logType, setLogType] = useState('linux_auth')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null) // { success, message }
  const [error, setError] = useState('')

  const fileInputRef = useRef(null)

  // ---- File validation ----
  const validateFile = (file) => {
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['log', 'txt'].includes(ext)) {
      return 'Only .log and .txt files are supported'
    }
    if (file.size > 50 * 1024 * 1024) {
      return 'File must be under 50 MB'
    }
    if (file.size === 0) {
      return 'File is empty'
    }
    return null
  }

  const handleFileSelect = (file) => {
    if (!file) return
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      setSelectedFile(null)
      return
    }
    setSelectedFile(file)
    setError('')
    setResult(null)
  }

  // ---- Drag events ----
  const handleDragOver = (e) => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    handleFileSelect(file)
  }

  // ---- Upload ----
  const handleUpload = async () => {
    if (!selectedFile || uploading) return

    const formData = new FormData()
    formData.append('logfile', selectedFile)
    formData.append('logType', logType)

    setUploading(true)
    setProgress(0)
    setResult(null)
    setError('')

    try {
      const res = await api.post('/api/logs/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          if (evt.total) {
            setProgress(Math.round((evt.loaded / evt.total) * 100))
          }
        },
      })

      setResult({ success: true, message: res.data.message })
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      onSuccess(res.data.fileId)
    } catch (err) {
      const msg = err.response?.data?.message || 'Upload failed. Please try again.'
      setResult({ success: false, message: msg })
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  const clearFile = () => {
    setSelectedFile(null)
    setError('')
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="upload-section glass-card" id="log-upload-section">
      <div className="upload-section-header">
        <h2 className="section-title">
          <span className="section-icon">📤</span>
          Upload Log File
        </h2>
        <span className="upload-hint">Supported: .log, .txt · Max 50 MB</span>
      </div>

      {/* Drop Zone */}
      <div
        className={`drop-zone ${dragging ? 'drop-zone-active' : ''} ${selectedFile ? 'drop-zone-has-file' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !selectedFile && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Drop zone for log file upload"
        id="drop-zone"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".log,.txt"
          onChange={(e) => handleFileSelect(e.target.files[0])}
          style={{ display: 'none' }}
          id="file-input"
        />

        {!selectedFile ? (
          <div className="drop-zone-empty">
            <div className="drop-zone-icon">📁</div>
            <p className="drop-zone-primary">
              {dragging ? 'Drop your file here' : 'Drag & drop your log file here'}
            </p>
            <p className="drop-zone-secondary">or click to browse</p>
          </div>
        ) : (
          <div className="drop-zone-file">
            <div className="file-icon">📄</div>
            <div className="file-info">
              <span className="file-name">{selectedFile.name}</span>
              <span className="file-size">{formatSize(selectedFile.size)}</span>
            </div>
            <button
              className="file-clear-btn"
              onClick={(e) => { e.stopPropagation(); clearFile() }}
              title="Remove file"
              id="file-clear-btn"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="upload-alert upload-alert-error">
          ⚠️ {error}
        </div>
      )}

      {/* Controls Row */}
      <div className="upload-controls">
        <div className="log-type-field">
          <label htmlFor="log-type-select" className="log-type-label">Log Type</label>
          <select
            id="log-type-select"
            value={logType}
            onChange={(e) => setLogType(e.target.value)}
            disabled={uploading}
          >
            {LOG_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <button
          className="btn btn-primary upload-btn"
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          id="upload-btn"
        >
          {uploading ? `Uploading ${progress}%` : '↑ Upload & Analyze'}
        </button>
      </div>

      {/* Progress Bar */}
      {uploading && (
        <div className="progress-track" role="progressbar" aria-valuenow={progress}>
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Result Message */}
      {result && (
        <div className={`upload-alert ${result.success ? 'upload-alert-success' : 'upload-alert-error'}`}>
          {result.success ? '✅' : '❌'} {result.message}
        </div>
      )}
    </div>
  )
}

export default LogUpload
