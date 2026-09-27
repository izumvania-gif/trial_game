#!/usr/bin/env node
// EFERON for agents. One command, four ways in:
//   serve   an HTTP server on 127.0.0.1:7357 holding one game (GET /observe, POST /act, POST /new, POST /load)
//   observe / act <id> [arg] / new / save / shot <file>   one call to that server, printing the text
//   mcp     a Model Context Protocol server on stdio (tools: observe, act, new_game, load_tablet)
// Options: --url <game url> (default: the local build in apps/game/dist), --profile <dir> (where the
// save lives), --port <n>, --headed, --json (print the whole observation as JSON).
import { EferonGame } from './game.mjs';

const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(`--${name}`); if (i < 0) return undefined; const v = argv[i + 1]; argv.splice(i, v && !v.startsWith('--') ? 2 : 1); return v && !v.startsWith('--') ? v : true; };
const url = flag('url');
const profile = flag('profile');
const port = Number(flag('port') ?? process.env.EFERON_AGENT_PORT ?? 7357);
const headed = !!flag('headed');
const json = !!flag('json');
const [cmd = 'help', ...rest] = argv;
const show = (o) => (json ? JSON.stringify(o, null, 2) : `${o.result ? `> ${o.result}\n\n` : ''}${o.text}`);

async function serve() {
  const game = await new EferonGame({ url, profile, headed }).start();
  const { createServer } = await import('node:http');
  let queue = Promise.resolve();
  const one = (fn) => (queue = queue.then(fn, fn)); // one action at a time
  const server = createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    let body = '';
    for await (const chunk of req) body += chunk;
    let data = {};
    try { data = body ? JSON.parse(body) : {}; } catch { data = { id: body.trim() }; }
    const q = (k) => data[k] ?? u.searchParams.get(k) ?? undefined;
    const asJson = u.searchParams.has('json') || req.headers.accept?.includes('application/json');
    try {
      const out = await one(async () => {
        switch (u.pathname) {
          case '/observe': return game.observe();
          case '/act': return game.act(q('id') ?? q('action'), q('arg'));
          case '/new': return game.newGame();
          case '/load': return game.loadTablet(q('tablet') ?? q('code'));
          case '/shot': return { text: await game.screenshot(q('path') ?? 'eferon.png') };
          default: return { text: 'EFERON agent server. GET /observe · POST /act {"id","arg"} · POST /new · POST /load {"tablet"} · GET /shot?path=' };
        }
      });
      res.writeHead(200, { 'content-type': asJson ? 'application/json' : 'text/plain; charset=utf-8' });
      res.end(asJson ? JSON.stringify(out) : `${out.result ? `> ${out.result}\n\n` : ''}${out.text}\n`);
    } catch (e) {
      res.writeHead(500).end(String(e?.message ?? e));
    }
  });
  server.listen(port, '127.0.0.1', () => process.stderr.write(`EFERON agent server on http://127.0.0.1:${port} (game: ${game.base})\n`));
  const stop = async () => { server.close(); await game.close(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

async function call(path, data) {
  const res = await fetch(`http://127.0.0.1:${port}${path}?json`, { method: data ? 'POST' : 'GET', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: data ? JSON.stringify(data) : undefined })
    .catch(() => { throw new Error(`No agent server on port ${port}. Start one with: node agent/eferon.mjs serve`); });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** A minimal MCP server over stdio (JSON-RPC 2.0, one message per line). */
async function mcp() {
  let game = null;
  const ready = async () => (game ??= await new EferonGame({ url, profile, headed }).start());
  const tools = [
    { name: 'observe', description: 'Look: what the player of EFERON perceives now (stage, hour, what is around, the line being spoken, open cards) and the list of actions available.', inputSchema: { type: 'object', properties: {} } },
    { name: 'act', description: 'Do one action from the list returned by observe; returns what happened and the new observation. Time in the game only moves when you act.', inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Action id, e.g. "go:agora", "talk:kora", "continue", "say:2", "ui:wake".' }, arg: { type: 'string', description: 'Argument, for actions that take one (minutes, degrees, a tile, a word to choose, text to type).' } }, required: ['id'] } },
    { name: 'new_game', description: 'Forget everything and start a new game from the title screen.', inputSchema: { type: 'object', properties: {} } },
    { name: 'load_tablet', description: 'Load a wax tablet (a save code from the "save" action) on the title screen.', inputSchema: { type: 'object', properties: { tablet: { type: 'string' } }, required: ['tablet'] } },
  ];
  const reply = (id, result) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
  const fail = (id, message) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32603, message } })}\n`);
  const text = (o) => ({ content: [{ type: 'text', text: show(o) }] });
  let queue = Promise.resolve();
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', async (chunk) => {
    buf += chunk;
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      queue = queue.then(() => handle(msg)).catch(() => {});
    }
  });
  async function handle(msg) {
    {
      const { id, method, params } = msg;
      try {
        if (method === 'initialize') reply(id, { protocolVersion: params?.protocolVersion ?? '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'eferon', version: '1.0.0' }, instructions: 'You are playing EFERON: The Other Hand, a time-loop mystery set in a Greek city whose last day repeats. Call observe, then act with ids from its action list (arguments where an action names one). Time moves only when you act. What you learn is kept in your chronicle across days; read it (act chronicle) and follow its open questions. The game text sometimes names keys: E = talk, F = finish, C = chronicle, B = book, M = mask, R = lyre, Esc = leave.' });
        else if (method === 'tools/list') reply(id, { tools });
        else if (method === 'tools/call') {
          const g = await ready();
          const a = params?.arguments ?? {};
          const out = params.name === 'observe' ? await g.observe()
            : params.name === 'act' ? await g.act(a.id, a.arg)
              : params.name === 'new_game' ? await g.newGame()
                : params.name === 'load_tablet' ? await g.loadTablet(a.tablet)
                  : null;
          if (!out) fail(id, `Unknown tool ${params.name}`);
          else reply(id, text(out));
        } else if (method === 'ping') reply(id, {});
        else if (id !== undefined) fail(id, `Unknown method ${method}`);
      } catch (e) {
        if (id !== undefined) fail(id, String(e?.message ?? e));
      }
    }
  }
  process.stdin.on('end', async () => { await game?.close(); process.exit(0); });
}

const help = `EFERON for agents

  node agent/eferon.mjs serve [--url URL] [--profile DIR] [--port 7357] [--headed]
      Start a headless game and an HTTP server for it.
  node agent/eferon.mjs observe            What the player perceives, and the actions available.
  node agent/eferon.mjs act <id> [arg]     Do one action; prints what happened and the new view.
  node agent/eferon.mjs new                New game (forgets the save).
  node agent/eferon.mjs save               Print a wax tablet (save code).
  node agent/eferon.mjs load <tablet>      Load a save code on the title screen.
  node agent/eferon.mjs shot <file.png>    Screenshot of what a human would see.
  node agent/eferon.mjs mcp                MCP server on stdio (tools: observe, act, new_game, load_tablet).
  Add --json to print the whole observation as JSON.`;

try {
  if (cmd === 'serve') await serve();
  else if (cmd === 'mcp') await mcp();
  else if (cmd === 'observe') console.log(show(await call('/observe')));
  else if (cmd === 'act') console.log(show(await call('/act', { id: rest[0], arg: rest.slice(1).join(' ') || undefined })));
  else if (cmd === 'new') console.log(show(await call('/new', {})));
  else if (cmd === 'save') console.log(show(await call('/act', { id: 'save' })));
  else if (cmd === 'load') console.log(show(await call('/load', { tablet: rest[0] })));
  else if (cmd === 'shot') console.log((await call('/shot', { path: rest[0] ?? 'eferon.png' })).text);
  else console.log(help);
} catch (e) {
  console.error(e.message ?? e);
  process.exit(1);
}
