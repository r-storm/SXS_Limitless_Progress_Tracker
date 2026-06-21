import React, { useState, useEffect, useMemo } from "react";
import {
  fmtNum, fmtDate, getProfile, PROFILE_META,
  ROSTER_SNAPS, CONQUEST_SNAPS,
  ROSTER_FIRST_SEEN, CONQUEST_FIRST_SEEN,
} from "./data";

// All guild data is now sourced from the modular data layer in src/data — the UI
// is a pure view over it. To add a week of data, drop a new file in
// src/data/weeks and register it; see src/data/README.md.

// ── App ──────────────────────────────────────────────────────────────────────
export default function GuildTracker() {
  const [tab, setTab] = useState("roster");
  const [profileKey, setProfileKey] = useState(null);

  return (
    <div style={S.shell}>
      <style>{CSS}</style>
      <header style={S.header}>
        <div>
          <div style={S.eyebrow}>LIMITLESS · SWORD × STAFF</div>
          <h1 style={S.h1}>Guild Tracker</h1>
        </div>
        <nav style={S.tabs}>
          <button style={tabStyle(tab === "roster")} onClick={() => setTab("roster")}>Roster</button>
          <button style={tabStyle(tab === "conquest")} onClick={() => setTab("conquest")}>Conquest DMG</button>
        </nav>
      </header>

      {tab === "roster" ? (
        <RosterView snaps={ROSTER_SNAPS} firstSeen={ROSTER_FIRST_SEEN} onPlayerClick={setProfileKey} />
      ) : (
        <ConquestView snaps={CONQUEST_SNAPS} firstSeen={CONQUEST_FIRST_SEEN} onPlayerClick={setProfileKey} />
      )}

      {profileKey && <PlayerModal playerKey={profileKey} onClose={() => setProfileKey(null)} />}
    </div>
  );
}

// ── Generic snapshot machinery shared by both tabs ─────────────────────────────
function useSnapshotState(snaps) {
  const [activeId, setActiveId] = useState(snaps[snaps.length - 1].id);
  const [compareId, setCompareId] = useState(snaps.length > 1 ? snaps[snaps.length - 2].id : null);
  useEffect(() => {
    if (!snaps.find((s) => s.id === activeId)) setActiveId(snaps[snaps.length - 1].id);
  }, [snaps, activeId]);
  return { activeId, setActiveId, compareId, setCompareId };
}

function SnapBar({ snaps, activeId, setActiveId, compareId, setCompareId, query, setQuery }) {
  return (
    <>
      <div style={S.snapBar}>
        <div style={S.snapField}>
          <label style={S.fieldLabel}>Viewing</label>
          <select style={S.select} value={activeId} onChange={(e) => setActiveId(e.target.value)}>
            {[...snaps].reverse().map((s) => (
              <option key={s.id} value={s.id}>{fmtDate(s.capturedAt)}</option>
            ))}
          </select>
        </div>
        <div style={S.snapField}>
          <label style={S.fieldLabel}>Compare to</label>
          <select style={S.select} value={compareId || ""} onChange={(e) => setCompareId(e.target.value || null)}>
            <option value="">None (raw values)</option>
            {[...snaps].reverse().filter((s) => s.id !== activeId).map((s) => (
              <option key={s.id} value={s.id}>{fmtDate(s.capturedAt)}</option>
            ))}
          </select>
        </div>
        <input style={S.search} placeholder="Search name…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div style={{ flex: 1 }} />
      </div>
      <div style={S.hint}>Tip: tap a player's name to view their full profile.</div>
    </>
  );
}

// ── Roster tab ─────────────────────────────────────────────────────────────────
function RosterView({ snaps, firstSeen, onPlayerClick }) {
  const { activeId, setActiveId, compareId, setCompareId } = useSnapshotState(snaps);
  const [sortKey, setSortKey] = useState("power");
  const [sortDir, setSortDir] = useState("desc");
  const [query, setQuery] = useState("");

  const active = snaps.find((s) => s.id === activeId);
  const compare = snaps.find((s) => s.id === compareId) || null;
  const cmap = useMemo(() => { const m = {}; if (compare) compare.rows.forEach((r) => { m[r.key] = r; }); return m; }, [compare]);

  // Only show players present in the latest capture — anyone who has since left
  // the guild is hidden, even when viewing an older snapshot.
  const currentKeys = useMemo(() => new Set(snaps[snaps.length - 1].rows.map((r) => r.key)), [snaps]);

  const totals = useMemo(() => {
    const present = active.rows.filter((r) => currentKeys.has(r.key));
    return { members: present.length, power: present.reduce((s, r) => s + r.power, 0) };
  }, [active, currentKeys]);

  const isFirstSnap = snaps[0].id === active.id;
  const rows = useMemo(() => {
    let list = active.rows.filter((r) => currentKeys.has(r.key)).map((r) => {
      const p = cmap[r.key];
      return {
        ...r,
        powerDelta: p ? r.power - p.power : null,
        weekDelta: p ? r.week - p.week : null,
        totalDelta: p ? r.total - p.total : null,
        isNew: !isFirstSnap && firstSeen[r.key] === active.id,
      };
    });
    if (query.trim()) { const q = query.toLowerCase(); list = list.filter((r) => r.name.toLowerCase().includes(q)); }
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let av, bv;
      switch (sortKey) {
        case "name": case "rank": av = a[sortKey].toLowerCase ? a[sortKey].toLowerCase() : a[sortKey]; bv = b[sortKey].toLowerCase ? b[sortKey].toLowerCase() : b[sortKey]; return av < bv ? -dir : av > bv ? dir : 0;
        case "week": av = a.week; bv = b.week; break;
        case "total": av = a.total; bv = b.total; break;
        case "powerDelta": av = a.powerDelta ?? -Infinity; bv = b.powerDelta ?? -Infinity; break;
        default: av = a.power; bv = b.power;
      }
      return (av - bv) * dir;
    });
    return list;
  }, [active, cmap, currentKeys, firstSeen, query, sortKey, sortDir, isFirstSnap]);

  function setSort(k) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "name" || k === "rank" ? "asc" : "desc"); }
  }

  return (
    <>
      <div style={S.headStats}>
        <Stat label="Members" value={totals.members} />
        <Stat label="Total power" value={fmtNum(totals.power)} />
        <Stat label="Snapshots" value={snaps.length} />
      </div>
      <SnapBar snaps={snaps} activeId={activeId} setActiveId={setActiveId} compareId={compareId} setCompareId={setCompareId}
        query={query} setQuery={setQuery} />
      {compare && <div style={S.diffNote}>Deltas compare <b>{fmtDate(active.capturedAt)}</b> against <b>{fmtDate(compare.capturedAt)}</b>.</div>}

      <div style={{ ...S.tableWrap, width: "fit-content", maxWidth: "100%" }}>
        <table style={{ ...S.table, width: "auto", minWidth: 0 }}>
          <thead><tr>
            <Th onClick={() => setSort("name")} active={sortKey === "name"} dir={sortDir} align="left">Player</Th>
            <Th onClick={() => setSort("power")} active={sortKey === "power"} dir={sortDir}>Power</Th>
            {compare && <Th onClick={() => setSort("powerDelta")} active={sortKey === "powerDelta"} dir={sortDir}>Δ Power</Th>}
            <Th onClick={() => setSort("rank")} active={sortKey === "rank"} dir={sortDir}>Rank</Th>
            <Th onClick={() => setSort("week")} active={sortKey === "week"} dir={sortDir}>This Week</Th>
            <Th onClick={() => setSort("total")} active={sortKey === "total"} dir={sortDir}>Total Contrib.</Th>
            <Th>Login</Th>
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key} className="row">
                <td style={S.tdName}>
                  <span style={S.rankNum}>{i + 1}</span>
                  <button className="pname" style={S.nameBtn} onClick={() => onPlayerClick(r.key)}>{r.name}</button>
                  {r.role && <span style={{ ...S.roleBadge, ...roleStyle(r.role) }}>{r.role}</span>}
                  {r.isNew && <span style={S.newBadge}>NEW</span>}
                </td>
                <td style={S.tdNum}>{fmtNum(r.power)}</td>
                {compare && <td style={S.tdNum}>{deltaCell(r.powerDelta)}</td>}
                <td style={S.tdMid}>{r.rank}</td>
                <td style={S.tdNum}>{r.week}{compare && r.weekDelta ? <span style={miniDelta(r.weekDelta)}> {r.weekDelta > 0 ? "+" : ""}{r.weekDelta}</span> : null}</td>
                <td style={S.tdNum}>{fmtNum(r.total)}{compare && r.totalDelta ? <span style={miniDelta(r.totalDelta)}> {r.totalDelta > 0 ? "+" : "-"}{fmtNum(Math.abs(r.totalDelta))}</span> : null}</td>
                <td style={S.tdMid}>{r.login}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={compare ? 7 : 6} style={S.empty}>No players match "{query}".</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Conquest tab ───────────────────────────────────────────────────────────────
function ConquestView({ snaps, firstSeen, onPlayerClick }) {
  const { activeId, setActiveId, compareId, setCompareId } = useSnapshotState(snaps);
  const [sortKey, setSortKey] = useState("dmg");
  const [sortDir, setSortDir] = useState("desc");
  const [query, setQuery] = useState("");

  const active = snaps.find((s) => s.id === activeId);
  const compare = snaps.find((s) => s.id === compareId) || null;
  const cmap = useMemo(() => { const m = {}; if (compare) compare.rows.forEach((r) => { m[r.key] = r; }); return m; }, [compare]);

  // Only show players present in the latest capture — anyone who has since left
  // the guild is hidden, even when viewing an older snapshot.
  const currentKeys = useMemo(() => new Set(snaps[snaps.length - 1].rows.map((r) => r.key)), [snaps]);

  const totals = useMemo(() => {
    const present = active.rows.filter((r) => currentKeys.has(r.key));
    return { members: present.length, dmg: present.reduce((s, r) => s + r.dmg, 0) };
  }, [active, currentKeys]);

  const isFirstSnap = snaps[0].id === active.id;
  const rows = useMemo(() => {
    let list = active.rows.filter((r) => currentKeys.has(r.key)).map((r) => {
      const p = cmap[r.key];
      return { ...r, dmgDelta: p ? r.dmg - p.dmg : null, isNew: !isFirstSnap && firstSeen[r.key] === active.id };
    });
    if (query.trim()) { const q = query.toLowerCase(); list = list.filter((r) => r.name.toLowerCase().includes(q)); }
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (sortKey === "name") { const av = a.name.toLowerCase(), bv = b.name.toLowerCase(); return av < bv ? -dir : av > bv ? dir : 0; }
      if (sortKey === "dmgDelta") return ((a.dmgDelta ?? -Infinity) - (b.dmgDelta ?? -Infinity)) * dir;
      return (a.dmg - b.dmg) * dir;
    });
    return list;
  }, [active, cmap, currentKeys, firstSeen, query, sortKey, sortDir, isFirstSnap]);

  function setSort(k) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "name" ? "asc" : "desc"); }
  }

  return (
    <>
      <div style={S.headStats}>
        <Stat label="Players" value={totals.members} />
        <Stat label="Total DMG" value={fmtNum(totals.dmg)} />
        <Stat label="Snapshots" value={snaps.length} />
      </div>
      <SnapBar snaps={snaps} activeId={activeId} setActiveId={setActiveId} compareId={compareId} setCompareId={setCompareId}
        query={query} setQuery={setQuery} />
      {compare && <div style={S.diffNote}>Deltas compare <b>{fmtDate(active.capturedAt)}</b> against <b>{fmtDate(compare.capturedAt)}</b>.</div>}

      <div style={{ ...S.tableWrap, width: "fit-content", maxWidth: "100%" }}>
        <table style={{ ...S.table, width: "auto", minWidth: 0 }}>
          <thead><tr>
            <Th align="left">Rank</Th>
            <Th onClick={() => setSort("name")} active={sortKey === "name"} dir={sortDir} align="left">Player</Th>
            <Th onClick={() => setSort("dmg")} active={sortKey === "dmg"} dir={sortDir}>Conquest DMG</Th>
            {compare && <Th onClick={() => setSort("dmgDelta")} active={sortKey === "dmgDelta"} dir={sortDir}>Δ DMG</Th>}
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key} className="row">
                <td style={S.tdMidLeft}><span style={S.rankBig}>{i + 1}</span></td>
                <td style={S.tdName}>
                  <button className="pname" style={S.nameBtn} onClick={() => onPlayerClick(r.key)}>{r.name}</button>
                  {r.isNew && <span style={S.newBadge}>NEW</span>}
                </td>
                <td style={S.tdNum}>{fmtNum(r.dmg)}</td>
                {compare && <td style={S.tdNum}>{deltaCell(r.dmgDelta)}</td>}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={compare ? 4 : 3} style={S.empty}>No players match "{query}".</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Player profile modal ────────────────────────────────────────────────────────
const GEAR_SLOTS = [
  ["primaryWeapon", "Primary"],
  ["secondaryWeapon", "Secondary"],
  ["helmet", "Helmet"],
  ["armour", "Armour"],
  ["boots", "Boots"],
];

function PlayerModal({ playerKey, onClose }) {
  const p = getProfile(playerKey);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (zoomed) setZoomed(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, zoomed]);

  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.pmCard} onClick={(e) => e.stopPropagation()}>
        <button style={S.pmClose} onClick={onClose} aria-label="Close">✕</button>

        {!p ? (
          <div style={S.empty}>No profile on record for this player yet.</div>
        ) : (
          <div style={S.pmBody}>
            {p.image && (
              <div style={S.pmShotWrap}>
                <img src={p.image} alt={`${p.name} profile`} style={S.pmShot} onClick={() => setZoomed(true)} title="Click to expand" />
                <div style={S.pmShotCaption}>Click to expand</div>
              </div>
            )}

            <div style={S.pmInfo}>
              <div style={S.pmName}>{p.name}</div>
              <div style={S.pmSub}>
                {p.class}{p.classLevel != null ? ` · Class Lv. ${p.classLevel}` : ""}{p.level != null ? ` · Lv. ${p.level}` : ""}
              </div>
              <div style={S.pmId}>ID: {p.playerId}</div>
              {PROFILE_META.capturedAt && <span style={S.pmUpdated}>Updated {fmtDate(PROFILE_META.capturedAt)}</span>}

              <div style={S.pmBadges}>
                {p.rank && <span style={S.pmBadge}>{p.rank}</span>}
                {p.guildTitle && <span style={S.pmBadge}>{p.guildTitle}</span>}
                {p.serverBadge && <span style={S.pmBadge}>{p.serverBadge}</span>}
                {p.fantomon && <span style={{ ...S.pmBadge, ...S.pmBadgeAccent }}>Fantomon: {p.fantomon}</span>}
                {p.likes != null && <span style={S.pmBadge}>♥ {p.likes}</span>}
              </div>

              <div style={S.pmPowerRow}>
                <span style={S.pmPowerLabel}>POWER</span>
                <span style={S.pmPowerValue}>{p.power}</span>
              </div>

              <div style={S.pmSectionLabel}>Stats</div>
              <div style={S.pmStatGrid}>
                <PmStat label="ATK" value={p.stats?.atk} />
                <PmStat label="DEF" value={p.stats?.def} />
                <PmStat label="HP" value={p.stats?.hp} />
                <PmStat label="SPD" value={p.stats?.spd} />
              </div>

              <div style={S.pmSectionLabel}>Gear</div>
              <div style={S.pmGearGrid}>
                {GEAR_SLOTS.map(([k, label]) => (
                  <div key={k} style={S.pmGear}>
                    <div style={S.pmGearLvl}>+{p.gear?.[k] ?? "—"}</div>
                    <div style={S.pmGearLabel}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {zoomed && p?.image && (
        <div style={S.pmZoom} onClick={(e) => { e.stopPropagation(); setZoomed(false); }}>
          <img src={p.image} alt={`${p.name} profile`} style={S.pmZoomImg} />
        </div>
      )}
    </div>
  );
}
function PmStat({ label, value }) {
  return (
    <div style={S.pmStat}>
      <div style={S.pmStatValue}>{value ?? "—"}</div>
      <div style={S.pmStatLabel}>{label}</div>
    </div>
  );
}

// ── Small components ───────────────────────────────────────────────────────────
function Stat({ label, value }) {
  return <div style={S.stat}><div style={S.statValue}>{value}</div><div style={S.statLabel}>{label}</div></div>;
}
function Th({ children, onClick, active, dir, align = "right" }) {
  return <th onClick={onClick} style={{ ...S.th, textAlign: align, cursor: onClick ? "pointer" : "default", color: active ? C.accent : C.dim }}>
    {children}{active ? (dir === "asc" ? " ▲" : " ▼") : ""}
  </th>;
}
function deltaCell(d) {
  if (d == null) return <span style={{ color: C.faint }}>—</span>;
  if (d === 0) return <span style={{ color: C.faint }}>0</span>;
  const pos = d > 0;
  return <span style={{ color: pos ? C.up : C.down, fontWeight: 600 }}>{pos ? "+" : "-"}{fmtNum(Math.abs(d))}</span>;
}
function miniDelta(d) { return { color: d > 0 ? C.up : C.down, fontSize: 11, fontWeight: 600, marginLeft: 4 }; }
function roleStyle(role) {
  switch (role) {
    case "Leader": return { background: "#3a2a08", color: "#f5b21a", border: "1px solid #6b4f10" };
    case "Deputy": return { background: "#2a1240", color: "#c98bff", border: "1px solid #4d2475" };
    case "Officer": return { background: "#0e2540", color: "#5fb0ff", border: "1px solid #1f4a7a" };
    default: return { background: "#222", color: "#aaa", border: "1px solid #333" };
  }
}
function tabStyle(on) {
  return {
    background: on ? C.accent : "transparent", color: on ? "#06231a" : C.dim,
    border: `1px solid ${on ? C.accent : C.line}`, borderRadius: 8, padding: "8px 16px",
    fontFamily: F.display, fontWeight: 600, fontSize: 13, cursor: "pointer",
  };
}

// ── Theme ──────────────────────────────────────────────────────────────────────
const C = {
  bg: "#0d0f14", panel: "#13161d", panel2: "#181c25", line: "#242a36",
  ink: "#eef1f6", dim: "#8b94a6", faint: "#4a5160",
  accent: "#7cf2c4", accent2: "#b98cff", up: "#5ce39a", down: "#ff6b7a",
};
const F = {
  display: "'Space Grotesk', 'Segoe UI', system-ui, sans-serif",
  body: "'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
};
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap');
.row { border-bottom: 1px solid ${C.line}; transition: background .12s; }
.row:hover { background: ${C.panel2}; }
::-webkit-scrollbar { height: 10px; width: 10px; }
::-webkit-scrollbar-thumb { background: ${C.line}; border-radius: 6px; }
select option { background: ${C.panel}; }
.pname { transition: color .12s; }
.pname:hover { color: ${C.accent}; text-decoration: underline; }
@keyframes pmIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
`;
const S = {
  shell: { background: C.bg, color: C.ink, fontFamily: F.body, padding: "20px clamp(12px,3vw,28px)", minHeight: "100%", borderRadius: 14 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 18 },
  eyebrow: { fontFamily: F.mono, fontSize: 11, letterSpacing: 2, color: C.accent, marginBottom: 6 },
  h1: { fontFamily: F.display, fontWeight: 700, fontSize: "clamp(22px,3.4vw,34px)", margin: 0, letterSpacing: -0.5 },
  tabs: { display: "flex", gap: 8 },
  headStats: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 },
  stat: { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "8px 14px", minWidth: 78 },
  statValue: { fontFamily: F.display, fontWeight: 600, fontSize: 18 },
  statLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: C.dim, marginTop: 2 },
  snapBar: { display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap", marginBottom: 10 },
  snapField: { display: "flex", flexDirection: "column", gap: 4 },
  fieldLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: C.dim },
  select: { background: C.panel, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 10px", fontFamily: F.body, fontSize: 13, outline: "none" },
  search: { background: C.panel, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 12px", fontFamily: F.body, fontSize: 13, outline: "none", width: 150 },
  ghostBtn: { background: "transparent", color: C.dim, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 12px", fontFamily: F.body, fontSize: 13, cursor: "pointer" },
  diffNote: { fontSize: 12, color: C.dim, marginBottom: 10, padding: "6px 10px", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8 },
  hint: { fontSize: 12, color: C.dim, marginBottom: 10 },
  tableWrap: { overflowX: "auto", border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 560 },
  th: { fontFamily: F.mono, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", padding: "12px 14px", borderBottom: `1px solid ${C.line}`, userSelect: "none", whiteSpace: "nowrap", background: C.panel2 },
  tdName: { padding: "11px 14px", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" },
  tdNum: { padding: "11px 14px", textAlign: "right", fontFamily: F.mono, fontSize: 13, whiteSpace: "nowrap" },
  tdMid: { padding: "11px 14px", textAlign: "right", fontSize: 13, color: C.dim, whiteSpace: "nowrap" },
  tdMidLeft: { padding: "11px 14px", textAlign: "left", whiteSpace: "nowrap" },
  rankNum: { fontFamily: F.mono, fontSize: 11, color: C.faint, width: 22, textAlign: "right" },
  rankBig: { fontFamily: F.display, fontSize: 14, fontWeight: 600, color: C.dim },
  name: { fontWeight: 600, fontSize: 14 },
  nameBtn: { background: "none", border: "none", padding: 0, margin: 0, color: C.ink, fontFamily: F.body, fontWeight: 600, fontSize: 14, cursor: "pointer" },
  roleBadge: { fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 999, letterSpacing: 0.3 },
  newBadge: { fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: C.accent, color: "#06231a", letterSpacing: 1 },
  empty: { padding: 28, textAlign: "center", color: C.dim, fontSize: 13 },

  // ── Player profile modal ──
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.66)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 },
  pmCard: { position: "relative", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 20, width: "min(680px,100%)", maxHeight: "90vh", overflowY: "auto", animation: "pmIn .16s ease-out" },
  pmClose: { position: "absolute", top: 12, right: 12, background: "transparent", color: C.dim, border: `1px solid ${C.line}`, borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: 13, lineHeight: 1, zIndex: 1 },
  pmBody: { display: "flex", flexWrap: "wrap", gap: 18 },
  pmShotWrap: { flex: "0 0 auto", width: 168, maxWidth: "100%", margin: "0 auto" },
  pmShot: { width: "100%", borderRadius: 12, border: `1px solid ${C.line}`, display: "block", cursor: "zoom-in" },
  pmShotCaption: { fontSize: 10, color: C.faint, textAlign: "center", marginTop: 4 },
  pmInfo: { flex: 1, minWidth: 220 },
  pmName: { fontFamily: F.display, fontWeight: 700, fontSize: 24, letterSpacing: -0.3, paddingRight: 34 },
  pmSub: { color: C.accent2, fontSize: 13, fontWeight: 600, marginTop: 2 },
  pmId: { color: C.faint, fontFamily: F.mono, fontSize: 11, marginTop: 4 },
  pmUpdated: { display: "inline-block", marginTop: 8, fontSize: 10, fontWeight: 600, letterSpacing: 0.3, padding: "3px 9px", borderRadius: 999, background: C.panel2, border: `1px solid ${C.line}`, color: C.dim },
  pmBadges: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 },
  pmBadge: { fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: C.panel2, border: `1px solid ${C.line}`, color: C.dim },
  pmBadgeAccent: { color: C.accent, borderColor: "#27503f" },
  pmPowerRow: { display: "flex", alignItems: "baseline", gap: 10, marginTop: 16, padding: "10px 14px", background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10 },
  pmPowerLabel: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1.5, color: C.dim },
  pmPowerValue: { fontFamily: F.display, fontWeight: 700, fontSize: 22, color: C.accent },
  pmSectionLabel: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: C.dim, margin: "16px 0 8px" },
  pmStatGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 },
  pmStat: { background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: "8px 6px", textAlign: "center" },
  pmStatValue: { fontFamily: F.mono, fontWeight: 600, fontSize: 14 },
  pmStatLabel: { fontSize: 9, letterSpacing: 1, color: C.dim, marginTop: 2 },
  pmGearGrid: { display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 },
  pmGear: { background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: "8px 4px", textAlign: "center" },
  pmGearLvl: { fontFamily: F.display, fontWeight: 700, fontSize: 15, color: C.ink },
  pmGearLabel: { fontSize: 9, letterSpacing: 0.5, color: C.dim, marginTop: 2 },
  pmZoom: { position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 60, cursor: "zoom-out" },
  pmZoomImg: { maxWidth: "96vw", maxHeight: "92vh", borderRadius: 12, boxShadow: "0 8px 40px rgba(0,0,0,.6)" },
};
