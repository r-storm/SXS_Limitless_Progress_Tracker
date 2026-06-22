import React, { useState, useEffect, useMemo } from "react";
import {
  fmtNum, fmtDate, parseNum, getProfile, PROFILE_META,
  ROSTER_SNAPS, CONQUEST_SNAPS,
  ROSTER_FIRST_SEEN, CONQUEST_FIRST_SEEN,
  playerTimeline, profileTimeline,
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
        <div style={S.headRight}>
          <a href="https://discord.gg/kmBs9N7m9N" target="_blank" rel="noopener noreferrer" style={S.discordBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3a.07.07 0 0 0-.073.035c-.211.375-.444.864-.608 1.249a18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25A.07.07 0 0 0 9.692 3 19.74 19.74 0 0 0 5.93 4.369a.06.06 0 0 0-.029.024C3.533 7.91 2.886 11.343 3.2 14.733a.08.08 0 0 0 .031.054 19.9 19.9 0 0 0 5.993 3.03.07.07 0 0 0 .077-.027c.462-.63.873-1.295 1.226-1.994a.07.07 0 0 0-.038-.098 13.1 13.1 0 0 1-1.872-.892.07.07 0 0 1-.007-.117c.126-.094.252-.192.372-.291a.07.07 0 0 1 .071-.01c3.927 1.793 8.18 1.793 12.061 0a.07.07 0 0 1 .072.009c.12.099.246.198.373.292a.07.07 0 0 1-.006.117c-.598.349-1.22.645-1.873.891a.07.07 0 0 0-.037.099c.36.698.772 1.362 1.225 1.993a.07.07 0 0 0 .078.028 19.84 19.84 0 0 0 6.002-3.03.08.08 0 0 0 .031-.054c.5-3.927-.838-7.33-3.549-10.34a.06.06 0 0 0-.028-.024ZM9.69 12.67c-1.182 0-2.156-1.085-2.156-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.175 1.096 2.156 2.42 0 1.333-.955 2.418-2.156 2.418Zm7.974 0c-1.182 0-2.156-1.085-2.156-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.175 1.096 2.156 2.42 0 1.333-.946 2.418-2.156 2.418Z" />
            </svg>
            Join Discord
          </a>
          <nav style={S.tabs}>
            <button style={tabStyle(tab === "roster")} onClick={() => setTab("roster")}>Roster</button>
            <button style={tabStyle(tab === "conquest")} onClick={() => setTab("conquest")}>Conquest DMG</button>
          </nav>
        </div>
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

  const widgets = useMemo(() => {
    const present = active.rows.filter((r) => currentKeys.has(r.key));
    if (!present.length) return null;
    const totalPower = present.reduce((s, r) => s + r.power, 0);
    const gainers = present.map((r) => ({ ...r, d: cmap[r.key] ? r.power - cmap[r.key].power : null })).filter((r) => r.d != null);
    const classCount = {};
    const withStats = [];
    for (const r of present) {
      const pr = getProfile(r.key);
      if (pr?.class) classCount[pr.class] = (classCount[pr.class] || 0) + 1;
      if (pr?.stats) withStats.push({ key: r.key, name: r.name, atk: parseNum(pr.stats.atk), def: parseNum(pr.stats.def), hp: parseNum(pr.stats.hp), spd: parseNum(pr.stats.spd) });
    }
    return {
      count: present.length,
      totalPower,
      avgPower: Math.round(totalPower / present.length),
      byPower: topN(present, (r) => r.power),
      byWeek: topN(present, (r) => r.week),
      byTotal: topN(present, (r) => r.total),
      byGain: gainers.length ? topN(gainers, (r) => r.d) : [],
      byAtk: topN(withStats, (r) => r.atk),
      byDef: topN(withStats, (r) => r.def),
      byHp: topN(withStats, (r) => r.hp),
      bySpd: topN(withStats.filter((r) => r.spd > 0), (r) => r.spd),
      classes: Object.entries(classCount).sort((a, b) => b[1] - a[1]),
    };
  }, [active, currentKeys, cmap]);

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
        {widgets && <Stat label="Avg power" value={fmtNum(widgets.avgPower)} />}
        <Stat label="Snapshots" value={snaps.length} />
      </div>
      <SnapBar snaps={snaps} activeId={activeId} setActiveId={setActiveId} compareId={compareId} setCompareId={setCompareId}
        query={query} setQuery={setQuery} />
      {compare && <div style={S.diffNote}>Deltas compare <b>{fmtDate(active.capturedAt)}</b> against <b>{fmtDate(compare.capturedAt)}</b>.</div>}

      <div style={S.layout}>
        <div style={{ ...S.tableWrap, width: "fit-content", maxWidth: "100%" }}>
          <table style={{ ...S.table, width: "auto", minWidth: 0 }}>
            <thead><tr>
              <Th onClick={() => setSort("name")} active={sortKey === "name"} dir={sortDir} align="left">Player</Th>
              <Th onClick={() => setSort("power")} active={sortKey === "power"} dir={sortDir}>Power</Th>
              {compare && <Th onClick={() => setSort("powerDelta")} active={sortKey === "powerDelta"} dir={sortDir}>Δ Power</Th>}
              <Th onClick={() => setSort("rank")} active={sortKey === "rank"} dir={sortDir}>Rank</Th>
              <Th onClick={() => setSort("week")} active={sortKey === "week"} dir={sortDir}>This Week</Th>
              <Th onClick={() => setSort("total")} active={sortKey === "total"} dir={sortDir}>Total Contrib.</Th>
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
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={compare ? 6 : 5} style={S.empty}>No players match "{query}".</td></tr>}
            </tbody>
          </table>
        </div>

        {widgets && (
          <aside style={S.side}>
            <TopList icon={<IconZap />} title="Strongest" items={widgets.byPower} render={(r) => fmtNum(r.power)} onPlayerClick={onPlayerClick} />
            {widgets.byGain.length > 0 && <TopList icon={<IconTrendingUp />} title="Biggest power gain" items={widgets.byGain} render={(r) => `${r.d > 0 ? "+" : ""}${fmtNum(r.d)}`} onPlayerClick={onPlayerClick} />}
            <TopList icon={<IconFlame />} title="Top contribution this week" items={widgets.byWeek} render={(r) => fmtNum(r.week)} onPlayerClick={onPlayerClick} />
            <TopList icon={<IconTrophy />} title="Most total contrib." items={widgets.byTotal} render={(r) => fmtNum(r.total)} onPlayerClick={onPlayerClick} />
            <TopList icon={<IconSword />} title="Highest attack" items={widgets.byAtk} render={(r) => fmtNum(r.atk)} onPlayerClick={onPlayerClick} />
            <TopList icon={<IconShield />} title="Highest defense" items={widgets.byDef} render={(r) => fmtNum(r.def)} onPlayerClick={onPlayerClick} />
            <TopList icon={<IconHeart />} title="Highest HP" items={widgets.byHp} render={(r) => fmtNum(r.hp)} onPlayerClick={onPlayerClick} />
            <TopList icon={<IconGauge />} title="Highest speed" items={widgets.bySpd} render={(r) => fmtNum(r.spd)} onPlayerClick={onPlayerClick} />
            {widgets.classes.length > 0 && (
              <SideCard title="Class split">
                {widgets.classes.map(([c, n]) => <ClassBar key={c} name={c} count={n} total={widgets.count} />)}
              </SideCard>
            )}
          </aside>
        )}
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

  const widgets = useMemo(() => {
    const present = active.rows.filter((r) => currentKeys.has(r.key));
    if (!present.length) return null;
    const totalDmg = present.reduce((s, r) => s + r.dmg, 0);
    const byDmg = topN(present, (r) => r.dmg);
    const gainers = present.map((r) => ({ ...r, d: cmap[r.key] ? r.dmg - cmap[r.key].dmg : null })).filter((r) => r.d != null);
    return {
      count: present.length,
      totalDmg,
      avgDmg: Math.round(totalDmg / present.length),
      topShare: Math.round((byDmg[0].dmg / totalDmg) * 100),
      byDmg,
      byGain: gainers.length ? topN(gainers, (r) => r.d) : [],
    };
  }, [active, currentKeys, cmap]);

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
        {widgets && <Stat label="Avg DMG" value={fmtNum(widgets.avgDmg)} />}
        {widgets && <Stat label="Top share" value={`${widgets.topShare}%`} />}
        <Stat label="Snapshots" value={snaps.length} />
      </div>
      <SnapBar snaps={snaps} activeId={activeId} setActiveId={setActiveId} compareId={compareId} setCompareId={setCompareId}
        query={query} setQuery={setQuery} />
      {compare && <div style={S.diffNote}>Deltas compare <b>{fmtDate(active.capturedAt)}</b> against <b>{fmtDate(compare.capturedAt)}</b>.</div>}

      <div style={S.layout}>
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

        {widgets && (
          <aside style={S.side}>
            <TopList icon={<IconTarget />} title="Top damage" items={widgets.byDmg} render={(r) => fmtNum(r.dmg)} onPlayerClick={onPlayerClick} />
            {widgets.byGain.length > 0 && <TopList icon={<IconTrendingUp />} title="Biggest increase" items={widgets.byGain} render={(r) => `${r.d > 0 ? "+" : ""}${fmtNum(r.d)}`} onPlayerClick={onPlayerClick} />}
          </aside>
        )}
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
// Mean enhancement across a profile's gear slots (null if no gear on record).
function gearAvg(profile) {
  if (!profile?.gear) return null;
  const vals = GEAR_SLOTS.map(([k]) => profile.gear[k]).filter((v) => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}
// Gear levels are small whole numbers — round, no sign (GrowthCard adds its own).
const fmtGear = (v) => String(Math.round(v));
// Metrics used for guild standing + head-to-head comparison.
const COMBAT_STATS = [["atk", "ATK"], ["def", "DEF"], ["hp", "HP"], ["spd", "SPD"]];
const CMP_METRICS = [["power", "Power"], ["dmg", "Conquest DMG"], ["atk", "ATK"], ["def", "DEF"], ["hp", "HP"], ["spd", "SPD"]];
const GROWTH_WINDOWS = [["7d", 7], ["30d", 30], ["All", null]];

// Build a one-shot index of the CURRENT guild: every present member with their
// power + combat stats + latest conquest DMG, plus per-metric max/avg/rank so any
// single player can be placed against the rest. Cheap (≈50 members), runs on open.
function buildGuildIndex() {
  const roster = ROSTER_SNAPS[ROSTER_SNAPS.length - 1];
  const lastConquest = [...CONQUEST_SNAPS].reverse().find((s) => s.rows.length) || null;
  const dmgMap = {};
  if (lastConquest) lastConquest.rows.forEach((r) => { dmgMap[r.key] = r.dmg; });

  const members = roster.rows.map((r) => {
    const pr = getProfile(r.key);
    const s = pr?.stats || {};
    return {
      key: r.key, name: r.name,
      power: r.power,
      atk: s.atk != null ? parseNum(s.atk) : null,
      def: s.def != null ? parseNum(s.def) : null,
      hp: s.hp != null ? parseNum(s.hp) : null,
      spd: s.spd != null ? parseNum(s.spd) : null,
      dmg: dmgMap[r.key] ?? null,
    };
  });

  const stat = {};
  for (const m of ["power", "atk", "def", "hp", "spd", "dmg"]) {
    const vals = members.map((x) => x[m]).filter((v) => v != null);
    const sorted = [...vals].sort((a, b) => b - a);
    stat[m] = {
      max: sorted[0] ?? 0,
      avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0,
      count: vals.length,
      rankOf: (v) => (v == null ? null : sorted.filter((x) => x > v).length + 1),
    };
  }
  return { members, stat };
}

// One player's history for a single metric, oldest→newest, nulls dropped.
function seriesFor(timeline, accessor) {
  return timeline.map((t) => ({ date: t.capturedAt, value: accessor(t) })).filter((p) => p.value != null);
}

// Change in a metric over a trailing window (days), or all-time when days==null.
// Baseline is the latest reading at/while before the cutoff, else the earliest.
function computeGrowth(series, days) {
  if (!series || series.length < 2) return null;
  const latest = series[series.length - 1];
  let base;
  if (days == null) base = series[0];
  else {
    const cutoff = new Date(latest.date).getTime() - days * 86400000;
    base = null;
    for (const pt of series) if (new Date(pt.date).getTime() <= cutoff) base = pt;
    if (!base) base = series[0];
  }
  if (base.date === latest.date) return null;
  const delta = latest.value - base.value;
  return { delta, pct: base.value ? (delta / base.value) * 100 : null, baseDate: base.date };
}

function Sparkline({ series, color = C.accent }) {
  if (!series || series.length < 2) return null;
  const w = 300, h = 52, pad = 5;
  const vals = series.map((p) => p.value);
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
  const step = (w - pad * 2) / (series.length - 1);
  const pts = series.map((p, i) => [pad + i * step, h - pad - ((p.value - min) / range) * (h - pad * 2)]);
  const line = pts.map((c, i) => `${i ? "L" : "M"}${c[0].toFixed(1)} ${c[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${h - pad} L${pts[0][0].toFixed(1)} ${h - pad} Z`;
  const last = pts[pts.length - 1];
  const gid = `spark-${color.replace("#", "")}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0.28" />
        <stop offset="100%" stopColor={color} stopOpacity="0" />
      </linearGradient></defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={color} />
    </svg>
  );
}

function GrowthCard({ label, series, days, fmt }) {
  const g = computeGrowth(series, days);
  return (
    <div style={S.growthCard}>
      <div style={S.growthLabel}>{label}</div>
      <div style={S.growthValue}>{series.length ? fmt(series[series.length - 1].value) : "—"}</div>
      {g ? (
        <>
          <div style={{ ...S.growthDelta, color: g.delta > 0 ? C.up : g.delta < 0 ? C.down : C.faint }}>
            {g.delta > 0 ? "▲" : g.delta < 0 ? "▼" : "•"} {g.delta > 0 ? "+" : g.delta < 0 ? "-" : ""}{fmt(Math.abs(g.delta))}
            {g.pct != null && <span style={S.growthPct}> · {g.pct > 0 ? "+" : ""}{g.pct.toFixed(1)}%</span>}
          </div>
          <div style={S.growthBase}>since {fmtDate(g.baseDate)}</div>
        </>
      ) : (
        <div style={S.growthBase}>no earlier reading</div>
      )}
    </div>
  );
}

function StandingRow({ label, value, info, fmt }) {
  if (value == null || !info) return null;
  const rank = info.rankOf(value);
  const pct = info.avg ? ((value - info.avg) / info.avg) * 100 : 0;
  const fill = info.max ? Math.max(2, (value / info.max) * 100) : 0;
  const avgAt = info.max ? (info.avg / info.max) * 100 : 0;
  return (
    <div style={S.standRow}>
      <div style={S.standHead}>
        <span style={S.standLabel}>{label}</span>
        <span style={S.standValue}>{fmt(value)}</span>
      </div>
      <div style={S.standBar}>
        <div style={{ ...S.standFill, width: `${fill}%` }} />
        <div style={{ ...S.standAvg, left: `${avgAt}%` }} title="Guild average" />
      </div>
      <div style={S.standMeta}>
        <span style={S.rankChip}>#{rank} of {info.count}</span>
        <span style={{ color: pct >= 0 ? C.up : C.down, fontWeight: 600 }}>
          {pct >= 0 ? "+" : ""}{pct.toFixed(0)}% vs avg
        </span>
      </div>
    </div>
  );
}

function PlayerModal({ playerKey, onClose }) {
  const p = getProfile(playerKey);
  const [zoomed, setZoomed] = useState(false);
  const [windowDays, setWindowDays] = useState(7);
  const [compareKey, setCompareKey] = useState("");

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (zoomed) setZoomed(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, zoomed]);

  const guild = useMemo(buildGuildIndex, []);
  const me = useMemo(() => guild.members.find((m) => m.key === playerKey) || null, [guild, playerKey]);
  const timeline = useMemo(() => playerTimeline(playerKey), [playerKey]);
  const powerSeries = useMemo(() => seriesFor(timeline, (t) => t.roster?.power), [timeline]);
  const totalSeries = useMemo(() => seriesFor(timeline, (t) => t.roster?.total), [timeline]);
  const dmgSeries = useMemo(() => seriesFor(timeline, (t) => t.conquest?.dmg), [timeline]);
  const profTimeline = useMemo(() => profileTimeline(playerKey), [playerKey]);
  const gearSeries = useMemo(() => seriesFor(profTimeline, (t) => gearAvg(t.profile)), [profTimeline]);
  const other = compareKey ? guild.members.find((m) => m.key === compareKey) || null : null;

  const displayName = p?.name || me?.name || "Unknown player";
  const headPower = me ? fmtNum(me.power) : p?.power;
  const others = useMemo(
    () => guild.members.filter((m) => m.key !== playerKey).sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())),
    [guild, playerKey]
  );

  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.pmCard} onClick={(e) => e.stopPropagation()}>
        <button style={S.pmClose} onClick={onClose} aria-label="Close">✕</button>

        {!p && !me ? (
          <div style={S.empty}>No data on record for this player yet.</div>
        ) : (
          <>
            <div style={S.pmBody}>
              {p?.image && (
                <div className="pm-shot-wrap" style={S.pmShotWrap}>
                  <img className="pm-shot" src={p.image} alt={`${displayName} profile`} style={S.pmShot} onClick={() => setZoomed(true)} title="Click to expand" />
                  <div style={S.pmShotCaption}>Click to expand</div>
                </div>
              )}

              <div style={S.pmInfo}>
                <div style={S.pmNameRow}>
                  <span style={S.pmName}>{displayName}</span>
                  {p?.level != null && <span style={S.pmLevelBadge}>Lv. {p.level}</span>}
                </div>
                {p?.class && (
                  <div style={S.pmClassRow}>
                    <span style={S.pmClass}>{p.class}</span>
                    {p.classLevel != null && <span style={S.pmClassBadge}>Class Lv. {p.classLevel}</span>}
                  </div>
                )}

                {p?.rank && (
                  <div style={S.pmBadges}>
                    <span style={S.pmBadge}>{p.rank}</span>
                  </div>
                )}

                {headPower != null && (
                  <div style={S.pmPowerRow}>
                    <span style={S.pmPowerLabel}>POWER</span>
                    <span style={S.pmPowerValue}>{headPower}</span>
                  </div>
                )}

                {p?.gear && (
                  <>
                    <div style={S.pmSectionLabel}>Gear</div>
                    <div style={S.pmGearGrid}>
                      {GEAR_SLOTS.map(([k, label]) => (
                        <div key={k} style={S.pmGear}>
                          <div style={S.pmGearLvl}>+{p.gear?.[k] ?? "—"}</div>
                          <div style={S.pmGearLabel}>{label}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── Growth over time ── */}
            <div style={S.pmSection}>
              <div style={S.pmSectionHead}>
                <span style={S.pmSectionLabel}>Growth</span>
                <div style={S.seg} role="group" aria-label="Growth window">
                  {GROWTH_WINDOWS.map(([lbl, d]) => (
                    <button key={lbl} style={segStyle(windowDays === d)} onClick={() => setWindowDays(d)}>{lbl}</button>
                  ))}
                </div>
              </div>
              <div style={S.growthGrid}>
                <GrowthCard label="Power" series={powerSeries} days={windowDays} fmt={fmtNum} />
                <GrowthCard label="Total contrib." series={totalSeries} days={windowDays} fmt={fmtNum} />
                <GrowthCard label="Conquest DMG" series={dmgSeries} days={windowDays} fmt={fmtNum} />
                <GrowthCard label="Gear (avg +)" series={gearSeries} days={windowDays} fmt={fmtGear} />
              </div>
              {powerSeries.length >= 2 && (
                <div style={S.trendCard}>
                  <div style={S.trendHead}>
                    <span>Power trend</span>
                    <span style={S.trendVals}>{fmtNum(powerSeries[0].value)} → {fmtNum(powerSeries[powerSeries.length - 1].value)}</span>
                  </div>
                  <Sparkline series={powerSeries} />
                  <div style={S.trendAxis}>
                    <span>{fmtDate(powerSeries[0].date)}</span>
                    <span>{fmtDate(powerSeries[powerSeries.length - 1].date)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Standing in the guild ── */}
            {me && (
              <div style={S.pmSection}>
                <div style={S.pmSectionLabel}>Standing in the guild</div>
                <div style={S.standWrap}>
                  <StandingRow label="Power" value={me.power} info={guild.stat.power} fmt={fmtNum} />
                  {me.dmg != null && <StandingRow label="Conquest DMG" value={me.dmg} info={guild.stat.dmg} fmt={fmtNum} />}
                  {COMBAT_STATS.map(([k, lbl]) => (
                    <StandingRow key={k} label={lbl} value={me[k]} info={guild.stat[k]} fmt={fmtNum} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Head-to-head ── */}
            {me && others.length > 0 && (
              <div style={S.pmSection}>
                <div style={S.pmSectionHead}>
                  <span style={S.pmSectionLabel}>Compare with</span>
                  <select style={S.cmpSelect} value={compareKey} onChange={(e) => setCompareKey(e.target.value)}>
                    <option value="">Pick a member…</option>
                    {others.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}
                  </select>
                </div>
                {other && (
                  <div style={S.cmpTable}>
                    <div style={S.cmpRow}>
                      <span style={S.cmpLabel} />
                      <span style={{ ...S.cmpCell, color: C.accent }}>{displayName}</span>
                      <span style={{ ...S.cmpCell, color: C.accent2 }}>{other.name}</span>
                    </div>
                    {CMP_METRICS.map(([k, lbl]) => {
                      const a = me[k], b = other[k];
                      if (a == null && b == null) return null;
                      return (
                        <div key={k} style={S.cmpRow}>
                          <span style={S.cmpLabel}>{lbl}</span>
                          <span style={{ ...S.cmpCell, ...(a != null && b != null && a > b ? S.cmpWin : {}) }}>{a != null ? fmtNum(a) : "—"}</span>
                          <span style={{ ...S.cmpCell, ...(a != null && b != null && b > a ? S.cmpWin : {}) }}>{b != null ? fmtNum(b) : "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {(p?.playerId || PROFILE_META.capturedAt) && (
              <div style={S.pmFooter}>
                {p?.playerId && <span>Player ID · {p.playerId}</span>}
                {PROFILE_META.capturedAt && <span style={S.pmUpdated}>Updated {fmtDate(PROFILE_META.capturedAt)}</span>}
              </div>
            )}
          </>
        )}
      </div>

      {zoomed && p?.image && (
        <div style={S.pmZoom} onClick={(e) => { e.stopPropagation(); setZoomed(false); }}>
          <img src={p.image} alt={`${displayName} profile`} style={S.pmZoomImg} />
        </div>
      )}
    </div>
  );
}

// ── Icons (inline, stroke inherits text color) ───────────────────────────────────
const ICON = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
const IconZap = () => <svg {...ICON}><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg>;
const IconTrendingUp = () => <svg {...ICON}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>;
const IconFlame = () => <svg {...ICON}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>;
const IconTrophy = () => <svg {...ICON}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>;
const IconTarget = () => <svg {...ICON}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
const IconSword = () => <svg {...ICON}><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" /><line x1="13" y1="19" x2="19" y2="13" /><line x1="16" y1="16" x2="20" y2="20" /><line x1="19" y1="21" x2="21" y2="19" /></svg>;
const IconShield = () => <svg {...ICON}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></svg>;
const IconHeart = () => <svg {...ICON}><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>;
const IconGauge = () => <svg {...ICON}><path d="m12 14 4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" /></svg>;

// ── Side widgets ─────────────────────────────────────────────────────────────────
function topN(arr, f, n = 5) {
  return [...arr].sort((a, b) => f(b) - f(a)).slice(0, n);
}
function SideCard({ title, children }) {
  return <div style={S.sideCard}><div style={S.sideCardTitle}>{title}</div>{children}</div>;
}
function TopList({ icon, title, items, render, onPlayerClick }) {
  if (!items.length) return null;
  return (
    <SideCard title={<span style={S.cardTitle}>{icon}{title}</span>}>
      {items.map((r, i) => (
        <div key={r.key} style={S.topRow}>
          <span style={S.topRank}>{i + 1}</span>
          <button className="pname" style={S.topName} onClick={() => onPlayerClick(r.key)}>{r.name}</button>
          <span style={S.topVal}>{render(r)}</span>
        </div>
      ))}
    </SideCard>
  );
}
function ClassBar({ name, count, total }) {
  const pct = Math.round((count / total) * 100);
  return (
    <div style={S.classRow}>
      <div style={S.classHead}><span>{name}</span><span style={S.kvValue}>{count}</span></div>
      <div style={S.classTrack}><div style={{ ...S.classFill, width: `${pct}%` }} /></div>
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
function segStyle(on) {
  return {
    background: on ? C.accent : "transparent", color: on ? "#06231a" : C.dim,
    border: "none", borderRadius: 6, padding: "5px 12px", minWidth: 44,
    fontFamily: F.display, fontWeight: 600, fontSize: 12, cursor: "pointer",
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
/* Side-by-side modal: pin the screenshot to the info column's height, cropping
   from the top so it ends level with the gear cards. Stacks full-height below. */
@media (min-width: 520px) {
  .pm-shot-wrap { align-self: stretch; }
  .pm-shot { position: absolute; inset: 0; width: 100%; height: 100%; }
}
`;
const S = {
  shell: { background: C.bg, color: C.ink, fontFamily: F.body, padding: "20px clamp(12px,3vw,28px)", minHeight: "100%", borderRadius: 14 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 18 },
  eyebrow: { fontFamily: F.mono, fontSize: 11, letterSpacing: 2, color: C.accent, marginBottom: 6 },
  h1: { fontFamily: F.display, fontWeight: 700, fontSize: "clamp(22px,3.4vw,34px)", margin: 0, letterSpacing: -0.5 },
  headRight: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  tabs: { display: "flex", gap: 8 },
  discordBtn: { display: "inline-flex", alignItems: "center", gap: 7, background: "#5865F2", color: "#fff", textDecoration: "none", border: "none", borderRadius: 8, padding: "8px 14px", fontFamily: F.display, fontWeight: 600, fontSize: 13, cursor: "pointer" },
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

  // ── Layout + side widgets ──
  layout: { display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" },
  side: { display: "flex", flexDirection: "column", gap: 10, flex: "1 1 240px", minWidth: 220, maxWidth: 420 },
  sideCard: { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 },
  sideCardTitle: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: C.dim, marginBottom: 10 },
  cardTitle: { display: "inline-flex", alignItems: "center", gap: 6, color: C.accent },
  kvValue: { fontFamily: F.mono, fontWeight: 600, color: C.ink },
  topRow: { display: "flex", alignItems: "baseline", gap: 8, padding: "6px 0", borderTop: `1px solid ${C.line}` },
  topRank: { fontFamily: F.mono, fontSize: 11, color: C.faint, width: 16, textAlign: "right", flex: "0 0 auto" },
  topName: { background: "none", border: "none", padding: 0, margin: 0, color: C.accent, fontFamily: F.display, fontWeight: 600, fontSize: 14, cursor: "pointer", textAlign: "left", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  topVal: { fontFamily: F.mono, fontWeight: 600, fontSize: 13, color: C.ink, whiteSpace: "nowrap", flex: "0 0 auto" },
  classRow: { padding: "6px 0" },
  classHead: { display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 },
  classTrack: { height: 6, background: C.panel2, borderRadius: 999, overflow: "hidden" },
  classFill: { height: "100%", background: C.accent, borderRadius: 999 },
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
  pmBody: { display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" },
  pmShotWrap: { flex: "0 0 auto", width: 200, maxWidth: "100%", margin: "0 auto", position: "relative", borderRadius: 14, overflow: "hidden", border: `1px solid ${C.line}`, boxShadow: "0 6px 24px rgba(0,0,0,.45)" },
  pmShot: { display: "block", width: "100%", cursor: "zoom-in", objectFit: "cover", objectPosition: "top center" },
  pmShotCaption: { position: "absolute", left: 0, right: 0, bottom: 0, fontSize: 10, color: C.ink, textAlign: "center", padding: "10px 4px 4px", background: "linear-gradient(to top, rgba(0,0,0,.72), transparent)", pointerEvents: "none" },
  pmInfo: { flex: 1, minWidth: 220 },
  pmNameRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", paddingRight: 34 },
  pmName: { fontFamily: F.display, fontWeight: 700, fontSize: "clamp(26px,5vw,32px)", letterSpacing: -0.4, lineHeight: 1.1 },
  pmLevelBadge: { fontFamily: F.display, fontWeight: 700, fontSize: 13, padding: "4px 11px", borderRadius: 999, background: "rgba(124,242,196,.12)", border: "1px solid #27503f", color: C.accent, whiteSpace: "nowrap" },
  pmClassRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 6 },
  pmClass: { color: C.accent2, fontFamily: F.display, fontSize: 17, fontWeight: 600 },
  pmClassBadge: { fontFamily: F.mono, fontWeight: 600, fontSize: 11, padding: "3px 9px", borderRadius: 999, background: "rgba(185,140,255,.12)", border: "1px solid #3d2c5c", color: C.accent2, whiteSpace: "nowrap" },
  pmId: { color: C.faint, fontFamily: F.mono, fontSize: 11 },
  pmUpdated: { display: "inline-block", fontSize: 10, fontWeight: 600, letterSpacing: 0.3, padding: "3px 9px", borderRadius: 999, background: C.panel2, border: `1px solid ${C.line}`, color: C.dim },
  pmFooter: { marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap", fontFamily: F.mono, fontSize: 11, letterSpacing: 0.5, color: C.faint },
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

  // ── Modal: advanced sections (growth / standing / compare) ──
  pmSection: { marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.line}` },
  pmSectionHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 },
  seg: { display: "inline-flex", gap: 2, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, padding: 2 },
  growthGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8 },
  growthCard: { background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px" },
  growthLabel: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: C.dim },
  growthValue: { fontFamily: F.display, fontWeight: 700, fontSize: 20, marginTop: 4 },
  growthDelta: { fontFamily: F.mono, fontSize: 13, fontWeight: 600, marginTop: 4 },
  growthPct: { fontWeight: 600 },
  growthBase: { fontSize: 10, color: C.faint, marginTop: 3 },
  trendCard: { background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px", marginTop: 8 },
  trendHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: F.mono, fontSize: 11, color: C.dim, marginBottom: 8 },
  trendVals: { color: C.ink, fontWeight: 600 },
  trendAxis: { display: "flex", justifyContent: "space-between", fontSize: 10, color: C.faint, marginTop: 4 },
  standWrap: { display: "flex", flexDirection: "column", gap: 12 },
  standRow: {},
  standHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 },
  standLabel: { fontFamily: F.mono, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: C.dim },
  standValue: { fontFamily: F.mono, fontSize: 14, fontWeight: 600, color: C.ink },
  standBar: { position: "relative", height: 8, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 999, overflow: "hidden" },
  standFill: { position: "absolute", left: 0, top: 0, bottom: 0, background: C.accent, borderRadius: 999 },
  standAvg: { position: "absolute", top: -2, bottom: -2, width: 2, background: C.accent2, opacity: 0.85 },
  standMeta: { display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: F.mono, fontSize: 11, marginTop: 5 },
  rankChip: { color: C.dim, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 999, padding: "2px 8px" },
  cmpSelect: { background: C.panel2, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 10px", fontFamily: F.body, fontSize: 13, outline: "none", maxWidth: "60%" },
  cmpTable: { border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" },
  cmpRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", alignItems: "center", padding: "9px 12px", borderTop: `1px solid ${C.line}` },
  cmpLabel: { fontFamily: F.mono, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: C.dim },
  cmpCell: { fontFamily: F.mono, fontSize: 13, fontWeight: 600, textAlign: "right", color: C.dim },
  cmpWin: { color: C.ink, background: "rgba(124,242,196,.08)" },
};
