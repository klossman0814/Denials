const { expect } = require('chai');
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
      expect(res.status).to.equal(201);
      expect(res.body.token).to.not.be.undefined;
      expect(res.body.user.password_hash).to.be.undefined;
    });

    it('should reject duplicate username', async () => {
      await request(app).post('/api/auth/register').send({ username: 'dup', email: 'a@a.com', password: 'test123' });
      const res = await request(app).post('/api/auth/register').send({ username: 'dup', email: 'b@b.com', password: 'test123' });
      expect(res.status).to.equal(409);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login and return token', async () => {
      await request(app).post('/api/auth/register').send({ username: 'user1', email: 'u@u.com', password: 'mypass' });
      const res = await request(app).post('/api/auth/login').send({ username: 'user1', password: 'mypass' });
      expect(res.status).to.equal(200);
      expect(res.body.token).to.not.be.undefined;
    });

    it('should reject wrong password', async () => {
      await request(app).post('/api/auth/register').send({ username: 'user2', email: 'u2@u.com', password: 'mypass' });
      const res = await request(app).post('/api/auth/login').send({ username: 'user2', password: 'wrong' });
      expect(res.status).to.equal(401);
    });
  });
});
