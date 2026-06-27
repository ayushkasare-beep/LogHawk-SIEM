# LogHawk — Security Log Analysis Platform

A portfolio SIEM (Security Information and Event Management) project that ingests raw Linux authentication logs, parses them into structured events, runs 8 signature-based threat detectors, generates triage-ready alerts, and provides a full incident response workflow.

Built to demonstrate practical knowledge of SOC workflows, log parsing architecture, threat detection design, and full-stack security application development.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Features](#2-features)
3. [Screenshots](#3-screenshots)
4. [Architecture](#4-architecture)
5. [Technology Stack](#5-technology-stack)
6. [Installation Guide](#6-installation-guide)
7. [Configuration](#7-configuration)
8. [Usage](#8-usage)
9. [Detection Capabilities](#9-detection-capabilities)
10. [Incident Response Workflow](#10-incident-response-workflow)
11. [Folder Structure](#11-folder-structure)
12. [API Reference](#12-api-reference)
13. [Future Improvements](#13-future-improvements)
14. [Resume Description](#14-resume-description)

---

## 1. Project Overview

LogHawk simulates the core data pipeline of a Security Operations Center:

- Analysts upload raw auth log files via a drag-and-drop interface
- The backend asynchronously calls a Python subprocess to parse log lines using compiled regex patterns
- Parsed events are bulk-inserted into MongoDB
- 8 threat signature detectors scan events and generate structured alerts
- Analysts triage alerts, promote them to incidents, add case notes, and apply containment actions (Block IP, Disable User)
- Blocked asset records are user-scoped and visible in a dedicated Blocked Assets view

The application enforces per-analyst data isolation — every query, alert, incident, and blocked asset is filtered by the authenticated user's MongoDB ObjectId.

---

## 2. Features

| Feature | Description |
|---------|-------------|
| **Log Ingestion** | Drag-and-drop upload of `.log` / `.txt` Linux auth log files. Returns `202 Accepted` immediately; parsing runs in background. |
| **Log Explorer** | Paginated, filterable table of parsed log events. Filter by username, source IP, event type (`Login`, `Sudo`, `Session`), and status (`Success`, `Failed`). |
| **Threat Detection** | 8 signature detectors execute on each ingestion. Results surface as structured alert documents. Per-analyst rule toggling persisted in MongoDB. |
| **Alert Center** | Full alert lifecycle: `Open → Investigating → Resolved`. Alert detail drawer shows related log events, source IP, recommended action, and risk score. |
| **Incident Response** | Promote alerts to incident cases. Add analyst notes with timestamps, track audit log timeline, execute containment actions (Block IP, Disable User, Escalate). |
| **Blocked Assets** | Searchable, paginated view of all IP addresses blocked via incident containment. User-scoped and timestamped. |
| **Password Reset** | Token-based password reset flow with bcrypt re-hashing and 30-minute expiry window. |
| **Settings** | Profile management, password change, and live API/database health status monitoring. |

---

## 3. Screenshots

Screenshots can be added to the `assets/` directory. Suggested naming convention:

| File | Page |
|------|------|
| `assets/screenshot-login.png` | Login and registration screen |
| `assets/screenshot-dashboard.png` | Main SOC dashboard with telemetry stats |
| `assets/screenshot-logs.png` | Log upload and log explorer |
| `assets/screenshot-alerts.png` | Alert center with triage drawer |
| `assets/screenshot-detection.png` | Threat detection rules panel |
| `assets/screenshot-incidents.png` | Incident workspace with notes and timeline |
| `assets/screenshot-blocked.png` | Blocked assets table |
| `assets/screenshot-settings.png` | Settings and profile management |

---


## 4. Architecture

LogHawk uses a four-tier architecture:

```
┌──────────────────────────────────────────────────────┐
│                  PRESENTATION TIER                   │
│         React 19 + React Router v7 (Vite)            │
└──────────────────────────┬───────────────────────────┘
                           │  JSON / REST API (Axios + JWT)
┌──────────────────────────▼───────────────────────────┐
│                  APPLICATION TIER                    │
│       Node.js + Express.js REST API Gateway          │
│         Multer file handler  │  JWT auth middleware   │
└──────────┬───────────────────────────────┬───────────┘
           │ child_process.execFile        │ Mongoose ODM
┌──────────▼───────────┐     ┌─────────────▼────────────┐
│    ANALYSIS TIER     │     │       DATA TIER           │
│   Python subprocess  │     │   MongoDB (Atlas / local)  │
│  linux_auth_parser.py│     │  6 collections            │
│  8 threat detectors  │     └───────────────────────────┘
└──────────────────────┘
```

**Data flow on log upload:**
1. Frontend POSTs log file as `multipart/form-data`
2. Multer saves file to `backend/uploads/`
3. Controller returns `202 Accepted` and fires background task
4. `parserService.js` calls Python via `execFile` with `--file`, `--output json`, and `--enabled-rules` arguments
5. Python returns a JSON blob of parsed events and detected threats
6. Node bulk-inserts `ParsedLog` documents and creates `Alert` documents
7. Frontend polls file status until `complete`

---

## 5. Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, React Router v7, Axios, Vanilla CSS |
| Backend | Node.js, Express.js |
| Authentication | JSON Web Tokens (JWT), bcryptjs (12 salt rounds) |
| File Handling | Multer (disk storage) |
| Database | MongoDB with Mongoose ODM |
| Python Engine | Python 3.10+, `re`, `collections`, `argparse`, `python-dateutil` |
| Dev Server | Vite 8, Nodemon |

---

## 6. Installation Guide

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | 18+ |
| Python | 3.10+ |
| MongoDB | 6+ local instance **or** MongoDB Atlas cluster |

### Clone the Repository

```bash
git clone https://github.com/your-github-username/LogHawk.git
cd LogHawk
```

### Backend Setup

```bash
cd backend
cp .env.example .env        # Copy environment template
# Edit .env and set your MONGO_URI and JWT_SECRET
npm install
npm run dev                 # Starts Express on port 5000
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev                 # Starts Vite dev server on port 5173
```

### Python Engine Setup

```bash
cd python-engine
pip install -r requirements.txt
```

The Python engine is invoked automatically by the backend. No manual startup required.

---

## 7. Configuration

All backend configuration is handled via `backend/.env`. Copy `backend/.env.example` and fill in values:

```env
# Server
PORT=5000
NODE_ENV=development

# MongoDB connection string (local or Atlas)
MONGO_URI=mongodb://127.0.0.1:27017/loghawk

# JWT signing secret — use a long random string in production
JWT_SECRET=your_jwt_secret_key_here_change_in_production
JWT_EXPIRE=7d

# Frontend origin for CORS
CLIENT_URL=http://localhost:5173

# Python interpreter (defaults to 'python' from PATH if not set)
# PYTHON_PATH=python3
# PYTHON_PATH=C:\Users\You\AppData\Local\Programs\Python\python.exe
```

**Security note:** Never commit `.env` to version control. It is already listed in `.gitignore`.

---

## 8. Usage

1. **Register** — Create an analyst account at `/register`. Password must meet complexity requirements (uppercase, lowercase, number, special character).
2. **Upload a Log** — Navigate to **Logs**, drag-and-drop a Linux auth log file, or use the sample file at `python-engine/sample_logs/sample_auth.log`.
3. **Monitor Parsing** — The file card shows `Processing → Complete`. Refresh or wait for status to update automatically.
4. **Explore Events** — Use the Log Explorer to search, filter, and paginate through parsed events.
5. **Triage Alerts** — Go to **Alerts** to view generated alerts. Click any alert to open the detail drawer: view related logs, severity, source IP, and recommended mitigation.
6. **Create an Incident** — From the alert drawer, click **Escalate to Incident**. This creates a case in the Incident Response workspace.
7. **Manage the Incident** — Open the incident, assign an analyst, add case notes, and execute containment actions (Block IP, Disable User, Escalate).
8. **Review Blocked Assets** — Navigate to **Blocked Assets** to see all IP addresses quarantined via containment actions.
9. **Manage Rules** — Go to **Threat Detection** to view which signatures are active and toggle individual rules on or off.

---

## 9. Detection Capabilities

The Python analysis engine includes 8 independent signature-based detectors. Each is a standalone class that accepts a list of parsed log events and returns structured threat objects.

| Detector | MITRE ATT&CK | Severity | Trigger Logic |
|----------|-------------|----------|---------------|
| **BruteForceDetector** | T1110 | High | > 5 failed auth attempts from same IP within 5 minutes |
| **PasswordSprayDetector** | T1110.003 | High | > 3 unique usernames targeted from same IP within 10 minutes |
| **AccountEnumerationDetector** | T1087 | Medium | > 5 invalid username attempts from same IP |
| **AbnormalLoginDetector** | T1078 | Medium | Successful login from IP matching a suspicious network block |
| **PrivilegeEscalationDetector** | T1068 | Critical | Failed `su`/`sudo` commands or unauthorized sudoers access |
| **ReconnaissanceDetector** | T1595 | Medium | Log lines referencing known scanner paths (`.env`, `wp-admin`, `/etc/passwd`) |
| **SuspiciousIPDetector** | T1090 | Medium | Source IP appears in prior alert history |
| **PortScanDetector** | T1046 | Medium | Rapid connections to multiple unique ports from single IP |

Each threat payload includes: `type`, `source_ip`, `severity`, `confidence`, `description`, and `recommendation`.

Per-analyst rule toggles are persisted in MongoDB via the `DetectionRule` collection. Disabled rules are skipped at parse time by passing `--enabled-rules` as a JSON argument to the Python subprocess.

---

## 10. Incident Response Workflow

```
Uploaded Log File
       │
       ▼
Python Parser (regex extraction)
       │
       ▼
Threat Detectors (8 signatures)
       │
       ▼
Alert Generated → Alert Center (status: Open)
       │
       ▼
Analyst Triages Alert → status: Investigating
       │
       ▼
Escalate to Incident → Incident Response workspace
       │
       ├─► Add Notes (timestamped, audit trail)
       ├─► Assign Analyst
       ├─► Execute Containment:
       │       • Block IP (creates BlockedAsset record)
       │       • Disable User Account
       │       • Escalate to Senior Analyst
       │
       ▼
Resolve Incident → status: Resolved
```

All actions are recorded in the incident's audit log timeline.

---

## 11. Folder Structure

```
LogHawk/
├── LICENSE
├── README.md
├── DOCUMENTATION.md
├── .gitignore
├── assets/                         # Screenshots for README (add manually)
│
├── backend/                        # Express.js REST API
│   ├── .env.example                # Environment variable template
│   ├── server.js                   # Entry point – middleware + route registration
│   ├── config/
│   │   └── db.js                   # MongoDB connection via Mongoose
│   ├── controllers/
│   │   ├── authController.js       # Register, login, password reset, profile
│   │   ├── logController.js        # Upload, list, query, delete log files
│   │   ├── alertController.js      # Alert listing, detail, status updates
│   │   ├── incidentController.js   # Case management, notes, containment actions
│   │   └── detectionRulesController.js  # Per-user rule toggle persistence
│   ├── middleware/
│   │   ├── auth.js                 # JWT verification middleware
│   │   ├── upload.js               # Multer configuration
│   │   └── errorHandler.js         # Global error handler
│   ├── models/
│   │   ├── User.js                 # Analyst account schema
│   │   ├── UploadedFile.js         # Uploaded file metadata schema
│   │   ├── ParsedLog.js            # Individual parsed security event schema
│   │   ├── Alert.js                # Threat alert schema
│   │   ├── Incident.js             # Incident case schema
│   │   ├── BlockedAsset.js         # Blocked IP containment record schema
│   │   └── DetectionRule.js        # Per-user rule enabled/disabled state
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── logRoutes.js
│   │   ├── alertRoutes.js
│   │   ├── incidentRoutes.js
│   │   └── detectionRulesRoutes.js
│   ├── services/
│   │   └── parserService.js        # Python subprocess bridge + bulk insert logic
│   └── utils/
│       └── sendEmail.js            # Email utility (password reset — stub)
│
├── frontend/                       # React 19 SPA (Vite)
│   └── src/
│       ├── App.jsx                 # Route definitions
│       ├── main.jsx                # React root + BrowserRouter
│       ├── index.css               # Global CSS design tokens
│       ├── components/             # Reusable UI components
│       │   ├── Sidebar.jsx / .css
│       │   ├── Navbar.jsx / .css
│       │   ├── LogUpload.jsx / .css
│       │   ├── LogExplorer.jsx / .css
│       │   ├── FileList.jsx / .css
│       │   └── StatCard.jsx / .css
│       ├── context/
│       │   └── AuthContext.jsx     # JWT session + user state provider
│       ├── layouts/
│       │   └── DashboardLayout.jsx
│       ├── pages/
│       │   ├── Dashboard.jsx / .css
│       │   ├── Logs.jsx / .css
│       │   ├── Alerts.jsx / .css
│       │   ├── ThreatDetection.jsx / .css
│       │   ├── IncidentResponse.jsx / .css
│       │   ├── BlockedAssets.jsx / .css
│       │   ├── Settings.jsx / .css
│       │   ├── Login.jsx
│       │   ├── Register.jsx
│       │   ├── ForgotPassword.jsx / .css
│       │   └── ResetPassword.jsx / .css
│       └── services/
│           └── api.js              # Axios instance with JWT interceptors
│
└── python-engine/                  # Log analysis subprocess
    ├── requirements.txt
    ├── main.py                     # Standalone CLI entry point (for manual use)
    ├── parsers/
    │   ├── linux_auth_parser.py    # Primary parser — called by backend
    │   └── log_parser.py           # Multi-format parser (architecture reference)
    ├── detectors/
    │   ├── brute_force_detector.py
    │   ├── password_spray_detector.py
    │   ├── account_enumeration_detector.py
    │   ├── abnormal_login_detector.py
    │   ├── privilege_escalation_detector.py
    │   ├── reconnaissance_detector.py
    │   ├── suspicious_ip_detector.py
    │   └── portscan_detector.py
    ├── sample_logs/
    │   └── sample_auth.log         # Sample Linux auth log for testing
    └── reports/                    # Output directory for standalone CLI use
```

---

## 12. API Reference

All endpoints (except `/api/auth/*` and `/api/health`) require a valid JWT in the `Authorization: Bearer <token>` header.

### Authentication — `/api/auth`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Register new analyst account |
| POST | `/login` | Authenticate and receive JWT |
| POST | `/logout` | Invalidate session (stateless) |
| GET | `/me` | Return current user profile |
| PUT | `/profile` | Update username and email |
| PATCH | `/me/password` | Change password (requires current password) |
| POST | `/forgot-password` | Generate password reset token |
| POST | `/reset-password` | Submit reset token and new password |

### Log Management — `/api/logs`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Upload log file (field: `logfile`) — returns 202 |
| GET | `/files` | List uploaded files for current user |
| DELETE | `/files/:id` | Delete file, events, and related alerts |
| GET | `/` | Paginated log query (`page`, `limit`, `search`, `status`, `eventType`, `fileId`) |
| GET | `/stats` | Aggregate dashboard telemetry |

### Alert Center — `/api/alerts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List alerts (`status`, `severity`, `page`, `limit`) |
| GET | `/stats` | Count open and unresolved alerts |
| GET | `/:id` | Get alert detail with related log excerpts |
| PATCH | `/:id/status` | Update alert status (`Open`, `Investigating`, `Resolved`) |

### Incident Response — `/api/incidents`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List incident cases |
| POST | `/` | Create incident from alert IDs |
| GET | `/:id` | Get full incident with notes and audit log |
| POST | `/:id/assign` | Assign analyst |
| POST | `/:id/note` | Append note |
| POST | `/:id/respond` | Execute containment action (`block_ip`, `disable_user`, `escalate`) |
| POST | `/:id/resolve` | Resolve case |

### Blocked Assets — `/api/blocked-assets`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List blocked IPs for current user (`search`, `page`, `limit`) |

### Detection Rules — `/api/detection-rules`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get enabled/disabled state for all 8 rules |
| PATCH | `/:ruleId` | Toggle a rule on or off (body: `{ "enabled": true }`) |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Returns server status, uptime, and timestamp |

---

## 13. Future Improvements

- Support for Windows Event Log (XML/EVTX) and Apache/Nginx access log formats
- Custom rule threshold editor — allow analysts to adjust brute-force window and count parameters via UI
- Email or webhook notifications for `Critical` severity alerts
- Export incident report to PDF or Markdown
- Docker Compose setup for zero-configuration local deployment

---

## 14. Resume Description

> **LogHawk** — Full-Stack SIEM Platform | React · Node.js · Python · MongoDB
>
> Designed and built a security information and event management portfolio application from scratch. Implemented a four-tier architecture: React SPA dashboard, Express.js REST API, Python regex-based log analysis subprocess, and MongoDB persistence. The system ingests Linux authentication logs, extracts structured security events, and executes 8 signature-based threat detectors (brute force, password spray, account enumeration, privilege escalation, and 4 others). Generated alerts feed into a triage workflow that supports status tracking, analyst assignment, chronological case notes, and IP containment actions. Enforced per-user data isolation across all API endpoints. Implemented JWT authentication with bcrypt password hashing, token-based password reset, and configurable detection rules persisted per analyst in MongoDB.
