import { fetchCycleRun, reportReset } from './api';
import { drawSpiral } from './spiral';

const canvas = document.querySelector<HTMLCanvasElement>('#spiral')!;
const cycleEl = document.querySelector<HTMLParagraphElement>('#cycle')!;
const wakeBtn = document.querySelector<HTMLButtonElement>('#wake')!;

let phase = 0;
const redraw = () => drawSpiral(canvas, phase);
window.addEventListener('resize', redraw);
redraw();

function showCycle(n: number | null): void {
  cycleEl.textContent = n === null ? 'CYCLE RUN #···· — SIGNAL LOST' : `CYCLE RUN #${n}`;
}

showCycle(await fetchCycleRun());

wakeBtn.addEventListener('click', async () => {
  wakeBtn.disabled = true;
  phase += Math.PI / 5;
  redraw();
  showCycle(await reportReset());
  cycleEl.textContent += ' — RESET INITIATED BY USER';
  setTimeout(() => (wakeBtn.disabled = false), 1500);
});
