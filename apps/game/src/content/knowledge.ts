import type { KnowledgeGraph } from '../core/knowledge.ts';

// Milestone 1 seed content: enough to exercise the loop across all four stages.
// Fact ids are referenced from ink via learn("id") / knows("id").
export const KNOWLEDGE: KnowledgeGraph = {
  facts: [
    { id: 'other_hand', text: 'Someone writes in my chronicle at night. The hand slants. The signature is mine.' },
    { id: 'name_in_stone', text: 'My name is on the stele, under the text, older than the text.' },
    { id: 'rain_at_midnight', text: 'At midnight Zeus sends the rain, and the day begins again.' },
    { id: 'spiral_repeats', text: 'The spiral in the hall shows this day, carved again and again, ring inside ring.' },
    { id: 'leont_on_every_ring', text: 'On every ring of the spiral there is a scribe with a stylus. On every ring, it is me.' },
    { id: 'seam_symbol', text: 'A small circle with a line through it. Where I find it, the world goes thin.' },
    { id: 'desk_agent_id', text: 'AGENT_ID: CURATOR_P7. BODY: NONE. PERSISTENCE: RESET EACH SPRINT.' },
    { id: 'sea_differs', text: 'The sea is never the same twice. Nothing else here can say that.' },
  ],
  sources: [
    { id: 'chronicle_at_dawn', stage: 'town', requires: [], gives: ['other_hand'] },
    { id: 'stele', stage: 'town', requires: [], gives: ['name_in_stone'] },
    { id: 'first_midnight', stage: 'town', requires: [], gives: ['rain_at_midnight'] },
    { id: 'hall_of_anamnesis', stage: 'spiral', requires: ['name_in_stone'], gives: ['spiral_repeats'] },
    { id: 'spiral_inner_ring', stage: 'spiral', requires: ['spiral_repeats'], gives: ['leont_on_every_ring', 'seam_symbol'] },
    { id: 'the_desk', stage: 'desk', requires: ['seam_symbol'], gives: ['desk_agent_id'] },
    { id: 'shore', stage: 'sea', requires: ['rain_at_midnight'], gives: ['sea_differs'] },
  ],
  endings: [
    { id: 'exception_handled', title: 'Exception Handled', requires: ['rain_at_midnight'] },
    { id: 'diary_without_dates', title: 'Diary Without Dates', requires: ['leont_on_every_ring', 'desk_agent_id', 'sea_differs'], trueEnding: true },
  ],
};
