// ── Raw paste parser ───────────────────────────────────────────────────────────
// Converts pasted text (one player per line, columns separated by tab, comma, or
// two+ spaces) into the row objects a weekly file expects. Used when turning a raw
// data drop into a new src/data/weeks/week-NN.js file. Values stay as raw strings
// (e.g. "1.99M") — the model normalises them at load time.
//
//   parseRoster(text)   -> [{ name, power, rank, week, total, login, role }, ...]
//   parseConquest(text) -> [{ name, dmg }, ...]

function* lines(text) {
  for (const line of String(text).split("\n").map((l) => l.trim()).filter(Boolean)) {
    const parts = line.split(/\t|,|\s{2,}/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) yield parts;
  }
}

function dedupeByName(rows) {
  const seen = new Set();
  return rows.filter((r) => {
    const k = r.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function parseRoster(text) {
  const out = [];
  for (const [name, power, rank = "", week = "0", total = "0", login = "", role = ""] of lines(text)) {
    out.push({ name, power, rank, week, total, login, role });
  }
  return dedupeByName(out);
}

export function parseConquest(text) {
  const out = [];
  for (const [name, dmg] of lines(text)) {
    out.push({ name, dmg });
  }
  return dedupeByName(out);
}
