# Mastery Tracker graph file

Mastery Tracker stores graph state in `mastery-graph.json` inside Electron's per-user `userData` directory.

## Compatibility contract

- `format` identifies the file independently from the application version.
- `schemaVersion` is an integer and currently uses version `2`.
- Readers migrate older versions before hydrating the store.
- Version 2 accepts version 1, the unversioned prototype shape, and Zustand-style `{ "state": ... }` wrappers.
- Version 1's global `history` array is distributed into each matching node's `updateHistory` during migration.
- Legacy `heat` values migrate to `momentum`.
- Legacy cumulative `thresholds` migrate to independent `levelXpRequirements`.
- Unknown fields are ignored, so additive fields remain backwards compatible.
- A file with a newer unsupported schema version is never overwritten.
- Writes use a temporary file and keep `mastery-graph.json.backup` as the previous complete save.
- Invalid JSON is moved aside with a `.corrupt-<timestamp>` suffix instead of being destroyed.

## Version 2

```json
{
  "format": "mastery-tracker.graph",
  "schemaVersion": 2,
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
        "levelXpRequirements": [100, 200, 300],
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
    "todayXp": 60
  }
}
```

Every root and skill owns an `updateHistory` array. Entries are retained in chronological order and contain the submitted time, effort, XP, note, and timestamp for that node. Root histories currently remain empty because updates are submitted directly against mastery nodes, but the field is present so every node follows the same durable format.

`roots`, `skills`, and `links` are the canonical graph. `todayXp` preserves the current prototype daily total. Transient UI state such as selections, open panels, and an unfinished create wizard is intentionally not persisted.

## Version 1 migration

Version 1 stored activity in one top-level array:

```json
{
  "schemaVersion": 1,
  "data": {
    "history": [
      {
        "nodeId": "squat",
        "xp": 60
      }
    ]
  }
}
```

When loaded by version 2, each entry is copied into the matching root or skill's `updateHistory`. Duplicate entry IDs are removed and entries are sorted chronologically before the file is saved back as version 2.

## Adding version 3

1. Add a new versioned document type.
2. Add a deterministic `v2 -> v3` migration.
3. Keep all existing migration paths.
4. Normalize and validate the migrated result before applying it to the store.
5. Write only the newest version after a successful load.
