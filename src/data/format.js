// ── Value formatting helpers ───────────────────────────────────────────────────
// Pure functions for converting between the compact game strings ("1.99M") and
// integers, plus date formatting. Shared by the data layer and the UI.

// Parse value strings like "1.99M", "984K", "2.44B", "40" into integers.
export function parseNum(str) {
  if (str == null) return 0;
  const s = String(str).trim().toUpperCase().replace(/,/g, "");
  const m = s.match(/^([\d.]+)\s*([BMK]?)$/);
  if (!m) return Number(s.replace(/[^\d.]/g, "")) || 0;
  const n = parseFloat(m[1]);
  if (m[2] === "B") return Math.round(n * 1_000_000_000);
  if (m[2] === "M") return Math.round(n * 1_000_000);
  if (m[2] === "K") return Math.round(n * 1_000);
  return Math.round(n);
}

export function fmtNum(n) {
  const a = Math.abs(n);
  if (a >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "") + "B";
  if (a >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (a >= 1_000) return (n / 1_000).toFixed(2).replace(/\.?0+$/, "") + "K";
  return String(n);
}

export function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}
