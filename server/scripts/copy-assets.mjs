// Copy non-TS assets that tsc doesn't emit (schema.sql) into dist/.
import { copyFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'src', 'db', 'schema.sql');
const to = join(root, 'dist', 'db', 'schema.sql');

mkdirSync(dirname(to), { recursive: true });
copyFileSync(from, to);
console.log('✓ copied schema.sql → dist/db');
