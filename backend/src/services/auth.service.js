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
    if (!user.active) throw Object.assign(new Error('Account is deactivated'), { status: 401 });
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
