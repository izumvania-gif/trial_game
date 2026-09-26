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
