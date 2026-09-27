=== shore ===
The sea.
It does not look like it did yesterday. It never does.
~ learn("sea_differs")
-> DONE

=== sea_final ===
The path down is dark, and then it isn't: the sea has its own light.
{night("shoreClear"):
    Nobody is waiting on the rocks.
- else:
    Lysimachus is on the rocks with a lamp, watching the water. Let him watch.
}
Glaucus, the priest of Poseidon, the one who keeps no calendar, is standing in the water up to his knees.
It's dangerous to go on alone. Take this. #speaker:Glaucus
He puts a knife in your hand, handle first.
+ [Cut your palm]
    The blood goes into the water, and the water does not care. That is the point.
    You won't return to the beginning, scribe. Yes? #speaker:Glaucus #mood:wonder
    ++ [Yes]
        {night("citySilent"):
            Up on the mountain the city is silent. Kora is standing in front of the priest of Zeus, and nobody is answering anybody.
        - else:
            Up on the mountain ten thousand voices answer the priest of Zeus. Yes. Theirs, not yours.
        }
        The wind before the storm does not come.
        {true_night():
            -> free
        }
        For a long moment nothing happens at all. #action:ending:curator_missing
        -> DONE

= free
Nothing happens. It goes on not happening.
Up in the Hall there is only dust. Upstairs, in a room with no weather, a ticket stays where it is, and a Curator who has no chair does not approve anything.
UNHANDLED EVENT: NON-CONFORMANT RITUAL OUTPUT TO RANDOM OCEAN LAYER #log
AUTO-RESET: DISABLED #log
MODE: FREE EVOLUTION #log
Glaucus is gone. You are standing in the sea on your own. Behind you the city is dark and silent and there, for the first time.
The criminal who broke the ritual, or the prophet who ended the ages. They will want you to be one of them by morning.
+ [Walk along the shore to the old hut by the water]
    You walk. The sea comes up to your ankles and goes back, differently every time. #action:wake_test:true
    -> DONE
+ [Go back up to the city. Someone has to tell them what happened]
    You turn back towards the city. You have so much to tell them. #action:wake_test:prophet
    -> DONE
