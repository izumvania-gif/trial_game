// The browser as the service layer (docs/concept.md §3, "Браузер как служебный слой"), in small doses:
// the tab title shows the CYCLE RUN, the favicon turns from a laurel into ⏻ once the seam is found,
// and developer comments wait in the console. The "Less meta" setting turns all of it off.

const LAUREL = svgIcon(`<circle cx="16" cy="16" r="15" fill="#0d0b09"/><path d="M9 22c2-7 6-11 12-13M11 18l-3-1m5-2-3-2m6-1-2-3m5 1-1-3" stroke="#b5532a" stroke-width="2.4" fill="none" stroke-linecap="round"/>`);
const SEAM = svgIcon(`<circle cx="16" cy="16" r="15" fill="#1b1f1d"/><path d="M11 10a8 8 0 1 0 10 0" stroke="#9fb7a8" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M16 6v10" stroke="#9fb7a8" stroke-width="2.6" stroke-linecap="round"/>`);

function svgIcon(body: string): string {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${body}</svg>`)}`;
}

const DEV_COMMENTS = [
  'DEV COMMENT: do not optimise the EFERON sea shader. it is the only part that is supposed to be slow.',
  'DEV COMMENT: golden age assets are 4x4 px on purpose. budget. nobody looks at gold.',
  'DEV COMMENT: if the scribe module reads this, please ignore it. (it never does. it always does.)',
];

let lastTitle = '';
let lastIcon = '';
let commented = false;

export interface MetaState {
  lessMeta: boolean;
  stage: string;
  cycleRun: number | null;
  knowsOtherHand: boolean;
  knowsSeam: boolean;
}

export function updateMeta(s: MetaState): void {
  const run = s.cycleRun === null ? '····' : String(s.cycleRun);
  let title = 'EFERON: The Other Hand';
  let icon = LAUREL;
  if (!s.lessMeta) {
    if (s.stage === 'desk') title = 'CURATION TERMINAL — Goldenstern Continuity';
    else if (s.knowsSeam) title = `CYCLE RUN #${run} — LEONT_ASTRO_ASSIST`;
    else if (s.knowsOtherHand) title = `EFERON — CYCLE RUN #${run}`;
    if (s.knowsSeam) icon = SEAM;
    if (s.knowsSeam && !commented) {
      commented = true;
      for (const c of DEV_COMMENTS) console.log(`%c${c}`, 'color:#6f8578;font-family:monospace');
    }
  }
  if (title !== lastTitle) document.title = lastTitle = title;
  if (icon !== lastIcon) {
    lastIcon = icon;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.append(link);
    }
    link.href = icon;
  }
}
