import fs from 'fs';
import path from 'path';
import { pool } from '../config/db';

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');
  // eslint-disable-next-line no-console
  console.log('Applying schema...');
  await pool.query(sql);
  // eslint-disable-next-line no-console
  console.log('✓ Schema applied successfully.');
  await pool.end();
}

migrate().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Migration failed:', err);
  process.exit(1);
});
