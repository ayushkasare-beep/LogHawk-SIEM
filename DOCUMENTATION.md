# LogHawk — Technical Documentation

This document provides a comprehensive engineering reference for the LogHawk SIEM platform, covering system architecture, log parsing pipeline, threat detection design, MongoDB schema, and full API specification.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Authentication](#3-authentication)
4. [Log Ingestion & Parsing Pipeline](#4-log-ingestion--parsing-pipeline)
5. [Threat Detection Engine](#5-threat-detection-engine)
6. [Alert Workflow](#6-alert-workflow)
7. [Incident Response Workflow](#7-incident-response-workflow)
8. [MongoDB Database Schema](#8-mongodb-database-schema)
9. [API Endpoints](#9-api-endpoints)
10. [Security Considerations](#10-security-considerations)
11. [Deployment Notes](#11-deployment-notes)

---

## 1. System Overview

LogHawk is a lightweight SIEM platform designed for security log aggregation, automated threat analysis, and incident containment. The core pipeline:

1. **Log Ingestion:** Analyst uploads a raw `.log` or `.txt` file via React frontend
2. **Asynchronous Parsing:** Express saves the file and immediately returns `202 Accepted`; parsing runs as a background task
3. **Regex Extraction:** The Node.js worker spawns a Python subprocess that parses raw lines into structured JSON
4. **Threat Detection:** Python runs all enabled detectors (or a user-filtered subset) against the parsed events
5. **Database Persistence:** Structured events are bulk-inserted as `ParsedLog` documents; threats are inserted as `Alert` documents
6. **Triage & Containment:** The analyst views and triages alerts, promotes them to `Incident` cases, adds chronological notes, and executes containment actions (Block IP, Disable User)

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         PRESENTATION TIER                        │
│          React 19 SPA — Vite dev server (port 5173)              │
│   Components: Dashboard · Logs · Alerts · ThreatDetection ·      │
│               IncidentResponse · BlockedAssets · Settings        │
└─────────────────────────────┬────────────────────────────────────┘
                              │ Axios — JWT Bearer token in header
┌─────────────────────────────▼────────────────────────────────────┐
│                         APPLICATION TIER                         │
│           Node.js + Express.js REST API (port 5000)              │
│                                                                  │
│  Middleware: cors · morgan · express.json · JWT auth             │
│  File Handling: Multer (disk storage, 50MB limit)                │
│  Background Worker: parserService.js (fire-and-forget)           │
└──────────────┬──────────────────────────────┬────────────────────┘
               │ child_process.execFile        │ Mongoose ODM
┌──────────────▼────────────┐   ┌─────────────▼──────────────────┐
│       ANALYSIS TIER       │   │           DATA TIER             │
│  python-engine/parsers/   │   │     MongoDB (local / Atlas)     │
│  linux_auth_parser.py     │   │                                 │
│  8 × Detector modules     │   │  Collections:                   │
│                           │   │  users · uploadedfiles ·        │
│  Input:  log file path    │   │  parsedlogs · alerts ·          │
│  Output: JSON (stdout)    │   │  incidents · blockedassets ·    │
│                           │   │  detectionrules                 │
└───────────────────────────┘   └─────────────────────────────────┘
```

### Frontend Architecture

- **Routing:** `react-router-dom` v7, protected routes via `ProtectedRoute` wrapper
- **Auth State:** `AuthContext` stores JWT token and user object in `localStorage`
- **API Client:** `services/api.js` — Axios instance with request interceptor that injects `Authorization: Bearer <token>` and a response interceptor that handles `401` by logging out the user
- **Styling:** Vanilla CSS with CSS custom properties. No framework dependencies (no Tailwind, no Bootstrap).
- **No global state library** — component-local `useState`/`useEffect` with context only for auth session

### Backend Architecture

- **REST API:** Express.js with resource-based route handlers
- **Auth Middleware:** `middleware/auth.js` verifies JWT and attaches `req.user`
- **File Upload:** Multer configured in `routes/logRoutes.js` — stores to `backend/uploads/` with a timestamp-prefixed filename; validates extension (`.log`, `.txt`)
- **Python Bridge:** `services/parserService.js` calls `child_process.execFile` with `[scriptPath, '--file', filePath, '--output', 'json', '--enabled-rules', JSON.stringify(enabledRules)]`

---

## 3. Authentication

### Registration

`POST /api/auth/register`

Password requirements enforced before hashing:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- At least one special character (`!@#$%^&*` etc.)

Passwords are hashed with **bcrypt** at 12 salt rounds before storage. The raw password is never logged or persisted.

### JWT Flow

1. On successful **login**, the backend signs a JWT with the user's MongoDB `_id` as the payload
2. The token is returned in the response body (not in a cookie)
3. The frontend stores the token in `localStorage` and attaches it as `Authorization: Bearer <token>` on all API requests
4. The `protect` middleware verifies the signature using `JWT_SECRET` and fetches the user record

**Registration does not issue a token.** After successful registration, the user is redirected to the login page to authenticate.

**Token expiry:** configurable via `JWT_EXPIRE` (default: `7d`)

### Password Reset

The forgot-password flow generates a random 20-byte hex token, hashes it with SHA-256, and stores the hash + a 30-minute expiry timestamp on the User document. The raw token is returned in the API response (suitable for local testing without an email provider).

In production, replace the `resetUrl` console/response return with an actual email send via your preferred provider (SendGrid, Nodemailer, etc.).

---

## 4. Log Ingestion & Parsing Pipeline

### Upload Flow

```
POST /api/logs/upload (multipart/form-data)
  │
  ├─ Multer: save file → backend/uploads/<timestamp>-<originalname>
  ├─ Create UploadedFile document (status: 'processing')
  ├─ Return 202 Accepted { fileId, filename }
  │
  └─ Background:
       parserService.parseAndStore(filePath, fileId, userId, logType)
         │
         ├─ Fetch DetectionRule docs for userId → build enabledRules[]
         ├─ execFile(python, [script, --file, ..., --enabled-rules, ...])
         ├─ Parse stdout JSON
         ├─ ParsedLog.insertMany() in 500-doc batches
         ├─ Alert.insertMany() for all detected threats
         └─ UploadedFile.update(status: 'complete' | 'error')
```

### Parser: `linux_auth_parser.py`

The parser reads the log file line-by-line and applies compiled regex patterns:

| Pattern | Captures | EventType | Status |
|---------|----------|-----------|--------|
| `Accepted password for <user> from <ip>` | username, ipAddress | Login | Success |
| `Failed password for [invalid user] <user> from <ip>` | username, ipAddress | Login | Failed |
| `Invalid user <user> from <ip>` | username, ipAddress | Login | Failed |
| `sudo: <user> : ... USER=<target> ; COMMAND=<cmd>` | username | Sudo | Success |
| `authentication failure.*logname=<user>` | username | Sudo | Failed |
| `session opened for user <user>` | username | Session | Success |
| `session closed for user <user>` | username | Session | Success |

Each line produces a structured dict:
```json
{
  "timestamp": "2024-06-14T08:12:01",
  "username": "root",
  "ipAddress": "192.168.1.105",
  "eventType": "Login",
  "status": "Failed",
  "rawLog": "Jun 14 08:12:01 webserver sshd[1234]: Failed password for root from 192.168.1.105 port 22 ssh2"
}
```

### CLI Output Format

```json
{
  "status": "success",
  "total": 23,
  "events": [ ... ],
  "threats": [ ... ],
  "stats": { "total_events": 23, "total_threats": 4 }
}
```

---

## 5. Threat Detection Engine

Each detector is an independent Python class implementing a `detect(events)` method. Detectors receive the full array of parsed events and return a list of threat objects.

### Detector Loading (Dynamic)

The parser uses `importlib` to load each detector. Disabled rules (from the `--enabled-rules` argument) are skipped:

```python
for rule_id, (module_path, class_name) in RULE_MAP.items():
    if enabled_ids is not None and rule_id not in enabled_ids:
        continue
    mod = importlib.import_module(module_path)
    cls = getattr(mod, class_name)
    detectors.append(cls())
```

### Threat Payload Schema

Each threat returned by a detector includes:

```json
{
  "type": "brute_force",
  "source_ip": "192.168.1.105",
  "severity": "high",
  "confidence": 90,
  "description": "Brute force attack detected: 6 failed attempts from 192.168.1.105 against user root",
  "recommendation": "Block source IP at the network perimeter and require MFA."
}
```

### Alert Type Mapping

| Threat Type | Alert Type |
|-------------|-----------|
| `brute_force` | `Brute Force Attack` |
| `brute_force_success` | `Possible Account Compromise` |
| `password_spray` | `Password Spray Attack` |
| `account_enumeration` | `Account Enumeration` |
| `abnormal_login` | `Suspicious Login Location` |
| `privilege_escalation` | `Privilege Escalation` |
| `reconnaissance` | `Reconnaissance Activity` |
| `suspicious_ip` | `Suspicious IP Activity` |
| `port_scan` | `Port Scan Detected` |

---

## 6. Alert Workflow

```
Threat detected by detector
         │
         ▼
Alert document created in MongoDB:
  { user, alertType, severity, description, sourceIP,
    username, status: 'Open', riskScore, recommendedAction,
    relatedLogs: [ObjectId, ...] }
         │
         ▼
Alert visible in Alert Center (status: Open)
         │
  ┌──────┴────────────────────────────────────┐
  ▼                                           ▼
PATCH /api/alerts/:id/status           Escalate to Incident
  → status: 'Investigating'         POST /api/incidents
  → status: 'Resolved'              → creates Incident document
```

Related log events are attached to each alert at creation time, filtered by IP address and matched against the parsed events inserted in the same batch.

---

## 7. Incident Response Workflow

```
POST /api/incidents  (body: { alertIds: [...], title, description })
         │
         ▼
Incident document created:
  { incidentId, title, description, severity,
    status: 'Open', alerts: [...], notes: [], auditLogs: [] }
         │
    ┌────┴──────────────────────────────────────────┐
    │                                               │
    ▼                                               ▼
POST /api/incidents/:id/note                POST /api/incidents/:id/respond
  → { content, analyst }                     body: { action, targetIp, reason, analyst }
  → appended to notes[]                      actions:
  → auditLog entry added                       • block_ip    → BlockedAsset.create()
                                               • disable_user → auditLog only
                                               • escalate    → auditLog only
    │
    ▼
POST /api/incidents/:id/resolve
  → status: 'Resolved'
  → resolvedAt timestamp set
  → auditLog entry added
```

### BlockedAsset Creation

When `action: 'block_ip'` is executed:
- `BlockedAsset` document is created with `ip`, `reason`, `incidentId`, `incidentRef`, `blockedByUser` (ObjectId), `blockedBy` (display name)
- The blocked asset is scoped to the authenticated user via `blockedByUser`
- Visible in `GET /api/blocked-assets` filtered by `req.user._id`

---

## 8. MongoDB Database Schema

### `users`

| Field | Type | Notes |
|-------|------|-------|
| `username` | String | Display name |
| `email` | String | Unique, lowercase |
| `passwordHash` | String | bcrypt hash, `select: false` |
| `role` | String | `analyst` \| `admin` |
| `resetPasswordToken` | String | SHA-256 hashed token |
| `resetPasswordExpire` | Date | 30-minute window |
| `lastLogin` | Date | Updated on each login |
| `createdAt` | Date | Auto |

### `uploadedfiles`

| Field | Type | Notes |
|-------|------|-------|
| `filename` | String | Original name |
| `storedFilename` | String | Timestamp-prefixed server name |
| `filepath` | String | Absolute disk path |
| `filesize` | Number | Bytes |
| `filetype` | String | `linux_auth` |
| `uploadedBy` | ObjectId | ref: User |
| `status` | String | `processing` \| `complete` \| `error` |
| `totalEvents` | Number | Count of parsed lines |
| `errorMessage` | String | Set on parse failure |

### `parsedlogs`

| Field | Type | Notes |
|-------|------|-------|
| `uploadedFile` | ObjectId | ref: UploadedFile |
| `uploadedBy` | ObjectId | ref: User |
| `timestamp` | Date | Extracted from log line |
| `username` | String | Target user |
| `ipAddress` | String | Source IP |
| `eventType` | String | `Login` \| `Authentication` \| `Sudo` \| `Session` \| `Other` |
| `status` | String | `Success` \| `Failed` \| `Unknown` |
| `rawLog` | String | Original log line |
| `sourceFile` | String | Filename reference |

### `alerts`

| Field | Type | Notes |
|-------|------|-------|
| `user` | ObjectId | ref: User |
| `alertType` | String | Human-readable threat name |
| `severity` | String | `Low` \| `Medium` \| `High` \| `Critical` |
| `description` | String | Threat narrative |
| `sourceIP` | String | Origin IP |
| `username` | String | Targeted account |
| `status` | String | `Open` \| `Investigating` \| `Resolved` |
| `riskScore` | Number | Detector confidence (1–100) |
| `recommendedAction` | String | Mitigation guidance |
| `relatedLogs` | [ObjectId] | ref: ParsedLog |
| `sourceFile` | String | File of origin |
| `createdAt` | Date | Auto |

### `incidents`

| Field | Type | Notes |
|-------|------|-------|
| `incidentId` | String | Auto-generated (e.g. `INC-001`) |
| `title` | String | Case summary |
| `description` | String | Narrative |
| `severity` | String | `Low` \| `Medium` \| `High` \| `Critical` |
| `status` | String | `Open` \| `In Progress` \| `Resolved` |
| `assignee` | ObjectId | ref: User |
| `createdBy` | ObjectId | ref: User |
| `alerts` | [ObjectId] | ref: Alert |
| `notes` | [Object] | `{ content, analyst, timestamp }` |
| `auditLogs` | [Object] | `{ action, description, analyst, timestamp }` |
| `resolvedAt` | Date | Set on resolution |

### `blockedassets`

| Field | Type | Notes |
|-------|------|-------|
| `ip` | String | Blocked IP address |
| `reason` | String | Containment explanation |
| `incidentId` | ObjectId | ref: Incident |
| `incidentRef` | String | Human-readable incident ID |
| `blockedByUser` | ObjectId | ref: User — for data isolation |
| `blockedBy` | String | Analyst display name |
| `blockedAt` | Date | Auto |

### `detectionrules`

| Field | Type | Notes |
|-------|------|-------|
| `user` | ObjectId | ref: User |
| `ruleId` | String | One of 8 rule IDs |
| `enabled` | Boolean | Default: `true` |

Compound unique index: `{ user, ruleId }` — one record per analyst per rule.

---

## 9. API Endpoints

All protected endpoints require: `Authorization: Bearer <token>`

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | Public | Register analyst |
| POST | `/api/auth/login` | Public | Authenticate, receive token |
| POST | `/api/auth/logout` | Public | Stateless session end |
| GET | `/api/auth/me` | Protected | Get current user |
| PUT | `/api/auth/profile` | Protected | Update username / email |
| PATCH | `/api/auth/me/password` | Protected | Change password |
| POST | `/api/auth/forgot-password` | Public | Generate reset token |
| POST | `/api/auth/reset-password` | Public | Set new password via token |

### Log Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/logs/upload` | Protected | Upload log file (field: `logfile`, body: `logType`) |
| GET | `/api/logs/files` | Protected | List uploaded files |
| DELETE | `/api/logs/files/:id` | Protected | Delete file + events + related alerts |
| GET | `/api/logs` | Protected | Paginated log query |
| GET | `/api/logs/stats` | Protected | Dashboard telemetry counts |

**Log query params:** `page`, `limit`, `search`, `status`, `eventType`, `fileId`

### Alert Center

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/alerts` | Protected | List alerts (`status`, `severity`, `page`, `limit`) |
| GET | `/api/alerts/stats` | Protected | Open / unresolved counts |
| GET | `/api/alerts/:id` | Protected | Alert detail with related log excerpts |
| PATCH | `/api/alerts/:id/status` | Protected | Update status |

### Incident Response

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/incidents` | Protected | List cases |
| POST | `/api/incidents` | Protected | Create case from alert IDs |
| GET | `/api/incidents/:id` | Protected | Case detail |
| POST | `/api/incidents/:id/assign` | Protected | Assign analyst |
| POST | `/api/incidents/:id/note` | Protected | Add note |
| POST | `/api/incidents/:id/respond` | Protected | Execute action (`block_ip`, `disable_user`, `escalate`) |
| POST | `/api/incidents/:id/resolve` | Protected | Resolve case |

**Respond body example:**
```json
{
  "action": "block_ip",
  "targetIp": "192.168.1.105",
  "reason": "Brute force source identified",
  "analyst": "j.smith"
}
```

### Blocked Assets

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/blocked-assets` | Protected | List blocked IPs for current user (`search`, `page`, `limit`) |

### Detection Rules

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/detection-rules` | Protected | Get all 8 rule states for current user |
| PATCH | `/api/detection-rules/:ruleId` | Protected | Toggle rule (body: `{ "enabled": true }`) |

**Valid `ruleId` values:** `brute_force`, `password_spray`, `account_enum`, `abnormal_login`, `privilege_escalation`, `reconnaissance`, `suspicious_ip`, `port_scan`

### Health Check

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | Public | Returns `{ status, service, version, timestamp, uptime }` |

---

## 10. Security Considerations

- **Password hashing:** bcrypt with 12 salt rounds. The raw password is never stored or logged.
- **JWT:** Signed using `JWT_SECRET` from environment. Expiry configurable via `JWT_EXPIRE`. Tokens are stateless — logout just removes the client-side token.
- **Data isolation:** All MongoDB queries for logs, alerts, incidents, and blocked assets include `uploadedBy: req.user._id` or `user: req.user._id`. Analysts cannot access each other's data.
- **File upload safety:** Multer restricts file extension to `.log` and `.txt`. Max file size is 50MB. Files are stored under unpredictable timestamp-prefixed names.
- **Subprocess safety:** Python is invoked using `child_process.execFile` with arguments passed as a separate array — not concatenated into a shell string. This prevents shell injection.
- **CORS:** The CORS origin allowlist accepts localhost origins (any port) and the configured `CLIENT_URL`. All other origins are rejected.
- **Input sanitization:** Mongoose schemas define explicit field types and validation rules. Express JSON body parser enforces 50MB limit.
- **Environment variables:** All secrets (`JWT_SECRET`, `MONGO_URI`) are loaded from `.env` which is excluded from version control via `.gitignore`.

---

## 11. Deployment Notes

### Frontend

- Build: `cd frontend && npm run build` — outputs to `frontend/dist/`
- The Vite build bundles all React assets into hashed filenames for cache-busting
- Serve `frontend/dist/` from any static file host (Nginx, Vercel, Netlify, S3+CloudFront)
- Configure `VITE_API_URL` environment variable if the API URL differs from `http://localhost:5000`

### Backend

- Set `NODE_ENV=production` in the environment
- Use a process manager (PM2, systemd) to keep the server alive
- Set a strong, randomly-generated `JWT_SECRET` (minimum 32 characters)
- MongoDB: use a dedicated Atlas cluster with IP allowlist and strong credentials
- Reverse proxy: run behind Nginx or Caddy for SSL termination, request buffering, and rate limiting

### Python Engine

- Install dependencies: `pip install -r python-engine/requirements.txt`
- Ensure the Python interpreter command matches the `PYTHON_PATH` configured in `backend/.env`
- The engine is invoked per-request (per file upload); no persistent process is needed
