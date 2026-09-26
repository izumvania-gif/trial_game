import { existsSync } from 'node:fs';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Store } from './db.ts';
import { MAX_LINE_WORDS, normalizeLine, STELE_WORDS } from './stele.ts';

export interface AppOptions {
  store: Store;
  /** Built client (apps/game/dist). Skipped when missing, e.g. in API tests. */
  staticDir?: string;
  /** Minimum milliseconds between two resets from the same IP. */
  resetCooldownMs?: number;
  /** Minimum milliseconds between two stele lines from the same IP. */
  steleCooldownMs?: number;
  logger?: boolean;
}

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const { store, staticDir, resetCooldownMs = 5_000, steleCooldownMs = 60_000, logger = false } = opts;
  const app = Fastify({ logger, trustProxy: true, bodyLimit: 4096 });
  const lastResetByIp = new Map<string, number>();
  const lastLineByIp = new Map<string, number>();

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

  app.get('/api/stele', async () => ({
    words: STELE_WORDS,
    maxWords: MAX_LINE_WORDS,
    lines: store.randomSteleLines(3),
  }));

  app.post('/api/stele', async (req, reply) => {
    const words = normalizeLine((req.body as { words?: unknown } | null)?.words);
    if (!words) return reply.code(400).send({ error: 'invalid_line' });
    const now = Date.now();
    const last = lastLineByIp.get(req.ip);
    if (last !== undefined && now - last < steleCooldownMs) return reply.code(429).send({ error: 'too_many_lines' });
    lastLineByIp.set(req.ip, now);
    if (lastLineByIp.size > 10_000) lastLineByIp.clear();
    store.addSteleLine(words);
    return { ok: true };
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
