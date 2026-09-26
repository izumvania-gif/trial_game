import assert from 'node:assert/strict';
import { test } from 'node:test';
import { noteAt, PIECES, pieceSeconds } from '../src/engine/music.ts';

test('every piece is long, stays in the lyre range and changes as it goes', () => {
  for (const [name, piece] of Object.entries(PIECES)) {
    assert.ok(pieceSeconds(piece) >= 45, `${name}: one pass is ${pieceSeconds(piece).toFixed(0)} s`);
    const bars = new Set<string>();
    const barCount = Math.round((pieceSeconds(piece) * 2) / (piece.step * piece.stepsPerBar));
    for (let bar = 0; bar < barCount; bar++) {
      const notes = Array.from({ length: piece.stepsPerBar }, (_, i) => noteAt(piece, bar * piece.stepsPerBar + i));
      for (const n of notes) {
        if (n.melody !== null) assert.ok(n.melody >= -24 && n.melody <= 36, `${name}: melody ${n.melody}`);
        if (n.bass !== null) assert.ok(n.bass >= -36 && n.bass <= 0, `${name}: bass ${n.bass}`);
      }
      bars.add(notes.map((n) => n.melody ?? '·').join(','));
    }
    assert.ok(bars.size >= 16, `${name}: only ${bars.size} different bars in two passes`);
    // The second pass is not a copy of the first.
    const pass = Math.round(pieceSeconds(piece) / piece.step);
    let same = 0;
    for (let i = 0; i < pass; i++) if (noteAt(piece, i).melody === noteAt(piece, i + pass).melody) same++;
    assert.ok(same < pass, `${name}: the second pass repeats the first exactly`);
  }
});

test('the music is the same every time it is played from the same step', () => {
  for (const piece of Object.values(PIECES)) for (let i = 0; i < 200; i += 7) assert.deepEqual(noteAt(piece, i), noteAt(piece, i));
});
