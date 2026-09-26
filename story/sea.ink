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
Glaucus, the priest of Poseidon, the one who keeps no calendar, is standing in the water up to his knees. #speaker:Glaucus
It's dangerous to go on alone. Take this. #speaker:Glaucus
He puts a knife in your hand, handle first.
* [Cut your palm]
    The blood goes into the water, and the water does not care. That is the point.
    You won't return to the beginning, scribe. Yes? #speaker:Glaucus
    ** [Yes]
        {night("citySilent"):
            Up on the mountain the city is silent. Kora is standing in front of the priest of Zeus, and nobody is answering anybody.
        - else:
            Up on the mountain ten thousand voices answer the priest of Zeus. Yes. Theirs, not yours.
        }
        The wind before the storm does not come. #action:ending:curator_missing
        -> DONE
