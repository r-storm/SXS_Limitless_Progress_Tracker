// ── Weekly captures registry ─────────────────────────────────────────────────
// The single place to register weekly data drops. Add one import + one array
// entry per new week — order here doesn't matter, captures are sorted by date.
import week01 from "./week-01.js";
import week02 from "./week-02.js";

const WEEKS = [
  week01,
  week02,
];

// Always chronological, oldest first.
export default [...WEEKS].sort(
  (a, b) => new Date(a.capturedAt) - new Date(b.capturedAt)
);
