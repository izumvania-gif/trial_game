// The prologue: the scribe's house on the first morning, before the city. Three rooms, one thing
// learned in each: the tablet (and the chronicle), Eion in the courtyard (talking, and the déjà vu),
// and the front door (the hour, the city). Played once; see stages/house/HouseStage.ts.

=== prologue_wake ===
Grey light on the wax. You fell asleep over the chronicle again.
Somewhere in the courtyard, someone is humming.
-> DONE

=== prologue_tablet ===
Your chronicle: tablets of wax, a stylus, yesterday written out in your best hand.
At the bottom of the last tablet there is a line you did not write.
Don't look at the sky. Look into the stone. #hand
The letters lean. Yours never do. And yet the name under them is yours.
~ learn("other_hand")
-> DONE

=== prologue_eion ===
Eion sits on the rim of the cistern, his lyre across his knees, his blind face turned to the light.
Leont. You slept at the desk again. I can hear it in how you walk. #speaker:Eion #mood:joy
+ [Eion? What are you doing here?]
    I sang all night at the tavern. Your door was open. It always is, at this hour. #speaker:Eion
+ [Did you write in my chronicle?]
    Me? I can't see the wax, scribe. I can barely see the wine. #speaker:Eion #mood:joy
- Listen. You know this one. The whole city does. #speaker:Eion
Iron rusts, the gods are just, the flood is kind, the gold comes back. #speaker:Eion #dejavu:prologue_ages
Again. This time, say the end before I do. #speaker:Eion #mood:joy
- (again) Iron rusts, the gods are just, ^the flood is kind, the gold comes back. #speaker:Eion #dejavu:prologue_ages
{
- dejavu_ok("prologue_ages"):
    Eion stops playing and laughs.
    There. You heard it before you heard it. Keep that. In this city it is worth more than eyes. #speaker:Eion #mood:wonder
- again < 3:
    Again. #speaker:Eion
    -> again
- else:
    Never mind. It comes back. Everything here comes back. #speaker:Eion #mood:joy
}
He gets up, the lyre on his back.
The sun is coming. I'll sleep under my table at the tavern until the afternoon. At two I sing in the agora, at six in the tavern again, and at eleven I go down to the water. Every day. #speaker:Eion
Write it down, if you want to find me. You write everything else down. #speaker:Eion #mood:joy
He goes out by the front door, humming, one hand on the wall.
-> DONE

=== prologue_sundial ===
A sundial on the courtyard wall. The shadow lies on the first hour.
The day is long. It ends at midnight, like every day in Eferon. Nobody has ever wondered what comes after.
-> DONE

=== prologue_door ===
The front door. Beyond it, Eferon is waking up: shutters, a cart, a rooster on the wrong roof.
+ [Go out into the city] #stage:town
    -> DONE
+ [Not yet]
    -> DONE
