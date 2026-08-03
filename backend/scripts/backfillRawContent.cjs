/**
 * Faster backfill for uploaded_files.raw_content using pg COPY batches.
 * Run inside backend container: node scripts/backfillRawContent.cjs
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { sequelize, UploadedFile } = require('./src/models');

const DIRS = {
  837: ['/incoming/837_processed', '/incoming/837'],
  835: ['/incoming/835_processed', '/incoming/835'],
};

function findFile(f) {
  for (const dir of DIRS[f.file_type] || []) {
    const fp = path.resolve(dir, f.filename);
    // Guard: filename must stay inside the incoming dir (no .. traversal)
    if (!fp.startsWith(path.resolve(dir) + path.sep)) continue;
    if (fs.existsSync(fp)) return fp;
  }
  const other = f.file_type === '837' ? DIRS['835'] : DIRS['837'];
  for (const dir of other) {
    const fp = path.resolve(dir, f.filename);
    if (!fp.startsWith(path.resolve(dir) + path.sep)) continue;
    if (fs.existsSync(fp)) return fp;
  }
  return null;
}

const BATCH = 500;

async function run() {
  const files = await UploadedFile.findAll({
    where: { raw_content: null },
    attributes: ['id', 'filename', 'file_type'],
    raw: true,
  });
  console.log(`Found ${files.length} files without raw_content`);

  const pool = new Pool({
    host: process.env.DB_HOST || 'db',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'denials_db',
    user: process.env.DB_USER || 'denials_user',
    password: process.env.DB_PASSWORD || 'denials_pass',
  });

  let updated = 0, missing = 0, errors = 0;
  let batch = [];

  const flush = async () => {
    if (batch.length === 0) return;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('CREATE TEMP TABLE _raw_backfill (id uuid PRIMARY KEY, raw_content text) ON COMMIT DROP');
      for (const { id, content } of batch) {
        await client.query('INSERT INTO _raw_backfill (id, raw_content) VALUES ($1, $2)', [id, content]);
      }
      await client.query('UPDATE uploaded_files u SET raw_content = b.raw_content FROM _raw_backfill b WHERE u.id = b.id');
      await client.query('COMMIT');
      updated += batch.length;
      batch = [];
      console.log(`...${updated} updated`);
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      errors += batch.length;
      console.error(`batch error: ${e.message}`);
      batch = [];
    } finally {
      client.release();
    }
  };

  for (const f of files) {
    const fp = findFile(f);
    if (!fp) { missing++; continue; }
    try {
      const content = fs.readFileSync(fp, 'utf8');
      batch.push({ id: f.id, content });
      if (batch.length >= BATCH) await flush();
    } catch (e) { errors++; }
  }
  await flush();

  console.log(`Done. Updated: ${updated}, Missing on disk: ${missing}, Errors: ${errors}`);
  await pool.end();
  await sequelize.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
