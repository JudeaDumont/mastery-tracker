
batch wizard:
- search assist with enter + arrow keys
- search assist has "new node" item along with search results
- enter each one as you go along, and fill out as much as you want
- new nodes go through the topology selection wizard per node until all are finished



- each node needs to have a task list associated with it
- each node should have a "recurring expected tasks" associated with it
- visual for this should be little unfilled orbs attached to the node, on hover would show the task that recurred

- each node should have "parallelized stacks" associated with it
- each node needs update history

- create node structure:
-  ng > gemsbok perf > 1986 = moving to new repo
-  ng > gemsbok dynamic deployments > 3619 = ticket imported, need gemsbok latest after merge of 1986 metrics.

- the notes at each node need to be visible on hover (starting at the bottom) and scrollable instead of those metrics,

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
- visuals

- level settings and other node settings need to be in a separate display,
- the expanded update display should have a gear icon where settings display can be acccessed.
- there should be a "clear button" on the updates pane that clears the current selection

==================FINISHED============================================


- double clicking a node should zoom to that node such that the full notes display could be viewed above
- clicking on the tabs in the header should zoom to the full graph under that root node

- need a way of setting "level steps", where in the update pane I can set the additional xp for another level,
  putting in 1000 would mean each level requires another 1000 xp, the default for a level up should be about 100
  the wizard should not ask for this value, but should offer a box in which the default can be changed  need to be able to change number of max levels as well etc.

- need the parent node to be able to be non root nodes

- xp should default to 0
- updates without notes should not create an update in history (say if just level cap changed etc.)
- if xp is at 0 and there is a note, show a warning that there was a note with no xp, and do not continue.
