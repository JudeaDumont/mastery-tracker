
batch wizard:
- search assist with enter + arrow keys
- search assist has "new node" item along with search results
- enter each one as you go along, and fill out as much as you want
- new nodes go through the topology selection wizard per node until all are finished



- each node needs to have a task list associated with it
- each node should have a "recurring expected tasks" associated with it
- visual for this should be little unfilled orbs attached to the node, on hover would show the task that recurred


- each node needs update history

- create node structure:
-  ng > gemsbok perf > 1986 = moving to new repo
-  ng > gemsbok dynamic deployments > 3619 = ticket imported, need gemsbok latest after merge of 1986 metrics.

- when creating a new node, the default text for the name should be selected or "backgrounded"

- need undo methodology

- "update mode" > type node name > drop down with nav: up, down, enter >
- enter selects node and brings up update menu > fill out xp, intensity, bread crumb trail with notes > enter > back to node search.

- when selecting nodes, the last selected node should be the first one in the update pane

- root nodes have shared experience, but parent nodes do not


- progress bar for each node should show any xp update by filling current level bar proportionally, not just whole levels being satisfied.

- created banner needs to come in then fade out at the top, and should not be part of the right pane

- need to be able to put deadlines on nodes, and their should be alerts based on upcoming deadlines (d < 7 days out) every 24 hours.

- selecting a node should have some kind of highlighting effect on its attached edges all the way down to leaves.

- tabs should be able to grow past 4, and should have horizontal arrows to select more.

- max level should be capped at like 30 or something, otherwise the visual is indescipherable
- root node notch overlaps notes display

- switching to the create node mode changes all the colors of all the graphs in that mode.
-
- need better visual indication that a node is selected


- create a sequential stack for getting ng setup,
-
- support for task stacks
- denoting a tasks relatinoship to the next task as "parallel" or "sequential" is useful
- this would be a separate display that batches together updates that are typically ran together
- these would be used to visually showcase effective task execution.
- so id go to this display and look at a stack I want to prioritize, and execute it
- then it would walk me through updating each node associated with each task
- for every update it would zoom to the node i am currently updating so I can see more of the surrounding graph around each node
-
- stacks need to be on their own display
 -
 - sequential stacks can also be paralellized in a side by side dynamic: (complicated)-
  - smart card                  -
  - login                       -
  - setup argo (long running)   - cgpt for other ng task
  - but this is more about identifying long running tasks in sequential stacks

- need enter to navigate node creation
- need to be able to change node relationships
- finished nodes should have a "locked in looking star overlay" in addition to the nice crown
- selecting a node should probably just be a single at a time, instead do shift for group selection and ctrl for group management
- section for measurement metrics? T would be one...
 - no, it would be a display that counts references to specific terms in updates and aggregates them together.
- gemsbok perf metrics node should be renamed to "gemsbok perf metrics plan"

- use the software to plan family trips
-
- iterate over these changes with the intention of operating at a higher order magnitude for improvements.
 - some items will be overtaken by earlier implemented items.
 - have cgpt turn these into nice looking markdown first
 -
 - not a huge fan of the visual when a parent has only one child.


==================FINISHED============================================
- template text for deadlines is confusing, should jsut say "type date numbers" or some shit
- deadline pane in notes display takes up too much real estate, lets put it behind the deadline icon
-
- the color for deadline materials should be a deep forest green, glowing lime greem
- an update can have a "deadline" associated with it
- nodes that have a deadline should be marked with an icon affixed to the top of the node
- hovering over this icon should reveal what update is due and when
- the same icon should be found in the header, and this should give a display of what is due,
- the display should be a scrollable area that starts at the bottom, where the soonest deadline can be found
- the later deadlines follow above in order
- both the notes display and the deadlines display should contain a textbox to enter or edit a deadline, and a deadline icon crossed out to remove them
- the text box should accept many forms of dates, and needs to be smart about interpreting them.
- "08/13", "1231", "20260813", "13 days", "08/13/2026", "0119" should all be considered valid and set correct assumed dates internally
- 08/13/2026, 12/31/2026, 08/11/2026, 08/13/2026, "01/19/2027"
- do not interpret past the day.

- level settings and other node settings need to be in a separate display,
- the expanded update display should have a gear icon where settings display can be acccessed.
- there should be a "clear button" on the updates pane that clears the current selection

- double clicking a node should zoom to that node such that the full notes display could be viewed above
- clicking on the tabs in the header should zoom to the full graph under that root node

- need a way of setting "level steps", where in the update pane I can set the additional xp for another level,
  putting in 1000 would mean each level requires another 1000 xp, the default for a level up should be about 100
  the wizard should not ask for this value, but should offer a box in which the default can be changed  need to be able to change number of max levels as well etc.

- need the parent node to be able to be non root nodes

- xp should default to 0
- updates without notes should not create an update in history (say if just level cap changed etc.)
- if xp is at 0 and there is a note, show a warning that there was a note with no xp, and do not continue.



- the notes at each node need to be visible on hover (starting at the bottom) and scrollable instead of those metrics,
