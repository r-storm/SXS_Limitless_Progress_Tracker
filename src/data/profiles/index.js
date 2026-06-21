// ── Player profiles ────────────────────────────────────────────────────────────
// Rich per-player detail (class, stats, gear, fantomon, the profile screenshot…)
// scanned from the in-game profile cards. Keyed by the same canonical playerKey as
// the roster/conquest data, so it lines up with the right player automatically —
// including the spelling-drift renames handled in ../players.js.
import raw from "./profiles.json";
import { playerKey } from "../players.js";

// Vite bundles every screenshot and hands back a hashed, base-aware URL.
const IMAGES = import.meta.glob("./images/*.png", { eager: true, import: "default" });
function imageUrl(profileImage) {
  if (!profileImage) return null;
  const file = profileImage.split("/").pop(); // e.g. "profile_01.png"
  return IMAGES[`./images/${file}`] || null;
}

// Canonical-key -> profile (with the screenshot resolved to a usable `image` URL).
export const PROFILES = raw.profiles.reduce((m, p) => {
  m[playerKey(p.name)] = { ...p, image: imageUrl(p.profileImage) };
  return m;
}, {});

// Where/when the profile scan came from.
export const PROFILE_META = {
  capturedAt: raw.capturedAt,
  label: raw.label,
  source: raw.source,
  notes: raw.notes,
};

// Look a player's profile up by any spelling of their name (or their key).
export function getProfile(nameOrKey) {
  return PROFILES[playerKey(nameOrKey)] || null;
}
