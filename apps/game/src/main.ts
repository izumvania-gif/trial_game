import storyJson from '../../../story/main.ink';
import { fetchCycleRun } from './api.ts';
import { browserStorage, exportTablet } from './core/save.ts';
import { SettingsStore } from './core/settings.ts';
import { SettingsPanel } from './ui/SettingsPanel.ts';
import { Game } from './game.ts';
import { drawSpiral } from './spiral.ts';
import { mountDebugPanel } from './ui/DebugPanel.ts';
import { PORTRAIT_IDS, portrait } from './ui/portraits.ts';

const title = document.querySelector<HTMLElement>('#title')!;
const titleCanvas = document.querySelector<HTMLCanvasElement>('#spiral')!;
const cycleEl = document.querySelector<HTMLParagraphElement>('#cycle')!;
const wakeBtn = document.querySelector<HTMLButtonElement>('#wake')!;
const view = document.querySelector<HTMLCanvasElement>('#view')!;
const overlay = document.querySelector<HTMLElement>('#overlay')!;

const redrawTitle = () => drawSpiral(titleCanvas, 0);
window.addEventListener('resize', redrawTitle);
redrawTitle();

const settings = new SettingsStore(browserStorage());
settings.subscribe((s) => {
  document.documentElement.classList.toggle('large-text', s.largeText);
  document.documentElement.classList.toggle('reduced-motion', s.reducedMotion);
});
const game = new Game(view, overlay, storyJson, settings);
const titleSettings = new SettingsPanel(document.body, settings);
document.querySelector('#settings')!.addEventListener('click', () => titleSettings.toggle());
if (new URLSearchParams(location.search).has('portraits')) {
  // Development sheet: every portrait, in both palettes, closed and talking.
  const sheet = document.createElement('div');
  sheet.style.cssText = 'position:fixed;inset:0;z-index:99;overflow:auto;background:#1d1611;display:flex;flex-wrap:wrap;gap:12px;padding:12px';
  for (const theme of ['vase', 'marble'] as const) {
    for (const id of PORTRAIT_IDS) {
      for (const open of [false, true]) {
        const c = portrait(id, theme, open);
        c.style.cssText = 'width:216px;height:216px;image-rendering:pixelated';
        c.title = id;
        sheet.append(c);
      }
    }
  }
  document.body.append(sheet);
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
