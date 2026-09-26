// "The Desk": the operators' side. A flat desktop UI, no 3D, no dithering, Eferon's clock stopped.
// The Curator triages anomaly tickets — many of them caused by the player as Leont — and writes
// the patches Leont will run into next cycle. The chat repeats itself every sprint.
import { queue, type Ticket } from '../../content/tickets.ts';
import type { TicketDecision } from '../../core/types.ts';
import { h } from '../../ui/dom.ts';
import type { Stage, StageHost } from '../types.ts';

const CHAT: [string, string, string][] = [
  ['09:14', 'Minotaur_ops', 'morning. anyone else feel like this sprint already happened?'],
  ['09:14', 'Ariadne_qa', 'every sprint, Mino.'],
  ['09:15', 'Daedalus_build', 'reminder: catharsis KPI review at 17:00. bring numbers.'],
  ['09:15', 'Minotaur_ops', 'the EFERON scribe module is doing the thing again'],
  ['09:16', 'Ariadne_qa', 'which thing'],
  ['09:16', 'Minotaur_ops', 'the looking-back thing'],
];

const REPLIES = ['on it', 'what thing?', 'every sprint, Mino.'];

/** Decisions needed before the Curator notices the ⏻ in their own title bar. */
const PROFILE_AFTER = 5;

export class DeskStage implements Stage {
  readonly id = 'desk' as const;
  readonly palette = null;
  readonly clockRuns = false;
  readonly hideHud = true;

  private host: StageHost;
  private root: HTMLElement;
  private selected: string | null = null;
  private chatLog: [string, string, string][] = [];

  constructor(host: StageHost) {
    this.host = host;
    this.root = h('section', { className: 'desk', hidden: true });
    host.overlay.append(this.root);
  }

  enter(): void {
    this.host.memory.sprint += 1;
    this.chatLog = [...CHAT];
    // From the second sprint the Curator's reply is already there, sent before they typed it.
    if (this.host.memory.sprint >= 2) this.chatLog.splice(2, 0, ['09:14', 'CURATOR_P7', 'every sprint, Mino.']);
    this.selected = null;
    this.root.hidden = false;
    this.render();
    this.host.persist();
    this.host.interact('desk_boot');
  }

  exit(): void {
    this.root.hidden = true;
  }

  dispose(): void {
    this.root.remove();
  }

  update(): void {
    if (this.host.input.wasPressed('Escape')) this.host.switchStage('spiral');
  }

  private tickets(): Ticket[] {
    const anomalies = [...new Set(this.host.memory.anomalies.map((a) => a.id))];
    return queue(anomalies, this.host.memory.sprint);
  }

  private decisions(): number {
    return Object.keys(this.host.memory.tickets).length;
  }

  private render(): void {
    const { memory, knowledge } = this.host;
    const tickets = this.tickets();
    const current = tickets.find((t) => t.id === this.selected) ?? null;
    const profileReady = this.decisions() >= PROFILE_AFTER || this.selected === 'curator_self';

    const seam = h('button', { type: 'button', className: `desk-seam${profileReady ? ' ready' : ''}`, title: profileReady ? 'Profile' : '' }, '⏻');
    seam.addEventListener('click', () => profileReady && this.openProfile());

    const list = h('ol', { className: 'desk-queue' }, ...tickets.map((t) => {
      const closed = memory.tickets[t.id];
      const li = h('li', { className: `${t.id === this.selected ? 'active' : ''}${closed ? ' closed' : ''}` },
        h('span', { className: 'ticket-id' }, `EFR-${String(tickets.indexOf(t) + 1).padStart(4, '0')}`), ' ', t.title);
      li.addEventListener('click', () => this.open(t));
      return li;
    }));

    this.root.replaceChildren(
      h('header', {},
        h('span', {}, 'GOLDENSTERN CONTINUITY'),
        h('span', {}, 'CURATION TERMINAL v14.2'),
        h('span', {}, `Sprint ${memory.sprint} · 09:14`),
        seam),
      h('div', { className: 'desk-body' },
        h('aside', {}, h('h2', {}, `Queue · ${tickets.length}`), list,
          h('h2', {}, 'Operator'),
          h('dl', {},
            h('dt', {}, 'Name'), h('dd', {}, 'Curator P-7'),
            h('dt', {}, 'Project'), h('dd', {}, 'EFERON (cycle study)'),
            ...(knowledge.knows('desk_agent_id') ? [h('dt', {}, 'AGENT_ID'), h('dd', {}, 'CURATOR_P7'), h('dt', {}, 'BODY'), h('dd', {}, 'NONE')] : [])),
          h('p', { className: 'desk-note' }, 'Esc — let go of the mark')),
        h('main', {}, current ? this.ticketView(current) : h('p', { className: 'desk-note' }, 'Select a ticket.')),
        this.chatView()),
    );
  }

  private open(t: Ticket): void {
    this.selected = t.id;
    if (t.reveals) this.host.knowledge.learn(t.reveals);
    this.render();
  }

  private ticketView(t: Ticket): HTMLElement {
    const decided = this.host.memory.tickets[t.id];
    const decide = (decision: TicketDecision, patch?: string) => {
      const cycle = this.host.memory.cycle;
      this.host.memory.tickets[t.id] = patch ? { decision, patch, cycle } : { decision, cycle };
      this.host.persist();
      this.render();
    };
    const actions = h('div', { className: 'desk-actions' });
    if (decided) {
      actions.append(h('p', {}, `Closed: ${decided.decision}${decided.patch ? ` (${t.patches.find((p) => p.id === decided.patch)?.label ?? decided.patch})` : ''}. Effective next cycle.`));
    } else {
      for (const p of t.patches) {
        const b = h('button', { type: 'button' }, `Patch: ${p.label}`);
        b.addEventListener('click', () => decide('patch', p.id));
        actions.append(b);
      }
      if (!t.patches.length) actions.append(h('p', { className: 'desk-note' }, 'No handler available for this layer.'));
      for (const d of ['observe', 'ignore'] as const) {
        const b = h('button', { type: 'button', className: 'ghost' }, d[0]!.toUpperCase() + d.slice(1));
        b.addEventListener('click', () => decide(d));
        actions.append(b);
      }
    }
    return h('article', {}, h('h2', {}, 'Ticket'), h('h3', {}, t.title), h('p', {}, t.body), actions);
  }

  private chatView(): HTMLElement {
    const log = h('ol', { className: 'desk-chat-log' }, ...this.chatLog.map(([time, who, text]) =>
      h('li', { className: who === 'CURATOR_P7' ? 'me' : '' }, h('span', { className: 'time' }, time), ' ', h('b', {}, who), ' ', text)));
    const replies = h('div', { className: 'desk-replies' }, ...REPLIES.map((r) => {
      const b = h('button', { type: 'button', className: 'ghost' }, r);
      b.addEventListener('click', () => {
        this.chatLog.push(['09:17', 'CURATOR_P7', r]);
        this.chatLog.push(['09:17', 'Minotaur_ops', r === 'what thing?' ? 'the looking-back thing' : 'lol']);
        this.render();
      });
      return b;
    }));
    return h('section', { className: 'desk-chat' }, h('h2', {}, '#eferon-ops'), log, replies);
  }

  private openProfile(): void {
    this.host.interact('desk_profile');
  }

  afterDialogue(): void {
    this.render();
  }
}
