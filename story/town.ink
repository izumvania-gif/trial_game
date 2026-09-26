=== dawn ===
{
- ended_last_cycle("sisyphus"):
    One must imagine Leont happy. #hint
- ended_last_cycle("aoidos"):
    Under the window an old man is singing. He sings about a scribe who carried the tablets out of the fire. Don't, he sings. Don't carry them.
- ended_last_cycle("exception_handled"):
    ACCOUNTED FOR #log
- ended_last_cycle("curator_missing"):
    ROLLBACK APPROVED BY: CURATOR_P7 (auto) #log
}
{cycle() == 1:
    Grey light on the wax. You fell asleep over the chronicle again.
- else:
    Grey light on the wax. You fell asleep over the chronicle. Again.
}
{
- ended_last_cycle("promotion"):
    At the bottom of the last tablet, in a hand that does not slant at all, very even, very tired:
    Welcome back. You won't remember this. I will. — P8 #hand
- ended_last_cycle("centre"):
    At the bottom of the last tablet, in the slanted hand, two words, pressed so hard the wax tore:
    First, memory. #hand
- ended_last_cycle("revolution"):
    At the bottom of the last tablet, in the slanted hand: Just this once, she said. It is always just this once. #hand
- dawn_hint() != "":
    At the bottom of the last tablet there is a line you did not write.
    {dawn_hint()} #hand
}
~ learn("other_hand")
{knows("rain_at_midnight") and not ended_last_cycle("promotion"):
    The letters lean the way yours would, if you were in a hurry. If you had done this before.
}
{stele_word() != "":
    Somewhere under the moss of the stele, your own letters survived the flood: {stele_word()}.
}
The city is not awake yet. #action:carve
-> DONE

=== stele ===
The star stele of the temple of Apollo. Tables of eclipses, the five ages, the names of those who led each one.
{stele_word() != "":
    In the crack beneath the moss, in your own hand: {stele_word()}.
}
{not knows("name_in_stone"):
    * [Scrape the moss from the corner] -> scrape
}
* [Run your fingers along the cracks]
    Other letters, scratched, not carved. Different hands. #action:stele_lines
    -> DONE
* [Leave it] -> DONE

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
    A temple guard you have never seen stands at the bronze door, very straight, very new. #speaker:Guard
    Not before the fifth hour, scribe. New orders. #speaker:Guard
    Whose orders, he doesn't say. He doesn't seem to know.
    -> DONE
}
The door to the Hall of Anamnesis. Aristion's key is warm from your hand.
* [Go in]
    ~ notice("hall_access", 0.1)
    The hall is cold. Something in the middle of it is very large and very white. #stage:spiral
    -> DONE
* [Not yet] -> DONE

=== agora_crier ===
{hour() < 20:
    Citizens! Tonight at midnight, on the holy mountain, the Iron Age ends as the stars have written! #speaker:Crier
    Bring nothing. Owe nothing. Tomorrow is gold! #speaker:Crier
- else:
    The crier is hoarse. Up the mountain, citizens. Up the mountain. #speaker:Crier
}
{knows("rain_at_midnight"): You mouth the words with him. You didn't mean to.}
{patched("crier_louder"): He is louder than yesterday. Nobody else seems to notice.}
-> DONE

=== to_shore ===
The path goes down between the rocks to the water.
{knows("rain_at_midnight"):
    * [Go down to the sea] #stage:sea
        -> DONE
    * [Stay in the city] -> DONE
- else:
    Fishermen are hauling their boats up. Nobody sails on the last day.
    -> DONE
}

=== mountain_path ===
{hour() < 22:
    The path up the holy mountain. Tonight the whole city climbs it. Not yet.
    -> DONE
}
The procession is already on the mountain. Torches, ten thousand faces turned up. The priest of Zeus raises his arms over the sacred fire.
Let the world return to its beginning, as the sun returns to its rising. #speaker:Priest of Zeus
* [Put out the sacred fire]
    ~ notice("quenched_fire", 0.34)
    You tip the water jar over the tripod. The fire hisses out. Ten thousand people look at you instead of the sky. #action:ending:exception_handled
    -> DONE
* {knows("cleon_repeats")} [Shout the priest's next words before he can]
    ~ notice("spoke_first", 0.34)
    You shout it first. The crowd turns. Somewhere a woman makes the sign against the evil eye. #action:ending:exception_handled
    -> DONE
* {knows("kora_ally") and knows("debts_reformed")} [Let Kora take the altar from Hierocles]
    Kora climbs onto the altar steps. The dockworkers climb with her. Hierocles looks round for the archons, and the archons are already running. #action:ending:revolution
    -> DONE
* {knows("last_line") and knows("aristion_phyllis")} [Write the last line yourself, cleanly, for Aristion]
    You take out your tablet. You know exactly what the last line is. You write it in your best hand, and give it to Hierocles, and step back into the crowd. #action:ending:sisyphus
    -> DONE
* [Say Yes with them]
    You say yes with them. It is very easy. It is the easiest thing you have ever done.
    -> DONE
* [Go back down] -> DONE

=== midnight ===
The wind rises. It always rises first.
On the mountain ten thousand voices answer the priest. Yes. #speaker:Eferon
Then the rain.
~ learn("rain_at_midnight")
RESET COMPLETED SUCCESSFULLY #log
-> DONE
