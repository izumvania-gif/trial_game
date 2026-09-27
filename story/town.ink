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
