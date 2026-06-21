// ── Data model ───────────────────────────────────────────────────────────────
// Turns the raw weekly files into the structures the UI consumes. Every row is
// normalised (game strings -> integers) and tagged with a canonical player `key`,
// so comparisons across weeks always line up the same player even if their
// display name's casing/spacing changes.
import WEEKS from "./weeks/index.js";
import { playerKey } from "./players.js";
import { parseNum } from "./format.js";

// ── Row normalisers ────────────────────────────────────────────────────────────
function rosterRow(r) {
  return {
    key: playerKey(r.name),
    name: r.name,
    power: parseNum(r.power),
    rank: r.rank || "",
    week: typeof r.week === "number" ? r.week : parseNum(r.week),
    total: parseNum(r.total),
    login: r.login || "",
    role: r.role || "",
  };
}
function conquestRow(r) {
  return { key: playerKey(r.name), name: r.name, dmg: parseNum(r.dmg) };
}

// Keep one row per player within a single capture (last write wins is avoided —
// first occurrence is kept, matching the previous import behaviour).
function dedupe(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    if (seen.has(row.key)) continue;
    seen.add(row.key);
    out.push(row);
  }
  return out;
}

// One snapshot per week for a given dataset ("roster" | "conquest").
// IDs are deterministic (kind + index) so they stay stable across reloads.
function buildSnaps(kind, mapRow) {
  return WEEKS.map((wk, i) => ({
    id: `${kind[0]}_${i}`,
    capturedAt: wk.capturedAt,
    label: wk.label || "",
    rows: dedupe((wk[kind] || []).map(mapRow)),
  }));
}

// Map of canonical key -> id of the snapshot a player first appears in.
// Powers the "NEW" badge (a player new to a later capture).
function buildFirstSeen(snaps) {
  const m = {};
  for (const s of snaps) {
    for (const r of s.rows) {
      if (!(r.key in m)) m[r.key] = s.id;
    }
  }
  return m;
}

export const ROSTER_SNAPS = buildSnaps("roster", rosterRow);
export const CONQUEST_SNAPS = buildSnaps("conquest", conquestRow);
export const ROSTER_FIRST_SEEN = buildFirstSeen(ROSTER_SNAPS);
export const CONQUEST_FIRST_SEEN = buildFirstSeen(CONQUEST_SNAPS);

// ── Per-player views (foundation for comparison features) ───────────────────────
// One player's full history across every capture, roster + conquest aligned by
// date. Returns one entry per week; `roster`/`conquest` are null when the player
// was absent that week. Look players up by any spelling — resolved via playerKey.
export function playerTimeline(name) {
  const key = playerKey(name);
  return WEEKS.map((wk) => ({
    capturedAt: wk.capturedAt,
    label: wk.label || "",
    roster: (wk.roster || []).map(rosterRow).find((r) => r.key === key) || null,
    conquest: (wk.conquest || []).map(conquestRow).find((r) => r.key === key) || null,
  }));
}

// Every distinct player ever seen, with their latest known display name.
// Sorted by display name. Handy for player pickers / comparison UIs.
export function allPlayers() {
  const latest = new Map(); // key -> display name (from the most recent week)
  for (const wk of WEEKS) {
    for (const r of [...(wk.roster || []), ...(wk.conquest || [])]) {
      latest.set(playerKey(r.name), r.name);
    }
  }
  return [...latest.entries()]
    .map(([key, name]) => ({ key, name }))
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}
