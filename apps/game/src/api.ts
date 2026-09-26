export interface CounterResponse {
  cycleRun: number;
}

export async function fetchCycleRun(): Promise<number | null> {
  try {
    const res = await fetch('/api/counter');
    if (!res.ok) return null;
    return ((await res.json()) as CounterResponse).cycleRun;
  } catch {
    // The game must keep working offline: "the sea is silent".
    return null;
  }
}

export async function reportReset(): Promise<number | null> {
  try {
    const res = await fetch('/api/counter/reset', { method: 'POST' });
    if (!res.ok && res.status !== 429) return null;
    return ((await res.json()) as CounterResponse).cycleRun;
  } catch {
    return null;
  }
}

export interface SteleResponse {
  words: string[];
  maxWords: number;
  lines: string[][];
}

export async function fetchStele(): Promise<SteleResponse | null> {
  try {
    const res = await fetch('/api/stele');
    return res.ok ? ((await res.json()) as SteleResponse) : null;
  } catch {
    return null;
  }
}

/** Returns 'ok', 'wait' (cooldown) or null (offline / rejected). */
export async function scratchLine(words: string[]): Promise<'ok' | 'wait' | null> {
  try {
    const res = await fetch('/api/stele', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ words }),
    });
    if (res.status === 429) return 'wait';
    return res.ok ? 'ok' : null;
  } catch {
    return null;
  }
}
