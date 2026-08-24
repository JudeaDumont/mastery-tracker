# Mastery Tracker graph file

When Mastery Tracker runs from a Git checkout, it stores graph state in the tracked
`data/mastery-graph.json` file at the repository root. Persistent edits therefore appear in the
working tree and can be committed, pushed, and pulled like source changes.

If no Git checkout can be found, such as in a packaged installation, the app falls back to
`mastery-graph.json` inside Electron's per-user `userData` directory. The
`MASTERY_GRAPH_STATE_PATH` environment variable can override both locations with an absolute path.

## Compatibility contract

- `format` identifies the file independently from the application version.
- `schemaVersion` is an integer and currently uses version `7`.
- Readers migrate older versions before hydrating the store.
- Version 7 accepts versions 6, 5, 4, 3, 2, 1, the unversioned prototype shape, and Zustand-style `{ "state": ... }` wrappers.
- Version 1's global `history` array is distributed into each matching node's `updateHistory` during migration.
- Versions 1-3 infer the initial XP ledger from existing node note histories. XP submissions that were never historically stored cannot be reconstructed.
- Version 2 files receive default new-node level settings during migration.
- Legacy `heat` values migrate to `momentum`.
- Legacy cumulative `thresholds` migrate to independent `levelXpRequirements`.
- Unknown fields are ignored, so additive fields remain backwards compatible.
- A file with a newer unsupported schema version is never overwritten.
- The committed repository seed is replaced by the previous `userData` graph on the first launch
  after this storage change, preserving an existing local graph.
- Loading an already-current version 7 file does not rewrite it just to refresh `savedAt`, avoiding
  meaningless Git changes on startup.
- Writes use a temporary file and keep `mastery-graph.json.backup` as the previous complete save.
- Invalid JSON is moved aside with a `.corrupt-<timestamp>` suffix instead of being destroyed.

## Version 7

```json
{
  "format": "mastery-tracker.graph",
  "schemaVersion": 7,
  "savedAt": "2026-07-28T12:00:00.000Z",
  "data": {
    "roots": [
      {
        "id": "lifter",
        "title": "Lifter",
        "accent": "teal",
        "engraving": "orbit",
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
            "note": "Worked on depth and bracing.",
            "deadlineOn": "2026-08-13",
            "opportuneOn": "2026-08-06"
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
        "note": "Worked on depth and bracing.",
        "deadlineOn": "2026-08-13",
        "opportuneOn": "2026-08-06"
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

`deadlineOn` is an optional local calendar-day value stored as `YYYY-MM-DD`. It deliberately has no time-of-day or timezone component. The deadline editor accepts forms such as `08/13`, `1231`, `20260813`, `13 days`, `08/13/2026`, and `0119`; yearless dates resolve to the next occurrence that is not already past.

Deadline edits are synchronized between `xpLedger` and the matching node `updateHistory` entry. Removing a deadline does not remove the update or its XP.

`opportuneOn` is a second optional local calendar-day value stored as `YYYY-MM-DD`. It uses the same smart day parser as deadlines but remains an independent scheduling flow with its own icon, node marker, and editor. An update may contain a deadline, an opportune time, both, or neither. The combined Deadlines & Opportune Times overlay renders each assigned date as its own scheduled item.

Every root and skill also owns an `updateHistory` array. That array contains only updates with notes and drives the node-hover notes display.

When a noted update is deleted from the hover display, the matching ledger entry is also removed. The node's XP, level dates, momentum contribution, daily totals, and lock state are recalculated.

`levelXpRequirements` remains the canonical per-node level-cost array. Node settings can replace it with one repeated step or change the node's maximum level without resetting lifetime XP.

`levelDefaults` controls newly created mastery nodes. The creation card edits these defaults directly. Existing nodes retain their own level configuration until edited individually.

Every root has an `engraving` string. Supported values are `heart`, `brain`, `gear`, `chicken`, `gabe`, `code`, `parallel`, and `orbit`. The value selects the root-color icon shown in its tab and the matching rudimentary line pattern rendered behind its tree. Background patterns combine complete, partial, and broken-up versions of the selected motif. Version 6 and older files infer an engraving from the root ID/title, then save the explicit string in version 7.

Transient UI state such as selections, open panels, unfinished updates, and an unfinished create wizard is intentionally not persisted.

## Version 6 migration

Version 6 has no root `engraving` field. Migration assigns deterministic defaults from the root ID/title: health and wellness roots use `heart`, career roots use `brain`, home-improvement roots use `gear`, Chicken uses `chicken`, and unmatched roots use the closest built-in theme or `orbit`.

## Version 5 migration

Version 5 has deadlines but no `opportuneOn` field. It migrates unchanged; opportune dates begin empty and are added only when the user assigns them.

## Version 4 migration

Version 4 has the complete XP ledger but no deadline field. It migrates unchanged; deadlines begin empty and are added only when the user assigns them.

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

## Adding version 8

1. Add a new versioned document type.
2. Add a deterministic migration to the new shape.
3. Keep all existing migration paths.
4. Normalize and validate the migrated result before applying it to the store.
5. Write only the newest version after a successful load.

## Weekday deadline input

Both deadline and opportune-time editors accept weekday names and common abbreviations.
The parser always chooses the next future occurrence, never the current day. For example,
entering `Thursday` on a Thursday resolves to the Thursday of the following week.
Supported examples include `Thursday`, `next Thursday`, `Thu`, and `Thurs`.
