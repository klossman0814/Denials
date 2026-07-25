# Project Context

## Environment
- Language: JavaScript (Node.js 18) + React 18
- Runtime: Node.js (Express backend), Vite (React frontend)
- Build: `npm run build` (frontend), `npx vite build` 
- Test: `npm test` (backend, mocha+chai), 12 parser tests pass
- Package Manager: npm

## Project Type
- Application: Full-stack Insurance Denials Management System
- Architecture: Monolithic Express API + React SPA
- Database: PostgreSQL 15 (port 5442)
- Container: Docker Compose (3 services: db, backend, frontend)

## Structure
- Backend: `backend/src/` — Express API (34 files)
  - Models: 6 Sequelize models (User, UploadedFile, Claim, ClaimLine, Remittance, DenialReason)
  - Routes: auth, claims, denials, dashboard, upload, admin
  - Parsers: EDI 837 (claims) and EDI 835 (payments)
  - Tests: 16 tests (12 parser + 4 integration requiring PG)
- Frontend: `frontend/src/` — React SPA (34 files)
  - Pages: Login, Dashboard, Claims, ClaimDetail, Denials, Upload, Admin
  - Charts: ClaimVolume, DenialRate, TopDenialReasons, FinancialImpact, PayerBreakdown
  - Layout: AppLayout with Sidebar + Navbar
  - Auth: JWT-based with role support (staff/admin)
- Infrastructure: Dockerfile, docker-compose.yml, nginx.conf
- Drop locations: `./incoming/837`, `./incoming/835`, `./incoming/837_processed`, `./incoming/835_processed`

## Key Features
- EDI 837/835 file parsing via upload UI or directory watcher
- Dashboard with 7 KPIs (volume, denial rate, top reasons, financial impact, payer breakdown, aging, resubmission)
- **Standalone Denials page** — bird's-eye view of all denials with summary stats, filtering (code/payer/status/search), 10-column table, row click → claim detail
- JWT authentication with bcrypt
- Dark/light theme toggle
- Admin panel for user management

## Notes
- Integration tests require PostgreSQL (run via Docker Compose)
- Default admin: admin/admin123
- Database port: 5442 (non-standard)
- EDI parsers use state-machine approach, tested with 12 unit tests
