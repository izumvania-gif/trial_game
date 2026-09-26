=== dawn ===
{cycle() == 1:
    Grey light on the wax. You fell asleep over the chronicle again.
- else:
    Grey light on the wax. You fell asleep over the chronicle. Again.
}
At the bottom of the last tablet there is a line you did not write.
Don't look at the sky. Look into the stone. #hand
~ learn("other_hand")
{knows("rain_at_midnight"):
    The letters lean the way yours would, if you were in a hurry. If you had done this before.
}
-> DONE

=== stele ===
The star stele of the temple of Apollo. Tables of eclipses, the five ages, the names of those who led each one.
{not knows("name_in_stone"):
    * [Scrape the moss from the corner] -> scrape
    * [Leave it] -> DONE
- else:
    Under the official text, in the crack, the older line is still there. LEONTOS. #spend:5
    -> DONE
}
= scrape
You scrape with your thumbnail. The moss comes away in one wet piece. #spend:10
Beneath it, smaller than the rest and older than the rest, a line of letters. Most are gone.
One word survived. LEONTOS.
There are many Leonts in Eferon. You tell yourself that twice.
~ learn("name_in_stone")
-> DONE

=== temple_door ===
{knows("name_in_stone"):
    The door to the Hall of Anamnesis. Only the high priests go in.
    It is not locked. It has never been locked, you realise. Nobody ever tried it.
    * [Go in] The hall is cold. Something in the middle of it is very large and very white. #stage:spiral
        -> DONE
    * [Not yet] -> DONE
- else:
    A bronze door at the back of the temple. You have walked past it every day of your life.
    You have no reason to open it. Not yet.
    -> DONE
}

=== agora_crier ===
A crier on the steps of the council house. #speaker:Crier
Citizens! Tonight at midnight, on the holy mountain, the Iron Age ends as the stars have written! #speaker:Crier
Bring nothing. Owe nothing. Tomorrow is gold! #speaker:Crier
{knows("rain_at_midnight"): You mouth the last words with him. You didn't mean to.}
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

=== midnight ===
The wind rises. It always rises first.
On the mountain ten thousand voices answer the priest. Yes. #speaker:Eferon
Then the rain.
~ learn("rain_at_midnight")
RESET COMPLETED SUCCESSFULLY #log
-> DONE
