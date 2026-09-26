import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.ts';
import { openStore } from './db.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT ?? 3000);
// On Amvera DATA_DIR is /data (the persistent mount); locally it defaults to ./data.
const dataDir = process.env.DATA_DIR ?? resolve(here, '../../data');
const staticDir = process.env.STATIC_DIR ?? resolve(here, '../../apps/game/dist');

const app = await buildApp({ store: openStore(dataDir), staticDir, logger: true });
await app.listen({ port, host: '0.0.0.0' });
