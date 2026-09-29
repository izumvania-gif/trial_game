// The settings panel, reachable from the title screen and with O in the game.
import type { Settings, SettingsStore } from '../core/settings.ts';
import { h } from './dom.ts';

export class SettingsPanel {
  private root = h('div', { className: 'settings', hidden: true });
  private store: SettingsStore;

  constructor(parent: HTMLElement, store: SettingsStore) {
    this.store = store;
    parent.append(this.root);
    window.addEventListener('keydown', (e) => {
      if (this.open && (e.code === 'Escape' || e.code === 'KeyO')) {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
    }, true);
  }

  get open(): boolean {
    return !this.root.hidden;
  }

  toggle(): void {
    if (this.open) this.close();
    else this.show();
  }

  show(): void {
    this.render();
    this.root.hidden = false;
  }

  close(): void {
    this.root.hidden = true;
  }

  private render(): void {
    const s = this.store.value;
    const slider = (key: 'master' | 'music' | 'sfx', label: string) => {
      const input = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(s[key]) });
      input.addEventListener('input', () => this.store.update({ [key]: Number(input.value) } as Partial<Settings>));
      return h('label', { className: 'setting' }, h('span', {}, label), input);
    };
    const toggle = (key: 'subtitles' | 'largeText' | 'noRhythm' | 'reducedMotion' | 'lessMeta' | 'tips' | 'pilgrim', label: string, note: string) => {
      const input = h('input', { type: 'checkbox', checked: s[key] });
      input.addEventListener('change', () => this.store.update({ [key]: input.checked } as Partial<Settings>));
      return h('label', { className: 'setting' }, input, h('span', {}, label, h('small', {}, note)));
    };
    const choice = <K extends 'dayMinutes' | 'quality'>(key: K, label: string, options: [Settings[K], string][]) => {
      const select = h('select', {}, ...options.map(([v, text]) => h('option', { value: String(v), selected: s[key] === v }, text)));
      select.addEventListener('change', () => {
        const raw = select.value;
        this.store.update({ [key]: key === 'dayMinutes' ? Number(raw) : raw } as Partial<Settings>);
      });
      return h('label', { className: 'setting' }, h('span', {}, label), select);
    };
    const close = h('button', { type: 'button' }, 'Close');
    close.addEventListener('click', () => this.close());
    this.root.replaceChildren(h('div', { className: 'settings-card' },
      h('h2', {}, 'Settings'),
      h('h3', {}, 'Sound'),
      slider('master', 'Volume'),
      slider('music', 'Music'),
      slider('sfx', 'Wind, sea and the world'),
      toggle('subtitles', 'Sound captions', ' — show what is heard, e.g. [the wind rises]'),
      h('h3', {}, 'Reading and playing'),
      toggle('tips', 'How-to cards and tips', ' — the first time in each place; H shows them again'),
      toggle('pilgrim', 'Pilgrim', ' — nothing points the way: no goal, no marks over places, no "Where next?", no hints. Find it yourself'),
      toggle('largeText', 'Large text', ''),
      toggle('noRhythm', 'Déjà vu without timing', ' — F at any moment finishes a line you have heard before'),
      toggle('reducedMotion', 'Reduce motion', ' — no rain streaks, no shaking, lines appear at once'),
      choice('dayMinutes', 'Length of the last day', [[18, '18 minutes'], [24, '24 minutes'], [30, '30 minutes']]),
      h('h3', {}, 'Picture'),
      choice('quality', 'Quality', [['auto', 'Automatic'], ['high', 'High'], ['low', 'Low (faster)']]),
      toggle('lessMeta', 'Less meta', ' — the service layer stays inside the game window'),
      h('p', { className: 'desk-note' }, 'O or Esc closes this panel.'),
      close,
    ));
  }
}
