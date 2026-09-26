import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/** The cycle number shown before any player has reset: the prologue is CYCLE RUN #1472. */
export const CYCLE_RUN_FIRST = 1472;

export interface Store {
  getCycleRun(): number;
  recordReset(): number;
  addSteleLine(words: string[]): void;
  /** Up to `n` random lines, newest-biased. */
  randomSteleLines(n: number): string[][];
  close(): void;
}

/** Opens (or creates) the SQLite database. Pass ':memory:' for tests. */
export function openStore(dataDir: string | ':memory:'): Store {
  let path = ':memory:';
  if (dataDir !== ':memory:') {
    mkdirSync(dataDir, { recursive: true });
    path = join(dataDir, 'eferon.sqlite');
  }
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS counters (
      name  TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    );
    INSERT OR IGNORE INTO counters (name, value) VALUES ('resets', 0);
    CREATE TABLE IF NOT EXISTS stele_lines (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      words      TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  const select = db.prepare(`SELECT value FROM counters WHERE name = 'resets'`);
  const increment = db.prepare(
    `UPDATE counters SET value = value + 1 WHERE name = 'resets' RETURNING value`,
  );

  const insertLine = db.prepare(`INSERT INTO stele_lines (words, created_at) VALUES (?, ?)`);
  // Sample from the most recent thousand lines so old ones slowly weather away.
  const sampleLines = db.prepare(`
    SELECT words FROM (SELECT words FROM stele_lines ORDER BY id DESC LIMIT 1000)
    ORDER BY random() LIMIT ?`);

  return {
    addSteleLine: (words) => void insertLine.run(JSON.stringify(words), Date.now()),
    randomSteleLines: (n) => (sampleLines.all(n) as { words: string }[]).map((r) => JSON.parse(r.words) as string[]),
    getCycleRun: () => CYCLE_RUN_FIRST + Number((select.get() as { value: number }).value),
    recordReset: () => CYCLE_RUN_FIRST + Number((increment.get() as { value: number }).value),
    close: () => db.close(),
  };
}
