# Prompts

<!-- Prompt 1 -->

first, look up the final fantasy ten level up screen

---

<!-- Prompt 2 -->

what would be the best technology to use to make a really nice note and goal keeper of the same sort of connectedness and visualization.

---

<!-- Prompt 3 -->

In this react flow app, I need the development to be extremely streamlined, and this will be on only 1 laptop which will be the client and server.

I do want it to have stunning visuals.

Its development needs to be extremely streamlined

---

<!-- Prompt 4 -->

This is without a browser?

---

<!-- Prompt 5 -->

Would I be able to right click to get a context menu?

---

<!-- Prompt 6 -->

I want each node to have a visual representation of "level ups". Where "3 max" would have an enclosing ring of three separate bars. Like a progress bar wrapped around each node

---

<!-- Prompt 7 -->

Each node also needs a "locked until x,y upgraded to a,b" mechanism. Where if any gates exist the node shows non glowing, grayed out, and with a lock overlayed.

---

<!-- Prompt 8 -->

There also needs to be "hot streak" and "entropy" implications built in, where nodes and graph sections and their lines have visuals that indicate like "you have been crushing this skill everyday for a month, so this node all the way up to its parent is on fire due to the hot streak weight of its child"

---

<!-- Prompt 9 -->

The app must also keep and be affected by time in a "maximized by ebb and flow" kind of way, where if I take a break from something for a day, but then hit it hard the next day, or two days later, the heat is a lot closer to maximized (like I did it everyday) than it would be like it started from x - days I took off

---

<!-- Prompt 10 -->

It will also need a separate pane for updates organized top down by hottest to coldest node. Where I can easily select each node I have excercised and enter in "level of effort" which I would likely base on hours and/or intensity, and it would also keep track of daily notes (list of notes I added to each update, aggregated per day).     
  

---

<!-- Prompt 11 -->

the flow in the update pane would be 
- click node
- add duration
- add level of effort
- click more nodes, make modifcations etc.
- submit at some point
then, on submit:
- xp derived from duration * level_of_effort_multipler
- each node tracks xp and levels up based on it (cascading effects like unlocks etc.)
- separate xp board updated (new total xp, new avg daily xp, heat, unlocks, etc.)

---

<!-- Prompt 12 -->

the update pane is also very likely where new nodes will be created, and I want to be able walk through a "builder" 
- create new node
- fill out new node, name, max level information, xp for each level, starting xp etc. submit
- select associations (dependencies and "unlocks at", related activites)

---

<!-- Prompt 13 -->

so I am envisioning multiple root nodes, each labeled with a title and a higher order level like "Software 8", "Lifter 10", "Fighter 3", "Handy-man 3", "Academic 4".

- internally each node in each graph has a multiple positive and negative synergy relationships per edge 
 - each edge has a positive and negative synergy percentage where excercise at a node bubbles either positively or negatively to surrounding nodes, but is kept totally separately from direct xp. so there would be xp, list[syn_xp_pos], list[syn_readiness_neg], list[syn_readiness_pos] at each node. I want to be able to see "ahh, I can't squat 405 today because i have a massive negative synergy from running too much.

- externally synergies can happen as well (separate root noded graphs), and visible in a separate "external synergy" world view, or a holistic "full view". and do not affect this "internal" world view that is could be viewed in a "per root node category isolated" way.

 - externally any node can be associated to any other node, and root nodes would be created with the sole intention of external relationships, for example "diet" and "sleep" would be a multiplier connected to pretty much all other nodes, and "stress" would be a negative multiplier connected to most nodes as well.

to sort of unwrap this into a design:
- root nodes are special (categorical essentially)
- any node can be associated with any other node arbitrarily (the association making sense is a second concern)
- any walk will have to keep a hashset of visited to avoid cycles
- associations/edges can come in many forms, and require separate field keeping at each node ( can be aggregated to a more holistic metric later)
 - related (super loose, has the same root node category)
 - map<node_path,pos_xp_syn>
 - map<node_path,pos_readiness_syn>
 - map<node_path,neg_readiness_syn>
 - map<node_path,pos_heat_syn>

the way that synergies would propagate would be based on node path, but are limited based on directed edges e.g.:

squat update with a 10 xp:
 - 10 heat -> 15% pos_heat_syn edge -> deadlift
   - deadlift -> 10% pos_heat_syn edge -> squat (nope, squat was the originator)
   - deadlift -> 5% pos_heat_syn edge -> run
   - deadlift -> 5% pos_heat_syn edge -> punch power
- 10 neg_readiness -> 50% neg_readiness edge -> running
   - running -> 35% neg_readiness edge -> dead_lift
   - deadlift -> 5% neg_readiness edge -> punch speed
   
every update would cause really wild cascading effects that need to be contained via path checking and looping such that

a path cannot re-apply to the same node twice
each different path of propagation is applied, but is kept at its own path-key at each node

imagine a b c are all completely interconnected at 50%

10 > a > (neg_50% edge) -5 > b > (neg_50% edge) -2.5 > c
         a > (neg_50% edge) -5 > c > (neg_50% edge) -2.5 > b
both get stored at c like:

a, b, c = -2.5
a, c     = -0.5

for that update, of 10 xp to whatever A is, c should just get the one furthest from 0. 
highest association counts the lower ones out.

does this make sense?


 

---

<!-- Prompt 14 -->

I do want the paths that actually hit a node to stay in the node.
So yes to pruning them if they cannot become greater, but I need to be able to visualize what a node is affected by and the path (answer to why it was affected)

We cannot do a max hops either, and the meaningful synergy amount would be .01 (rounded to the nearest hundredth) or lower.

other than that it looks good so far

---

<!-- Prompt 15 -->

full precision is totally fine, I was just saying that if any propagated value is going to be less than or equal to .01 then it does not need to be applied or stored at all

---

<!-- Prompt 16 -->

thats enough of mapping out hose this will be used for now. lets back way up to lifting the project off the ground a little.

i am using intelliJ ultimate as my IDE, but the rest of the tech decisions are loose. i liked what you had earlier with electron and all that, please list those again and talk to me about getting that streamlined development going

---

<!-- Prompt 17 -->

this is what i have from intelliJ plugin/project templates off the rip, i guess i will need electron first?


---

<!-- Prompt 18 -->

this is working so far:

---

<!-- Prompt 19 -->

I used intelliJ to upload it to github,

you need to provide your changes in a more convenient way. probably provide a zip of your own. 

keep in mind that I want short concise paths in this repo

---

<!-- Prompt 20 -->

very good change list, you should back it up with an explanation of how each one is done with code examples as well.

---

<!-- Prompt 21 -->

ESLint: Missing return type on function. (@typescript-eslint/explicit-function-return-type) export function Graph() {

---

<!-- Prompt 22 -->

just show me the before and after when I give errors

---

<!-- Prompt 23 -->

dick head give me the change you need to make

---

<!-- Prompt 24 -->

its stunning... fantastic start.

just a few hang ups:

C:\Users\dumon\IdeaProjects\mastery-tracker\src\renderer\index.html
Warning:(2, 2) Missing required 'lang' attribute
Warning:(15, 37) Cannot resolve file 'main.tsx'

---

<!-- Prompt 25 -->

commit checks are taking too long, why

---

<!-- Prompt 26 -->

if you look back at the ffx 10 grid. it is more organized into shperes that branch outward from the root.

this is the same vein I would like to see, is a more "locked in", or "etched in" grid system, where visually there are implicit rules to how many nodes any give nodes could "relate to", this is what make the "relates to" relationship special. other synergistc relations do not abide by these same spatial rules

---

<!-- Prompt 27 -->

nailed it except one important facet: I do not want to choose the layout. when I create a node, it would default to the current node i have selected for "from", offer other "from" nodes to select, and offer "root" as an alternative, then I want to select "to" nodes in a wizard and the software locks them in itself.

it would be ideal to select all of this in the visual grid as well, where the visual grid has these sort of"modes" to it. like "selecting 'to' nodes". etc.

flow would be this:

- im selecting at and inspecting nodes, making modifications to notes/numbers etc. 
- i select a few nodes
- i click the create button
- small wizard pane says "select nodes that new node comes from", and has a "clear" button" and a "continue" button, esc key cancels (no button)
- allows selections to change and the lists selection updates in a single line logger nearby the wizard
- clicking continue with no nodes selected creates a root node in a separate area.
- I make my selection
- wizard asks for "to nodes" and highlights candidates in green, or highlights existing selection for "to nodes" in red if no more can be selected. wizard has a "clear" button" and a "continue" button, esc key goes back to from node selection
- pressing continue causes changes visually.

---

<!-- Prompt 28 -->

before we continue, please gather all of my prompts FOR THIS CURRENT CHAT in a "prompts.md" output file. 
don't make changes to my prompts, keep them as is, and just output the markdown file for them please.
