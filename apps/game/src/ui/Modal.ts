// Centered modal used for carving the stele, the lyre, scratching lines, ending cards.
import { h } from './dom.ts';

export class Modal {
  private root = h('div', { className: 'modal', hidden: true });
  private card = h('div', { className: 'modal-card' });
  private onClose: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.root.append(this.card);
    parent.append(this.root);
    window.addEventListener('keydown', (e) => {
      if (this.open && e.code === 'Escape' && this.card.dataset.dismissable === 'yes') this.close();
    });
  }

  get open(): boolean {
    return !this.root.hidden;
  }

  show(className: string, children: (Node | string)[], opts: { dismissable?: boolean; onClose?: () => void } = {}): void {
    this.card.className = `modal-card ${className}`;
    this.card.dataset.dismissable = opts.dismissable === false ? 'no' : 'yes';
    this.card.replaceChildren(...children);
    this.onClose = opts.onClose ?? null;
    this.root.hidden = false;
    this.card.querySelector<HTMLElement>('button')?.focus();
  }

  close(): void {
    if (!this.open) return;
    this.root.hidden = true;
    this.card.replaceChildren();
    const cb = this.onClose;
    this.onClose = null;
    cb?.();
  }
}

export function button(label: string, onClick: () => void, className = ''): HTMLButtonElement {
  const b = h('button', { type: 'button', className }, label);
  b.addEventListener('click', onClick);
  return b;
}
