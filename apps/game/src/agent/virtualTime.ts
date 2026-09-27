// Agent mode runs on its own clock: nothing moves until the agent acts. performance.now,
// requestAnimationFrame and the timers are replaced by a virtual clock that `advance` moves
// forward, so the game is turn-based for an agent and exactly reproducible, however slowly the
// machine running it renders. Installed before the game is built (see main.ts).

export interface VirtualTime {
  /** Move the clock forward by `ms`, running due timers and one animation frame at the end. */
  advance(ms: number): void;
  now(): number;
  /** Let the browser breathe (promises, network) without moving the virtual clock. */
  yieldReal(): Promise<void>;
}

export function installVirtualTime(): VirtualTime {
  let now = 1000;
  let nextId = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const timers: { id: number; due: number; every?: number; fn: () => void }[] = [];
  const w = window as unknown as Record<string, unknown>;
  const channel = new MessageChannel();
  const waiting: (() => void)[] = [];
  channel.port1.onmessage = () => waiting.shift()?.();
  performance.now = () => now;
  w.requestAnimationFrame = (cb: FrameRequestCallback) => {
    frames.set(++nextId, cb);
    return nextId;
  };
  w.cancelAnimationFrame = (id: number) => void frames.delete(id);
  w.setTimeout = (fn: TimerHandler, ms = 0, ...args: unknown[]) => {
    timers.push({ id: ++nextId, due: now + (Number(ms) || 0), fn: () => (typeof fn === 'function' ? fn(...args) : undefined) });
    return nextId;
  };
  w.setInterval = (fn: TimerHandler, ms = 0, ...args: unknown[]) => {
    const every = Math.max(1, Number(ms) || 1);
    timers.push({ id: ++nextId, due: now + every, every, fn: () => (typeof fn === 'function' ? fn(...args) : undefined) });
    return nextId;
  };
  w.clearTimeout = w.clearInterval = (id: number) => {
    const i = timers.findIndex((t) => t.id === id);
    if (i >= 0) timers.splice(i, 1);
  };
  return {
    now: () => now,
    yieldReal: () => new Promise<void>((resolve) => {
      waiting.push(resolve);
      channel.port2.postMessage(0);
    }),
    advance(ms: number) {
      const end = now + ms;
      for (let guard = 0; guard < 20000; guard++) {
        timers.sort((a, b) => a.due - b.due);
        const t = timers[0];
        if (!t || t.due > end) break;
        now = Math.max(now, t.due);
        if (t.every) t.due += t.every;
        else timers.shift();
        try {
          t.fn();
        } catch (e) {
          console.error(e);
        }
      }
      now = end;
      const due = [...frames.values()];
      frames.clear();
      for (const cb of due) {
        try {
          cb(now);
        } catch (e) {
          console.error(e);
        }
      }
    },
  };
}
