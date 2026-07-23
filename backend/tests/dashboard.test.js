const request = require('supertest');
const app = require('../src/app');
const { sequelize, User } = require('../src/models');

describe('Dashboard API', () => {
  let token;
  beforeAll(async () => { await sequelize.sync(); });
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

  it('should return paginated payer breakdown', async () => {
    const res = await request(app)
      .get('/api/dashboard/payer-breakdown?page=1&limit=10')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.breakdown).toBeDefined();
    expect(Array.isArray(res.body.breakdown)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });
});