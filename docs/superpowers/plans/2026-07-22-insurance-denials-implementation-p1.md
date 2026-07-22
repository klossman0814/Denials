# Insurance Denials System — Implementation Plan (Part 1: Backend)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete React + Express application that ingests EDI 837/835 files, parses them, stores claims and denial data in PostgreSQL, and displays it on a dashboard.

**Architecture:** Monolithic Express API + React (Vite) frontend, Docker containers with PostgreSQL. File watcher monitors directories for auto-ingestion. JWT auth with staff/admin roles.

**Tech Stack:** Vite 5, React 18, Express 4, Sequelize 6, PostgreSQL 16, Recharts, JWT, bcrypt, chokidar, winston, Docker Compose

## Global Constraints

- PostgreSQL port: 5441
- Files monitored from `./data/837/` and `./data/835/`
- Ports: frontend=5173, backend=3001, postgres=5441
- JWT expiry: 24 hours
- bcrypt rounds: 12
- File upload limit: 10MB
- Node.js: 20 LTS
- All timestamps use TIMESTAMPTZ / ISO 8601

---

### Task 1: Backend Project Scaffolding

**Files:**
- Create: `backend/package.json`
- Create: `backend/src/config/database.js`
- Create: `backend/src/config/env.js`
- Create: `backend/src/middleware/error.middleware.js`
- Create: `backend/src/utils/logger.js`
- Create: `backend/src/app.js`
- Create: `backend/src/server.js`
- Create: `backend/.env.example`

**Interfaces:**
- Produces: Express app instance, database connection config, server entry point

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "insurance-denials-backend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "nodemon src/server.js",
    "start": "node src/server.js",
    "migrate": "npx sequelize-cli db:migrate",
    "seed": "npx sequelize-cli db:seed:all",
    "test": "jest --forceExit --detectOpenHandles",
    "test:watch": "jest --watch --forceExit"
  },
  "dependencies": {
    "express": "^4.18.2",
    "sequelize": "^6.37.1",
    "pg": "^8.12.0",
    "pg-hstore": "^2.3.4",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "chokidar": "^3.6.0",
    "multer": "^1.4.5-lts.1",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0",
    "winston": "^3.13.0",
    "winston-daily-rotate-file": "^5.0.0",
    "express-rate-limit": "^7.2.0",
    "uuid": "^9.0.1",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^6.3.4",
    "nodemon": "^3.1.0",
    "sequelize-cli": "^6.6.2"
  }
}
```

- [ ] **Step 2: Create `backend/.env.example`**

```env
NODE_ENV=development
PORT=3001

DB_HOST=localhost
DB_PORT=5441
DB_NAME=insurance_denials
DB_USER=denials_user
DB_PASSWORD=denials_pass

JWT_SECRET=change_this_to_a_random_secret_in_production
JWT_EXPIRES_IN=24h

UPLOAD_DIR_837=./data/837
UPLOAD_DIR_835=./data/835
MAX_FILE_SIZE=10485760

CORS_ORIGIN=http://localhost:5173
```

- [ ] **Step 3: Create `backend/src/config/env.js`**

```javascript
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3001,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5441,
    name: process.env.DB_NAME || 'insurance_denials',
    user: process.env.DB_USER || 'denials_user',
    password: process.env.DB_PASSWORD || 'denials_pass',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  upload: {
    dir837: process.env.UPLOAD_DIR_837 || './data/837',
    dir835: process.env.UPLOAD_DIR_835 || './data/835',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10485760,
  },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};
```

- [ ] **Step 4: Create `backend/src/config/database.js`**

```javascript
const { Sequelize } = require('sequelize');
const config = require('./env');

const sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
  host: config.db.host,
  port: config.db.port,
  dialect: 'postgres',
  logging: false,
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
});

module.exports = sequelize;
```

- [ ] **Step 5: Create `backend/src/utils/logger.js`**

```javascript
const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

const logDir = path.resolve(__dirname, '../../logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD', level: 'error', maxFiles: '30d',
    }),
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD', maxFiles: '30d',
    }),
  ],
});

module.exports = logger;
```

- [ ] **Step 6: Create `backend/src/middleware/error.middleware.js`**

```javascript
const logger = require('../utils/logger');

const errorMiddleware = (err, req, res, next) => {
  logger.error(`${req.method} ${req.path}: ${err.message}`, { stack: err.stack });

  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({ error: 'Validation error', details: err.errors.map((e) => e.message) });
  }
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ error: 'Resource already exists' });
  }
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
};

module.exports = errorMiddleware;
```

- [ ] **Step 7: Create `backend/src/app.js`**

```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const config = require('./config/env');
const errorMiddleware = require('./middleware/error.middleware');

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many requests, please try again later.' },
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes will be mounted in later tasks
const authRoutes = require('./routes/auth.routes');
app.use('/api/auth', authLimiter, authRoutes);

app.use(errorMiddleware);

module.exports = app;
```

- [ ] **Step 8: Create `backend/src/server.js`**

```javascript
const app = require('./app');
const config = require('./config/env');
const logger = require('./utils/logger');
const { sequelize } = require('./models');

const start = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established');
    await sequelize.sync({ alter: config.nodeEnv === 'development' });
    logger.info('Database models synchronized');

    if (config.nodeEnv !== 'test') {
      const { startWatcher } = require('./watcher/fileWatcher');
      startWatcher();
    }

    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();
```

- [ ] **Step 9: Run `cd backend && npm install`**
Expected: node_modules created, no errors

---

### Task 2: Database Models

**Files:**
- Create: `backend/src/models/User.js`
- Create: `backend/src/models/UploadedFile.js`
- Create: `backend/src/models/Claim.js`
- Create: `backend/src/models/ClaimLine.js`
- Create: `backend/src/models/Remittance.js`
- Create: `backend/src/models/DenialReason.js`
- Create: `backend/src/models/index.js`
- Create: `backend/src/seeders/20260722-admin-user.js`

**Interfaces:** All model exports, admin seed user

- [ ] **Step 1: Create `backend/src/models/User.js`**

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcrypt');

const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  username: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  email: { type: DataTypes.STRING(255), allowNull: false, unique: true, validate: { isEmail: true } },
  password_hash: { type: DataTypes.STRING(255), allowNull: false },
  role: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'staff', validate: { isIn: [['staff', 'admin']] } },
}, {
  tableName: 'users', timestamps: true, underscored: true,
  hooks: { beforeCreate: async (user) => { user.password_hash = await bcrypt.hash(user.password_hash, 12); } },
});

User.prototype.validatePassword = async function (password) {
  return bcrypt.compare(password, this.password_hash);
};

User.prototype.toSafeJSON = function () {
  const values = this.toJSON();
  delete values.password_hash;
  return values;
};

User.associate = (models) => {
  User.hasMany(models.UploadedFile, { foreignKey: 'uploaded_by' });
};

module.exports = User;
```

- [ ] **Step 2: Create `backend/src/models/UploadedFile.js`**

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UploadedFile = sequelize.define('UploadedFile', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  filename: { type: DataTypes.STRING(255), allowNull: false },
  file_type: { type: DataTypes.STRING(3), allowNull: false, validate: { isIn: [['837', '835']] } },
  file_path: { type: DataTypes.TEXT, allowNull: false },
  file_size: { type: DataTypes.BIGINT },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pending', validate: { isIn: [['pending', 'parsing', 'parsed', 'error']] } },
  error_message: { type: DataTypes.TEXT },
  uploaded_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  parsed_at: { type: DataTypes.DATE },
}, { tableName: 'uploaded_files', timestamps: false, underscored: true });

UploadedFile.associate = (models) => {
  UploadedFile.belongsTo(models.User, { foreignKey: 'uploaded_by' });
  UploadedFile.hasMany(models.Claim, { foreignKey: 'file_id' });
  UploadedFile.hasMany(models.Remittance, { foreignKey: 'file_id' });
};

module.exports = UploadedFile;
```

- [ ] **Step 3: Create `backend/src/models/Claim.js`**

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Claim = sequelize.define('Claim', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  claim_id: { type: DataTypes.STRING(50) },
  patient_last_name: { type: DataTypes.STRING(100) },
  patient_first_name: { type: DataTypes.STRING(100) },
  patient_dob: { type: DataTypes.DATEONLY },
  patient_gender: { type: DataTypes.STRING(10) },
  subscriber_id: { type: DataTypes.STRING(100) },
  payer_name: { type: DataTypes.STRING(200) },
  provider_name: { type: DataTypes.STRING(200) },
  provider_npi: { type: DataTypes.STRING(20) },
  total_charge: { type: DataTypes.DECIMAL(10, 2) },
  service_date_start: { type: DataTypes.DATEONLY },
  service_date_end: { type: DataTypes.DATEONLY },
  status: { type: DataTypes.STRING(20), defaultValue: 'submitted', validate: { isIn: [['submitted', 'paid', 'denied', 'partial']] } },
}, { tableName: 'claims', timestamps: true, underscored: true });

Claim.associate = (models) => {
  Claim.belongsTo(models.UploadedFile, { foreignKey: 'file_id' });
  Claim.hasMany(models.ClaimLine, { foreignKey: 'claim_id' });
  Claim.hasMany(models.Remittance, { foreignKey: 'claim_id' });
  Claim.hasMany(models.DenialReason, { foreignKey: 'claim_id' });
};

module.exports = Claim;
```

- [ ] **Step 4: Create `backend/src/models/ClaimLine.js`**

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ClaimLine = sequelize.define('ClaimLine', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  line_number: { type: DataTypes.INTEGER },
  procedure_code: { type: DataTypes.STRING(20) },
  diagnosis_code: { type: DataTypes.STRING(20) },
  charge_amount: { type: DataTypes.DECIMAL(10, 2) },
  service_date: { type: DataTypes.DATEONLY },
}, { tableName: 'claim_lines', timestamps: false, underscored: true });

ClaimLine.associate = (models) => {
  ClaimLine.belongsTo(models.Claim, { foreignKey: 'claim_id' });
};

module.exports = ClaimLine;
```

- [ ] **Step 5: Create `backend/src/models/Remittance.js`**

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Remittance = sequelize.define('Remittance', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  patient_name: { type: DataTypes.STRING(200) },
  payer_claim_id: { type: DataTypes.STRING(100) },
  total_charge: { type: DataTypes.DECIMAL(10, 2) },
  total_paid: { type: DataTypes.DECIMAL(10, 2) },
  adjustment_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  remittance_date: { type: DataTypes.DATEONLY },
  status: { type: DataTypes.STRING(20), defaultValue: 'pending', validate: { isIn: [['pending', 'paid', 'denied', 'partial']] } },
}, { tableName: 'remittances', timestamps: true, underscored: true });

Remittance.associate = (models) => {
  Remittance.belongsTo(models.UploadedFile, { foreignKey: 'file_id' });
  Remittance.belongsTo(models.Claim, { foreignKey: 'claim_id' });
  Remittance.hasMany(models.DenialReason, { foreignKey: 'remittance_id' });
};

module.exports = Remittance;
```

- [ ] **Step 6: Create `backend/src/models/DenialReason.js`**

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DenialReason = sequelize.define('DenialReason', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  denial_code: { type: DataTypes.STRING(10), allowNull: false },
  group_code: { type: DataTypes.STRING(5) },
  amount: { type: DataTypes.DECIMAL(10, 2) },
  reason_description: { type: DataTypes.TEXT },
}, { tableName: 'denial_reasons', timestamps: true, underscored: true });

DenialReason.associate = (models) => {
  DenialReason.belongsTo(models.Remittance, { foreignKey: 'remittance_id' });
  DenialReason.belongsTo(models.Claim, { foreignKey: 'claim_id' });
  DenialReason.belongsTo(models.ClaimLine, { foreignKey: 'claim_line_id' });
};

module.exports = DenialReason;
```

- [ ] **Step 7: Create `backend/src/models/index.js`**

```javascript
const sequelize = require('../config/database');
const User = require('./User');
const UploadedFile = require('./UploadedFile');
const Claim = require('./Claim');
const ClaimLine = require('./ClaimLine');
const Remittance = require('./Remittance');
const DenialReason = require('./DenialReason');

User.associate?.({ UploadedFile });
UploadedFile.associate?.({ User, Claim, Remittance });
Claim.associate?.({ UploadedFile, ClaimLine, Remittance, DenialReason });
ClaimLine.associate?.({ Claim });
Remittance.associate?.({ UploadedFile, Claim, DenialReason });
DenialReason.associate?.({ Remittance, Claim, ClaimLine });

module.exports = { sequelize, User, UploadedFile, Claim, ClaimLine, Remittance, DenialReason };
```

- [ ] **Step 8: Create `backend/src/seeders/20260722-admin-user.js`**

```javascript
const bcrypt = require('bcrypt');

module.exports = {
  up: async (queryInterface) => {
    const hash = await bcrypt.hash('admin123', 12);
    await queryInterface.bulkInsert('users', [{
      id: '00000000-0000-0000-0000-000000000001',
      username: 'admin',
      email: 'admin@denials.local',
      password_hash: hash,
      role: 'admin',
      created_at: new Date(),
      updated_at: new Date(),
    }]);
  },
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('users', { username: 'admin' });
  },
};
```

---

### Task 3: Authentication System

**Files:**
- Create: `backend/src/middleware/auth.middleware.js`
- Create: `backend/src/services/auth.service.js`
- Create: `backend/src/controllers/auth.controller.js`
- Create: `backend/src/routes/auth.routes.js`
- Create: `backend/tests/auth.test.js`

**Interfaces:** `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `authenticate` and `requireAdmin` middleware

- [ ] **Step 1: Create `backend/src/middleware/auth.middleware.js`**

```javascript
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { User } = require('../models');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await User.findByPk(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

module.exports = { authenticate, requireAdmin };
```

- [ ] **Step 2: Create `backend/src/services/auth.service.js`**

```javascript
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { User } = require('../models');
const config = require('../config/env');

class AuthService {
  async register({ username, email, password, role = 'staff' }) {
    const existing = await User.findOne({ where: { [Op.or]: [{ username }, { email }] } });
    if (existing) {
      const field = existing.username === username ? 'username' : 'email';
      throw Object.assign(new Error(`${field} already exists`), { status: 409 });
    }
    const user = await User.create({ username, email, password_hash: password, role });
    const token = this.generateToken(user);
    return { user: user.toSafeJSON(), token };
  }

  async login({ username, password }) {
    const user = await User.findOne({ where: { username } });
    if (!user) throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    const valid = await user.validatePassword(password);
    if (!valid) throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    const token = this.generateToken(user);
    return { user: user.toSafeJSON(), token };
  }

  generateToken(user) {
    return jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
  }
}

module.exports = new AuthService();
```

- [ ] **Step 3: Create `backend/src/controllers/auth.controller.js`**

```javascript
const authService = require('../services/auth.service');

exports.register = async (req, res, next) => {
  try { res.status(201).json(await authService.register(req.body)); }
  catch (error) { next(error); }
};

exports.login = async (req, res, next) => {
  try { res.json(await authService.login(req.body)); }
  catch (error) { next(error); }
};

exports.me = async (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
};
```

- [ ] **Step 4: Create `backend/src/routes/auth.routes.js`**

```javascript
const { Router } = require('express');
const controller = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = Router();
router.post('/register', controller.register);
router.post('/login', controller.login);
router.get('/me', authenticate, controller.me);

module.exports = router;
```

- [ ] **Step 5: Create `backend/tests/auth.test.js`**

```javascript
const request = require('supertest');
const app = require('../src/app');
const { User } = require('../src/models');

describe('Auth API', () => {
  beforeEach(async () => { await User.destroy({ where: {} }); });

  describe('POST /api/auth/register', () => {
    it('should register a new user and return token', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', email: 'test@test.com', password: 'test123' });
      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.password_hash).toBeUndefined();
    });

    it('should reject duplicate username', async () => {
      await request(app).post('/api/auth/register').send({ username: 'dup', email: 'a@a.com', password: 'test123' });
      const res = await request(app).post('/api/auth/register').send({ username: 'dup', email: 'b@b.com', password: 'test123' });
      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login and return token', async () => {
      await request(app).post('/api/auth/register').send({ username: 'user1', email: 'u@u.com', password: 'mypass' });
      const res = await request(app).post('/api/auth/login').send({ username: 'user1', password: 'mypass' });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });

    it('should reject wrong password', async () => {
      await request(app).post('/api/auth/register').send({ username: 'user2', email: 'u2@u.com', password: 'mypass' });
      const res = await request(app).post('/api/auth/login').send({ username: 'user2', password: 'wrong' });
      expect(res.status).toBe(401);
    });
  });
});
```

- [ ] **Step 6: Run `cd backend && npx jest tests/auth.test.js --forceExit`**
Expected: All tests pass

---

### Task 4: EDI Parsers (837 + 835)

**Files:**
- Create: `backend/src/parsers/edi.utils.js`
- Create: `backend/src/parsers/edi837.parser.js`
- Create: `backend/src/parsers/edi835.parser.js`
- Create: `backend/tests/fixtures/sample.837.js`
- Create: `backend/tests/fixtures/sample.835.js`
- Create: `backend/tests/edi837.parser.test.js`
- Create: `backend/tests/edi835.parser.test.js`

**Interfaces:** `parse837(content)` → `{ claims: [...], metadata: {...} }`, `parse835(content)` → `{ remittances: [...], metadata: {...} }`

- [ ] **Step 1: Create `backend/src/parsers/edi.utils.js`**

```javascript
function splitSegments(content) {
  const normalized = content.replace(/\r?\n/g, '~\n');
  return normalized.split('~').map(s => s.replace(/\r?\n/g, '').trim()).filter(s => s.length > 0);
}

function parseSegment(segment) { return segment.split('*'); }

function getSubElements(element) { return element.split(':'); }

function parseEDIDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return null;
  return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
}

function parseEDIAmount(amountStr) {
  if (!amountStr) return 0;
  const clean = amountStr.replace(/[^0-9]/g, '');
  if (clean.length <= 2) return parseFloat(clean) / 100;
  return parseFloat(clean.substring(0, clean.length - 2) + '.' + clean.substring(clean.length - 2));
}

module.exports = { splitSegments, parseSegment, getSubElements, parseEDIDate, parseEDIAmount };
```

- [ ] **Step 2: Create `backend/tests/fixtures/sample.837.js`**

```javascript
const SAMPLE_837 = `ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *220701*1253*^*00501*000000001*0*P*:~
GS*HC*SENDER*RECEIVER*20220701*1253*1*X*005010X222A1~
ST*837*0001~
BHT*0019*00*12345*20220701*1253*CH~
NM1*41*2*SENDING CLINIC*****46*123456789~
PER*IC*JOHN SMITH*TE*5551234567~
NM1*40*2*RECEIVING PAYER*****46*987654321~
HL*1**20*1~
NM1*85*2*BILLING PROVIDER*****XX*1234567893~
N3*123 MAIN ST~
N4*ANYTOWN*CA*90210~
REF*EI*123456789~
HL*2*1*22*0~
SBR*P*18*******CI~
NM1*IL*1*DOE*JOHN****MI*ABC123456~
DMG*D8*19800115*M~
HL*3*2*23*0~
PAT*19~
NM1*QC*1*DOE*JOHN~
DMG*D8*19800115*M~
CLM*CLM001*250**17:B:1*Y*A*Y*I*Y~
DTP*434*D8*20220701~
REF*D9*111222333~
HI*BK:I10~
NM1*82*1*SMITH*JANE****XX*9876543212~
LX*1~
SV1*HC:99213*150*UN*1*11**1:2:3**N~
DTP*472*D8*20220701~
LX*2~
SV1*HC:99214*100*UN*1*11**1:2:3**N~
DTP*472*D8*20220701~
SE*30*0001~
GE*1*1~
IEA*1*000000001~`;

module.exports = SAMPLE_837;
```

- [ ] **Step 3: Create `backend/tests/fixtures/sample.835.js`**

```javascript
const SAMPLE_835 = `ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *220715*0953*^*00501*000000002*0*P*:~
GS*HP*SENDER*RECEIVER*20220715*0953*1*X*005010X221A1~
ST*835*0002~
BPR*I*200*C*CHK*********20220715~
TRN*1*PAYREF001*SENDER~
DTM*405*20220715~
N1*PR*PAYER NAME~
N3*456 OAK ST~
N4*METROPOLIS*NY*10001~
N1*PE*PROVIDER NAME~
CLP*CLM001*1*250*200*50*CO-45*CLM001*11~
NM1*QC*1*DOE*JOHN~
CAS*CO*45*50*50~
SVC*HC:99213*150*120~
CAS*CO*45*30*30~
DTM*472*20220701~
SVC*HC:99214*100*80~
CAS*PR*3*20*20~
DTM*472*20220701~
SE*19*0002~
GE*1*1~
IEA*1*000000002~`;

module.exports = SAMPLE_835;
```

- [ ] **Step 4: Create `backend/src/parsers/edi837.parser.js`**

```javascript
const { splitSegments, parseSegment, getSubElements, parseEDIDate, parseEDIAmount } = require('./edi.utils');

function parse837(content) {
  const segments = splitSegments(content);
  const metadata = { sender_id: '', receiver_id: '', date: '', time: '', control_number: '' };
  const claims = [];
  let currentClaim = null;
  let currentLine = null;
  let inClaim = false;
  let patientInfo = {};
  let subscriberInfo = {};

  for (let i = 0; i < segments.length; i++) {
    const elements = parseSegment(segments[i]);
    const segId = elements[0];

    switch (segId) {
      case 'ISA':
        metadata.sender_id = elements[6]?.trim();
        metadata.receiver_id = elements[8]?.trim();
        metadata.date = elements[9]?.trim();
        metadata.time = elements[10]?.trim();
        metadata.control_number = elements[13]?.trim();
        break;
      case 'NM1': {
        const qual = elements[1];
        const last = elements[3] || '';
        const first = elements[4] || '';
        const npi = elements[9] || '';
        if (qual === 'QC' || qual === 'IL') {
          subscriberInfo = { ...subscriberInfo, last_name: last, first_name: first };
          if (qual === 'QC') patientInfo = { last_name: last, first_name: first };
        } else if (qual === '82' && currentClaim) currentClaim.provider_npi = npi;
        else if (qual === '85' && currentClaim) {
          currentClaim.provider_name = `${first} ${last}`.trim();
          currentClaim.provider_npi = currentClaim.provider_npi || npi;
        } else if (qual === 'PR' && currentClaim) currentClaim.payer_name = `${first} ${last}`.trim();
        break;
      }
      case 'CLM':
        currentClaim = {
          claim_id: elements[1] || '', total_charge: parseEDIAmount(elements[2]),
          patient_first_name: '', patient_last_name: '', patient_dob: null, patient_gender: '',
          subscriber_id: '', payer_name: '', provider_name: '', provider_npi: '',
          service_date_start: null, service_date_end: null, status: 'submitted', lines: [],
        };
        inClaim = true;
        claims.push(currentClaim);
        break;
      case 'DMG':
        if (inClaim && currentClaim) {
          currentClaim.patient_dob = parseEDIDate(elements[2]);
          currentClaim.patient_gender = elements[3] || '';
        }
        break;
      case 'DTP': {
        if (inClaim && currentClaim && elements[3]) {
          const date = parseEDIDate(elements[3]);
          if (elements[1] === '434' || elements[1] === '435' || segments[i].includes('*434*')) {
            if (!currentClaim.service_date_start) currentClaim.service_date_start = date;
            currentClaim.service_date_end = date;
          }
        }
        break;
      }
      case 'REF':
        if ((elements[1] === '1L' || elements[1] === 'D9') && currentClaim) {
          subscriberInfo.subscriber_id = elements[2] || '';
          currentClaim.subscriber_id = subscriberInfo.subscriber_id;
        }
        break;
      case 'LX':
        if (inClaim && currentClaim) {
          currentLine = { line_number: parseInt(elements[1], 10) || 0, procedure_code: '', diagnosis_code: '', charge_amount: 0, service_date: null };
          currentClaim.lines.push(currentLine);
        }
        break;
      case 'SV1':
        if (currentLine && inClaim) {
          const procSub = getSubElements(elements[1]);
          currentLine.procedure_code = procSub.length > 1 ? procSub[1] : '';
          currentLine.charge_amount = parseEDIAmount(elements[2]);
        } else if (inClaim && currentClaim && !currentLine) {
          currentLine = { line_number: 1, procedure_code: '', diagnosis_code: '', charge_amount: 0, service_date: null };
          const procSub = getSubElements(elements[1]);
          currentLine.procedure_code = procSub.length > 1 ? procSub[1] : '';
          currentLine.charge_amount = parseEDIAmount(elements[2]);
          currentClaim.lines.push(currentLine);
        }
        break;
      case 'SE':
        if (currentClaim) {
          currentClaim.patient_first_name = patientInfo.first_name || subscriberInfo.first_name || '';
          currentClaim.patient_last_name = patientInfo.last_name || subscriberInfo.last_name || '';
          currentClaim.subscriber_id = subscriberInfo.subscriber_id || '';
        }
        break;
    }
  }

  return { claims, metadata };
}

module.exports = { parse837 };
```

- [ ] **Step 5: Create `backend/src/parsers/edi835.parser.js`**

```javascript
const { splitSegments, parseSegment, getSubElements, parseEDIDate, parseEDIAmount } = require('./edi.utils');

function parse835(content) {
  const segments = splitSegments(content);
  const metadata = { sender_id: '', receiver_id: '', date: '', control_number: '', total_payment: 0 };
  const remittances = [];
  let currentRemittance = null;

  for (let i = 0; i < segments.length; i++) {
    const elements = parseSegment(segments[i]);
    const segId = elements[0];

    switch (segId) {
      case 'ISA':
        metadata.sender_id = elements[6]?.trim();
        metadata.receiver_id = elements[8]?.trim();
        metadata.date = elements[9]?.trim();
        metadata.control_number = elements[13]?.trim();
        break;
      case 'BPR':
        metadata.total_payment = parseEDIAmount(elements[2]);
        break;
      case 'CLP':
        currentRemittance = {
          patient_name: '',
          payer_claim_id: elements[7] || elements[1] || '',
          total_charge: parseEDIAmount(elements[3]),
          total_paid: parseEDIAmount(elements[4]),
          adjustment_amount: 0,
          remittance_date: '',
          status: parseFloat(elements[4]) >= parseFloat(elements[3]) ? 'paid' : (parseFloat(elements[4]) > 0 ? 'partial' : 'denied'),
          claim_reference: { clp_claim_id: elements[1] || '', clp_status: elements[2] || '' },
          denial_reasons: [],
        };
        if (elements[6] && elements[6].trim()) {
          const denialSub = getSubElements(elements[6]);
          if (denialSub.length >= 2) {
            currentRemittance.denial_reasons.push({ denial_code: `${denialSub[0]}-${denialSub[1]}`, group_code: denialSub[0], amount: 0, reason_description: '' });
          }
        }
        remittances.push(currentRemittance);
        break;
      case 'NM1':
        if (elements[1] === 'QC' && currentRemittance) {
          currentRemittance.patient_name = `${elements[4] || ''} ${elements[3] || ''}`.trim();
        }
        break;
      case 'CAS':
        if (!currentRemittance) break;
        const groupCode = elements[1] || '';
        for (let j = 2; j + 2 < elements.length; j += 3) {
          const code = elements[j];
          const amount = parseEDIAmount(elements[j + 1]);
          const denial = { denial_code: `${groupCode}-${code}`, group_code: groupCode, amount, reason_description: '' };
          currentRemittance.denial_reasons.push(denial);
          currentRemittance.adjustment_amount += amount;
        }
        break;
      case 'DTM':
        if (elements[1] === '405' && currentRemittance) {
          currentRemittance.remittance_date = parseEDIDate(elements[2]);
        }
        break;
    }
  }

  return { remittances, metadata };
}

module.exports = { parse835 };
```

- [ ] **Step 6: Create `backend/tests/edi837.parser.test.js`**

```javascript
const { parse837 } = require('../src/parsers/edi837.parser');
const SAMPLE_837 = require('./fixtures/sample.837');

describe('EDI 837 Parser', () => {
  it('should parse metadata from ISA header', () => {
    const result = parse837(SAMPLE_837);
    expect(result.metadata.sender_id).toBe('SENDER');
    expect(result.metadata.control_number).toBe('000000001');
  });

  it('should extract claims from CLM segments', () => {
    const result = parse837(SAMPLE_837);
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].claim_id).toBe('CLM001');
    expect(result.claims[0].total_charge).toBeCloseTo(250, 2);
  });

  it('should extract patient info', () => {
    const result = parse837(SAMPLE_837);
    expect(result.claims[0].patient_first_name).toBe('JOHN');
    expect(result.claims[0].patient_last_name).toBe('DOE');
    expect(result.claims[0].patient_dob).toBe('1980-01-15');
    expect(result.claims[0].patient_gender).toBe('M');
  });

  it('should extract subscriber ID', () => {
    expect(parse837(SAMPLE_837).claims[0].subscriber_id).toBe('ABC123456');
  });

  it('should extract service line items', () => {
    const claim = parse837(SAMPLE_837).claims[0];
    expect(claim.lines).toHaveLength(2);
    expect(claim.lines[0].procedure_code).toBe('99213');
    expect(claim.lines[0].charge_amount).toBeCloseTo(150, 2);
    expect(claim.lines[1].procedure_code).toBe('99214');
    expect(claim.lines[1].charge_amount).toBeCloseTo(100, 2);
  });

  it('should handle empty content', () => {
    expect(parse837('').claims).toHaveLength(0);
  });
});
```

- [ ] **Step 7: Create `backend/tests/edi835.parser.test.js`**

```javascript
const { parse835 } = require('../src/parsers/edi835.parser');
const SAMPLE_835 = require('./fixtures/sample.835');

describe('EDI 835 Parser', () => {
  it('should parse metadata from ISA header', () => {
    const result = parse835(SAMPLE_835);
    expect(result.metadata.sender_id).toBe('SENDER');
    expect(result.metadata.total_payment).toBeCloseTo(200, 2);
  });

  it('should extract remittances from CLP segments', () => {
    const result = parse835(SAMPLE_835);
    expect(result.remittances).toHaveLength(1);
    expect(result.remittances[0].total_charge).toBeCloseTo(250, 2);
    expect(result.remittances[0].total_paid).toBeCloseTo(200, 2);
  });

  it('should detect partial payment status', () => {
    expect(parse835(SAMPLE_835).remittances[0].status).toBe('partial');
  });

  it('should extract denial reasons from CAS segments', () => {
    const remit = parse835(SAMPLE_835).remittances[0];
    const co45 = remit.denial_reasons.find(r => r.denial_code === 'CO-45');
    expect(co45).toBeDefined();
    expect(co45.amount).toBeGreaterThan(0);
  });

  it('should extract patient name', () => {
    expect(parse835(SAMPLE_835).remittances[0].patient_name).toBe('JOHN DOE');
  });

  it('should handle empty content', () => {
    expect(parse835('').remittances).toHaveLength(0);
  });
});
```

- [ ] **Step 8: Run `cd backend && npx jest tests/edi837.parser.test.js tests/edi835.parser.test.js --forceExit`**
Expected: All tests pass

---

### Task 5: File Upload + Watcher Service

**Files:**
- Create: `backend/src/middleware/upload.middleware.js`
- Create: `backend/src/services/upload.service.js`
- Create: `backend/src/watcher/fileWatcher.js`
- Create: `backend/src/controllers/upload.controller.js`
- Create: `backend/src/routes/upload.routes.js`
- Create: `backend/tests/upload.test.js`
- Modify: `backend/src/app.js`

**Interfaces:** `POST /api/upload/:type`, `GET /api/upload/files`, auto-watch directories

- [ ] **Step 1: Create `backend/src/middleware/upload.middleware.js`**

```javascript
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config/env');

[config.upload.dir837, config.upload.dir835].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = req.params.type === '837' ? config.upload.dir837 : config.upload.dir835;
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const fileFilter = (req, file, cb) => {
  if (file.originalname.match(/\.(edi|837|835|txt)$/i) || file.mimetype === 'text/plain') {
    cb(null, true);
  } else {
    cb(new Error('Only .edi, .837, .835, .txt files allowed'), false);
  }
};

const upload = multer({ storage, limits: { fileSize: config.upload.maxFileSize }, fileFilter }).single('file');

module.exports = upload;
```

- [ ] **Step 2: Create `backend/src/services/upload.service.js`**

```javascript
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { UploadedFile, Claim, ClaimLine, Remittance, DenialReason } = require('../models');
const { parse837 } = require('../parsers/edi837.parser');
const { parse835 } = require('../parsers/edi835.parser');
const logger = require('../utils/logger');

class UploadService {
  async processFile(filePath, fileType, uploadedBy = null) {
    const filename = path.basename(filePath);
    const stats = fs.statSync(filePath);
    const fileRecord = await UploadedFile.create({
      filename, file_type: fileType, file_path: filePath,
      file_size: stats.size, status: 'parsing', uploaded_by: uploadedBy,
    });

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      let result;
      if (fileType === '837') result = await this._process837(content, fileRecord.id);
      else result = await this._process835(content, fileRecord.id);

      fileRecord.status = 'parsed';
      fileRecord.parsed_at = new Date();
      await fileRecord.save();
      logger.info(`File ${filename} processed: ${result.count} records`);
      return { file: fileRecord, recordsCreated: result.count };
    } catch (error) {
      fileRecord.status = 'error';
      fileRecord.error_message = error.message;
      await fileRecord.save();
      logger.error(`File ${filename} processing failed: ${error.message}`);
      throw error;
    }
  }

  async _process837(content, fileId) {
    const { claims } = parse837(content);
    let count = 0;
    for (const { lines, ...claimFields } of claims) {
      const claim = await Claim.create({ ...claimFields, file_id: fileId, status: 'submitted' });
      count++;
      for (const line of lines) {
        await ClaimLine.create({ ...line, claim_id: claim.id });
        count++;
      }
    }
    return { count };
  }

  async _process835(content, fileId) {
    const { remittances } = parse835(content);
    let count = 0;
    for (const { denial_reasons, claim_reference, ...remitFields } of remittances) {
      const match = await this._matchClaim(remitFields.patient_name, remitFields.payer_claim_id);
      const remittance = await Remittance.create({ ...remitFields, file_id: fileId, claim_id: match?.id || null });
      count++;
      if (match) {
        const newStatus = remitFields.status === 'paid' ? 'paid' : remitFields.status === 'partial' ? 'partial' : 'denied';
        await match.update({ status: newStatus });
      }
      for (const dr of denial_reasons) {
        await DenialReason.create({ ...dr, remittance_id: remittance.id, claim_id: match?.id || null });
        count++;
      }
    }
    return { count };
  }

  async _matchClaim(patientName, claimId) {
    if (!patientName && !claimId) return null;
    const conditions = [];
    if (claimId) conditions.push({ claim_id: claimId });
    if (patientName) {
      const parts = patientName.split(' ').filter(Boolean);
      if (parts.length >= 2) {
        conditions.push({ patient_first_name: parts[0], patient_last_name: parts.slice(1).join(' ') });
      }
    }
    if (conditions.length === 0) return null;
    return await Claim.findOne({ where: { [Op.or]: conditions } });
  }
}

module.exports = new UploadService();
```

- [ ] **Step 3: Create `backend/src/watcher/fileWatcher.js`**

```javascript
const chokidar = require('chokidar');
const path = require('path');
const config = require('../config/env');
const uploadService = require('../services/upload.service');
const logger = require('../utils/logger');

let watcher = null;

function startWatcher() {
  const dir837 = path.resolve(config.upload.dir837);
  const dir835 = path.resolve(config.upload.dir835);

  watcher = chokidar.watch([dir837, dir835], {
    ignored: /(^|[\\/])\\../,
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 500 },
  });

  watcher
    .on('add', async (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      const dir = path.dirname(filePath);
      let fileType = null;
      if (dir === path.resolve(config.upload.dir837) && (ext === '.837' || ext === '.edi' || ext === '.txt')) fileType = '837';
      else if (dir === path.resolve(config.upload.dir835) && (ext === '.835' || ext === '.edi' || ext === '.txt')) fileType = '835';

      if (fileType) {
        logger.info(`File detected: ${filePath} (type: ${fileType})`);
        try { await uploadService.processFile(filePath, fileType); }
        catch (error) { logger.error(`Auto-processing failed for ${filePath}: ${error.message}`); }
      }
    })
    .on('error', (error) => logger.error(`File watcher error: ${error.message}`));

  logger.info(`File watcher started: watching ${dir837} and ${dir835}`);
  return watcher;
}

function stopWatcher() {
  if (watcher) { watcher.close(); watcher = null; logger.info('File watcher stopped'); }
}

module.exports = { startWatcher, stopWatcher };
```

- [ ] **Step 4: Create `backend/src/controllers/upload.controller.js`**

```javascript
const uploadService = require('../services/upload.service');
const { UploadedFile } = require('../models');

exports.uploadFile = async (req, res, next) => {
  try {
    const fileType = req.params.type;
    if (!['837', '835'].includes(fileType)) return res.status(400).json({ error: 'Invalid file type' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const result = await uploadService.processFile(req.file.path, fileType, req.user?.id || null);
    res.status(201).json({ message: 'File processed successfully', file: result.file, recordsCreated: result.recordsCreated });
  } catch (error) { next(error); }
};

exports.listFiles = async (req, res, next) => {
  try {
    const files = await UploadedFile.findAll({ order: [['uploaded_at', 'DESC']], limit: 100 });
    res.json({ files });
  } catch (error) { next(error); }
};
```

- [ ] **Step 5: Create `backend/src/routes/upload.routes.js`**

```javascript
const { Router } = require('express');
const controller = require('../controllers/upload.controller');
const { authenticate } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

const router = Router();
router.post('/:type', authenticate, (req, res, next) => {
  upload(req, res, (err) => { if (err) return next(err); controller.uploadFile(req, res, next); });
});
router.get('/files', authenticate, controller.listFiles);

module.exports = router;
```

- [ ] **Step 6: Mount upload routes in `backend/src/app.js`** (add after auth routes)

```javascript
const uploadRoutes = require('./routes/upload.routes');
app.use('/api/upload', uploadRoutes);
```

- [ ] **Step 7: Create `backend/tests/upload.test.js`**

```javascript
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../src/app');
const { User, UploadedFile, Claim } = require('../src/models');
const SAMPLE_837 = require('./fixtures/sample.837');

describe('Upload API', () => {
  let token;
  beforeEach(async () => {
    await UploadedFile.destroy({ where: {} }); await Claim.destroy({ where: {} }); await User.destroy({ where: {} });
    const res = await request(app).post('/api/auth/register').send({ username: 'uploader', email: 'up@test.com', password: 'test123' });
    token = res.body.token;
  });

  it('should upload and parse an 837 file', async () => {
    const tmpDir = path.resolve(__dirname, '../data/837');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, 'test-837.837');
    fs.writeFileSync(tmpFile, SAMPLE_837);

    const res = await request(app)
      .post('/api/upload/837').set('Authorization', `Bearer ${token}`)
      .attach('file', tmpFile);
    expect(res.status).toBe(201);
    expect(res.body.recordsCreated).toBeGreaterThan(0);
    expect(res.body.file.status).toBe('parsed');

    const claims = await Claim.findAll();
    expect(claims.length).toBeGreaterThan(0);
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  });

  it('should return 401 without token', async () => {
    const res = await request(app).post('/api/upload/837');
    expect(res.status).toBe(401);
  });

  it('should list uploaded files', async () => {
    const res = await request(app).get('/api/upload/files').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.files).toBeDefined();
  });
});
```

- [ ] **Step 8: Run `cd backend && npx jest tests/upload.test.js --forceExit`**
Expected: All tests pass

---

### Task 6: Claims + Dashboard API Routes

**Files:**
- Create: `backend/src/controllers/claims.controller.js`
- Create: `backend/src/routes/claims.routes.js`
- Create: `backend/src/services/dashboard.service.js`
- Create: `backend/src/controllers/dashboard.controller.js`
- Create: `backend/src/routes/dashboard.routes.js`
- Create: `backend/src/routes/admin.routes.js`
- Create: `backend/tests/claims.test.js`
- Create: `backend/tests/dashboard.test.js`
- Modify: `backend/src/app.js`

**Interfaces:** Full REST API for claims, dashboard KPIs, and admin user management

- [ ] **Step 1: Create `backend/src/controllers/claims.controller.js`**

```javascript
const { Op } = require('sequelize');
const { Claim, ClaimLine, Remittance, DenialReason } = require('../models');

exports.listClaims = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, payer, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (status) where.status = status;
    if (payer) where.payer_name = { [Op.iLike]: `%${payer}%` };
    if (search) {
      where[Op.or] = [
        { patient_first_name: { [Op.iLike]: `%${search}%` } },
        { patient_last_name: { [Op.iLike]: `%${search}%` } },
        { claim_id: { [Op.iLike]: `%${search}%` } },
        { subscriber_id: { [Op.iLike]: `%${search}%` } },
      ];
    }
    const { rows, count } = await Claim.findAndCountAll({
      where, include: [{ model: ClaimLine, required: false }],
      order: [['created_at', 'DESC']], limit: parseInt(limit), offset,
    });
    res.json({ claims: rows, total: count, page: parseInt(page), totalPages: Math.ceil(count / parseInt(limit)) });
  } catch (error) { next(error); }
};

exports.getClaim = async (req, res, next) => {
  try {
    const claim = await Claim.findByPk(req.params.id, {
      include: [{ model: ClaimLine }, { model: Remittance, include: [{ model: DenialReason }] }, { model: DenialReason }],
    });
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    res.json({ claim });
  } catch (error) { next(error); }
};

exports.getClaimDenials = async (req, res, next) => {
  try {
    const denials = await DenialReason.findAll({
      where: { claim_id: req.params.id },
      include: [{ model: Remittance }],
      order: [['created_at', 'DESC']],
    });
    res.json({ denials });
  } catch (error) { next(error); }
};
```

- [ ] **Step 2: Create `backend/src/routes/claims.routes.js`**

```javascript
const { Router } = require('express');
const controller = require('../controllers/claims.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = Router();
router.get('/', authenticate, controller.listClaims);
router.get('/:id', authenticate, controller.getClaim);
router.get('/:id/denials', authenticate, controller.getClaimDenials);

module.exports = router;
```

- [ ] **Step 3: Create `backend/src/services/dashboard.service.js`**

```javascript
const { Op, fn, col, literal } = require('sequelize');
const { Claim, Remittance, DenialReason } = require('../models');

class DashboardService {
  async getSummary() {
    const totalClaims = await Claim.count();
    const statusDistribution = await Claim.findAll({
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      group: ['status'], raw: true,
    });
    const totalCharges = await Claim.sum('total_charge') || 0;
    const totalPayments = await Remittance.sum('total_paid') || 0;
    const totalAdjustments = await Remittance.sum('adjustment_amount') || 0;
    const deniedCount = statusDistribution.find(s => s.status === 'denied')?.count || 0;
    const denialRate = totalClaims > 0 ? parseFloat((deniedCount / totalClaims * 100).toFixed(1)) : 0;
    return { totalClaims, totalCharges: parseFloat(totalCharges.toFixed(2)), totalPayments: parseFloat(totalPayments.toFixed(2)), totalAdjustments: parseFloat(totalAdjustments.toFixed(2)), denialRate, statusDistribution: statusDistribution.map(s => ({ status: s.status, count: parseInt(s.count) })) };
  }

  async getDenialReasons(limit = 10) {
    const reasons = await DenialReason.findAll({
      attributes: ['denial_code', 'group_code', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('amount')), 'total_amount']],
      group: ['denial_code', 'group_code'],
      order: [[literal('"count"'), 'DESC']], limit, raw: true,
    });
    return reasons.map(r => ({ code: r.denial_code, group: r.group_code, count: parseInt(r.count), totalAmount: parseFloat(r.total_amount || 0).toFixed(2) }));
  }

  async getTrends(days = 30) {
    const since = new Date(); since.setDate(since.getDate() - days);
    const claimTrends = await Claim.findAll({
      attributes: [[fn('DATE', col('created_at')), 'date'], [fn('COUNT', col('id')), 'count']],
      where: { created_at: { [Op.gte]: since } },
      group: [fn('DATE', col('created_at'))], order: [[fn('DATE', col('created_at')), 'ASC']], raw: true,
    });
    const denialTrends = await DenialReason.findAll({
      attributes: [[fn('DATE', col('created_at')), 'date'], [fn('COUNT', col('id')), 'count']],
      where: { created_at: { [Op.gte]: since } },
      group: [fn('DATE', col('created_at'))], order: [[fn('DATE', col('created_at')), 'ASC']], raw: true,
    });
    return { claimTrends, denialTrends };
  }

  async getPayerBreakdown() {
    const payers = await Claim.findAll({
      attributes: ['payer_name', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('total_charge')), 'total_charge']],
      group: ['payer_name'], order: [[literal('"count"'), 'DESC']], raw: true,
    });
    return payers.map(p => ({ payer: p.payer_name || 'Unknown', count: parseInt(p.count), totalCharge: parseFloat(p.total_charge || 0).toFixed(2) }));
  }

  async getAging() {
    const claims = await Claim.findAll({
      attributes: ['id', 'claim_id', 'status', 'created_at', 'patient_last_name', 'patient_first_name'],
      include: [{ model: Remittance, attributes: ['remittance_date', 'status'], required: false }],
      order: [['created_at', 'DESC']], limit: 50,
    });
    return claims.map(c => {
      const daysAging = Math.floor((new Date() - new Date(c.created_at)) / (1000 * 60 * 60 * 24));
      const resolvedDate = c.Remittances?.[0]?.remittance_date || null;
      const daysToResolve = resolvedDate ? Math.floor((new Date(resolvedDate) - new Date(c.created_at)) / (1000 * 60 * 60 * 24)) : null;
      return { id: c.id, claimId: c.claim_id, patient: `${c.patient_first_name} ${c.patient_last_name}`.trim(), status: c.status, daysAging, daysToResolve };
    });
  }
}

module.exports = new DashboardService();
```

- [ ] **Step 4: Create `backend/src/controllers/dashboard.controller.js`**

```javascript
const dashboardService = require('../services/dashboard.service');

exports.summary = async (req, res, next) => {
  try { res.json(await dashboardService.getSummary()); }
  catch (error) { next(error); }
};

exports.denialReasons = async (req, res, next) => {
  try { res.json({ reasons: await dashboardService.getDenialReasons(parseInt(req.query.limit) || 10) }); }
  catch (error) { next(error); }
};

exports.trends = async (req, res, next) => {
  try { res.json(await dashboardService.getTrends(parseInt(req.query.days) || 30)); }
  catch (error) { next(error); }
};

exports.payerBreakdown = async (req, res, next) => {
  try { res.json({ breakdown: await dashboardService.getPayerBreakdown() }); }
  catch (error) { next(error); }
};

exports.aging = async (req, res, next) => {
  try { res.json({ aging: await dashboardService.getAging() }); }
  catch (error) { next(error); }
};
```

- [ ] **Step 5: Create `backend/src/routes/dashboard.routes.js`**

```javascript
const { Router } = require('express');
const controller = require('../controllers/dashboard.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = Router();
router.get('/summary', authenticate, controller.summary);
router.get('/denial-reasons', authenticate, controller.denialReasons);
router.get('/trends', authenticate, controller.trends);
router.get('/payer-breakdown', authenticate, controller.payerBreakdown);
router.get('/aging', authenticate, controller.aging);

module.exports = router;
```

- [ ] **Step 6: Create `backend/src/routes/admin.routes.js`**

```javascript
const { Router } = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const { User } = require('../models');

const router = Router();

router.get('/users', authenticate, requireAdmin, async (req, res, next) => {
  try { res.json({ users: await User.findAll({ attributes: { exclude: ['password_hash'] } }) }); }
  catch (error) { next(error); }
});

router.post('/users', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { username, email, password, role } = req.body;
    const user = await User.create({ username, email, password_hash: password, role: role || 'staff' });
    res.status(201).json({ user: user.toSafeJSON() });
  } catch (error) { next(error); }
});

module.exports = router;
```

- [ ] **Step 7: Mount routes in `backend/src/app.js`** (add after upload routes)

```javascript
const claimsRoutes = require('./routes/claims.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const adminRoutes = require('./routes/admin.routes');
app.use('/api/claims', claimsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
```

- [ ] **Step 8: Create `backend/tests/claims.test.js`**

```javascript
const request = require('supertest');
const app = require('../src/app');
const { User, Claim, ClaimLine } = require('../src/models');

describe('Claims API', () => {
  let token;
  beforeEach(async () => {
    await ClaimLine.destroy({ where: {} }); await Claim.destroy({ where: {} }); await User.destroy({ where: {} });
    const res = await request(app).post('/api/auth/register').send({ username: 'cuser', email: 'c@test.com', password: 'test123' });
    token = res.body.token;
  });

  it('should list claims (empty)', async () => {
    const res = await request(app).get('/api/claims').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.claims).toEqual([]);
  });

  it('should return 401 without auth', async () => {
    const res = await request(app).get('/api/claims');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 9: Create `backend/tests/dashboard.test.js`**

```javascript
const request = require('supertest');
const app = require('../src/app');
const { User } = require('../src/models');

describe('Dashboard API', () => {
  let token;
  beforeEach(async () => {
    await User.destroy({ where: {} });
    const res = await request(app).post('/api/auth/register').send({ username: 'duser', email: 'd@test.com', password: 'test123' });
    token = res.body.token;
  });

  it('should return summary with zeros when no data', async () => {
    const res = await request(app).get('/api/dashboard/summary').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.totalClaims).toBe(0);
    expect(res.body.denialRate).toBe(0);
  });

  it('should return denial reasons list', async () => {
    const res = await request(app).get('/api/dashboard/denial-reasons').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.reasons).toBeDefined();
  });
});
```

- [ ] **Step 10: Run all backend tests**
Run: `cd backend && npx jest --forceExit`
Expected: All tests pass
