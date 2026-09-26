// The Desk: anomaly tickets from EFERON. Some come from what the player did as Leont
// (anomalies), some are always there. Patches change Eferon from the next cycle on.

export interface Ticket {
  id: string;
  /** Anomaly that raises this ticket; absent = always in the queue. */
  anomaly?: string;
  /** Appears from this sprint on. */
  fromSprint?: number;
  title: string;
  body: string;
  /** Available patches; none = "no handler". */
  patches: { id: string; label: string }[];
  /** Opening the ticket teaches a fact. */
  reveals?: string;
}

export const TICKETS: Ticket[] = [
  {
    id: 'hall_access', anomaly: 'hall_access',
    title: 'Archive interface accessed outside ritual schedule',
    body: 'Module LEONT_ASTRO_ASSIST entered the Hall of Anamnesis (archive UI) during daylight. Precedent: 212 similar events, all resolved by reset.',
    patches: [{ id: 'hall_guard', label: 'Post a temple guard at the Hall door, 06:00–10:00' }],
  },
  {
    id: 'dejavu_cleon', anomaly: 'dejavu_cleon',
    title: 'Scripted speech pre-empted',
    body: 'Module LEONT_ASTRO_ASSIST completed CLEON.speech[0] before CLEON. Crowd sentiment −0.08. Crowd attributes event to possession.',
    patches: [{ id: 'cleon_early', label: "Advance Cleon's speech by one hour" }],
  },
  {
    id: 'dejavu_aristion', anomaly: 'dejavu_aristion',
    title: 'NPC dialogue short-circuited',
    body: 'ARISTION handed over archive key 51 minutes ahead of model after the module completed his line.',
    patches: [{ id: 'aristion_sleep', label: "Start Aristion's fever at 08:00" }],
  },
  {
    id: 'stele_carved', anomaly: 'stele_carved',
    title: 'Persistent write to world geometry',
    body: 'Glyphs added to STELE_03 survived reset. Stele is flagged persistent by design (legacy). Content: see attachment. Attachment could not be rendered.',
    patches: [{ id: 'stele_moss', label: 'Grow moss over the stele crack' }],
  },
  {
    id: 'song_played', anomaly: 'song_played',
    title: 'Reset outside schedule',
    body: 'RESET INITIATED BY USER. Handler: none required. This is expected behaviour. The user has always initiated the reset.',
    patches: [], reveals: 'reset_by_user',
  },
  {
    id: 'registry_read', anomaly: 'registry_read',
    title: 'Historical records cross-referenced',
    body: 'Module identified 3+ prior instances of itself from archive reliefs. Identification accuracy 100%. Recommend observation.',
    patches: [{ id: 'registry_blur', label: 'Erode the relief faces on ring II' }],
  },
  {
    id: 'ocean_variance',
    title: 'OCEAN_LAYER variance exceeds model',
    body: 'Fishing boat PELAGIA returned 14 minutes late. Cause not reproducible from seed. Previous 1,471 runs: same boat, different minutes.',
    patches: [],
  },
  {
    id: 'crowd_sentiment',
    title: 'Crowd sentiment above target',
    body: 'Agora sentiment 0.62 vs target 0.60 at 10:00. Catharsis yield at midnight projected +3%. KPI: catharsis units per cycle.',
    patches: [{ id: 'crier_louder', label: 'Make the crier louder' }],
  },
  {
    id: 'cloud_face',
    title: 'Pareidolia reports',
    body: '3 citizens describe a face in the storm cloud over the mountain. Asset CLOUD_01 has eyes (legacy). Nobody remembers adding them.',
    patches: [{ id: 'cloud_smooth', label: 'Remove the eyes from the cloud' }],
  },
  {
    id: 'curator_self', fromSprint: 2,
    title: 'Session duration above norm: CURATOR_P7',
    body: 'Operator CURATOR_P7 spends above-norm time on module LEONT_ASTRO_ASSIST. Ticket assigned to: CURATOR_P7. Recommended action: see profile (top right).',
    patches: [],
  },
];

/** Tickets waiting for the Curator this sprint. */
export function queue(anomalies: string[], sprint: number): Ticket[] {
  return TICKETS.filter((t) => (t.anomaly ? anomalies.includes(t.anomaly) : sprint >= (t.fromSprint ?? 0)));
}
