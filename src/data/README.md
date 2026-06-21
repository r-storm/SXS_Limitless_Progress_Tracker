# Data layer

All guild data lives here. The UI (`src/App.jsx`) is purely a view over it — it
never stores or seeds data itself. The repo is the single source of truth, so a
new weekly drop shows up for everyone as soon as it's added (no stale browser
storage to clear).

## Layout

| File | Responsibility |
| --- | --- |
| `weeks/week-NN.js` | One weekly capture — both roster + conquest readings taken at that time. **This is the only kind of file you add over time.** |
| `weeks/index.js` | Registry: lists every week file. |
| `players.js` | Canonical player identity + the `RENAMES` map for handling in-game name changes. |
| `model.js` | Builds snapshots from the weeks, attaches each row to its player, and exposes per-player APIs (`playerTimeline`, `allPlayers`). |
| `format.js` | Value/date formatting (`parseNum`, `fmtNum`, `fmtDate`). |
| `parse.js` | Turns raw pasted text into row objects when authoring a new week file. |
| `profiles/` | Rich per-player detail (class, stats, gear, fantomon) + a profile screenshot each. `profiles.json` is the data; `images/` holds the screenshots; `index.js` keys it all by `playerKey` and resolves the images. Powers the player modal. |
| `index.js` | Barrel — the app imports everything from `../data`. |

## Adding a new week

1. Copy `weeks/week-01.js` to `weeks/week-02.js`.
2. Set `capturedAt` (when the data was taken) and `label` (e.g. `"Week 2"`).
3. Replace the `roster` and `conquest` rows. Values can stay as game strings
   (`"1.99M"`, `"2.44B"`) — they're normalised on load.
4. Register it in `weeks/index.js` (one import + one array entry).

That's it. Ordering, comparison, and the "NEW" badge are all derived
automatically.

## Player identity

Players are matched across weeks by a normalised key (`playerKey`), never by raw
name, so casing/spacing differences between captures don't split a player's
history. If someone **renames in-game**, add `"oldname": "NewName"` to `RENAMES`
in `players.js` to merge both names into one timeline.

## Comparison features

`model.js` exposes the building blocks for per-player comparison UIs:

- `playerTimeline(name)` — one player's full roster + conquest history, one entry
  per week (null where they were absent).
- `allPlayers()` — every distinct player with their latest display name, for
  pickers/search.
