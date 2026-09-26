// ?debug in the URL: time controls, stage jumps, save tools. Not part of the game.
import { DAY_MINUTES } from '../core/clock.ts';
import { clearSave, exportTablet, browserStorage } from '../core/save.ts';
import { STAGE_IDS } from '../core/types.ts';
import type { Game } from '../game.ts';
import { h } from './dom.ts';

export function mountDebugPanel(game: Game, parent: HTMLElement): void {
  const btn = (label: string, fn: () => void) => {
    const b = h('button', { type: 'button' }, label);
    b.addEventListener('click', (e) => {
      fn();
      (e.currentTarget as HTMLButtonElement).blur();
    });
    return b;
  };
  const status = h('pre', {});
  const panel = h('div', { className: 'debug' },
    h('strong', {}, 'debug'),
    h('div', {}, ...[1, 20, 120].map((s) => btn(`×${s}`, () => game.debugSetSpeed(s)))),
    h('div', {}, btn('23:58', () => game.debugJump(DAY_MINUTES - 2)), btn('prep night', () => game.debugPrepareNight()), btn('prep true', () => game.debugPrepareTrue())),
    h('div', {}, ...STAGE_IDS.map((id) => btn(id, () => game.debugStage(id)))),
    h('div', {},
      btn('export', () => window.prompt('Wax tablet code', exportTablet(game.save))),
      btn('wipe save', () => {
        clearSave(browserStorage());
        location.reload();
      })),
    status,
  );
  parent.append(panel);
  setInterval(() => {
    status.textContent = [
      `day ${game.save.memory.cycle} · ${game.clock.label()} · ×${game.clock.speed}`,
      `facts ${game.save.memory.facts.length}`,
      `quality ${game.qualityLabel}`,
      game.saveBlocked ? 'SAVE BLOCKED' : 'saved',
    ].join('\n');
  }, 250);
}
