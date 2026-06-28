// ── Player identity ────────────────────────────────────────────────────────────
// Every row in every week is attached to a player by a STABLE canonical key, not
// by its raw display name. This is what keeps a player's history correctly
// assigned to them across weeks (and powers the comparison features), even if the
// display name changes casing/spacing between captures.
//
// If a player RENAMES in-game, add a mapping below from their old name to their
// new one so both names resolve to a single timeline:
//
//   export const RENAMES = {
//     "oldname": "NewName",
//   };
export const RENAMES = {
  // Spelling drift between captures — merge into one timeline:
  "mafi0zos": "MafiOzos", // capture 2 spells it with a zero
  "dqoo7": "DQO07",       // capture 2 spells it with a double-O
};

// Players who have LEFT the guild. List any spelling of their name — it's
// resolved through playerKey, so renames still match. Marked players are hidden
// from the dashboard everywhere (every snapshot), even captures where they were
// still present. Add a name here the moment someone leaves.
export const LEFT = [
  "Bfoz",
  "Leetokki",
  "Raij",
  "Shrecky",
];

function normalize(name) {
  return String(name || "").trim().toLowerCase();
}

// Canonical, comparison-safe identity for a player, after applying any renames.
// Follows a rename chain (old -> new -> newer) and guards against cycles.
export function playerKey(name) {
  let key = normalize(name);
  const seen = new Set();
  while (RENAMES[key] != null && !seen.has(key)) {
    seen.add(key);
    key = normalize(RENAMES[key]);
  }
  return key;
}

// Canonical keys of everyone who has left — built from LEFT through playerKey.
export const LEFT_KEYS = new Set(LEFT.map(playerKey));

// Has this player left the guild? Accepts any spelling of their name (or a key).
export function hasLeft(nameOrKey) {
  return LEFT_KEYS.has(playerKey(nameOrKey));
}
