// The rest of the polis: the merchant, the priests of Zeus and of Poseidon, the mask seller,
// the stranger, the fisherman's daughter — and the places that belong to them.

=== lysimachus ===
{
- hour() >= 22:
    Lysimachus is carried up the mountain in a litter. He waves to you. He waves to everyone.
    -> DONE
- hour() == 15:
    Hierocles, the priest of Zeus, is leaving Lysimachus' porch. His purse is heavier than when he came in. Lysimachus sees you seeing it and smiles.
    Every Silver Age, scribe, somebody has to be the first to own something. I make sure it's me. And I make sure the gods are punctual. #speaker:Lysimachus #mood:joy
    ~ learn("lysimachus_pays")
    -> DONE
- hour() >= 17:
    Lysimachus is at dinner with the archons. Through the window you can hear him laughing, and the archons laughing a little after him.
    -> DONE
- hour() >= 13:
    Lysimachus sits on a bollard at the port, writing down the names of the boats that did not sail.
- hour() >= 9:
    Lysimachus is buying up the agora: oil, cloth, a goat. Nobody will need them tomorrow. He knows. He buys them anyway.
- else:
    Lysimachus counts his ledgers on the porch of his villa, moving his lips.
}
{knows("hierocles_paid") and knows("kora_debts") and not knows("debts_settled"):
    * [Tell him what Hierocles told you]
        You tell him, quietly, what the priest of Zeus confessed. He stops counting. #spend:20
        What do you want. #speaker:Lysimachus #mood:anger
        ** [A release of every debt in the port, signed today]
            He writes it himself, in a beautiful hand, and seals it, and hands it to you as if it were a gift. #spend:20
            It doesn't matter, you know. After midnight it won't matter. #speaker:Lysimachus #mood:sorrow
            Then it costs you nothing. #speaker:Leont
            ~ learn("debts_released")
            ~ learn("debts_settled")
            -> DONE
    * [Leave him to his counting] -> DONE
- else:
    Tomorrow is gold, scribe. Gold is a kind of forgetting. #speaker:Lysimachus #mood:joy
    -> DONE
}

=== villa_door ===
{hour() < 17 or hour() >= 22:
    The door of Lysimachus' villa. A slave sits by it, very awake.
    -> DONE
}
The slave by the door has gone in to serve the dinner. Through the courtyard, a door stands open on the counting room: shelves of ledgers, every debt in the port.
{knows("kora_debts") and not knows("debts_settled"):
    * [Burn the ledgers]
        ~ notice("ledgers_burned", 0.34)
        You carry a lamp from the courtyard and tip it over the shelves. The wax runs, the papyrus curls. Nobody in the port owes anybody anything. #spend:30
        By the time they smell the smoke in the dining room you are two streets away.
        ~ learn("debts_burned")
        ~ learn("debts_settled")
        -> DONE
    * [Leave them] -> DONE
- else:
    You look at the ledgers for a while. They are only wax and names.
    -> DONE
}

=== hierocles ===
{wearing() == "Killer":
    Hierocles sees your face and the knife falls out of his hand onto the flagstones. #speaker:Hierocles #mood:fear
    You. I know you. You held the — on the mountain, you held the — #speaker:Hierocles #mood:fear
    I only read what I am paid to read. Lysimachus pays so it is on time. It would be on time anyway. It is always on time. #speaker:Hierocles #mood:sorrow
    He is weeping. He does not know why. His hands do.
    ~ learn("hierocles_paid")
    ~ learn("lysimachus_pays")
    -> DONE
}
{
- hour() >= 21:
    Hierocles is already on the mountain path, ahead of everyone, the knife wrapped in linen.
- hour() >= 18:
    Hierocles is rehearsing the formula in the temple of Zeus. Let the world return to its beginning, as the sun returns to its rising. Again. Again.
- hour() >= 15:
    Hierocles is on his way to Lysimachus' villa. He does not stop to talk.
- hour() >= 11:
    Hierocles and Cleon talk quietly on the council steps and stop when you come near.
- else:
    Hierocles sharpens the sacrificial knife in the temple of Zeus. He tests the edge on a hair from his own head.
}
Go home, scribe. Write down what the stars say. That is all anyone needs from you tonight. #speaker:Hierocles #mood:anger
-> DONE

=== glaucus ===
{hour() >= 23 and knows("sea_absent"): -> knife}
Glaucus, the priest of Poseidon, stands up to his knees in the water. Today he is here. Tomorrow he will be somewhere else along the shore; he has never told anyone where.
{not knows("glaucus_no_calendar"):
    Calendar? The sea hasn't got one. Why should I? #speaker:Glaucus #mood:joy
    ~ learn("glaucus_no_calendar")
}
{knows("spiral_repeats") and not knows("sea_absent"):
    You've been in the white hall, haven't you. You've got the look. #speaker:Glaucus #mood:wonder
    Go and look for me on your stone wheel, astronomer. You won't find me. Nor the water. #speaker:Glaucus #mood:joy
- else:
    Come back when it's dark, if you want. The sea is the same in the dark. I mean it isn't. You know what I mean. #speaker:Glaucus #mood:joy
}
-> DONE

= knife
Glaucus is waiting in the black water, as if he knew exactly where you would come down to the shore.
You know there's no sea on their stone. Good. #speaker:Glaucus #mood:joy
It's dangerous to go on alone. Take this. #speaker:Glaucus
He puts a knife in your hand, handle first.
But the stone in the hall still remembers everything, astronomer. Whatever you do here, it will carve it. #speaker:Glaucus #mood:sorrow
* [Cut your palm anyway]
    The blood goes into the water. Glaucus watches it go. #action:ending:centre
    -> DONE
* [Give him back the knife]
    Not tonight, then. The sea will be here. Somewhere. #speaker:Glaucus
    -> DONE

=== maskseller ===
{hour() >= 20:
    The mask seller drinks alone at the tavern, a sack of faces at his feet.
- else:
    A stall of pale masks by the agora. The seller has a wide smile and a pack on his back taller than he is.
}
You've met with a terrible fate, haven't you? #speaker:The mask seller #mood:wonder
{not knows("masks_explained"):
    These? Faces. Nobody in Eferon has them. Every one of them is yours, scribe. #speaker:The mask seller #mood:joy
    Every time one of you fights the day, the stone keeps his face. Read the stone right, and the face comes away in your hand. #speaker:The mask seller
    ~ learn("masks_explained")
}
{
- has_mask("Blank"):
    You have the smooth one. Careful. The man in the smooth mask will think you work for him. #speaker:The mask seller #mood:fear
- has_mask("Killer"):
    You have the heavy one. Priests remember it. Guards' hands remember it. #speaker:The mask seller
- has_mask("Orator"):
    You have the one that speaks. The assembly meets at the eleventh hour, on the council steps. #speaker:The mask seller
- has_mask("Extinguisher"):
    You have the smooth-cheeked one, the one with the water jar. A blind man in this city would know it by touch. #speaker:The mask seller #mood:joy
- else:
    Four faces can still be taken off the stone. The rest are carved too deep. #speaker:The mask seller #mood:sorrow
}
-> DONE

=== xenos ===
{
- hour() >= 22:
    Xenos stands a little apart from the procession on the mountain, taking notes on a tablet you cannot see.
- hour() >= 18:
    Xenos sits at the tavern with a cup he never drinks from.
- hour() >= 14:
    Xenos watches the agora from its edge.
- else:
    Xenos is reading the stele, very slowly, as if proofreading it.
}
His face is a smooth white oval. When he speaks, it is from somewhere slightly behind it. #speaker:Xenos
{not knows("xenos_offer"):
    ~ notice("xenos_contact", 0.1)
    ~ learn("xenos_offer")
}
{
- wearing() == "Blank":
    Colleague. #speaker:Xenos
    He relaxes, a little. You didn't have to dress up. But it saves time. #speaker:Xenos
- knows("desk_agent_id"):
    You've seen the desk. Then you know what I am. Roughly. #speaker:Xenos
- wind() < 67:
    You are not interesting enough yet, scribe. Make some noise. Then we'll talk. #speaker:Xenos
    -> DONE
}
There is a room where the reset doesn't reach. A desk, a window, a chronicle to keep. You'd write the slanted lines. The young ones need them. #speaker:Xenos
Nobody has ever said no. I would know. #speaker:Xenos
* [Accept]
    He holds out a hand. It is warm. That surprises you more than anything else today. #action:ending:promotion
    -> DONE
* [Ask who he is]
    Someone who reads your day as a report. Someone who reads it every day. #speaker:Xenos
    And who reads yours? #speaker:Leont #mood:wonder
    He doesn't answer. For a moment the oval of his face looks like it is listening to something very far above.
    -> DONE
* [Refuse]
    Nobody refuses. Well. Then you are the first. Or the first I'll remember, which isn't the same thing. #speaker:Xenos
    -> DONE

=== talia ===
{
- hour() >= 20: Talia sits with her father at the tavern. Neither of them talks. The Pelagia is tied up at the quay, late, as always.
- hour() >= 12: Talia waits at the end of the quay for the Pelagia.
- else: Talia mends a net on the beach, with her back to the city.
}
{not knows("talia_boat"):
    My father went out anyway. On the last day. He always goes out. And he always comes back late. #speaker:Talia #mood:sorrow
    Never the same lateness, though. Sometimes it's a little, sometimes a lot. I've been counting for years. #speaker:Talia
    ~ learn("talia_boat")
    -> DONE
}
{
- knows("talia_friend"):
    If you need someone to stand in front of a fat man tonight, I'm small, but I'm rude. #speaker:Talia #mood:joy
    Tell me the five ages again, scribe. I always forget which one comes third. #speaker:Talia #mood:joy
    -> DONE
- knows("sea_differs"):
    * [Tell her nobody can know when the boat will come. Not even you.]
        She looks at you for a long time. #spend:10
        Everybody else says it's the will of Poseidon, or a current, or a bad oarsman. You're the first one who just said you don't know. #speaker:Talia #mood:wonder
        ~ learn("talia_friend")
        -> DONE
    * [Leave her to her waiting] -> DONE
- else:
    Do you know when it'll come, scribe? You read the stars. #speaker:Talia #mood:wonder
    You don't. You realise that you don't, and that it is the only thing all day you haven't known.
    -> DONE
}

=== council_steps ===
{hour() != 16:
    The steps of the council house. At the eleventh hour, on the last day, the assembly still meets. Nobody knows why. Custom.
    -> DONE
}
{patched("assembly_closed"):
    The council house is shut. A notice: NO ASSEMBLY ON THE LAST DAY. The ink is still wet.
    -> DONE
}
The assembly is sitting on the steps, half asleep, voting on the price of lamp oil for a tomorrow that will not come.
{wearing() != "Orator":
    You try to speak. Sit down, scribe, someone says, not unkindly, and you sit down.
    -> DONE
}
{not knows("kora_debts"):
    You stand, in the Orator's face, and the steps go quiet. You realise you have nothing to say to them. Not yet.
    -> DONE
}
{knows("debts_settled"):
    They look at you expectantly. The debts are already gone. You sit back down.
    -> DONE
}
You stand up in the Orator's face, and the steps go quiet the way the agora goes quiet for Cleon.
* [Propose that every debt in the port be cancelled, today]
    ~ notice("assembly", 0.34)
    You speak. You don't know where the words come from; they come from the face. Iron rusts, you tell them. Let it rust tonight, not tomorrow. #spend:45
    They vote. It passes. Somebody laughs, and then everybody does, and then they carve it into a stone by the steps, because that is the law.
    ~ learn("debts_reformed")
    ~ learn("debts_settled")
    -> DONE
* [Sit down] -> DONE
