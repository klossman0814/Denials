const { expect } = require('chai');
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
    expect(res.status).to.equal(200);
    expect(res.body.totalClaims).to.equal(0);
    expect(res.body.denialRate).to.equal(0);
  });

  it('should return denial reasons list', async () => {
    const res = await request(app).get('/api/dashboard/denial-reasons').set('Authorization', `Bearer ${token}`);
    expect(res.status).to.equal(200);
    expect(res.body.reasons).to.not.be.undefined;
  });
});
