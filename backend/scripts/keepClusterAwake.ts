import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { keepClusterAwake, mongoClusterClient } from '../src/lib/keepClusterAwake.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

keepClusterAwake(mongoClusterClient())
  .then(() => {
    console.log('MongoDB cluster ping ok');
    process.exit(0);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'MongoDB cluster ping failed';
    console.error(message);
    process.exit(1);
  });
