// The knowledge graph: what the player can learn, where, and what that knowledge unlocks.
// Progress in Eferon is knowledge only, so the graph *is* the progression. CI proves every
// fact and ending is reachable (test/knowledge.test.ts) so content edits can't create dead ends.
import type { StageId } from './types.ts';

export interface Fact {
  id: string;
  /** How the fact reads in the chronicle. */
  text: string;
}

/** A place or action that teaches facts, available once `requires` are all known. */
export interface Source {
  id: string;
  stage: StageId;
  requires: string[];
  gives: string[];
}

export interface Ending {
  id: string;
  title: string;
  requires: string[];
  /** True-ending gates are also the long path; flagged for balancing reports. */
  trueEnding?: boolean;
}

export interface KnowledgeGraph {
  facts: Fact[];
  sources: Source[];
  endings: Ending[];
}

export interface GraphReport {
  errors: string[];
  /** Facts reachable from an empty memory, in the order a greedy player would learn them. */
  reachable: string[];
}

/** Checks references and reachability by running sources to a fixpoint from zero knowledge. */
export function validateGraph(graph: KnowledgeGraph): GraphReport {
  const errors: string[] = [];
  const factIds = new Set<string>();
  for (const f of graph.facts) {
    if (factIds.has(f.id)) errors.push(`duplicate fact "${f.id}"`);
    factIds.add(f.id);
  }
  const check = (owner: string, ids: string[]) => {
    for (const id of ids) if (!factIds.has(id)) errors.push(`${owner} references unknown fact "${id}"`);
  };
  for (const s of graph.sources) {
    check(`source "${s.id}"`, [...s.requires, ...s.gives]);
    if (s.gives.length === 0) errors.push(`source "${s.id}" gives nothing`);
  }
  for (const e of graph.endings) check(`ending "${e.id}"`, e.requires);

  const known = new Set<string>();
  const order: string[] = [];
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const s of graph.sources) {
      if (!s.requires.every((r) => known.has(r))) continue;
      for (const g of s.gives) {
        if (!known.has(g)) {
          known.add(g);
          order.push(g);
          progressed = true;
        }
      }
    }
  }
  for (const f of graph.facts) if (!known.has(f.id)) errors.push(`fact "${f.id}" is unreachable`);
  for (const e of graph.endings) {
    const missing = e.requires.filter((r) => !known.has(r));
    if (missing.length) errors.push(`ending "${e.id}" is unreachable (missing ${missing.join(', ')})`);
  }
  return { errors, reachable: order };
}

/** Runtime view over the player's known facts. */
export class Knowledge {
  private known: Set<string>;
  private graph: KnowledgeGraph;
  private onLearn: (fact: Fact) => void;

  constructor(graph: KnowledgeGraph, facts: Iterable<string>, onLearn: (fact: Fact) => void = () => {}) {
    this.graph = graph;
    this.known = new Set(facts);
    this.onLearn = onLearn;
  }

  knows(id: string): boolean {
    return this.known.has(id);
  }

  /** Returns true if the fact is new. Unknown ids throw: they mean the story and graph disagree. */
  learn(id: string): boolean {
    const fact = this.graph.facts.find((f) => f.id === id);
    if (!fact) throw new Error(`Unknown fact "${id}"`);
    if (this.known.has(id)) return false;
    this.known.add(id);
    this.onLearn(fact);
    return true;
  }

  /** Replace all known facts (loading a different save). No onLearn events. */
  reset(facts: Iterable<string>): void {
    this.known = new Set(facts);
  }

  list(): string[] {
    return [...this.known];
  }

  endingsAvailable(): Ending[] {
    return this.graph.endings.filter((e) => e.requires.every((r) => this.known.has(r)));
  }
}
