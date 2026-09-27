// The four residents of the demo. Their positions come from content/residents.ts;
// what they say depends on the hour, on what Leont knows, and on what he wears.

=== aristion ===
~ temp fever = 9
{patched("aristion_sleep"):
    ~ fever = 8
}
{hour() >= fever: -> fever_talk}
Aristion lies on a pallet in his doorway, grey as the stone. His eyes are still clear.
{ended_last_cycle("sisyphus"):
    You look tired, boy. Like a man who carried something up a hill in the night, and was glad to. #speaker:Aristion #mood:joy
}
{knows("aristion_trust"): -> after_key}
You will never be at peace. ^Go and look at what they called holy before you. #speaker:Aristion #dejavu:aristion_restless #mood:sorrow
{dejavu_ok("aristion_restless"):
    ~ notice("dejavu_aristion", 0.2)
    His mouth stays open on the words you took out of it. #spend:5
    So you know already. Good. Then I don't have to explain, and I haven't the breath for it. #speaker:Aristion #mood:sorrow
    ~ learn("aristion_trust")
    {knows("hall_key"): -> after_key}
    -> give_key
}
{knows("hall_key"): -> after_key}
He coughs. The fever is climbing his neck; by the fourth hour it will have him.
* [Ask for the key to the Hall of Anamnesis] -> ask_key
* [Ask why he never went into the Hall himself] -> ask_why
* [Let him rest] -> DONE

= ask_key
The key. #speaker:Aristion
{knows("name_in_stone"):
    He looks at you for a long time. #spend:30
    You found your name under the moss, didn't you. I found mine, when I was your age. I put the moss back. #speaker:Aristion #mood:sorrow
    -> give_key
- else:
    Go and read the stele properly first, scribe. The corner. Under the moss. Then come back and ask me again. #speaker:Aristion
    -> DONE
}

= ask_why
Because every Golden Age my Phyllis is at the well again. Twenty years dead, and every Golden Age she is at the well. #speaker:Aristion #mood:sorrow
{stele_word() == "PHYLLIS":
    Someone has carved her name into the stele. Who did that? Who knows her name? #speaker:Aristion #mood:fear
    He grips your wrist. He is afraid of you. For a man like Aristion that is the same as trusting you.
    ~ learn("aristion_trust")
}
~ learn("aristion_phyllis")
Go into the Hall and you will want to break the circle. Break the circle and she stays dead. #spend:20
-> DONE

= give_key
He fumbles the key off his belt and puts it in your hand. It is warm.
~ learn("hall_key")
~ learn("aristion_phyllis")
Look at it. Look at all of it. And then, I beg you, leave it as it is. My wife is at the well. #speaker:Aristion #mood:sorrow
-> DONE

= after_key
{knows("aristion_trust"):
    Go on, then. Look at all of it. #speaker:Aristion #mood:sorrow
    ...And if it is tonight, I will get up. I can still hold a door against two boys with spears. #speaker:Aristion #mood:anger
- else:
    You have the key. What more do you want from a sick old man? #speaker:Aristion #mood:anger
}
-> DONE

= fever_talk
Aristion is burning. He talks to the doorpost.
Phyllis. Is it the well already? Is it gold already? Wait for me at the well, Phyllis. #speaker:Aristion #mood:sorrow
~ learn("aristion_phyllis")
{knows("aristion_trust") and not knows("shard_aristion"):
    His right fist is clenched on something. When you take his hand, he knows you for a moment, and opens it.
    Keep it. It fell out of the wall of the Hall when I was your age. I put the moss back. #speaker:Aristion
    ~ learn("shard_aristion")
- else:
    He does not know you. His right fist is clenched on something, and stays clenched.
}
-> DONE

=== kora ===
{wearing() == "Extinguisher":
    Take that off. #speaker:Kora #mood:anger
    I've seen that face. On the old stones, pouring water on the fire. It didn't work, you know. It never works. #speaker:Kora #mood:anger
}
{
- hour() >= 22: Kora climbs towards the mountain with the procession, a torch in her fist, looking at nobody.
- hour() >= 18: Tonight Kora buys the dockworkers' round at the port tavern. Nobody drinks more than one. Nobody pays.
- hour() >= 13: Kora counts something on her fingers. The agora is done with her; the shrine of Demeter is waiting.
- hour() >= 10: Kora has her arms crossed already. She is waiting for Cleon, and she wants him to see it.
- else: Kora is sweeping the shrine of Demeter as if it had personally offended her.
}
{not knows("kora_debts"):
    Tomorrow is gold, they say. Do you know what else tomorrow is? #speaker:Kora
    Tomorrow every ledger Lysimachus keeps is ash. His, and the ledger of every docker who owes him. The flood is the only amnesty the poor ever get. #speaker:Kora #mood:anger
    So I hate it, and I need it. Don't look at me like that. #speaker:Kora #mood:anger
    ~ learn("kora_debts")
    -> DONE
}
{
- knows("debts_reformed") and knows("kora_ally"):
    By law. You did it by law, in a dead man's face. #speaker:Kora #mood:wonder
    Tonight on the mountain I could take the altar from Hierocles myself. Say the word and I will. #speaker:Kora #mood:joy
    -> DONE
- knows("debts_settled") and not knows("kora_ally"):
    The port owes nobody anything tonight. I don't know how you did it and I don't want to. #speaker:Kora #mood:wonder
- knows("kora_ally"):
    The mountain, at midnight. Give me the words and I'll choke their formula in their throats. #speaker:Kora #mood:anger
    {not knows("debts_settled"):
        And scribe: if you mean to take the flood away from us, find my people another amnesty first. #speaker:Kora
    }
    -> DONE
}
+ {knows("cleon_repeats")} [Tell her Cleon's speech is carved on the oldest stones] -> test
+ [Leave her to it] -> DONE

= test
Carved. On the stones. #speaker:Kora #mood:wonder
She laughs, then stops.
Then tell me what he says after "Citizens of Eferon, we have been told that iron rusts." #speaker:Kora
+ ["I say: let it rust! Let the gold come!"] -> right
+ ["I say: let us polish it, brothers!"] -> wrong
+ ["I say: iron is the metal of free men!"] -> wrong

= right
~ temp speech = 12
{patched("cleon_early"):
    ~ speech = 11
}
She is quiet for a while. #spend:15
{
- hour() > speech:
    He said that in the agora today, word for word. And you didn't hear it there. You had it from the stones. #speaker:Kora #mood:fear
- hour() == speech:
    That is what he is shouting in the agora right now. Word for word. And you were here, with me. #speaker:Kora #mood:fear
- else:
    He hasn't said it yet. He'll say it at the {speech == 11: sixth| seventh} hour, and I'll be standing there, and I'll know it before he does. #speaker:Kora #mood:fear
}
All right, scribe. If the circle is a machine, machines can be jammed. I'll be on the mountain tonight. #speaker:Kora #mood:joy
~ learn("kora_ally")
-> DONE

= wrong
Go away, scribe. I have real work. #speaker:Kora #mood:anger
-> DONE

=== cleon ===
~ temp speech = 12
{patched("cleon_early"):
    ~ speech = 11
}
{
- hour() < speech:
    Cleon is walking up and down the council steps, moving his lips.
    Not now, scribe. At the {speech == 11: sixth| seventh} hour everyone will hear it. Everyone. #speaker:Cleon #mood:joy
    -> DONE
- hour() == speech: -> speech_time
- hour() >= 20:
    Cleon is going up the mountain early, to be seen going up the mountain early.
    -> DONE
- else:
    Cleon is shaking hands in the square.
    Did you hear it? They will remember it forever. Well. Until tomorrow. #speaker:Cleon #mood:joy
    -> DONE
}

= speech_time
{wearing() == "Orator":
    Cleon sees your face before he starts, and stops with one foot on the step.
    Take that off. That is — that's my — no. It's yours. Isn't it. It was always yours. #speaker:Cleon #mood:fear
}
The agora is full. Cleon climbs onto the steps and lifts one arm.
Citizens of Eferon, we have been told that iron rusts. I say: ^let it rust! Let the gold come! #speaker:Cleon #dejavu:cleon_speech #mood:anger
{dejavu_ok("cleon_speech"):
    ~ notice("dejavu_cleon", 0.34)
    The crowd turns from him to you. Cleon's arm is still up, his mouth still closed. #spend:10
    Possessed, someone says. The word travels through the agora faster than you could walk it.
    ~ learn("cleon_repeats")
    -> DONE
}
{knows("rain_at_midnight") and heard("cleon_speech"):
    You knew every word before he said it. Every one. #spend:30
    He believes he wrote it this morning.
    ~ learn("cleon_repeats")
- else:
    The crowd cheers. It is a good speech. It is, you think, a speech you could almost repeat. #spend:30
}
-> DONE

=== eion ===
{
- hour() >= 23: -> shore_talk
- hour() >= 18: -> evening
- hour() >= 14: -> agora_song
- else:
    Eion is asleep under a table at the tavern, one hand on his lyre, snoring in a perfect metre.
    -> DONE
}

= agora_song
Blind Eion sits on the agora steps and sings the five ages for coins. Gold, silver, bronze, heroes, iron.
Iron rusts, the gods are just, the flood is kind, the gold comes back. #speaker:Eion
~ learn("eion_song")
-> DONE

= evening
The tavern is loud and Eion sings through it without raising his voice.
~ learn("eion_song")
{wearing() == "Extinguisher" and not knows("song_of_return"): -> masked}
{stele_word() == "PHYLLIS" and not knows("last_line"): -> new_verse}
{knows("last_line") and knows("hall_key") and knows("past_attempts") and knows("sea_absent"): -> plan}
Iron rusts, the gods are just, the flood is kind, the gold comes back. #speaker:Eion
The same verses as every night. You could sing them with him. You nearly do.
-> DONE

= masked
The song stops in the middle of a word. Eion turns his blind face to you.
I know that face. I wore it, once. Or the one before me did. #speaker:Eion #mood:wonder
You want to know how to fold the day shut. Everybody does, around the third time. #speaker:Eion #mood:joy
He takes your hands and puts them on the strings. Down, left, up. Down, left, up.
The Song of Return. Play it and the morning comes early. Don't ask whose morning. #speaker:Eion #mood:sorrow
R — raise the lyre. Arrow keys pluck the strings. #hint
~ learn("song_of_return")
~ learn("eion_was_leont")
-> DONE

= new_verse
Eion stops. He has heard something no one else in the tavern heard: a name, cut into a stone across the city.
Then he sings a verse you have never heard.
Phyllis at the well, and the scribe with the stylus. The scribe writes the last line, and the city says yes. #speaker:Eion
The scribe writes the last line. The priest only reads it. And the city says yes. #speaker:Eion #mood:sorrow
~ learn("last_line")
Nobody in the tavern notices that he sang it looking straight at you.
-> DONE

= plan
Eion puts the lyre down.
You know what launches it, and who holds the door, and where the hole in the myth is, and what the others tried. #speaker:Eion #mood:wonder
Then it is tonight. Sit. Let's paint it on the table. #speaker:Eion #mood:joy
+ [Plan the night] #action:board
    -> DONE
+ [Not tonight] -> DONE

= shore_talk
Eion stands in the sea up to his ankles, his lyre held high and dry.
It is never the same, the sea. Have you noticed? Nothing else here can say that. #speaker:Eion #mood:wonder
~ learn("sea_differs")
-> DONE
