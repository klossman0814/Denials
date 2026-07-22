# Insurance Denials System — Design Document

**Date:** 2026-07-22
**Status:** Approved

## 1. System Architecture

A monolithic backend (Express) + React (Vite) frontend running in Docker containers.

```
docker-compose
├── frontend (Vite + React, served via Nginx on :5173)
├── backend  (Node.js/Express API on :3001)
├── postgres (PostgreSQL 16 on :5441)
```

**File Storage:**
- `./data/837/` — uploaded or monitored 837 claim files
- `./data/835/` — uploaded or monitored 835 remittance files
- Files can be uploaded via the UI or copied directly to these directories (watched by chokidar)

**Networking:** All containers on a single Docker bridge network. PostgreSQL port set to `5441` (configurable via `.env`).

## 2. Backend Architecture

### Directory Structure
```
backend/
├── src/
│   ├── config/           # DB, env, app configuration
│   ├── routes/           # Express route definitions
│   │   ├── auth.routes.js
│   │   ├── claims.routes.js
│   │   ├── dashboard.routes.js
│   │   └── upload.routes.js
│   ├── controllers/      # Thin request handlers
│   │   ├── auth.controller.js
│   │   ├── claims.controller.js
│   │   ├── dashboard.controller.js
│   │   └── upload.controller.js
│   ├── services/         # Business logic layer
│   │   ├── auth.service.js
│   │   ├── claim.service.js
│   │   ├── dashboard.service.js
│   │   └── analysis.service.js
│   ├── parsers/          # EDI 837/835 parsers
│   │   ├── edi837.parser.js
│   │   ├── edi835.parser.js
│   │   └── edi.utils.js
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   ├── error.middleware.js
│   │   └── upload.middleware.js
│   ├── models/           # Sequelize models
│   ├── watcher/          # chokidar file watcher
│   ├── utils/            # Logger, helpers
│   ├── app.js            # Express setup
│   └── server.js         # Entry point
├── tests/
├── Dockerfile
└── package.json
```

### Technology Stack
- **Runtime:** Node.js 20 LTS
- **Framework:** Express 4.x
- **ORM:** Sequelize 6.x with `pg` driver
- **Auth:** bcrypt + jsonwebtoken
- **File watching:** chokidar
- **Logging:** winston
- **File upload:** multer

## 3. Database Schema

### Tables

**users** — Authentication and role management
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | gen_random_uuid() |
| username | VARCHAR(100) UNIQUE | |
| email | VARCHAR(255) UNIQUE | |
| password_hash | VARCHAR(255) | bcrypt hash |
| role | VARCHAR(20) | 'staff' or 'admin' |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**uploaded_files** — File lifecycle tracking
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| filename | VARCHAR(255) | |
| file_type | VARCHAR(3) | '837' or '835' |
| file_path | TEXT | |
| file_size | BIGINT | |
| status | VARCHAR(20) | pending → parsing → parsed / error |
| error_message | TEXT | |
| uploaded_by | UUID FK→users | nullable (null for auto-detected files) |
| uploaded_at | TIMESTAMPTZ | |
| parsed_at | TIMESTAMPTZ | |

**claims** — 837 claim data
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| file_id | UUID FK→uploaded_files | |
| claim_id | VARCHAR(50) | Internal ID from 837 |
| patient_last_name | VARCHAR(100) | |
| patient_first_name | VARCHAR(100) | |
| patient_dob | DATE | |
| patient_gender | VARCHAR(10) | |
| subscriber_id | VARCHAR(100) | |
| payer_name | VARCHAR(200) | |
| provider_name | VARCHAR(200) | |
| provider_npi | VARCHAR(20) | |
| total_charge | DECIMAL(10,2) | |
| service_date_start | DATE | |
| service_date_end | DATE | |
| status | VARCHAR(20) | submitted / paid / denied / partial |
| created_at | TIMESTAMPTZ | |

**claim_lines** — 837 line item services
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| claim_id | UUID FK→claims | |
| line_number | INT | |
| procedure_code | VARCHAR(20) | CPT/HCPCS |
| diagnosis_code | VARCHAR(20) | ICD-10 |
| charge_amount | DECIMAL(10,2) | |
| service_date | DATE | |

**remittances** — 835 payment/denial records
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| file_id | UUID FK→uploaded_files | |
| claim_id | UUID FK→claims | nullable until matched |
| patient_name | VARCHAR(200) | |
| payer_claim_id | VARCHAR(100) | |
| total_charge | DECIMAL(10,2) | |
| total_paid | DECIMAL(10,2) | |
| adjustment_amount | DECIMAL(10,2) | |
| remittance_date | DATE | |
| status | VARCHAR(20) | pending / paid / denied / partial |

**denial_reasons** — CAS segment adjustments
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| remittance_id | UUID FK→remittances | |
| claim_id | UUID FK→claims | |
| claim_line_id | UUID FK→claim_lines | nullable |
| denial_code | VARCHAR(10) | e.g., CO-45, PR-3 |
| group_code | VARCHAR(5) | CO / PR / OA / PI |
| amount | DECIMAL(10,2) | |
| reason_description | TEXT | |
| created_at | TIMESTAMPTZ | |

## 4. EDI Parsing Pipeline

### 837 Parser (Claims)
```
Input: X12 5010 837P file
State machine: ISA → GS → ST → BHT → HL → CLM → ...
Extracts:
  - ISA header (sender/receiver IDs, date)
  - HL hierarchy (billing provider, subscriber, patient)
  - CLM segments (claim ID, charge amount, POS)
  - NM1 segments (names: patient, provider, payer)
  - DMG (patient demographics)
  - LX + SV1 + DTP (line items, procedure codes, dates)
  - HI (diagnosis codes)
Output: Claim records with line items
```

### 835 Parser (Remittance)
```
Input: X12 5010 835 file
State machine: ISA → GS → ST → BPR → CLP → ...
Extracts:
  - BPR (payment amount, payer info)
  - CLP (claim-level payment info)
  - SVC (service line payments)
  - CAS (denial/adjustment codes)
  - NM1 (patient/provider names)
Output: Remittance records with denial reasons
```

### Claim↔Remittance Matching
- Primary: Match by subscriber ID + claim ID + service dates
- Secondary: Match by patient name + provider NPI + approximate dates
- Unmatched 835s create remittances without claim_id (shown as "unmatched" on dashboard)

## 5. Frontend Architecture

### Directory Structure
```
frontend/
├── public/
├── src/
│   ├── components/
│   │   ├── Layout/        # AppShell, Sidebar, Navbar, Footer
│   │   ├── Charts/        # All chart components
│   │   ├── DataTable/     # Reusable sortable table
│   │   ├── StatusBadge/   # Claim status visual indicator
│   │   ├── FileUpload/    # Drag-and-drop upload zone
│   │   ├── ThemeToggle/   # Light/dark mode toggle
│   │   └── Notification/  # Toast notification system
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Claims.jsx
│   │   ├── ClaimDetail.jsx
│   │   ├── Upload.jsx
│   │   └── Admin.jsx
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useDashboard.js
│   │   └── useTheme.js
│   ├── context/
│   │   ├── AuthContext.jsx
│   │   └── ThemeContext.jsx
│   ├── services/
│   │   ├── api.js         # Axios instance + JWT interceptor
│   │   ├── auth.api.js
│   │   ├── claims.api.js
│   │   └── dashboard.api.js
│   ├── styles/
│   │   ├── globals.css
│   │   └── theme.css      # CSS custom properties
│   ├── App.jsx
│   └── main.jsx
├── Dockerfile
├── nginx.conf
├── vite.config.js
└── package.json
```

### Technology Stack
- **Build:** Vite 5.x
- **UI Framework:** React 18.x
- **Routing:** React Router v6
- **HTTP:** Axios
- **Charts:** Recharts
- **Styling:** CSS custom properties (no framework)
- **Testing:** Vitest + React Testing Library

### Theme System
- CSS custom properties on `:root` (light) and `[data-theme="dark"]`
- 5 semantic color tokens: primary, success, error, warning, background
- Dark mode preference stored in localStorage

### KPI Dashboard Charts
| KPI | Chart Type | Data Source |
|-----|-----------|-------------|
| Claim Volume (daily/weekly) | Bar chart | claims count by date |
| Denial Rate (%) | Line chart | denied / total claims |
| Top Denial Reasons | Horizontal bar | denial_reasons grouped by code |
| Financial Impact | Stacked bar | charges vs payments vs adjustments |
| Payer Breakdown | Pie/Donut | claims grouped by payer |
| Aging Analysis | Scatter/Table | days from submission to resolution |
| Resubmission Tracking | Small multiples | claims with multiple remittances |

## 6. User Authentication

- **Registration:** POST /api/auth/register — username, email, password → bcrypt hash → store → return JWT
- **Login:** POST /api/auth/login — username/password → verify hash → return JWT (24h expiry)
- **Middleware:** JWT verification on all `/api/claims`, `/api/dashboard`, `/api/upload` routes
- **Roles:** `staff` (view own data), `admin` (view all, manage users)
- **Seed user:** admin/admin123 created on first migration

## 7. API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/register | No | Create user |
| POST | /api/auth/login | No | Login, returns JWT |
| GET | /api/auth/me | Yes | Current user info |
| GET | /api/claims | Yes | List claims (paginated, filterable) |
| GET | /api/claims/:id | Yes | Single claim with line items |
| GET | /api/claims/:id/denials | Yes | Denial reasons for a claim |
| POST | /api/upload | Yes | Upload file (837/835) |
| GET | /api/upload/files | Yes | List uploaded files with status |
| GET | /api/dashboard/summary | Yes | Aggregate KPI data |
| GET | /api/dashboard/denial-reasons | Yes | Top denial reasons |
| GET | /api/dashboard/trends | Yes | Time-series data |
| GET | /api/admin/users | Admin | List users |
| POST | /api/admin/users | Admin | Create user |

## 8. Notification & Logging

### Notifications (Frontend)
- In-app toast notifications via React context
- Triggers: file parsed, denials detected, errors occurred
- Stored in-memory per session
- Toast types: success (green), error (red), warning (amber), info (blue)

### Logging (Backend)
- Winston logger with 3 transports: console, file-error.log, file-combined.log
- Daily rotate for log files (30-day retention)
- Log levels: error, warn, info, debug
- Request logging via morgan middleware

## 9. Testing Strategy

| Layer | Tool | Scope |
|-------|------|-------|
| EDI Parser (unit) | Jest | Segment extraction, edge cases, malformed input |
| Auth (unit) | Jest | Registration, login, password hashing, token validation |
| API (integration) | Supertest + Jest | All endpoints with test database |
| Dashboard queries | Jest + seed data | KPI calculations with known data |
| Frontend components | Vitest + RTL | Component rendering, user interactions |
| Auth flow (frontend) | Vitest + RTL | Login form, protected routes, logout |

## 10. Docker Configuration

### Backend Dockerfile
- Multi-stage: `node:20-alpine` build → production image
- Exposes port 3001
- Health check: `curl http://localhost:3001/api/health`

### Frontend Dockerfile
- Multi-stage: `node:20-alpine` build → `nginx:alpine` serve
- Nginx config for SPA routing (all routes → index.html)
- API proxy to backend

### docker-compose.yml
```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports: ["5441:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    env: POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD

  backend:
    build: ./backend
    ports: ["3001:3001"]
    volumes: [./data:/data, ./logs:/app/logs]
    depends_on: [postgres]
    env: DATABASE_URL

  frontend:
    build: ./frontend
    ports: ["5173:80"]
    depends_on: [backend]
```

## 11. File Processing Flow

```
User uploads file (or file appears in ./data/{type}/)
  → multer or chokidar detects file
  → status: parsing
  → EDI parser extracts data
  → Insert into claims/remittances tables
  → Run analysis: match 835 to 837, update claim statuses
  → status: parsed (or error)
  → Notification sent to dashboard
```

## 12. Error Handling

- Backend global error middleware catches all errors
- Structured JSON error response: `{ error: string, details?: any }`
- Parser errors include line number and segment info
- Database constraint violations return 400 with descriptive message
- Unauthorized returns 401, Forbidden returns 403
- All errors logged to winston

## 13. Security Considerations

- Passwords hashed with bcrypt (12 rounds)
- JWT tokens with 24h expiry
- API rate limiting on auth routes
- CORS configured for frontend origin
- File upload size limit (10MB)
- SQL injection prevention via Sequelize parameterized queries

---

*End of design document.*
