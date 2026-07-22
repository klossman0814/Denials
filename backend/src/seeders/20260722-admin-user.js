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
