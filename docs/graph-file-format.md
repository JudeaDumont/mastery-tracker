# Mastery Tracker graph file

Mastery Tracker stores graph state in `mastery-graph.json` inside Electron's per-user `userData` directory.

## Compatibility contract

- `format` identifies the file independently from the application version.
- `schemaVersion` is an integer and currently uses version `4`.
- Readers migrate older versions before hydrating the store.
- Version 4 accepts versions 3, 2, 1, the unversioned prototype shape, and Zustand-style `{ "state": ... }` wrappers.
- Version 1's global `history` array is distributed into each matching node's `updateHistory` during migration.
- Versions 1-3 infer the initial XP ledger from existing node note histories. XP submissions that were never historically stored cannot be reconstructed.
- Version 2 files receive default new-node level settings during migration.
- Legacy `heat` values migrate to `momentum`.
- Legacy cumulative `thresholds` migrate to independent `levelXpRequirements`.
- Unknown fields are ignored, so additive fields remain backwards compatible.
- A file with a newer unsupported schema version is never overwritten.
- Writes use a temporary file and keep `mastery-graph.json.backup` as the previous complete save.
- Invalid JSON is moved aside with a `.corrupt-<timestamp>` suffix instead of being destroyed.

## Version 4

```json
{
  "format": "mastery-tracker.graph",
  "schemaVersion": 4,
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
    "xpLedger": [
      {
        "id": "2026-07-28T12:00:00.000Z-squat",
        "nodeId": "squat",
        "occurredAt": "2026-07-28T12:00:00.000Z",
        "minutes": 60,
        "effort": "moderate",
        "xp": 60,
        "note": "Worked on depth and bracing."
      },
      {
        "id": "2026-07-28T14:00:00.000Z-squat",
        "nodeId": "squat",
        "occurredAt": "2026-07-28T14:00:00.000Z",
        "minutes": 30,
        "effort": "light",
        "xp": 23,
        "note": ""
      }
    ],
    "todayXp": 83,
    "levelDefaults": {
      "levelStepXp": 100,
      "maxLevel": 3
    }
  }
}
```

`xpLedger` is the authoritative chronological record of every XP submission, including submissions without notes. The Daily Updates overlay groups these entries by the user's local calendar day.

Every root and skill also owns an `updateHistory` array. That array contains only updates with notes and drives the node-hover notes display.

When a noted update is deleted from the hover display, the matching ledger entry is also removed. The node's XP, level dates, momentum contribution, daily totals, and lock state are recalculated.

`levelXpRequirements` remains the canonical per-node level-cost array. Node settings can replace it with one repeated step or change the node's maximum level without resetting lifetime XP.

`levelDefaults` controls newly created mastery nodes. The creation card edits these defaults directly. Existing nodes retain their own level configuration until edited individually.

Transient UI state such as selections, open panels, unfinished updates, and an unfinished create wizard is intentionally not persisted.

## Version 3 migration

Version 3 has node note histories but no complete XP ledger. Migration copies every existing node-history entry into `xpLedger`. XP updates that had no note were not retained by version 3 and therefore cannot be reconstructed.

## Version 2 migration

Version 2 already stores update history on each node but has no `levelDefaults` object. It migrates with:

```json
{
  "levelStepXp": 100,
  "maxLevel": 3
}
```

Existing node-specific XP requirements and maximum levels remain unchanged. Existing node-history entries seed the XP ledger.

## Version 1 migration

Version 1 stores activity in one top-level `history` array. During migration, each entry is copied into the matching root or skill's `updateHistory` and into the XP ledger. Duplicate entry IDs are removed and entries are sorted chronologically.

## Adding version 5

1. Add a new versioned document type.
2. Add a deterministic migration to the new shape.
3. Keep all existing migration paths.
4. Normalize and validate the migrated result before applying it to the store.
5. Write only the newest version after a successful load.
