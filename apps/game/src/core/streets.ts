// The street graph of Eferon: residents walk it between the places in their schedules.

export interface Point {
  x: number;
  z: number;
}

export type Place =
  | 'temple' | 'stele' | 'center' | 'agora' | 'council' | 'westLane' | 'aristion' | 'eastLane'
  | 'shrine' | 'south' | 'port' | 'tavern' | 'shore' | 'northEast' | 'mountain';

export const PLACES: Record<Place, Point> = {
  temple: { x: 0, z: -12.5 },
  stele: { x: -3.2, z: -9 },
  center: { x: 0, z: 0 },
  agora: { x: 7.5, z: 1.5 },
  council: { x: 10.2, z: 0.6 },
  westLane: { x: -8, z: -3.5 },
  aristion: { x: -13.5, z: -5.2 },
  eastLane: { x: 14, z: -3 },
  shrine: { x: 18, z: -8.5 },
  south: { x: 0, z: 11 },
  port: { x: -6, z: 14 },
  tavern: { x: -11.5, z: 13 },
  shore: { x: 0, z: 19.5 },
  northEast: { x: 9, z: -12 },
  mountain: { x: 10, z: -23 },
};

const EDGES: [Place, Place][] = [
  ['temple', 'stele'], ['temple', 'center'], ['temple', 'northEast'], ['northEast', 'mountain'],
  ['northEast', 'eastLane'], ['stele', 'westLane'], ['center', 'westLane'], ['westLane', 'aristion'],
  ['center', 'agora'], ['agora', 'council'], ['agora', 'eastLane'], ['eastLane', 'shrine'],
  ['center', 'south'], ['south', 'port'], ['port', 'tavern'], ['south', 'shore'],
];

export const STREET_EDGES = EDGES;

const neighbours = new Map<Place, Place[]>();
for (const [a, b] of EDGES) {
  neighbours.set(a, [...(neighbours.get(a) ?? []), b]);
  neighbours.set(b, [...(neighbours.get(b) ?? []), a]);
}

/** Fewest-hops route between two places (the graph is small and nearly a tree). */
export function route(from: Place, to: Place): Point[] {
  const prev = new Map<Place, Place | null>([[from, null]]);
  const queue: Place[] = [from];
  while (queue.length) {
    const p = queue.shift()!;
    if (p === to) break;
    for (const n of neighbours.get(p) ?? []) {
      if (!prev.has(n)) {
        prev.set(n, p);
        queue.push(n);
      }
    }
  }
  const path: Point[] = [];
  for (let p: Place | null | undefined = to; p; p = prev.get(p)) path.unshift(PLACES[p]);
  return path;
}

export function pathLength(path: Point[]): number {
  let len = 0;
  for (let i = 1; i < path.length; i++) len += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.z - path[i - 1]!.z);
  return len;
}

/** Point `dist` units along the path, and the heading there. */
export function alongPath(path: Point[], dist: number): { x: number; z: number; heading: number } {
  let left = dist;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const seg = Math.hypot(b.x - a.x, b.z - a.z);
    const heading = Math.atan2(b.x - a.x, b.z - a.z);
    if (left <= seg || i === path.length - 1) {
      const t = seg === 0 ? 1 : Math.min(1, left / seg);
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, heading };
    }
    left -= seg;
  }
  const last = path[path.length - 1] ?? { x: 0, z: 0 };
  return { x: last.x, z: last.z, heading: 0 };
}

/** Distance from a point to the nearest street, used to keep the streets free of houses. */
export function distanceToStreets(x: number, z: number): number {
  let best = Infinity;
  for (const [ea, eb] of EDGES) {
    const a = PLACES[ea];
    const b = PLACES[eb];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)));
  }
  return best;
}
