# Data layer

All guild data lives here. The UI (`src/App.jsx`) is purely a view over it — it
never stores or seeds data itself. The repo is the single source of truth, so a
new data drop shows up for everyone as soon as it's added (no stale browser
storage to clear).

## Layout

Every data drop lives in its own **date-stamped folder** under `captures/`, so
the folder name alone tells you exactly which day the data is from:

```
src/data/
├── captures/
│   ├── 2026-06-16/
│   │   └── week.json              roster + conquest readings (this day)
│   ├── 2026-06-20/
│   │   ├── week.json
│   │   ├── profiles.json          rich per-player profile cards
│   │   └── images/
│   │       └── profiles/          one screenshot per player card
│   ├── 2026-06-21/
│   │   ├── week.json
│   │   ├── profiles.json
│   │   └── images/
│   │       ├── profiles/          per-player card screenshots
│   │       └── members/           raw members-list screenshots (provenance)
│   └── index.js                   auto-discovers every dated folder ↑
├── players.js                     canonical player identity + RENAMES map
├── model.js                       builds snapshots / per-player timelines
├── format.js                      value + date formatting helpers
├── parse.js                       turns pasted text into rows when authoring
├── index.js                       barrel — the app imports from `../data`
└── README.md
```

| File | Responsibility |
| --- | --- |
| `captures/<date>/week.json` | One day's capture — both roster + conquest readings. **Required** in every capture folder. |
| `captures/<date>/profiles.json` | Rich per-player detail (class, stats, gear, fantomon). **Optional** — only the days you scanned profiles. |
| `captures/<date>/images/profiles/` | One card screenshot per player, in the same order as `profiles.json` (`profile_01.png` = first entry). |
| `captures/<date>/images/members/` | Raw members-list screenshots kept as provenance for the roster. Not shown in the app. |
| `captures/index.js` | Auto-discovers every dated folder (no manual registry). Exposes `CAPTURES`, `PROFILES`, `PROFILE_META`, `getProfile`. |
| `players.js` | Canonical player identity + the `RENAMES` map for in-game name changes. |
| `model.js` | Builds snapshots from the captures, attaches each row to its player, exposes per-player APIs (`playerTimeline`, `allPlayers`). |
| `format.js` | Value/date formatting (`parseNum`, `fmtNum`, `fmtDate`). |
| `parse.js` | Turns raw pasted text into row objects when authoring a `week.json`. |
| `index.js` | Barrel — the app imports everything from `../data`. |

`capturedAt` (inside each file) is the precise timestamp and the sort key; the
folder date is the human-readable label. Captures are always shown oldest-first,
and the live profile cards come from the **most recent** capture that has a
`profiles.json`.

## Adding a capture

1. Create a new folder named for the capture date: `captures/YYYY-MM-DD/`.
2. Add `week.json` with `capturedAt`, `label`, and the `roster` / `conquest`
   rows. Values can stay as game strings (`"1.99M"`, `"2.44B"`) — they're
   normalised on load. (`parse.js` can turn pasted text into these rows.)
3. *(Optional)* Add `profiles.json` plus `images/profiles/profile_NN.png` (one
   per player, in the same order as the `profiles` array).
4. *(Optional)* Drop the raw members-list screenshots in `images/members/`.

That's it — there is **no registry to edit**. `captures/index.js` globs the
folders at build time, so the new day appears automatically. Ordering,
comparison, and the "NEW" badge are all derived for you.

### Profile schema

Either shape is accepted (the loader normalises both):

- **Flat** — `rank`, `guildTitle`, `serverBadge` fields and a `gear` object
  (`{ primaryWeapon, secondaryWeapon, helmet, armour, boots }`).
- **Compact** — a `badges` array `["Expert III", "Limitless", "Oasis Star"]` and
  a `gear` array `[120, 110, 110, 111, 112]` (same slot order), plus optional
  `technique` / `charm`.

Images are matched **by position**, so a `profileImage` field is not needed.

## Player identity

Players are matched across captures by a normalised key (`playerKey`), never by
raw name, so casing/spacing differences don't split a player's history. If
someone **renames in-game**, add `"oldname": "NewName"` to `RENAMES` in
`players.js` to merge both names into one timeline.

## Comparison features

`model.js` exposes the building blocks for per-player comparison UIs:

- `playerTimeline(name)` — one player's full roster + conquest history, one entry
  per capture (null where they were absent).
- `allPlayers()` — every distinct player with their latest display name, for
  pickers/search.
