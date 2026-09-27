=== spiral_enter ===
A disk of white marble, taller than three men, carved in a spiral that runs inward to an empty circle.
The outer ring is the market. The council. The plague ships. This year.
~ learn("spiral_repeats")
Drag — turn a ring · Click — study a scribe · Tab — registry #hint
-> DONE

=== spiral_aligned ===
Two rings lock with a sound like a tooth breaking.
On both of them, in the corner of the same scene, a small figure with a stylus and a tablet, looking up.
On the ring inside that one, the same figure. Coarser. Still you.
~ learn("leont_on_every_ring")
In the crack between the rings there is a mark. A small circle with a line through it.
~ learn("seam_symbol")
-> DONE

=== spiral_seam ===
You touch the mark. The marble goes smooth and cold, like no stone you know.
LOG: CYCLE RUN — LEONT_ASTRO_ASSIST FAILED TO ALTER RESET TIMING #log
+ [Hold on to it] #stage:desk
    -> DONE
+ [Let go] The Hall comes back. Your heart is going like a hare's.
    -> DONE

=== registry_confirmed ===
The carvings seem to settle into the stone, as if they had been waiting to be read correctly.
{identified("l1") and not has_mask("Extinguisher"):
    The face of the scribe with the water jar was chiselled smooth. You touch it, and the smooth face comes away in your hand like a mask.
    ~ give_mask("Extinguisher")
    ~ learn("mask_extinguisher")
    M — put on or change a mask (in the city) #hint
}
{identified("l2") and not has_mask("Orator"):
    The inlaid face of the scribe on the council steps loosens under your thumb. It is warm, as if someone had just been speaking through it.
    ~ give_mask("Orator")
    ~ learn("mask_orator")
}
{identified("l3") and not has_mask("Killer"):
    The face of the scribe with the knife comes out of the deep carving whole. It is heavier than the others.
    ~ give_mask("Killer")
    ~ learn("mask_killer")
}
{identified("l12") and not has_mask("Blank"):
    Where the vanished scribe clasped hands with the stranger there is a smooth oval of marble. It comes away. It is not a face at all.
    ~ give_mask("Blank")
    ~ learn("mask_blank")
}
{registry_locked() >= 3:
    ~ learn("registry_three")
}
{registry_locked() >= 9 and not knows("past_attempts"):
    Nine scribes. The fire, the date, the priest, the speech, the sacrifice, the tablets, the warning, the flight, the song. Nine ways to fight the day, and the day came back after every one.
    None of them touched the stone you are standing in front of. It was their memory. It was their weapon.
    ~ learn("past_attempts")
    ~ learn("eion_was_leont")
}
{registry_locked() >= 18 and not knows("shard_registry_18"):
    Something small falls out of the spiral and ticks across the floor: a chip of the marble, from nowhere you can see.
    ~ learn("shard_registry_18")
}
{registry_locked() >= 24 and not knows("shard_registry_24"):
    Another chip falls. The spiral does not look damaged. It looks lighter.
    ~ learn("shard_registry_24")
}
{registry_locked() >= 30 and not knows("shard_registry_30"):
    A third chip. You could swear the inner ring turned a little by itself.
    ~ learn("shard_registry_30")
}
{registry_locked() >= 36 and not knows("registry_all"):
    Thirty-six. Every scribe on every ring has a name, and every name is yours.
    A last chip falls from the empty centre. The circle is still empty.
    ~ learn("shard_registry_36")
    ~ learn("registry_all")
}
{registry_locked() >= 12 and not knows("sea_absent"):
    -> no_sea
}
-> DONE

= no_sea
You look over the whole spiral again, ring by ring, for something you have not seen. And there it is, because it is not there:
there is no sea on the spiral. Not one wave. Not a boat, not a shore. The city on the stone has no edge.
~ learn("sea_absent")
-> DONE

=== spiral_no_sea ===
Glaucus keeps no calendar. The sea keeps none either. You look for it on the stone. Market, council, plague ships — plague ships without water under them.
-> registry_confirmed.no_sea

=== spiral_shard ===
On the outer ring, where there has never been anything, a carving you have never seen.
A scribe at the very edge of the stone, cutting his palm over nothing. Where the sea should be, the carver left the marble blank.
You do not remember doing it. The stone does.
-> DONE
