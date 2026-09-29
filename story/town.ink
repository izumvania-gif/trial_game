=== dawn ===
{
- ended_last_cycle("sisyphus"):
    One must imagine Leont happy. #hint
- ended_last_cycle("aoidos"):
    Under the window an old man is singing. He sings about a scribe who carried the tablets out of the fire. Don't, he sings. Don't carry them.
- ended_last_cycle("exception_handled"):
    ACCOUNTED FOR #log
- ended_last_cycle("wake_pressed"):
    RESET INITIATED BY USER #log
    Everything was done, and you pressed it anyway. The hand remembers the button better than the head remembers why.
- ended_last_cycle("curator_missing") and not knows("curator_awake"):
    ROLLBACK APPROVED BY: CURATOR_P7 (auto) #log
- ended_last_cycle("curator_missing"):
    AUTO-RESET: RESUMED. THE CURATOR DID NOT SIGN IT. #log
}
{knows("curator_awake") and curator_note() != "":
    Before you open your eyes, a line in the service script, the one you are not supposed to read:
    USER NOTE: {curator_note()} #log
    It is not an order. It is not a correction. Someone copied it for you.
}
{cycle() == 1:
    Grey light on the wax. You fell asleep over the chronicle again.
- else:
    Grey light on the wax. You fell asleep over the chronicle. Again.
}
{knows("curator_chair") and not knows("curator_awake"):
    The stool creaks under you. You find that you are listening to it, as if it were the first sound you had ever been sure of.
}
{ended_last_cycle("intermediate"):
    The stars were late last night. You checked twice. The tables say one thing and the sky says another, and neither is sure.
}
{shard_line() != "":
    On the first tablet, older than the others, in a slanted hand you almost recognise:
    {shard_line()} #hand
}
~ temp slanted = false
{
- ended_last_cycle("promotion"):
    At the bottom of the last tablet, in a hand that does not slant at all, very even, very tired:
    Welcome back. You won't remember this. I will. — P-8 #hand
- ended_last_cycle("centre"):
    At the bottom of the last tablet, in the slanted hand, two words, pressed so hard the wax tore:
    First, memory. #hand
    ~ slanted = true
- ended_last_cycle("revolution"):
    At the bottom of the last tablet, in the slanted hand: Just this once, she said. It is always just this once. #hand
    ~ slanted = true
- dawn_hint() != "":
    At the bottom of the last tablet there is a line you did not write.
    {dawn_hint()} #hand
    ~ slanted = true
}
~ learn("other_hand")
{voice() != "":
    {voice()} #voice
}
{slanted and knows("rain_at_midnight"):
    The letters lean the way yours would, if you were in a hurry. If you had done this before.
}
{stele_word() != "":
    Somewhere under the moss of the stele, your own letters survived the flood: {stele_word()}.
}
The city is not awake yet. #action:carve
-> DONE

=== stele ===
The star stele of the temple of Apollo. Tables of eclipses, the five ages, the names of those who led each one.
{
- stele_word() != "" and patched("stele_moss"):
    Fresh moss has grown over the crack overnight, thick and green, as if a season had passed in a night. You scrape it off with your thumb. Underneath, in your own hand: {stele_word()}.
- stele_word() != "":
    In the crack beneath the moss, in your own hand: {stele_word()}.
}
{not knows("name_in_stone"):
    + [Scrape the moss from the corner] -> scrape
}
+ {hour() < 7} [Carve a word while nobody is watching]
    You take out the little chisel you have never admitted to owning. #action:carve_now
    -> DONE
+ [Run your fingers along the cracks]
    Other letters, scratched, not carved. Different hands. #action:stele_lines
    -> DONE
+ [Leave it] -> DONE

= scrape
You scrape with your thumbnail. The moss comes away in one wet piece. #spend:10
Beneath it, smaller than the rest and older than the rest, a line of letters. Most are gone.
One word survived. LEONTOS.
There are many Leonts in Eferon. You tell yourself that twice.
~ learn("name_in_stone")
-> DONE

=== temple_door ===
{not knows("hall_key"):
    The bronze door to the Hall of Anamnesis. Locked. The key hangs on old Aristion's belt, they say, and he has not got up in a week.
    -> DONE
}
{
- patched("hall_guard") and hour() < 10 and wearing() == "Killer":
    The new guard at the bronze door looks at your face and takes one step to the side, and then another. He does not know why. His hands do.
- patched("hall_guard") and hour() < 10:
    A temple guard you have never seen stands at the bronze door, very straight, very new.
    Not before the fifth hour, scribe. New orders. #speaker:Guard #mood:anger
    Whose orders, he doesn't say. He doesn't seem to know.
    -> DONE
}
{learned_today("hall_key"):
    The door to the Hall of Anamnesis. Aristion's key is still warm from his belt. It turns as if it had been waiting.
- else:
    The door to the Hall of Anamnesis. Every morning Aristion's key is back on his belt, and every morning it is in your hand; the lock does not ask how.
}
+ [Go in]
    ~ notice("hall_access", 0.1)
    The Hall is cold. Something in the middle of it is very large and very white. #stage:spiral
    -> DONE
+ [Not yet] -> DONE

=== agora_crier ===
{hour() < 20:
    Citizens! Tonight at midnight, on the holy mountain, the Iron Age ends as the stars have written! #speaker:Crier #mood:joy
    Bring nothing. Owe nothing. Tomorrow is gold! #speaker:Crier #mood:joy
- else:
    The crier is hoarse.
    Up the mountain, citizens. Up the mountain. #speaker:Crier #mood:sorrow
}
{knows("rain_at_midnight"): You mouth the words with him. You didn't mean to.}
{patched("crier_louder"): He is louder than yesterday. Nobody else seems to notice.}
-> DONE

=== to_shore ===
The path goes down between the rocks to the water.
{knows("rain_at_midnight"):
    + [Go down to the sea] #stage:sea
        -> DONE
    + [Stay in the city] -> DONE
- else:
    Fishermen are hauling their boats up. Nobody sails on the last day.
    -> DONE
}

=== mole_end ===
{last_hour():
    The mole ends in black water. Behind you the whole city faces the mountain; out here nobody is watching, and the sea goes on as if there were no midnight.
    -> DONE
}
{hour() >= 20:
    The boats knock against the stone. The sea has gone dark before the sky has, and it still moves the way nothing in Eferon does.
    -> DONE
}
The mole ends in open water. Two boats knock against the stone, their sails tied up. Past the harbour mouth the sea goes on to the edge of the world, and it never moves the same way twice.
-> DONE

=== horos ===
A boundary stone where the road leaves the gate and starts to climb, cut with one word: HOROS. Past it the mountain belongs to the god.
-> mountain_path

=== theatre ===
{
- last_hour():
    The rows are empty. From the top of the theatre the whole city lies below you, and it is looking the other way, up at the mountain.
    Past the roofs and the mole the sea is still moving. Nothing else is.
- hour() >= 17:
    The chorus has gone home. The orchestra is swept; the masks are hung inside the skene in a row, their mouths open on nothing.
    Somebody has left one on the altar in the middle. It is not any face you know.
- hour() >= 9:
    The chorus is rehearsing a tragedy in the orchestra, white masks, one voice.
    "Every night the city says yes, and every morning the city forgets it said it." The man with the staff stops them. "Again. From the yes."
    They begin again. They say it exactly the same way. He is pleased.
- else:
    The theatre at first light. Stone rows climb away from you in a half-circle, and from the top of them, over the roofs, you can see the sea.
    Nobody sits here this early. The rows are cold, and every one of them is the same height as the last.
}
-> DONE

=== cape_shrine ===
{
- last_hour():
    The light on the tower is burning for nobody. Every boat is hauled up; every face in the city is turned to the mountain.
    Out here there is only the fire, the wind and the water, and the water is not listening to the priest.
- hour() >= 19:
    The keeper has lit the fire on the tower. It throws a long, shaking line across the water towards you, and the line is never the same twice.
- else:
    A small shrine of Poseidon at the end of the rocks: four columns, a roof, an altar stone that is always wet, whatever the weather.
    There are no inscriptions on it, no dates. Somebody has left a fish-hook and a single barley grain on the altar, as if that were enough.
}
-> DONE

=== lookout ===
{
- last_hour():
    From the rock the procession is a line of fire climbing the mountain, and above it the cloud has a face.
    Behind you, over the roofs, the sea goes on in the dark as if nothing were about to happen. It may be right.
- hour() >= 19:
    The first torches are going up the mountain path. From here you can count them. You stop at a hundred.
- else:
    From the top of the rock Eferon is a map: the agora, the temple roof at your feet, the harbour, the walls on three sides.
    The fourth side has no wall. It has the sea, and the sea is the only part of the map that will not keep still.
}
-> DONE

=== phyllis_grave ===
A tall stele by the road, painted: a woman carrying a water jar, walking out of the frame.
PHYLLIS, WIFE OF ARISTION. Under the name, somebody has scratched a small well with a stick.
{knows("aristion_phyllis"):
    Twenty years dead, and every Golden Age she is at the well again. A sprig of olive lies at the foot of the stone, fresh this morning.
    Aristion cannot walk this far. Somebody else brings it. Nobody has ever asked who.
- else:
    A sprig of olive lies at the foot of the stone, fresh this morning, though the stone is old.
}
-> DONE

=== west_road ===
The road goes on past the last grave into the hills, and the hills go round, the way hills do on the spiral.
{knows("past_attempts"):
    You know how this walk ends. One of you walked it all day, and came back through the other gate at dusk, dusty, into the same city.
- else:
    You could walk it all day. You have the feeling that somebody once did.
}
-> DONE

=== gymnasium ===
{
- today("runner_fell") and not last_hour() and ((hour() >= 7 and hour() < 12) or (hour() >= 15 and hour() < 19)):
    The third runner sits in the sand holding his ankle. The other two run on without him, down and back.
    For the first time in all the days there have been, he is not a stride behind anyone. The trainer does not know what to shout.
- last_hour():
    The gymnasium is empty. The rake lies in the sand where it was dropped. Every runner has gone up the mountain.
- hour() >= 18:
    Oil and sand and the smell of bodies. The trainer is scraping the sand smooth for a tomorrow that will not need it.
- hour() >= 15 or (hour() >= 7 and hour() < 12):
    Three runners, down the track and back. The third is always one stride behind the second — exactly one, every length, every day. The trainer has stopped shouting at him.
    In the sand two wrestlers hold each other still. Neither of them will ever throw the other.
- hour() >= 12:
    The gymnasium is empty at noon. Even the trainer is asleep in the shade of the stoa, his forked stick across his knees.
- else:
    Before seven the gymnasium is raked sand and nobody. The first footprints on it will be the same ones as yesterday's.
}
-> DONE

=== farm ===
{
- last_hour():
    The threshing floor is empty. The straw lies in a perfect ring where the mule trod it. Up on the hill the goats have lain down facing the mountain, like everyone.
- hour() >= 19:
    The mule stands in the yard with its head down. The farmer sits on the edge of the threshing floor and shakes the chaff out of his beard.
- hour() >= 6:
    The mule goes round the threshing floor, the farmer at the pole in the middle turning with it. Round and round, the same track in the straw.
    "The grain doesn't know it's the last day," he says, without stopping. "Why tell it?"
    {knows("past_attempts"):
        He has trodden this ring every day there has ever been. The track in the straw is as deep as the day is long, and never deeper.
    }
- else:
    The farm is still asleep. A goat looks at you over the pen wall.
}
-> DONE

=== world_edge ===
The road goes on west into the hills. You walk on. The last milestone stays beside you, and the hill ahead does not come any nearer. #spend:10
You walk until your shadow has moved. The dust on the road beyond the milestone has no footprints in it, not even old ones.
{knows("desk_agent_id"):
    Somewhere a line of code says that Eferon ends here. It does not say what is past it. Nobody wrote that part.
- else:
    Eferon has an edge, then. Nobody told you, because nobody has ever come this far to find it.
}
-> DONE

=== wall_scratch ===
Up here, where nobody walks, someone has scratched into the coping with the point of a stylus.
A row of tally marks, too many to count at a glance. The last one is fresh: the stone dust is still in it.
Under them, in a hand you know because it is yours: "The view is better from here."
-> DONE

=== sea_cave ===
Under the cape the rock is hollow. You pull yourself onto a ledge at the back, out of the swell.
Someone has been here before you. On the dry wall, scratched with a knife, is a spiral: thirty-six marks round it, and a thirty-seventh begun and not finished.
{knows("sea_absent"):
    There is no sea on the spiral in the Hall. There is sea all round this one.
}
The water sucks at the ledge and lets go, and never the same way twice.
-> DONE

=== open_sea ===
You swim until the city is a white line on the shore and the mountain a shadow over it.
Out here the water moves the way it likes. You watch one wave and wait for it to come round again. It does not. Nothing out here repeats.
For a while you just float, and nobody writes anything down.
-> DONE

=== dog(state) ===
{
- state == "hungry":
    A thin yellow dog lies by the stones of the dead, chin on his paws. He watches you the way dogs watch people who might have food, and do not.
- state == "fed":
    The dog walks at your heel as if he had always belonged to you. When you stop, he sits and looks up.
- else:
    The dog was waiting for you at the gate. Nobody in Eferon remembers yesterday, but he does, a little: he smells your hand and his tail goes.
}
-> DONE

=== cleon_sore ===
Cleon sits on the council steps with a wet cloth on his head.
Somebody knocked the speech right out of me. The whole city was waiting. #speaker:Cleon #mood:anger
Tomorrow. I will give it tomorrow. Word for word, the way I always do. #speaker:Cleon #mood:sorrow
-> DONE

=== trainer ===
{ not ((hour() >= 7 and hour() < 12) or (hour() >= 15 and hour() < 18)):
    The trainer's forked stick leans against the stoa. He will be back when the runners are.
    -> DONE
}
The trainer taps his forked stick on the sand and looks you up and down, scribe's cloak and all.
{trials_won() == 0:
    A scribe who climbs the roofs. The whole city is talking about it. Let's see what those legs are for. #speaker:Trainer
- else:
    Back again. My water-clocks don't remember you, scribe. I have a feeling you remember them. #speaker:Trainer #mood:wonder
}
{trials_won() >= 4 and not has_mask("Hermes"):
    ~ give_mask("Hermes")
    All four. Nobody has ever beaten every one of my clocks. Here. It was carved for a messenger. #speaker:Trainer #mood:joy
    He puts a mask in your hands: a young face with a winged cap, smiling as if he had already arrived.
}
~ temp best_dromos = trial_best("dromos")
~ temp best_walls = trial_best("walls")
~ temp best_swim = trial_best("swim")
~ temp best_roof = trial_best("roof")
Four trials. The water-clock starts when you pass the first post, and stops at the last. #speaker:Trainer
+ [The streets: round by the agora and the temple steps and back here{best_dromos}]
    Past my post, round the fountain in the agora, touch the temple steps, back to my post. Run. #speaker:Trainer #action:trial:dromos
+ [The walls: the whole wall walk, and never the street{best_walls}]
    Up on the west wall by the gate, north over the towers, east along the top to the mountain gate. Put one foot on the street and you've lost. #speaker:Trainer #action:trial:walls
+ [The sea: from the end of the mole to Poseidon's cape{best_swim}]
    From the end of the mole to the rock of the cape. The sea is not like the streets, scribe. It does not do the same thing twice. #speaker:Trainer #action:trial:swim
+ [Apollo's roof: up to the ridge of the temple, then down to the star stele{best_roof}]
    From the bronze door, up the columns to the ridge of the roof, and down to the star stele. Don't tell the priests I sent you. #speaker:Trainer #action:trial:roof
+ [Not now]
    Suit yourself. The runners will be here. They always are. #speaker:Trainer
- -> DONE

=== caught_by_watch(times) ===
Two Scythian archers take you by the arms and walk you across the agora to the council house. An archon with ink on his fingers opens a wax register. #spend:30
{times == "1":
    "Leont the scribe. Disorder in the streets." He looks up. "You, of all people. You write things down for a living."
- else:
    "Leont the scribe. Disorder in the streets." He smooths the wax to make room. "Again. That is {times} times today."
}
He presses the stylus in hard, as if it could last. They let you go.
By morning the wax will be smooth. Nothing anyone writes in this city lasts the night, except what you write.
-> DONE

=== olive_press ===
{
- today("press_stopped") and hour() >= 7 and hour() < 18 and not last_hour():
    The millstone has stopped against the stone you put in the basin. The worker stands and looks at it as if it had spoken.
    "It has never done that," he says. "Not once." There is no oil in the jar today, and he does not say "Good year."
- last_hour():
    The millstone has stopped halfway round. The oil in the settling jars is still going clear, and nobody will ever pour it off.
- hour() >= 18:
    The press is shut for the night. The stone smells of oil and dust, and the beam is lashed down as if someone meant to come back.
- hour() >= 7:
    The worker leans on the bar and the stone goes round, crushing the same olives it crushed yesterday. The oil runs green-gold into the jar.
    The jar never fills past the same line. He empties it into the same amphora at the same moment, every day, and says the same thing: "Good year."
- else:
    Before seven the press is cold. A lizard sits on the millstone as if it had always been part of it.
}
-> DONE

=== olive_grove ===
{
- last_hour():
    The grove is empty. A sapling stands in fresh earth at the end of the row, watered, staked, and waiting for years.
- hour() >= 18:
    The old man has gone home. The sapling he planted today stands at the end of the row with a little ring of wet earth round it.
- hour() >= 7:
    An old man is planting an olive sapling at the end of the row. An olive takes twenty years to bear.
    He knows he will not see it. He plants it anyway, tamps the earth down with his heel, and pours water on it from a jar.
    {knows("past_attempts"):
        Tomorrow the hole will be empty again and he will dig it again. He will not remember, and the tree will not grow, and he will be exactly as patient as today.
    }
- else:
    The grey trees stand in their terraces. Every leaf turns silver on the same breath of wind.
}
-> DONE

=== fish_market ===
{
- last_hour():
    The fish stones are bare and washed. The gulls sit on the awnings and wait for a morning.
- hour() >= 13:
    The catch sold out before noon. Only the smell stays, and the gulls, and a boy sluicing the stones with sea water.
- hour() >= 6:
    Tunny, mullet, a basket of squid still changing colour. The sellers shout the prices at the same moment the cooks come down from the agora.
    Every day one mullet slips off the slab and the same cat takes it. The seller swears at it with the same words.
- else:
    The stalls wait under their awnings for the boats.
}
-> DONE

=== shipyard ===
{
- last_hour():
    The shipwright has left his adze in the timber. The ribs of the boat stand against the dark sea like a ribcage.
- hour() >= 18:
    The yard is empty. The keel lies on its blocks, ribs up, half-planked. It will sail when it is finished.
- hour() >= 7:
    The shipwright is fitting a plank to the ribs, steaming it and bending it to the curve. He measures twice.
    "By the festival of Poseidon she'll be in the water," he says. It is the same plank as yesterday. It is always the third plank from the keel.
- else:
    The keel lies on its blocks in the morning grey. Sawdust from yesterday, and yesterday, and yesterday.
}
-> DONE

=== mountain_path ===
{hour() == 21 and not knows("shard_path") and knows("rain_at_midnight"):
    The path up the holy mountain. For one more hour only the early climbers are on it, the ones who want to be seen. Among the pale stones one is paler than the rest, and square-edged.
    It is a chip of the white marble from the Hall. Nobody carried it here. Nobody could have.
    ~ learn("shard_path")
    -> DONE
}
{hour() < 22 and not last_hour():
    The path up the holy mountain. Tonight the whole city climbs it. Not yet.
    -> DONE
}
The procession is already on the mountain. Torches, ten thousand faces turned up. The priest of Zeus raises his arms over the sacred fire.
Let the world return to its beginning, as the sun returns to its rising. #speaker:Priest of Zeus
+ [Put out the sacred fire]
    ~ notice("quenched_fire", 0.34)
    You tip the water jar over the tripod. The fire hisses out. Ten thousand people look at you instead of the sky. #action:ending:exception_handled
    -> DONE
+ {knows("rain_at_midnight")} [Shout the priest's next words before he can]
    ~ notice("spoke_first", 0.34)
    You shout it first. The crowd turns. Somewhere a woman makes the sign against the evil eye. #action:ending:exception_handled
    -> DONE
+ {knows("kora_ally") and knows("debts_reformed")} [Let Kora take the altar from Hierocles]
    Kora climbs onto the altar steps. The dockworkers climb with her. Hierocles looks round for the archons, and the archons are already running. #action:ending:revolution
    -> DONE
+ {knows("last_line") and knows("aristion_phyllis") and knows("past_attempts")} [Write the last line yourself, cleanly, for Aristion]
    You take out your tablet. You know exactly what the last line is. You write it in your best hand, and give it to Hierocles, and step back into the crowd. #action:ending:sisyphus
    -> DONE
+ [Say Yes with them]
    You say yes with them. It is very easy. It is the easiest thing you have ever done.
    -> DONE
+ [Go back down] -> DONE

=== midnight ===
The wind rises. It always rises first.
On the mountain ten thousand voices answer the priest.
Yes. #speaker:Eferon
Then the rain.
~ learn("rain_at_midnight")
-> DONE

// The last hour: a named resident has stopped wherever eleven found them, facing the mountain.
=== still(name) ===
{name} has stopped where the last hour found them, turned towards the mountain. Not a word. Not a blink.
You say the name. Nothing. The whole city is listening to something you cannot hear.
-> DONE

=== well ===
The old well by the square. The rope is new every morning; the stones are very old.
{knows("aristion_phyllis"):
    Every Golden Age, Aristion says, his wife is standing here. You look at the place where she would stand.
}
{
- hour() == 12 and not knows("shard_well"):
    The noon sun stands straight over the shaft, and for a moment the water at the bottom is a white eye. In it, something whiter.
    You go down on the rope. It is a chip of the marble from the Hall, lying on the bottom as if it had been dropped from a great height. #spend:30
    ~ learn("shard_well")
- hour() != 12 and not knows("shard_well") and knows("aristion_phyllis"):
    The water is dark. At another hour, perhaps, you would see the bottom.
}
-> DONE

=== tavern_table ===
{hour() < 14:
    Eion is asleep under this table, one hand on his lyre.
    -> DONE
}
{hour() >= 23 and not knows("shard_tavern") and knows("eion_song"):
    Eion has gone down to the sea. Under his table, where his head lay all morning, a chip of white marble is pressed into the floor.
    It is warm, like something that has been slept on.
    ~ learn("shard_tavern")
    -> DONE
}
The table where Eion sleeps in the mornings. It smells of wine and of lyre strings.
-> DONE
