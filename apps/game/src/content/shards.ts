// The twelve shards of the spiral (the heart pieces of Eferon). They are hidden in every genre
// of the game; every four of them teach one new word for the stele. Each shard is a fact.
export interface Shard {
  fact: string;
  where: 'town' | 'registry' | 'desk' | 'relief' | 'board';
  text: string;
}

export const SHARDS: Shard[] = [
  { fact: 'shard_well', where: 'town', text: 'A chip of white marble at the bottom of the well, visible only when the noon sun stands straight over it.' },
  { fact: 'shard_tavern', where: 'town', text: 'A chip of white marble under the table where Eion sleeps, once he has gone down to the sea.' },
  { fact: 'shard_path', where: 'town', text: 'A chip of white marble among the stones of the mountain path, the hour before the procession.' },
  { fact: 'shard_aristion', where: 'town', text: 'A chip of white marble that Aristion clutches in his fever and gives only to someone he trusts.' },
  { fact: 'shard_registry_18', where: 'registry', text: 'A chip that fell out of the spiral when eighteen of us were read correctly.' },
  { fact: 'shard_registry_24', where: 'registry', text: 'A chip that fell out of the spiral when twenty-four of us were read correctly.' },
  { fact: 'shard_registry_30', where: 'registry', text: 'A chip that fell out of the spiral when thirty of us were read correctly.' },
  { fact: 'shard_registry_36', where: 'registry', text: 'The last chip of the spiral, when every one of us had a name.' },
  { fact: 'shard_attachment', where: 'desk', text: 'The attachment on the stele ticket finally rendered: a photograph of a chip of marble. It was on my desk when I looked up.' },
  { fact: 'shard_directors', where: 'desk', text: 'A chip of marble in the minutes of the board of directors, where the directors\' names should be.' },
  { fact: 'shard_relief', where: 'relief', text: 'A chip of marble hanging in the frozen air of the carving, at the very edge of the mountain.' },
  { fact: 'shard_board', where: 'board', text: 'A chip of marble painted on the night board, on the old well. Somebody stood on it.' },
];

/** Every four shards teach one new stele word. */
export const SHARD_WORDS: { count: number; fact: string }[] = [
  { count: 4, fact: 'shards_4' },
  { count: 8, fact: 'shards_8' },
  { count: 12, fact: 'shards_12' },
];
