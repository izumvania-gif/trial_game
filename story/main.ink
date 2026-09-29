// EFERON: The Other Hand — story entry point.
// Conventions (see apps/game/src/engine/story.ts):
//   - The engine jumps straight to a knot with ChoosePathString; every knot ends in -> DONE.
//   - Facts come from the knowledge graph: ~ learn(<fact>) and {knows(<fact>)}.
//   - Line tags: #speaker:Name, #mood:<neutral|joy|anger|sorrow|fear|wonder> (the portrait's face), #hand (Leont's slanted past hand), #log (service layer),
//     #hint, #voice (a past Leont talking), #stage:<id> (switch stage after the dialogue), #spend:<minutes>,
//     #dejavu:<id> (the player can finish this line the second time; mark the cue word with ^),
//     #action: carve, stele_lines, board or ending:<id> (UI to open after the dialogue).

EXTERNAL learn(id)
EXTERNAL knows(id)
EXTERNAL cycle()
EXTERNAL hour()
EXTERNAL dejavu_ok(id)
EXTERNAL heard(id)
EXTERNAL wearing()
EXTERNAL has_mask(id)
EXTERNAL give_mask(id)
EXTERNAL stele_word()
EXTERNAL patched(id)
EXTERNAL notice(id, amount)
EXTERNAL seen_ending(id)
EXTERNAL registry_locked()
EXTERNAL identified(id)
EXTERNAL night(key)
EXTERNAL sprint()
EXTERNAL dawn_hint()
EXTERNAL wind()
EXTERNAL ended_last_cycle(id)
EXTERNAL learned_today(id)
EXTERNAL last_hour()
EXTERNAL today(id)
EXTERNAL shard_count()
EXTERNAL curator_note()
EXTERNAL true_night()
EXTERNAL damaged()
EXTERNAL shard_line()
EXTERNAL voice()

INCLUDE prologue.ink
INCLUDE town.ink
INCLUDE people.ink
INCLUDE people2.ink
INCLUDE spiral.ink
INCLUDE desk.ink
INCLUDE sea.ink
INCLUDE curator.ink

-> DONE

// Fallbacks so the story also runs in Inky, where the game's functions don't exist.
=== function learn(id)
~ return true
=== function knows(id)
~ return false
=== function cycle()
~ return 1
=== function hour()
~ return 6
=== function dejavu_ok(id)
~ return false
=== function heard(id)
~ return false
=== function wearing()
~ return ""
=== function has_mask(id)
~ return false
=== function give_mask(id)
~ return true
=== function stele_word()
~ return ""
=== function patched(id)
~ return false
=== function notice(id, amount)
~ return true
=== function seen_ending(id)
~ return false
=== function registry_locked()
~ return 0
=== function identified(id)
~ return false
=== function night(key)
~ return false
=== function sprint()
~ return 1
=== function dawn_hint()
~ return "Don't look at the sky. Look into the stone."
=== function wind()
~ return 0
=== function ended_last_cycle(id)
~ return false
=== function learned_today(id)
~ return false
=== function last_hour()
~ return false
=== function today(id)
~ return false
=== function shard_count()
~ return 0
=== function curator_note()
~ return ""
=== function true_night()
~ return false
=== function damaged()
~ return false
=== function shard_line()
~ return ""
=== function voice()
~ return ""
