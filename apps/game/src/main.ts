import storyJson from '../../../story/main.ink';
import { fetchCycleRun } from './api.ts';
import { Game } from './game.ts';
import { drawSpiral } from './spiral.ts';
import { mountDebugPanel } from './ui/DebugPanel.ts';

const title = document.querySelector<HTMLElement>('#title')!;
const titleCanvas = document.querySelector<HTMLCanvasElement>('#spiral')!;
const cycleEl = document.querySelector<HTMLParagraphElement>('#cycle')!;
const wakeBtn = document.querySelector<HTMLButtonElement>('#wake')!;
const view = document.querySelector<HTMLCanvasElement>('#view')!;
const overlay = document.querySelector<HTMLElement>('#overlay')!;

const redrawTitle = () => drawSpiral(titleCanvas, 0);
window.addEventListener('resize', redrawTitle);
redrawTitle();

const game = new Game(view, overlay, storyJson);
if (new URLSearchParams(location.search).has('debug')) {
  mountDebugPanel(game, document.body);
  (window as unknown as { eferon: Game }).eferon = game;
}

void fetchCycleRun().then((run) => {
  if (run !== null) game.cycleRun = run;
  const shown = run ?? game.cycleRun;
  cycleEl.textContent = shown === null ? 'CYCLE RUN #···· — SIGNAL LOST' : `CYCLE RUN #${shown}`;
});

wakeBtn.addEventListener('click', () => {
  window.removeEventListener('resize', redrawTitle);
  title.remove();
  game.start();
}, { once: true });
