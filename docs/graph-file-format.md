# Mastery Tracker graph file

Mastery Tracker stores graph state in `mastery-graph.json` inside Electron's per-user `userData` directory.

## Compatibility contract

- `format` identifies the file independently from the application version.
- `schemaVersion` is an integer and currently uses version `3`.
- Readers migrate older versions before hydrating the store.
- Version 3 accepts version 2, version 1, the unversioned prototype shape, and Zustand-style `{ "state": ... }` wrappers.
- Version 1's global `history` array is distributed into each matching node's `updateHistory` during migration.
- Version 2 files receive default new-node level settings during migration.
- Legacy `heat` values migrate to `momentum`.
- Legacy cumulative `thresholds` migrate to independent `levelXpRequirements`.
- Unknown fields are ignored, so additive fields remain backwards compatible.
- A file with a newer unsupported schema version is never overwritten.
- Writes use a temporary file and keep `mastery-graph.json.backup` as the previous complete save.
- Invalid JSON is moved aside with a `.corrupt-<timestamp>` suffix instead of being destroyed.

## Version 3

```json
{
  "format": "mastery-tracker.graph",
  "schemaVersion": 3,
  "savedAt": "2026-07-28T12:00:00.000Z",
  "data": {
    "roots": [
      {
        "id": "lifter",
        "title": "Lifter",
        "accent": "teal",
        "updateHistory": []
      }
    ],
    "skills": [
      {
        "id": "squat",
        "rootId": "lifter",
        "title": "Squat",
        "xp": 340,
        "maxLevel": 3,
        "levelXpRequirements": [100, 100, 100],
        "levelReachedAt": ["2026-07-01T12:00:00.000Z"],
        "momentum": 42,
        "gates": [],
        "updateHistory": [
          {
            "id": "2026-07-28T12:00:00.000Z-squat",
            "nodeId": "squat",
            "occurredAt": "2026-07-28T12:00:00.000Z",
            "minutes": 60,
            "effort": "moderate",
            "xp": 60,
            "note": "Worked on depth and bracing."
          }
        ]
      }
    ],
    "links": [],
    "todayXp": 60,
    "levelDefaults": {
      "levelStepXp": 100,
      "maxLevel": 3
    }
  }
}
```

Every root and skill owns an `updateHistory` array. Entries are retained chronologically and contain the submitted time, effort, XP, note, and timestamp for that node.

`levelXpRequirements` remains the canonical per-node level-cost array. The expanded node card can replace it with one repeated step or change the node's maximum level without resetting lifetime XP.

`levelDefaults` controls only newly created mastery nodes. The Updates pane edits these defaults directly. Existing nodes retain their own level configuration until edited individually.

Transient UI state such as selections, open panels, unfinished updates, and an unfinished create wizard is intentionally not persisted.

## Version 2 migration

Version 2 already stores update history on each node but has no `levelDefaults` object. It migrates to version 3 with:

```json
{
  "levelStepXp": 100,
  "maxLevel": 3
}
```

Existing node-specific XP requirements and maximum levels remain unchanged.

## Version 1 migration

Version 1 stores activity in one top-level `history` array. During migration, each entry is copied into the matching root or skill's `updateHistory`. Duplicate entry IDs are removed and entries are sorted chronologically.

## Adding version 4

1. Add a new versioned document type.
2. Add a deterministic migration to the new shape.
3. Keep all existing migration paths.
4. Normalize and validate the migrated result before applying it to the store.
5. Write only the newest version after a successful load.
