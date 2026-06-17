import fs from 'fs';
import { createApp } from './app';
import { env } from './config/env';

// Ensure upload directory exists.
fs.mkdirSync(env.uploadDir, { recursive: true });

const app = createApp();
app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`API running on http://localhost:${env.port} (${env.nodeEnv})`);
});
