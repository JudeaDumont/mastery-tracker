# Mastery Tracker graph file

Mastery Tracker stores graph state in `mastery-graph.json` inside Electron's per-user `userData` directory.

## Compatibility contract

- `format` identifies the file independently from the application version.
- `schemaVersion` is an integer and starts at `1`.
- Readers migrate older versions before hydrating the store.
- Version 1 also accepts the unversioned prototype shape and Zustand-style `{ "state": ... }` wrappers.
- Legacy `heat` values migrate to `momentum`.
- Legacy cumulative `thresholds` migrate to independent `levelXpRequirements`.
- Unknown fields are ignored, so additive fields remain backwards compatible.
- A file with a newer unsupported schema version is never overwritten.
- Writes use a temporary file and keep `mastery-graph.json.backup` as the previous complete save.
- Invalid JSON is moved aside with a `.corrupt-<timestamp>` suffix instead of being destroyed.

## Version 1

```json
{
  "format": "mastery-tracker.graph",
  "schemaVersion": 1,
  "savedAt": "2026-07-26T12:00:00.000Z",
  "data": {
    "roots": [],
    "skills": [],
    "links": [],
    "history": [],
    "todayXp": 0
  }
}
```

`roots`, `skills`, and `links` are the canonical graph. `history` preserves submitted activity, and `todayXp` preserves the current prototype daily total. Transient UI state such as selections, open panels, and an unfinished create wizard is intentionally not persisted.

## Adding version 2

1. Add a new versioned document type.
2. Add a deterministic `v1 -> v2` migration.
3. Keep all existing migration paths.
4. Normalize and validate the migrated result before applying it to the store.
5. Write only the newest version after a successful load.
