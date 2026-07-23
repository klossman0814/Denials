const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Admin .env Sync Logic', () => {
  const tmpDir = path.resolve(__dirname, '../.test-tmp');
  const tmpEnv = path.join(tmpDir, '.env');

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('replace existing setting', () => {
    it('should replace UPLOAD_DIR_837 in existing .env', () => {
      fs.writeFileSync(tmpEnv, [
        'NODE_ENV=development',
        'UPLOAD_DIR_837=./data/837',
        'UPLOAD_DIR_835=./data/835',
      ].join(os.EOL) + os.EOL);

      let content = fs.readFileSync(tmpEnv, 'utf8');
      content = content.replace(/^UPLOAD_DIR_837=.*/m, 'UPLOAD_DIR_837=/incoming/837');
      fs.writeFileSync(tmpEnv, content, 'utf8');

      const updated = fs.readFileSync(tmpEnv, 'utf8');
      expect(updated).toContain('UPLOAD_DIR_837=/incoming/837');
      expect(updated).toContain('UPLOAD_DIR_835=./data/835');
      expect(updated).toContain('NODE_ENV=development');
    });

    it('should replace UPLOAD_DIR_835 in existing .env', () => {
      fs.writeFileSync(tmpEnv, [
        'PORT=3000',
        'UPLOAD_DIR_837=./data/837',
        'UPLOAD_DIR_835=./data/835',
      ].join(os.EOL) + os.EOL);

      let content = fs.readFileSync(tmpEnv, 'utf8');
      content = content.replace(/^UPLOAD_DIR_835=.*/m, 'UPLOAD_DIR_835=/incoming/835');
      fs.writeFileSync(tmpEnv, content, 'utf8');

      const updated = fs.readFileSync(tmpEnv, 'utf8');
      expect(updated).toContain('UPLOAD_DIR_835=/incoming/835');
      expect(updated).toContain('UPLOAD_DIR_837=./data/837');
    });
  });

  describe('append missing setting', () => {
    it('should append UPLOAD_DIR_837 if missing from .env', () => {
      fs.writeFileSync(tmpEnv, [
        'NODE_ENV=production',
        'DB_HOST=localhost',
      ].join(os.EOL) + os.EOL);

      let content = fs.readFileSync(tmpEnv, 'utf8');
      const regex = /^UPLOAD_DIR_837=.*/m;
      if (!regex.test(content)) {
        content += `UPLOAD_DIR_837=/incoming/837${os.EOL}`;
      }
      fs.writeFileSync(tmpEnv, content, 'utf8');

      const updated = fs.readFileSync(tmpEnv, 'utf8');
      expect(updated).toContain('UPLOAD_DIR_837=/incoming/837');
      expect(updated).toContain('NODE_ENV=production');
    });

    it('should append UPLOAD_DIR_835 if missing from .env', () => {
      fs.writeFileSync(tmpEnv, [
        'JWT_SECRET=test-secret',
        'REDIS_URL=redis://localhost:6379',
      ].join(os.EOL) + os.EOL);

      let content = fs.readFileSync(tmpEnv, 'utf8');
      const regex = /^UPLOAD_DIR_835=.*/m;
      if (!regex.test(content)) {
        content += `UPLOAD_DIR_835=/incoming/835${os.EOL}`;
      }
      fs.writeFileSync(tmpEnv, content, 'utf8');

      const updated = fs.readFileSync(tmpEnv, 'utf8');
      expect(updated).toContain('UPLOAD_DIR_835=/incoming/835');
    });
  });

  describe('edge cases', () => {
    it('should handle empty .env file', () => {
      fs.writeFileSync(tmpEnv, '');

      let content = fs.readFileSync(tmpEnv, 'utf8');
      const regex = /^UPLOAD_DIR_837=.*/m;
      if (!regex.test(content)) {
        content += (content.endsWith(os.EOL) ? '' : os.EOL) + `UPLOAD_DIR_837=/incoming/837${os.EOL}`;
      }
      fs.writeFileSync(tmpEnv, content, 'utf8');

      const updated = fs.readFileSync(tmpEnv, 'utf8');
      expect(updated).toContain('UPLOAD_DIR_837=/incoming/837');
    });

    it('should handle .env with only the setting to replace', () => {
      fs.writeFileSync(tmpEnv, 'UPLOAD_DIR_837=./data/837' + os.EOL);

      let content = fs.readFileSync(tmpEnv, 'utf8');
      content = content.replace(/^UPLOAD_DIR_837=.*/m, 'UPLOAD_DIR_837=/incoming/837');
      fs.writeFileSync(tmpEnv, content, 'utf8');

      const updated = fs.readFileSync(tmpEnv, 'utf8');
      expect(updated).toBe('UPLOAD_DIR_837=/incoming/837' + os.EOL);
    });
  });
});
