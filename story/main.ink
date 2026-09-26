// EFERON: The Other Hand — story entry point.
// Conventions (see apps/game/src/engine/story.ts):
//   - The engine jumps straight to a knot with ChoosePathString; every knot ends in -> DONE.
//   - Facts come from the knowledge graph: ~ learn(<fact>) and {knows(<fact>)}.
//   - Line tags: #speaker:Name, #hand (Leont's slanted past hand), #log (service layer),
//     #stage:<id> (switch stage after the line), #spend:<minutes> (costs game time).

EXTERNAL learn(id)
EXTERNAL knows(id)
EXTERNAL cycle()
EXTERNAL hour()

INCLUDE town.ink
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
