import { existsSync } from 'node:fs';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Store } from './db.ts';

export interface AppOptions {
  store: Store;
  /** Built client (apps/game/dist). Skipped when missing, e.g. in API tests. */
  staticDir?: string;
  /** Minimum milliseconds between two resets from the same IP. */
  resetCooldownMs?: number;
  logger?: boolean;
}

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const { store, staticDir, resetCooldownMs = 5_000, logger = false } = opts;
  const app = Fastify({ logger, trustProxy: true });
  const lastResetByIp = new Map<string, number>();

  app.get('/api/health', async () => ({ ok: true }));

  app.get('/api/counter', async () => ({ cycleRun: store.getCycleRun() }));

  app.post('/api/counter/reset', async (req, reply) => {
    const now = Date.now();
    const last = lastResetByIp.get(req.ip);
    if (last !== undefined && now - last < resetCooldownMs) {
      return reply.code(429).send({ error: 'too_many_resets', cycleRun: store.getCycleRun() });
    }
    lastResetByIp.set(req.ip, now);
    if (lastResetByIp.size > 10_000) lastResetByIp.clear();
    return { cycleRun: store.recordReset() };
  });

  if (staticDir && existsSync(staticDir)) {
    await app.register(fastifyStatic, { root: staticDir });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api/')) return reply.sendFile('index.html');
      return reply.code(404).send({ error: 'not_found' });
    });
  }

  app.addHook('onClose', async () => store.close());
  return app;
}
