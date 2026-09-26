=== spiral_enter ===
A disk of white marble, taller than three men, carved in a spiral that runs inward to an empty circle.
The outer ring is the market. The council. The plague ships. This year.
~ learn("spiral_repeats")
Drag a ring to turn it. Click a carved scribe to study him. Tab — the registry. #hint
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
* [Hold on to it] #stage:desk
    -> DONE
* [Let go] The hall comes back. Your heart is going like a hare's.
    -> DONE

=== registry_confirmed ===
The three carvings seem to settle into the stone, as if they had been waiting to be read correctly.
{identified("l1") and not has_mask("Extinguisher"):
    The face of the scribe with the water jar was chiselled smooth. You touch it, and the smooth face comes away in your hand like a mask.
    ~ give_mask("Extinguisher")
    ~ learn("mask_extinguisher")
    M — put on the mask, in the city. #hint
}
{registry_locked() >= 3:
    ~ learn("registry_three")
}
{registry_locked() >= 6:
    Six scribes. Six ways to fight the day. Six floods, fires, stonings, and one old singer.
    ~ learn("past_attempts")
    ~ learn("eion_was_leont")
    You look over the whole spiral again, ring by ring, for something you have not seen. And there it is, because it is not there:
    there is no sea on the spiral. Not one wave. Not a boat, not a shore. The city on the stone has no edge.
    ~ learn("sea_absent")
}
-> DONE
