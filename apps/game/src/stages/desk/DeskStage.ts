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

/** The office going on around the Curator: said now and then while the Desk is open. */
const OFFICE: [string, string][] = [
  ['Daedalus_build', 'build 14.2.7 is green. build 14.2.7 was green yesterday too'],
  ['Ariadne_qa', 'anyone else seeing the scribe tickets spike'],
  ['Minotaur_ops', 'brb coffee'],
  ['Daedalus_build', 'who keeps opening the window in the EFERON room. there is no window'],
  ['Ariadne_qa', 'the 17:00 review has been moved to 17:00'],
  ['Minotaur_ops', 'back. the coffee machine said the same thing as yesterday'],
  ['Ariadne_qa', 'reminder: do not talk to the processes'],
  ['Daedalus_build', 'if the sea layer throws again just leave it. it always throws'],
];

/** Someone starts typing and then does not send anything. */
const TYPERS = ['Minotaur_ops', 'Ariadne_qa', 'Daedalus_build'];


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
  /** The office's own clock: when the next line is said, who is typing. */
  private officeAt = 0;
  private officeNext = 0;
  private officeIndex = 0;
  private typing: { who: string; left: number; sends: boolean; keyAt: number } | null = null;
  private typingEl: HTMLElement | null = null;

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
    this.officeAt = 0;
    this.officeNext = 12;
    this.typing = null;
    this.root.hidden = false;
    this.render();
    // The queue comes in one ticket after another, and the chime says there is work.
    this.root.classList.remove('arriving');
    void this.root.offsetWidth;
    this.root.classList.add('arriving');
    // Only on arrival: later redraws (a chat line, a decision) must not replay it.
    window.setTimeout(() => this.root.classList.remove('arriving'), 1200);
    if (this.tickets().some((t) => !this.host.memory.tickets[t.id])) window.setTimeout(() => this.host.sound('ticket'), 700);
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

  update(dt: number): void {
    if (this.host.input.wasPressed('Escape')) this.host.switchStage('spiral');
    this.office(dt);
  }

  /** Every so often someone types; mostly they say something, sometimes they stop and send nothing. */
  private office(dt: number): void {
    this.officeAt += dt;
    const t = this.typing;
    if (t) {
      t.left -= dt;
      t.keyAt -= dt;
      if (t.keyAt <= 0) {
        this.host.sound('key');
        t.keyAt = 0.06 + Math.random() * 0.16;
      }
      if (t.left <= 0) {
        this.typing = null;
        if (t.sends) {
          const line = OFFICE[this.officeIndex++ % OFFICE.length]!;
          this.chatLog.push(['09:17', line[0], line[1]]);
          this.render();
        }
        this.officeNext = this.officeAt + 14 + Math.random() * 22;
      }
    } else if (this.officeAt >= this.officeNext) {
      const sends = Math.random() < 0.75;
      const who = sends ? OFFICE[this.officeIndex % OFFICE.length]![0] : TYPERS[Math.floor(Math.random() * TYPERS.length)]!;
      this.typing = { who, left: 1.8 + Math.random() * 2.5, sends, keyAt: 0 };
    }
    if (this.typingEl) this.typingEl.textContent = this.typing ? `${this.typing.who} is typing…` : '';
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

    const feed = this.host.lastFrame();
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
          h('p', { className: 'desk-note' }, 'Esc — let go of the mark'),
          // The module under study, as the Curator sees it: the frame Leont was standing in.
          ...(feed ? [h('figure', { className: 'desk-feed' }, h('img', { src: feed, alt: 'Eferon, the last frame before you looked up' }),
            h('figcaption', {}, 'MODULE FEED · LEONT_ASTRO_ASSIST · paused'))] : []),
          // A window onto a morning that does not move.
          h('div', { className: 'desk-window', ariaHidden: 'true' }),
          h('p', { className: 'desk-weather' }, 'Outside: 21°C, overcast. Updated 09:14.')),
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
    // The field opens on a later day than the minutes were read: the Curator needs a night between
    // seeing that nobody is above it and doing something nobody asked for.
    const directorsSeen = knowledge.knows('board_of_directors') && !knowledge.knows('curator_awake');
    const canWrite = directorsSeen && (memory.learnedOn['board_of_directors'] ?? -Infinity) < memory.cycle;
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
    if (directorsSeen && !canWrite) {
      body.push(h('p', { className: 'desk-note' }, 'USER NOTE: field locked. PERMISSION REQUEST FILED WITH: ________. Estimated review: tomorrow’s sprint.'));
    }
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
    this.typingEl = h('p', { className: 'desk-typing' }, this.typing ? `${this.typing.who} is typing…` : '');
    return h('section', { className: 'desk-chat' }, h('h2', {}, '#eferon-ops'), log, this.typingEl, replies);
  }
}
