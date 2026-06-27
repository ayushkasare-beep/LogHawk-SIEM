/**
 * LogHawk – Uploaded Files List Component
 *
 * Displays a table of files the user has uploaded.
 * Shows processing status with live indicator.
 * Supports file selection (to filter LogExplorer) and deletion.
 */

import './FileList.css'

const FILE_TYPE_LABELS = {
  linux_auth: 'Linux Auth',
  windows_event: 'Windows Event',
  apache: 'Apache',
  nginx: 'Nginx',
  firewall: 'Firewall',
}

function StatusBadge({ status }) {
  if (status === 'complete') {
    return <span className="file-status-badge status-complete">✓ Complete</span>
  }
  if (status === 'processing') {
    return (
      <span className="file-status-badge status-processing">
        <span className="processing-dot" />
        Processing
      </span>
    )
  }
  return <span className="file-status-badge status-error">✕ Error</span>
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function FileList({ files, loading, selectedFileId, onSelect, onDelete }) {
  if (loading) {
    return (
      <div className="file-list-section glass-card" id="uploaded-files-section">
        <div className="file-list-header">
          <h2 className="section-title">
            <span className="section-icon">📂</span>
            Uploaded Files
          </h2>
        </div>
        <div className="file-list-loading">Loading files...</div>
      </div>
    )
  }

  return (
    <div className="file-list-section glass-card" id="uploaded-files-section">
      <div className="file-list-header">
        <h2 className="section-title">
          <span className="section-icon">📂</span>
          Uploaded Files
          {files.length > 0 && (
            <span className="file-count-badge">{files.length}</span>
          )}
        </h2>
        {selectedFileId && (
          <button
            className="btn btn-outline"
            style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}
            onClick={() => onSelect('')}
          >
            ✕ Clear Filter
          </button>
        )}
      </div>

      {files.length === 0 ? (
        <div className="file-list-empty">
          <span className="file-list-empty-icon">📭</span>
          <p>No log files uploaded yet.</p>
          <p className="file-list-empty-hint">Upload a file above to get started.</p>
        </div>
      ) : (
        <div className="file-table-wrapper">
          <table className="file-table" id="uploaded-files-table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Type</th>
                <th>Uploaded</th>
                <th>Size</th>
                <th>Events</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr
                  key={file._id}
                  className={`file-row ${selectedFileId === file._id ? 'file-row-selected' : ''}`}
                >
                  <td>
                    <span className="file-row-name" title={file.filename}>
                      {file.filename}
                    </span>
                  </td>
                  <td>
                    <span className="file-type-tag">
                      {FILE_TYPE_LABELS[file.filetype] || file.filetype}
                    </span>
                  </td>
                  <td className="file-date">
                    {formatDate(file.createdAt)}
                  </td>
                  <td className="file-size-cell">
                    {formatBytes(file.filesize)}
                  </td>
                  <td className="file-events-cell">
                    {file.status === 'complete'
                      ? file.totalEvents.toLocaleString()
                      : file.status === 'processing'
                        ? '—'
                        : '—'
                    }
                  </td>
                  <td>
                    <StatusBadge status={file.status} />
                    {file.status === 'error' && file.errorMessage && (
                      <span className="error-tooltip" title={file.errorMessage}>ℹ️</span>
                    )}
                  </td>
                  <td>
                    <div className="file-actions">
                      {file.status === 'complete' && (
                        <button
                          className="file-action-btn file-action-view"
                          onClick={() => onSelect(
                            selectedFileId === file._id ? '' : file._id
                          )}
                          title="Filter logs by this file"
                          id={`view-file-${file._id}`}
                        >
                          {selectedFileId === file._id ? 'Unselect' : 'View'}
                        </button>
                      )}
                      <button
                        className="file-action-btn file-action-delete"
                        onClick={() => {
                          if (window.confirm(`Delete "${file.filename}" and all its events?`)) {
                            onDelete(file._id)
                          }
                        }}
                        title="Delete file and all parsed logs"
                        id={`delete-file-${file._id}`}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default FileList
