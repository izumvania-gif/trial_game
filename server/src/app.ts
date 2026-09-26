import { existsSync } from 'node:fs';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Store } from './db.ts';
import { ADMIN_PAGE } from './admin.ts';
import { cleanNote } from './notes.ts';
import { MAX_LINE_WORDS, normalizeLine, STELE_WORDS } from './stele.ts';

export interface AppOptions {
  store: Store;
  /** Built client (apps/game/dist). Skipped when missing, e.g. in API tests. */
  staticDir?: string;
  /** Minimum milliseconds between two resets from the same IP. */
  resetCooldownMs?: number;
  /** Minimum milliseconds between two stele lines (or two notes) from the same IP. */
  steleCooldownMs?: number;
  /** Enables /admin and /api/admin/*. Unset = moderation endpoints do not exist. */
  adminToken?: string;
  logger?: boolean;
}

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const { store, staticDir, resetCooldownMs = 5_000, steleCooldownMs = 60_000, adminToken, logger = false } = opts;
  const app = Fastify({ logger, trustProxy: true, bodyLimit: 4096 });
  const lastResetByIp = new Map<string, number>();
  const lastLineByIp = new Map<string, number>();
  const lastNoteByIp = new Map<string, number>();

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

  // Notes in the waves: premoderated free text.
  app.get('/api/notes', async () => ({ notes: store.randomApprovedNotes(3) }));

  app.post('/api/notes', async (req, reply) => {
    const text = cleanNote((req.body as { text?: unknown } | null)?.text);
    if (!text) return reply.code(400).send({ error: 'invalid_note' });
    const now = Date.now();
    const last = lastNoteByIp.get(req.ip);
    if (last !== undefined && now - last < steleCooldownMs) return reply.code(429).send({ error: 'too_many_notes' });
    lastNoteByIp.set(req.ip, now);
    if (lastNoteByIp.size > 10_000) lastNoteByIp.clear();
    store.addNote(text);
    // Always "queued": the player never learns whether a note was approved. The sea keeps its own counsel.
    return { ok: true };
  });

  if (adminToken) {
    const authorized = (header: string | undefined) => header === `Bearer ${adminToken}`;
    app.get('/admin', async (_req, reply) => reply.type('text/html').send(ADMIN_PAGE));
    app.get('/api/admin/notes', async (req, reply) => {
      if (!authorized(req.headers.authorization)) return reply.code(401).send({ error: 'unauthorized' });
      const status = (req.query as { status?: string }).status ?? 'pending';
      if (!['pending', 'approved', 'rejected'].includes(status)) return reply.code(400).send({ error: 'bad_status' });
      return { notes: store.notesByStatus(status as 'pending', 200) };
    });
    app.post('/api/admin/notes/:id', async (req, reply) => {
      if (!authorized(req.headers.authorization)) return reply.code(401).send({ error: 'unauthorized' });
      const status = (req.body as { status?: string } | null)?.status;
      if (status !== 'approved' && status !== 'rejected') return reply.code(400).send({ error: 'bad_status' });
      const ok = store.setNoteStatus(Number((req.params as { id: string }).id), status);
      return ok ? { ok } : reply.code(404).send({ error: 'not_found' });
    });
  }

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
