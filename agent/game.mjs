// One running game in a headless browser, in agent mode (`?agent`): observe() and act() are the
// page's own `window.eferonAgent`, which runs on a virtual clock, so nothing happens between calls.
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const DIST = resolve(HERE, '../apps/game/dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

/**
 * Serve the built game (apps/game/dist) locally; the /api calls fail soft.
 * On a fixed port by default: the save lives in the page's localStorage, which belongs to the
 * origin, so a port that changed between runs would start every run with an empty save.
 */
function serveDist(port = 7358) {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error(`No build at ${DIST}. Run "npm run build" in the repo root first, or pass --url.`);
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.startsWith('/api/')) { res.writeHead(404).end(); return; }
    let file = join(DIST, path);
    if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok, fail) => {
    const listen = (p) => server.listen(p, '127.0.0.1', () => ok({ server, url: `http://127.0.0.1:${server.address().port}/` }));
    server.once('error', (e) => {
      if (e.code !== 'EADDRINUSE' || port === 0) return fail(e);
      process.stderr.write(`[eferon] port ${port} is busy; serving on a free port instead — this run's save will not be found by the next one.\n`);
      listen(0);
    });
    listen(port);
  });
}

export class EferonGame {
  /**
   * @param {{ url?: string, profile?: string, headed?: boolean, executablePath?: string, gamePort?: number }} opts
   *   url: a deployed game instead of the local build; profile: where the save lives between runs;
   *   gamePort: where the local build is served (default 7358; the save belongs to that origin).
   */
  constructor(opts = {}) {
    this.opts = opts;
  }

  async start() {
    const { url, profile = resolve(HERE, '.profile'), headed = false } = this.opts;
    if (!url) this.local = await serveDist(this.opts.gamePort);
    this.base = url ?? this.local.url;
    mkdirSync(profile, { recursive: true });
    this.context = await chromium.launchPersistentContext(profile, {
      headless: !headed,
      viewport: { width: 1280, height: 720 },
      executablePath: this.opts.executablePath ?? process.env.EFERON_CHROMIUM ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'],
    });
    this.page = this.context.pages()[0] ?? (await this.context.newPage());
    this.page.on('pageerror', (e) => process.stderr.write(`[game] ${e.message}\n`));
    await this.load();
    return this;
  }

  async load() {
    const target = new URL(this.base);
    target.searchParams.set('agent', '');
    if (this.opts.debug) target.searchParams.set('debug', '');
    await this.page.goto(target.toString());
    for (let i = 0; i < 300; i++) {
      if (await this.page.evaluate(() => !!window.eferonAgent)) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('The game did not start in agent mode.');
  }

  /** What the player perceives now, with the list of actions. */
  observe() {
    return this.page.evaluate(() => window.eferonAgent.observe());
  }

  /** Do one action (an id from the list; `arg` when it takes one) and look again. */
  act(id, arg) {
    return this.page.evaluate(([id, arg]) => window.eferonAgent.act(id, arg), [id, arg ?? undefined]);
  }

  /** Forget everything and start from the title screen. */
  async newGame() {
    await this.page.evaluate(() => { localStorage.removeItem('eferon.save'); localStorage.removeItem('eferon.shard'); });
    await this.load();
    return this.observe();
  }

  /** Load a wax tablet (from the "save" action) on the title screen; then act "ui:wake". */
  async loadTablet(code) {
    await this.load();
    const status = await this.page.evaluate((code) => {
      document.querySelector('#tablet-code').value = code;
      document.querySelector('#tablet-import').click();
      return document.querySelector('#tablet-status').textContent;
    }, code);
    return { ...(await this.observe()), result: status };
  }

  async screenshot(path) {
    await this.page.screenshot({ path });
    return path;
  }

  async close() {
    await this.context?.close();
    this.local?.server.close();
  }
}
