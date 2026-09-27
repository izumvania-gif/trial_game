// A quick run through every stage in agent mode (needs `npm run build` first):
//   node agent/selftest.mjs
// It uses the debug panel to jump between stages, then plays each one only through observe/act.
import { EferonGame } from './game.mjs';

const game = await new EferonGame({ debug: true, profile: `/tmp/eferon-agent-selftest-${process.pid}` }).start();
const log = (...a) => console.log(...a);
let fails = 0;
const check = (ok, what) => { log(ok ? '  ok ' : '  FAIL', what); if (!ok) fails++; };
const has = (o, id) => o.actions.some((a) => a.id === id || a.id.startsWith(id));
const act = async (id, arg) => { const o = await game.act(id, arg); if (/Unknown action/.test(o.result)) log('  (unknown)', id); return o; };
/** Answer every line until the stage is free again (first choice when asked). */
const through = async (o, max = 60) => {
  for (let i = 0; i < max && o.dialogue; i++) o = await act(o.dialogue.choices.length ? 'say:1' : o.dialogue.dejavu ? 'finish' : 'continue');
  return o;
};
const debug = (label) => game.page.evaluate((l) => [...document.querySelectorAll('.debug button')].find((b) => b.innerText.trim() === l)?.click(), label);
const stage = (id) => game.page.evaluate((s) => window.eferon.debugStage(s), id);

log('title');
let o = await game.newGame();
check(has(o, 'ui:wake'), 'the title offers Wake');
o = await through(await act('ui:wake'));
check(o.stage === 'town' && has(o, 'go:agora'), 'dawn in the town, free to walk');

log('town');
o = await through(await act('talk:stele'));
check(/star stele/.test(o.text), 'walked to the stele and read it');
o = await act('wait_until', '12:00');
check(o.time === '12:00' || o.time === '12:01', `waited until noon (${o.time})`);
o = await through(await act('meet:eion').then(() => act('talk:eion')));
check(o.stage === 'town', 'talked to Eion');
o = await act('chronicle');
check(/Questions:/.test(o.result), 'read the chronicle');
o = await act('book');
check(/Book of Strangers/.test(o.result), 'read the Book');

log('midnight');
o = await act('wait_until', '23:59');
o = await act('wait', '5');
o = await through(o);
for (let i = 0; i < 10 && !has(o, 'ui:wake'); i++) o = await through(await act('wait', '2'));
check(has(o, 'ui:wake'), 'midnight came and the reset screen offers Wake');
o = await act('ui:wake');
for (let i = 0; i < 5 && (o.dialogue || o.actions.some((a) => a.id.startsWith('ui:'))) && !has(o, 'go:agora'); i++) {
  o = await through(o);
  const ok = o.actions.find((a) => a.id.startsWith('ui:'));
  if (ok && !has(o, 'go:agora')) o = await act(ok.id);
}
check(o.day === 2 && has(o, 'go:agora'), `day 2 begins (day ${o.day})`);

log('spiral');
await stage('spiral');
o = await through(await game.observe());
check(o.stage === 'spiral' && has(o, 'carvings'), 'in the Hall');
o = await act('carvings');
check(/l1 · Leont 1/.test(o.result), 'the carvings are listed');
const angle = (id) => Number(new RegExp(`${id} · [^\\n]*? at (\\d+)°`).exec(o.result)?.[1]);
const a1 = angle('l1');
const a3 = angle('l3');
o = await act('turn:1', String(a1 - a3));
check(/lock/.test(o.result), `aligning l1 and l3 locks the rings (${o.result})`);
o = await through(o);
o = await act('study', 'l1');
check(o.actions.some((a) => a.id.startsWith('choose:')), 'studying a carving opens its card with the registry words');
const close = o.actions.find((a) => /close|step back/i.test(a.label));
if (close) o = await act(close.id);
o = await through(o);
check(has(o, 'leave'), 'the card closes');

log('board and strikes');
await debug('prep night');
o = await through(await game.observe());
for (let i = 0; i < 5 && o.stage !== 'board'; i++) { await stage('board'); o = await through(await game.observe()); }
check(o.stage === 'board' && /Routes tonight/.test(o.text), 'the board is described with its routes');
o = await act('place:eion', '1,2');
check(/stands at/.test(o.result), `placed Eion (${o.result})`);
o = await act('ui:let-the-night-come');
check(/The priest|Guards|Lysimachus/.test(o.text), 'the night was played to its end');
o = await act('ui:go-down-to-the-hall');
o = await through(o);
check(o.stage === 'strikes' && has(o, 'strike:'), 'in the burning Hall with ages to strike');
for (let i = 0; i < 12 && has(o, 'strike:'); i++) o = await through(await act(o.actions.find((a) => a.id.startsWith('strike:')).id));
check(/burning|carry/i.test(o.text), 'every age broken, the fire starts');

log('desk');
await stage('desk');
o = await through(await game.observe());
check(o.stage === 'desk' && o.screen.some((s) => /CURATION TERMINAL|Queue/i.test(s)), 'the Desk is read from the screen');

await game.close();
log(fails ? `${fails} failed` : 'all ok');
process.exit(fails ? 1 : 0);
