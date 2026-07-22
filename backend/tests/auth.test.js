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