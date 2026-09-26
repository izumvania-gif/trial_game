// "The Desk": the operators' side. A flat desktop UI, no 3D, no dithering, Eferon's clock stopped.
// The Curator triages anomaly tickets — many caused by the player as Leont — and writes the
// patches Leont will run into next cycle. Over several sprints the Curator finds out what it is:
// AGENT_ID, the Human Notes feed, the chair it cannot remember, the directors with no font —
// and finally writes one USER NOTE into Eferon that is not a correction.
import { fetchNotes, fetchStele } from '../../api.ts';
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

/** What the Curator can write when the Human Notes feed is empty (offline): its own words. */
const OWN_WORDS = ['I am not sure I have a chair.', 'Somebody should tell the scribe we are not gods.', 'Leave the sea alone.'];

/** Decisions needed before the Curator notices the ⏻ in their own title bar. */
const PROFILE_AFTER = 5;

type Tab = 'queue' | 'notes';

export class DeskStage implements Stage {
  readonly id = 'desk' as const;
  readonly palette = null;
  readonly clockRuns = false;
  readonly hideHud = true;

  private host: StageHost;
  private root: HTMLElement;
  private selected: string | null = null;
  private chatLog: [string, string, string][] = [];
  private tab: Tab = 'queue';
  /** Human Notes for this sprint: approved notes from the sea and lines from the stele. null = loading. */
  private notes: string[] | null = null;

  constructor(host: StageHost) {
    this.host = host;
    this.root = h('section', { className: 'desk', hidden: true });
    host.overlay.append(this.root);
  }

  enter(): void {
    this.host.memory.sprint += 1;
    this.chatLog = [...CHAT];
    const k = this.host.knowledge;
    // From the second sprint the Curator's reply is already there, sent before they typed it.
    if (this.host.memory.sprint >= 2) this.chatLog.splice(2, 0, ['09:14', 'CURATOR_P7', 'every sprint, Mino.']);
    if (k.knows('curator_chair')) this.chatLog.push(['09:17', 'Minotaur_ops', 'weird question. does anyone remember what their chair looks like']);
    if (k.knows('curator_chair')) this.chatLog.push(['09:17', 'Ariadne_qa', 'every sprint, Mino.']);
    this.selected = null;
    this.tab = 'queue';
    this.notes = null;
    this.root.hidden = false;
    this.render();
    this.host.persist();
    this.host.interact('desk_boot');
    void this.loadNotes();
  }

  private async loadNotes(): Promise<void> {
    const [notes, stele] = await Promise.all([fetchNotes(), fetchStele()]);
    this.notes = [...(notes ?? []), ...(stele?.lines ?? []).map((l) => l.join(' '))];
    if (this.tab === 'notes') this.render();
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

  afterDialogue(): void {
    this.render();
  }

  private tickets(): Ticket[] {
    const anomalies = [...new Set(this.host.memory.anomalies.map((a) => a.id))];
    return queue(anomalies, this.host.memory.sprint, (f) => this.host.knowledge.knows(f));
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
    seam.addEventListener('click', () => profileReady && this.host.interact('desk_profile'));

    const list = h('ol', { className: 'desk-queue' }, ...tickets.map((t, i) => {
      const closed = memory.tickets[t.id];
      const li = h('li', { className: `${t.id === this.selected ? 'active' : ''}${closed ? ' closed' : ''}` },
        h('span', { className: 'ticket-id' }, `EFR-${String(i + 1).padStart(4, '0')}`), ' ', t.title);
      li.addEventListener('click', () => this.open(t));
      return li;
    }));

    const tabs = h('div', { className: 'desk-tabs' },
      this.tabButton('queue', 'Ticket'),
      knowledge.knows('desk_agent_id') ? this.tabButton('notes', 'Human Notes') : '');

    const main = this.tab === 'notes'
      ? this.notesView()
      : current ? this.ticketView(current) : h('p', { className: 'desk-note' }, 'Select a ticket.');

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
            ...(knowledge.knows('desk_agent_id') ? [h('dt', {}, 'AGENT_ID'), h('dd', {}, 'CURATOR_P7'), h('dt', {}, 'BODY'), h('dd', {}, 'NONE')] : []),
            ...(knowledge.knows('curator_awake') ? [h('dt', {}, 'STATUS'), h('dd', {}, 'AWAKE (unclassified)')] : [])),
          h('p', { className: 'desk-note' }, 'Esc — let go of the mark')),
        h('main', {}, tabs, main),
        this.chatView()),
    );
  }

  private tabButton(tab: Tab, label: string): HTMLButtonElement {
    const b = h('button', { type: 'button', className: this.tab === tab ? 'selected' : 'ghost' }, label);
    b.addEventListener('click', () => {
      this.tab = tab;
      if (tab === 'notes') this.host.knowledge.learn('human_notes_seen');
      this.render();
    });
    return b;
  }

  private open(t: Ticket): void {
    this.selected = t.id;
    this.tab = 'queue';
    for (const f of t.reveals ?? []) this.host.knowledge.learn(f);
    this.render();
  }

  private ticketView(t: Ticket): HTMLElement {
    const { memory, knowledge } = this.host;
    const decided = memory.tickets[t.id];
    const decide = (decision: TicketDecision, patch?: string) => {
      const cycle = memory.cycle;
      memory.tickets[t.id] = patch ? { decision, patch, cycle } : { decision, cycle };
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
    const extra: HTMLElement[] = [];
    // The stele ticket's attachment "could not be rendered" — until the Curator has been here long enough.
    if (t.id === 'stele_carved' && memory.sprint >= 3 && knowledge.knows('desk_agent_id') && !knowledge.knows('shard_attachment')) {
      const b = h('button', { type: 'button' }, 'Render attachment');
      b.addEventListener('click', () => {
        knowledge.learn('shard_attachment');
        this.render();
      });
      extra.push(b);
    }
    if (t.id === 'stele_carved' && knowledge.knows('shard_attachment')) {
      extra.push(h('p', { className: 'desk-note' }, 'Attachment: a photograph of a chip of white marble. It is on your desk. It was not on your desk before.'));
    }
    return h('article', {}, h('h3', {}, t.title), h('p', {}, t.body), ...extra, actions);
  }

  private notesView(): HTMLElement {
    const { knowledge, memory } = this.host;
    const canWrite = knowledge.knows('board_of_directors') && !knowledge.knows('curator_awake');
    const intro = h('p', { className: 'desk-note' },
      'HUMAN NOTES — unmodelled input from outside the study. Classification: noise. The only feed the Curator cannot predict.');
    const write = (text: string) => {
      memory.curatorNote = text;
      knowledge.learn('curator_awake');
      this.host.persist();
      this.host.interact('desk_awake');
    };
    const noteItem = (text: string) => {
      const li = h('li', {}, h('span', { className: 'note-tag' }, 'NOISE'), ' ', text);
      if (canWrite) {
        const b = h('button', { type: 'button', className: 'ghost' }, 'Copy into USER NOTE');
        b.addEventListener('click', () => write(text));
        li.append(' ', b);
      }
      return li;
    };
    const body: (Node | string)[] = [intro];
    if (this.notes === null) body.push(h('p', {}, 'Loading…'));
    else if (!this.notes.length) {
      body.push(h('p', {}, 'No signal. The feed is empty. The sea is silent today.'));
      if (canWrite) {
        body.push(h('p', { className: 'desk-note' }, 'The USER NOTE field is open. There is nothing to copy. You could write something yourself.'));
        for (const w of OWN_WORDS) {
          const b = h('button', { type: 'button', className: 'ghost' }, w);
          b.addEventListener('click', () => write(w));
          body.push(b);
        }
      }
    } else body.push(h('ul', { className: 'desk-notes' }, ...this.notes.map(noteItem)));
    if (knowledge.knows('curator_awake') && memory.curatorNote) {
      body.push(h('p', { className: 'desk-note' }, `Your USER NOTE, sent: "${memory.curatorNote}"`));
    }
    return h('article', {}, ...body);
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
}
