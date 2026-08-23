# Mastery Tracker

Local-first Electron prototype for a visual mastery graph.

## Run

```powershell
npm install
npm run dev
```

The install step adds React Flow and Zustand, which were not in the original Electron scaffold.

## Included in this slice

- Luminous React Flow canvas with draggable nodes
- Segmented radial level rings
- Root node plus Squat, Deadlift, and Running
- Level-gated locked node
- Hottest-to-coldest update pane
- Single-node duration, effort, and note entry
- XP awards, level-ups, unlock checks, and heat changes
- Persistent activity history and XP board

## Graph state and Git sync

When the app runs from a Git checkout, its canonical graph state is
`data/mastery-graph.json`. That file is intentionally committed to the repository, so normal
Git commits preserve graph history and make the graph portable between devices.

```powershell
git add data/mastery-graph.json
git commit -m "Update mastery graph state"
git push
```

Pull the latest commit before opening the app on another device. The app does not create Git
commits automatically.

The first launch after this storage change imports the previous Electron `userData` copy when the
tracked file is still the repository seed. Packaged builds that are not running inside a Git
checkout continue to use Electron `userData`. Set `MASTERY_GRAPH_STATE_PATH` to an absolute file
path to override either location.

## Short source layout

```text
src/renderer/src/
  App.tsx
  model.ts
  store.ts
  xp.ts
  ui/
    Graph.tsx
    MasteryNode.tsx
    Updates.tsx
```
