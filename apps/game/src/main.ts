import storyJson from '../../../story/main.ink';
import { fetchCycleRun } from './api.ts';
import { browserStorage, exportTablet } from './core/save.ts';
import { SettingsStore } from './core/settings.ts';
import { SettingsPanel } from './ui/SettingsPanel.ts';
import { Game } from './game.ts';
import { drawSpiral } from './spiral.ts';
import { mountDebugPanel } from './ui/DebugPanel.ts';
import { PORTRAIT_IDS, portrait } from './ui/portraits.ts';
import { MOODS } from './content/moods.ts';
import { PAST_LEONTS } from './content/leonts.ts';
import { carvingCanvas } from './ui/carvings.ts';
import { installVirtualTime } from './agent/virtualTime.ts';
import { AgentBridge } from './agent/bridge.ts';

const title = document.querySelector<HTMLElement>('#title')!;
const titleCanvas = document.querySelector<HTMLCanvasElement>('#spiral')!;
const cycleEl = document.querySelector<HTMLParagraphElement>('#cycle')!;
const wakeBtn = document.querySelector<HTMLButtonElement>('#wake')!;
const view = document.querySelector<HTMLCanvasElement>('#view')!;
const overlay = document.querySelector<HTMLElement>('#overlay')!;

const redrawTitle = () => drawSpiral(titleCanvas, 0);
window.addEventListener('resize', redrawTitle);
redrawTitle();

// Agent mode: a virtual clock (time moves only when the agent acts) and the game in words.
const agentMode = new URLSearchParams(location.search).has('agent');
const virtualTime = agentMode ? installVirtualTime() : null;

const settings = new SettingsStore(browserStorage());
// An agent cannot hear or time a word: no sound, déjà vu at any moment, text at once, no tips.
if (agentMode) settings.update({ master: 0, noRhythm: true, reducedMotion: true, tips: false, lessMeta: true, quality: 'low' });
settings.subscribe((s) => {
  document.documentElement.classList.toggle('large-text', s.largeText);
  document.documentElement.classList.toggle('pilgrim', s.pilgrim);
  document.documentElement.classList.toggle('reduced-motion', s.reducedMotion);
});
const game = new Game(view, overlay, storyJson, settings);
const titleSettings = new SettingsPanel(document.body, settings);
document.querySelector('#settings')!.addEventListener('click', () => titleSettings.toggle());
if (new URLSearchParams(location.search).has('portraits')) {
  // Development sheet: every portrait, in both palettes, closed and talking.
  const sheet = document.createElement('div');
  sheet.style.cssText = 'position:fixed;inset:0;z-index:99;overflow:auto;background:#1d1611;display:grid;grid-template-columns:repeat(8,144px);gap:8px;padding:12px';
  const add = (c: HTMLCanvasElement, title: string) => {
    c.style.cssText = 'width:144px;height:144px;image-rendering:pixelated';
    c.title = title;
    sheet.append(c);
  };
  // One row per person: every mood, then talking, then the marble version.
  for (const id of PORTRAIT_IDS) {
    for (const mood of MOODS) add(portrait(id, 'vase', false, mood), `${id} ${mood}`);
    add(portrait(id, 'vase', true, 'joy'), `${id} talking`);
    add(portrait(id, 'marble', false, 'sorrow'), `${id} marble`);
  }
  document.body.append(sheet);
}
if (new URLSearchParams(location.search).has('carvings')) {
  // Development sheet: every past Leont's carving, ring by ring.
  const sheet = document.createElement('div');
  sheet.style.cssText = 'position:fixed;inset:0;z-index:99;overflow:auto;background:#1d1611;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:12px;color:#e8e2d0;font:12px serif';
  for (const l of PAST_LEONTS) {
    const cell = document.createElement('div');
    const c = carvingCanvas(l);
    c.style.cssText = 'width:100%;display:block';
    cell.append(c, `${l.id} · ring ${l.ring} · ${l.attempt} → ${l.fate}`);
    sheet.append(cell);
  }
  document.body.append(sheet);
}
if (virtualTime) {
  const bridge = new AgentBridge(game, virtualTime);
  // Stage guides are written for hands on keys; the agent reads its own actions instead.
  game.save.memory.guides.push('town', 'spiral', 'relief', 'desk', 'board', 'strikes', 'sea', 'diary');
  (window as unknown as { eferonAgent: unknown }).eferonAgent = {
    observe: () => bridge.observe(),
    act: (id: string, arg?: string) => bridge.act(id, arg),
    settle: () => bridge.settle(),
  };
  void bridge.settle(0.2);
}
if (new URLSearchParams(location.search).has('debug')) {
  mountDebugPanel(game, document.body);
  (window as unknown as { eferon: Game }).eferon = game;
}

void fetchCycleRun().then((run) => {
  if (run !== null) game.cycleRun = run;
  const shown = run ?? game.cycleRun;
  cycleEl.textContent = shown === null ? 'CYCLE RUN #···· — SIGNAL LOST' : `CYCLE RUN #${shown}`;
});

// The wax tablet: export / import of the whole save as a code.
const tabletPanel = document.querySelector<HTMLElement>('#tablet-panel')!;
const tabletCode = document.querySelector<HTMLTextAreaElement>('#tablet-code')!;
const tabletStatus = document.querySelector<HTMLElement>('#tablet-status')!;
document.querySelector('#tablet')!.addEventListener('click', () => {
  tabletPanel.hidden = !tabletPanel.hidden;
  tabletCode.value = exportTablet(game.save);
  tabletCode.select();
});
document.querySelector('#tablet-import')!.addEventListener('click', () => {
  const ok = game.loadTablet(tabletCode.value);
  tabletStatus.textContent = ok ? 'The wax takes it. Wake when you are ready.' : 'The wax will not take that.';
});
if (game.save.memory.epilogue) wakeBtn.textContent = 'Open the diary';

wakeBtn.addEventListener('click', () => {
  window.removeEventListener('resize', redrawTitle);
  title.remove();
  game.start();
}, { once: true });
