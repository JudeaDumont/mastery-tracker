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
- Batch duration, effort, and note entry
- XP awards, level-ups, unlock checks, and heat changes
- In-memory activity history and XP board

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

The next slice should add JSON persistence through `src/main` and `src/preload`.
