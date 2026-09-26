// "The Desk": the operators' side. A flat desktop UI, no 3D, no dithering, Eferon's clock stopped.
// Milestone 1 slice: the terminal shell and the first ticket; the story knot writes into its log.
import type { Stage, StageHost } from '../types.ts';

export class DeskStage implements Stage {
  readonly id = 'desk' as const;
  readonly palette = null;
  readonly clockRuns = false;
  readonly hideHud = true;

  private host: StageHost;
  private root: HTMLElement;

  constructor(host: StageHost, overlay: HTMLElement) {
    this.host = host;
    this.root = document.createElement('section');
    this.root.className = 'desk';
    this.root.hidden = true;
    overlay.append(this.root);
  }

  enter(): void {
    const k = this.host.knowledge;
    this.root.innerHTML = `
      <header><span>GOLDENSTERN CONTINUITY</span><span>CURATION TERMINAL v14.2</span><span class="desk-seam" title="">&#x23FB;</span></header>
      <div class="desk-body">
        <aside>
          <h2>Queue</h2>
          <ol>
            <li class="active">EFERON-A-0001 · anomaly · scribe module</li>
          </ol>
          <h2>Agent</h2>
          <dl>
            <dt>Operator</dt><dd>Curator P-7</dd>
            <dt>Shift</dt><dd>Sprint 1, day 1</dd>
            ${k.knows('desk_agent_id') ? '<dt>AGENT_ID</dt><dd>CURATOR_P7</dd><dt>BODY</dt><dd>NONE</dd>' : ''}
          </dl>
        </aside>
        <main>
          <h2>Ticket</h2>
          <p>Module LEONT_ASTRO_ASSIST accessed the archive interface (Hall of Anamnesis) outside ritual schedule.</p>
          <p>Recommended action: <em>patch</em>. Alternatives: <em>observe</em>, <em>ignore</em>.</p>
          <p class="desk-note">Patch tools arrive in a later sprint. Press Esc to let go of the mark.</p>
        </main>
      </div>`;
    this.root.hidden = false;
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
}
