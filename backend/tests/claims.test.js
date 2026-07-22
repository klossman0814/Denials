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