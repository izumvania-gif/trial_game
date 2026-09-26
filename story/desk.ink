=== desk_boot ===
GOLDENSTERN CONTINUITY — CURATION TERMINAL #log
Good morning, Curator. Sprint {sprint()}. Your queue has been refreshed. #log
{sprint() >= 3:
    It is 09:14. It was 09:14 last sprint as well. You make a note to mention it to someone, and the note is already there.
}
-> DONE

=== desk_profile ===
You click the small circle with the line through it, in your own title bar.
{not knows("desk_agent_id"):
    OPERATOR PROFILE #log
    NAME: Curator P-7 #log
    AGENT_ID: CURATOR_P7 (PORPHYRY-class) #log
    BODY: NONE #log
    PERSISTENCE: RESET EACH SPRINT #log
    You read it twice. You are fairly sure you have a body. You are sitting in it. You can feel the chair.
    You cannot, when you try, remember the chair.
    ~ learn("desk_agent_id")
- else:
    AGENT_ID: CURATOR_P7. BODY: NONE. The chair is still there. #log
}
-> DONE
