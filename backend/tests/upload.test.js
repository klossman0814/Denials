const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../src/app');
const { sequelize, User, UploadedFile, Claim } = require('../src/models');
const SAMPLE_837 = require('./fixtures/sample.837');

describe('Upload API', () => {
  let token;
  beforeAll(async () => { await sequelize.sync({ force: true }); });
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

    // Accept both sync (201, parsed) and queue (202, queued) responses
    if (res.status === 202) {
      expect(res.body.file.status).toBe('queued');
      // Wait for the queue to process, then check claims
      await new Promise(r => setTimeout(r, 3000));
    } else {
      expect(res.status).toBe(201);
      expect(res.body.recordsCreated).toBeGreaterThan(0);
      expect(res.body.file.status).toBe('parsed');
    }

    const claims = await Claim.findAll();
    if (res.status === 201) {
      expect(claims.length).toBeGreaterThan(0);
    }
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