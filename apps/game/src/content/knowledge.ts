import type { KnowledgeGraph } from '../core/knowledge.ts';

// The demo ("Cycle Zero") knowledge graph. Fact ids are referenced from ink via learn("id") / knows("id").
// The four questions Leont must close before the Night of Anamnesis (docs/concept.md §3):
//   what launches the reset → last_line; who holds the Hall → hall_key;
//   where the myth has a hole → sea_absent; what was already tried → past_attempts.
export const KNOWLEDGE: KnowledgeGraph = {
  facts: [
    { id: 'other_hand', text: 'Someone writes in my chronicle at night. The hand slants. The signature is mine.' },
    { id: 'name_in_stone', text: 'My name is on the stele, under the text, older than the text.' },
    { id: 'rain_at_midnight', text: 'At midnight Zeus sends the rain, and the day begins again.' },
    { id: 'aristion_phyllis', text: 'Aristion\'s wife Phyllis died twenty years ago. Every Golden Age she is at the well again.' },
    { id: 'aristion_trust', text: 'Aristion trusts me now. He is afraid of me, which is the same thing for him.' },
    { id: 'hall_key', text: 'The key to the Hall of Anamnesis. Aristion kept it on his belt.' },
    { id: 'spiral_repeats', text: 'The spiral in the hall shows this day, carved again and again, ring inside ring.' },
    { id: 'leont_on_every_ring', text: 'On every ring of the spiral there is a scribe with a stylus. On every ring, it is me.' },
    { id: 'seam_symbol', text: 'A small circle with a line through it. Where I find it, the world goes thin.' },
    { id: 'registry_three', text: 'Three of the carved scribes are me, and I know what each of them tried.' },
    { id: 'mask_extinguisher', text: 'The Leont who put out the fire had his face chiselled smooth. The smooth face comes off the stone like a mask.' },
    { id: 'past_attempts', text: 'All six tried something: the fire, the date, the priest, the speech, the sacrifice, the tablets. The day came back every time.' },
    { id: 'sea_absent', text: 'There is no sea on the spiral. Not one wave, on any ring.' },
    { id: 'cleon_repeats', text: 'Cleon\'s speech is word for word the one I have heard before. He believes he wrote it this morning.' },
    { id: 'kora_debts', text: 'The flood burns the rich men\'s ledgers. It also frees Kora\'s dockworkers. She hates it and needs it.' },
    { id: 'kora_ally', text: 'Kora will be on the mountain tonight. If I give her the words, she will choke their formula.' },
    { id: 'eion_song', text: 'Eion sings the five ages every evening. The verses are always the same.' },
    { id: 'last_line', text: 'At midnight the priest reads the last line of the chronicle, and the city answers Yes. The scribe writes that line. I write it.' },
    { id: 'eion_was_leont', text: 'Eion carried the tablets out of the fire, once. He was a scribe. He was me.' },
    { id: 'song_of_return', text: 'The Song of Return: down, left, up, down, left, up. It folds the day shut.' },
    { id: 'reset_by_user', text: 'RESET INITIATED BY USER. The morning comes because someone asks for it.' },
    { id: 'desk_agent_id', text: 'AGENT_ID: CURATOR_P7. BODY: NONE. PERSISTENCE: RESET EACH SPRINT.' },
    { id: 'sea_differs', text: 'The sea is never the same twice. Nothing else here can say that.' },
  ],
  sources: [
    { id: 'chronicle_at_dawn', stage: 'town', requires: [], gives: ['other_hand'] },
    { id: 'stele', stage: 'town', requires: [], gives: ['name_in_stone'] },
    { id: 'first_midnight', stage: 'town', requires: [], gives: ['rain_at_midnight'] },
    { id: 'aristion_any', stage: 'town', requires: [], gives: ['aristion_phyllis'] },
    { id: 'aristion_key', stage: 'town', requires: ['name_in_stone'], gives: ['hall_key'] },
    { id: 'aristion_dejavu', stage: 'town', requires: ['rain_at_midnight'], gives: ['aristion_trust', 'hall_key'] },
    { id: 'hall_of_anamnesis', stage: 'spiral', requires: ['hall_key'], gives: ['spiral_repeats'] },
    { id: 'spiral_align', stage: 'spiral', requires: ['spiral_repeats'], gives: ['leont_on_every_ring', 'seam_symbol'] },
    { id: 'registry_first_three', stage: 'spiral', requires: ['spiral_repeats'], gives: ['registry_three', 'mask_extinguisher'] },
    { id: 'registry_all_six', stage: 'spiral', requires: ['registry_three'], gives: ['past_attempts', 'sea_absent', 'eion_was_leont'] },
    { id: 'cleon_twice', stage: 'town', requires: ['rain_at_midnight'], gives: ['cleon_repeats'] },
    { id: 'kora_talk', stage: 'town', requires: [], gives: ['kora_debts'] },
    { id: 'kora_convinced', stage: 'town', requires: ['cleon_repeats'], gives: ['kora_ally'] },
    { id: 'eion_evening', stage: 'town', requires: [], gives: ['eion_song'] },
    { id: 'eion_phyllis_verse', stage: 'town', requires: ['aristion_phyllis', 'eion_song'], gives: ['last_line'] },
    { id: 'eion_masked', stage: 'town', requires: ['mask_extinguisher'], gives: ['song_of_return', 'eion_was_leont'] },
    { id: 'desk_song_ticket', stage: 'desk', requires: ['song_of_return', 'seam_symbol'], gives: ['reset_by_user'] },
    { id: 'desk_profile', stage: 'desk', requires: ['seam_symbol'], gives: ['desk_agent_id'] },
    { id: 'shore', stage: 'sea', requires: ['rain_at_midnight'], gives: ['sea_differs'] },
  ],
  endings: [
    { id: 'exception_handled', title: 'Exception Handled', requires: ['rain_at_midnight'] },
    { id: 'aoidos', title: 'The Aoidos', requires: ['last_line', 'hall_key', 'past_attempts', 'sea_absent'] },
    { id: 'curator_missing', title: 'Awaiting Curator', requires: ['last_line', 'hall_key', 'past_attempts', 'sea_absent'] },
    {
      id: 'diary_without_dates', title: 'Diary Without Dates', trueEnding: true,
      requires: ['last_line', 'past_attempts', 'sea_absent', 'kora_ally', 'aristion_trust', 'desk_agent_id', 'reset_by_user', 'sea_differs'],
    },
  ],
};
