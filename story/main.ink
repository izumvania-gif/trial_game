// EFERON: The Other Hand — story entry point.
// Conventions (see apps/game/src/engine/story.ts):
//   - The engine jumps straight to a knot with ChoosePathString; every knot ends in -> DONE.
//   - Facts come from the knowledge graph: ~ learn(<fact>) and {knows(<fact>)}.
//   - Line tags: #speaker:Name, #hand (Leont's slanted past hand), #log (service layer),
//     #hint, #stage:<id> (switch stage after the dialogue), #spend:<minutes>,
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
EXTERNAL notice(id, wind)
EXTERNAL seen_ending(id)
EXTERNAL registry_locked()
EXTERNAL identified(id)
EXTERNAL night(key)
EXTERNAL sprint()

INCLUDE town.ink
INCLUDE people.ink
INCLUDE spiral.ink
INCLUDE desk.ink
INCLUDE sea.ink

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
=== function notice(id, wind)
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
