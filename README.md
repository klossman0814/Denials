# Insurance Denials Management System

A full-stack web application for parsing EDI 837/835 healthcare files, managing claims and denials, and visualizing denial analytics.

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌───────────┐
│  React SPA   │────▶│  Express API │────▶│ PostgreSQL│
│  (Vite/5173) │     │  (:3000)     │     │  (:5441)  │
└──────────────┘     └──────┬───────┘     └───────────┘
                            │
                     ┌──────┴───────┐
                     │  EDI Parser  │
                     │  (837 / 835) │
                     └──────────────┘
```

### Components

| Layer | Tech | Details |
|-------|------|---------|
| **Frontend** | React 18 + Vite | Dashboard, claims list, detail view, file upload, admin panel |
| **Backend** | Express.js | RESTful API, JWT auth, file watcher, EDI parsing |
| **Database** | PostgreSQL 15 | Sequelize ORM, 6 models (User, UploadedFile, Claim, ClaimLine, Remittance, DenialReason) |
| **Container** | Docker Compose | 3 services: db, backend, frontend |

## Prerequisites

- Node.js 18+
- PostgreSQL 15 (or Docker)
- npm

## Quick Start (Docker)

```bash
docker compose up -d
```

The app will be available at `http://localhost` (ports: frontend=5173, backend=3000, db=5441).

## Manual Setup

### 1. Database

```bash
createdb -p 5441 -U denials_user denials_db
```

### 2. Backend

```bash
cd backend
cp .env.example .env   # edit credentials as needed
npm install
node src/server.js     # starts on :3000
```

### 3. Frontend

```bash
cd frontend
npm install
npx vite               # starts on :5173
```

### 4. Seed Admin User

The backend auto-seeds a default admin on first run:

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin123` |
| Role | `admin` |

## EDI File Processing

### Supported Formats

- **EDI 837** — Healthcare claims (professional/institutional)
- **EDI 835** — Healthcare payment/remittance advice

### Upload Methods

1. **Web UI** — Drag-and-drop upload via the Upload page
2. **Directory Watcher** — Files placed in `./data/837/` and `./data/835/` are auto-processed
3. **API** — `POST /api/upload/837` and `POST /api/upload/835`

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Current user info |

### Claims
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/claims` | List claims (paginated, filterable) |
| GET | `/api/claims/:id` | Claim details + lines |
| GET | `/api/claims/:id/denials` | Denial reasons for claim |

### Dashboard
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard/summary` | Aggregated KPI metrics |
| GET | `/api/dashboard/denial-reasons` | Top denial reasons |
| GET | `/api/dashboard/trends` | Claim/denial trends over time |
| GET | `/api/dashboard/payer-breakdown` | Claims grouped by payer |
| GET | `/api/dashboard/aging` | Claims by aging bucket |

### Upload
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload/837` | Upload EDI 837 file |
| POST | `/api/upload/835` | Upload EDI 835 file |
| GET | `/api/upload/files` | List uploaded files |

### Admin
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/users` | List all users |
| PUT | `/api/admin/users/:id/role` | Update user role |

## Dashboard KPIs

1. **Claim Volume** — Total claims processed over time
2. **Denial Rate** — Percentage of claims denied
3. **Top Denial Reasons** — Ranked by frequency
4. **Financial Impact** — Total charges vs payments vs adjustments
5. **Payer Breakdown** — Claims distribution by insurance payer
6. **Aging Analysis** — How long claims have been open
7. **Resubmission Tracking** — Claims that were resubmitted after denial

## Tests

```bash
cd backend
npm test
```

Tests cover: EDI 837 parser, EDI 835 parser, auth, upload, claims, and dashboard endpoints.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Backend port |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5441` | PostgreSQL port |
| `DB_NAME` | `denials_db` | Database name |
| `DB_USER` | `denials_user` | Database user |
| `DB_PASS` | `denials_pass` | Database password |
| `JWT_SECRET` | `change-me` | JWT signing secret |
| `UPLOAD_DIR` | `./uploads` | Upload storage path |
| `DATA_DIR_837` | `./data/837` | Watched 837 directory |
| `DATA_DIR_835` | `./data/835` | Watched 835 directory |

## License

MIT
