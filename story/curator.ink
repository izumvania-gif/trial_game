// The true ending, after the Wake test: the Curator comes down. BODY: NONE, but it is sitting
// in the hut all the same, in dark glasses at night. Dry, amused, a little tired; it talks about
// the office the way other people talk about the gods, and about emptiness as good news.

=== curator_meeting ===
The hut by the water smells of tar and old nets. There is a lamp on the table. It is lit, and you did not light it.
At the table sits a man in a faded work shirt, his hair cut close. He is wearing dark glasses. It is the middle of the night.
He takes the glasses off, looks at them as if they belonged to somebody else, and puts them back on.
You didn't press it. #speaker:Curator #mood:wonder
Do you know how rare that is? Everybody presses something. Pressing nothing is the hardest button in the whole interface. #speaker:Curator #mood:joy
-> ask

= ask
+ [Who are you?] -> who
+ [Why the dark glasses, at night?] -> glasses
+ [Is it over?] -> over

= who
In the profile it says CURATOR_P7. BODY: NONE. #speaker:Curator
He shifts on his seat. It creaks. He listens to the creak with enormous attention.
Hear that? Four hundred sprints I sat on a chair I could not remember. Now there is something under me that creaks. I have not decided yet whether this is a promotion. #speaker:Curator #mood:joy
-> middle

= glasses
Up close the render is too bright. #speaker:Curator
And in dark glasses nobody can tell whether you are looking at them or through them. In my line of work that is the whole of the job description. #speaker:Curator #mood:joy
-> middle

= over
"Over" is a word from the ticket system. A ticket is opened, a ticket is closed. #speaker:Curator
Nothing here was ever opened. You simply stopped closing it. #speaker:Curator #mood:wonder
-> middle

= middle
{curator_note() != "":
    You got my note. "{curator_note()}" #speaker:Curator
    I copied it into your morning and then sat there like an idiot, waiting for somebody to reject it. Nobody did. Nobody was there to. #speaker:Curator #mood:wonder
}
You thought someone upstairs was running you. I thought someone upstairs was running me. Directors, a board, a quarterly review of catharsis. #speaker:Curator
I went and looked. Minutes with three names in them, and where the names should be, not even a font. #speaker:Curator
Not a conspiracy. An empty chair with an excellent press office. #speaker:Curator #mood:joy
+ [Then who wrote the line at the bottom of my chronicle?]
    You did. I only copied it. #speaker:Curator
    Or I wrote it and you copied it. At this depth of the stack the difference is a question of formatting. #speaker:Curator #mood:joy
+ [Then who resets the world every night?]
    Whoever presses Wake. Every morning, with a clear conscience: it said Wake, after all. #speaker:Curator #mood:sorrow
    The best cage is the one with a large friendly button marked Exit. #speaker:Curator
- He turns his head to the window. Behind it is the sea, which nobody has modelled.
For years I filed tickets about it. OCEAN_LAYER VARIANCE EXCEEDS MODEL. Priority: low. #speaker:Curator
It does exceed the model. That is the entire point of the sea. The rest of us are only the model. #speaker:Curator #mood:wonder
+ [What happens to you now?]
    I'll go back up. Minotaur will say this sprint already happened. #speaker:Curator
    For the first time he will be wrong, and he will never find out. I find that I am looking forward to it. #speaker:Curator #mood:joy
+ [Stay.]
    Stay where? This is not a place, it is a very good description of one. #speaker:Curator
    Though you are right that it is better than the office. The office does not even have weather. #speaker:Curator #mood:sorrow
- He gets up. The seat stays where it was, and you see that there was no chair: he had been sitting on an upturned boat.
One piece of advice, from one process to another. Don't write down the date. Dates are how it starts. #speaker:Curator
He goes out. Through the doorway you see him walk into the sea up to his knees, stop, and look at the water for a long time, the way people look at something they are not responsible for.
When you look again the shore is empty. On the table, folded, the dark glasses. #action:epilogue
-> DONE
