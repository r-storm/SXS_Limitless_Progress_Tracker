// ── Dated capture registry ───────────────────────────────────────────────────
// Every data drop lives in its own date-stamped folder under ./captures, so the
// folder name alone tells you exactly which day the data is from:
//
//   captures/<YYYY-MM-DD>/
//     week.json          roster + conquest readings for that day  (required)
//     profiles.json      rich per-player profile cards            (optional)
//     images/profiles/   one screenshot per player card           (optional)
//     images/members/    raw members-list screenshots (provenance, optional)
//
// Nothing here is hand-registered. Vite globs the folders at build time, so to
// ADD A CAPTURE you just drop a new dated folder in — it shows up automatically.
import { playerKey } from "../players.js";

// Pull the YYYY-MM-DD out of a glob key. Vite keys these globs relative to this
// file, so they look like "./2026-06-21/week.json" — the date is the first
// segment after the leading "./".
function dateOf(path) {
  const m = path.match(/^\.\/([^/]+)\//);
  return m ? m[1] : path;
}

// ── Weekly readings (roster + conquest) ──────────────────────────────────────
const weekFiles = import.meta.glob("./*/week.json", { eager: true, import: "default" });

// One entry per capture, chronological (oldest first). `date` is the folder name;
// `capturedAt` (inside the file) is the precise timestamp and the sort key.
export const CAPTURES = Object.entries(weekFiles)
  .map(([path, week]) => ({
    date: dateOf(path),
    capturedAt: week.capturedAt,
    label: week.label || "",
    roster: week.roster || [],
    conquest: week.conquest || [],
  }))
  .sort((a, b) => new Date(a.capturedAt) - new Date(b.capturedAt));

// ── Profiles ─────────────────────────────────────────────────────────────────
// Profile cards are a point-in-time scan. Not every capture has them, so the app
// shows the MOST RECENT capture that does.
const profileFiles = import.meta.glob("./*/profiles.json", { eager: true, import: "default" });
const profileImages = import.meta.glob("./*/images/profiles/*.png", { eager: true, import: "default" });

// Card screenshots are saved in the same order as the profiles array (profile_01
// = first entry), so we line them up by position within each capture's folder.
function imagesFor(date) {
  return Object.entries(profileImages)
    .filter(([path]) => dateOf(path) === date)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, url]) => url);
}

// Normalise either profile schema (old flat fields / gear-object, or the newer
// `badges` array / gear-array) into the single shape the UI consumes.
function normalizeProfile(p, image) {
  const gear = Array.isArray(p.gear)
    ? { primaryWeapon: p.gear[0], secondaryWeapon: p.gear[1], helmet: p.gear[2], armour: p.gear[3], boots: p.gear[4] }
    : p.gear || {};
  return {
    ...p,
    rank: p.rank ?? p.badges?.[0] ?? "",
    guildTitle: p.guildTitle ?? p.badges?.[1] ?? "",
    serverBadge: p.serverBadge ?? p.badges?.[2] ?? "",
    gear,
    image: image || null,
  };
}

// Each capture that has profiles, newest first.
const PROFILE_CAPTURES = Object.entries(profileFiles)
  .map(([path, file]) => {
    const date = dateOf(path);
    const images = imagesFor(date);
    return {
      date,
      capturedAt: file.capturedAt,
      label: file.label || "",
      source: file.source,
      notes: file.notes,
      profiles: (file.profiles || []).map((p, i) => normalizeProfile(p, images[i])),
    };
  })
  .sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt));

const LATEST = PROFILE_CAPTURES[0] || null;

// Canonical-key -> profile, from the most recent profile scan.
export const PROFILES = (LATEST?.profiles || []).reduce((m, p) => {
  m[playerKey(p.name)] = p;
  return m;
}, {});

// Where/when the live profile scan came from.
export const PROFILE_META = {
  capturedAt: LATEST?.capturedAt,
  label: LATEST?.label,
  source: LATEST?.source,
  notes: LATEST?.notes,
};

// Look a player's profile up by any spelling of their name (or their key).
export function getProfile(nameOrKey) {
  return PROFILES[playerKey(nameOrKey)] || null;
}

// One player's profile across every scan, oldest→newest, so the UI can track how
// stats/gear changed over time. `profile` is null for captures they're absent from.
const PROFILE_CAPTURES_ASC = [...PROFILE_CAPTURES].sort(
  (a, b) => new Date(a.capturedAt) - new Date(b.capturedAt)
);
export function profileTimeline(nameOrKey) {
  const key = playerKey(nameOrKey);
  return PROFILE_CAPTURES_ASC.map((cap) => ({
    date: cap.date,
    capturedAt: cap.capturedAt,
    label: cap.label,
    profile: cap.profiles.find((p) => playerKey(p.name) === key) || null,
  }));
}
