// ── Data layer entry point ───────────────────────────────────────────────────
// Single import surface for the app's data. The UI only ever imports from here.
//
//   import { ROSTER_SNAPS, CONQUEST_SNAPS, fmtNum, playerTimeline } from "./data";
export * from "./format.js";
export * from "./model.js";
export { playerKey, RENAMES } from "./players.js";
export { parseRoster, parseConquest } from "./parse.js";
export { default as WEEKS } from "./weeks/index.js";
export { PROFILES, PROFILE_META, getProfile } from "./profiles/index.js";
