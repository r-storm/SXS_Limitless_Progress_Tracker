// ── Data layer entry point ───────────────────────────────────────────────────
// Single import surface for the app's data. The UI only ever imports from here.
//
//   import { ROSTER_SNAPS, CONQUEST_SNAPS, fmtNum, playerTimeline } from "./data";
export * from "./format.js";
export * from "./model.js";
export { playerKey, RENAMES } from "./players.js";
export { parseRoster, parseConquest } from "./parse.js";
export { CAPTURES, CAPTURES as WEEKS, PROFILES, PROFILE_META, getProfile, profileTimeline } from "./captures/index.js";
