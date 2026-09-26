import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/** The cycle number shown before any player has reset: the prologue is CYCLE RUN #1472. */
export const CYCLE_RUN_FIRST = 1472;

export interface Store {
  getCycleRun(): number;
  recordReset(): number;
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
  `);

  const select = db.prepare(`SELECT value FROM counters WHERE name = 'resets'`);
  const increment = db.prepare(
    `UPDATE counters SET value = value + 1 WHERE name = 'resets' RETURNING value`,
  );

  return {
    getCycleRun: () => CYCLE_RUN_FIRST + Number((select.get() as { value: number }).value),
    recordReset: () => CYCLE_RUN_FIRST + Number((increment.get() as { value: number }).value),
    close: () => db.close(),
  };
}
