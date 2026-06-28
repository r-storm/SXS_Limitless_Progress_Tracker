import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  fmtNum, fmtDate, parseNum, getProfile, PROFILE_META, hasLeft,
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
            <button style={tabStyle(tab === "rankings")} onClick={() => setTab("rankings")}>Rankings</button>
          </nav>
        </div>
      </header>

      {tab === "roster" && <RosterView snaps={ROSTER_SNAPS} firstSeen={ROSTER_FIRST_SEEN} onPlayerClick={setProfileKey} />}
      {tab === "conquest" && <ConquestView snaps={CONQUEST_SNAPS} firstSeen={CONQUEST_FIRST_SEEN} onPlayerClick={setProfileKey} />}
      {tab === "rankings" && <RankingsView rosterSnaps={ROSTER_SNAPS} conquestSnaps={CONQUEST_SNAPS} onPlayerClick={setProfileKey} />}

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
        {setQuery && <input style={S.search} placeholder="Search name…" value={query} onChange={(e) => setQuery(e.target.value)} />}
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

  // Only show players present in the latest capture and not flagged as having
  // left (see LEFT in src/data/players.js) — leavers are hidden everywhere, even
  // when viewing an older snapshot.
  const currentKeys = useMemo(() => new Set(snaps[snaps.length - 1].rows.map((r) => r.key).filter((k) => !hasLeft(k))), [snaps]);

  const totals = useMemo(() => {
    const present = active.rows.filter((r) => currentKeys.has(r.key));
    const power = present.reduce((s, r) => s + r.power, 0);
    return { members: present.length, power, avgPower: present.length ? Math.round(power / present.length) : 0 };
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
        {totals.members > 0 && <Stat label="Avg power" value={fmtNum(totals.avgPower)} />}
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

  // Only show players present in the latest capture and not flagged as having
  // left (see LEFT in src/data/players.js) — leavers are hidden everywhere, even
  // when viewing an older snapshot.
  const currentKeys = useMemo(() => new Set(snaps[snaps.length - 1].rows.map((r) => r.key).filter((k) => !hasLeft(k))), [snaps]);

  const totals = useMemo(() => {
    const present = active.rows.filter((r) => currentKeys.has(r.key));
    const dmg = present.reduce((s, r) => s + r.dmg, 0);
    const maxDmg = present.reduce((m, r) => Math.max(m, r.dmg), 0);
    return {
      members: present.length,
      dmg,
      avgDmg: present.length ? Math.round(dmg / present.length) : 0,
      topShare: dmg ? Math.round((maxDmg / dmg) * 100) : 0,
    };
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
        {totals.members > 0 && <Stat label="Avg DMG" value={fmtNum(totals.avgDmg)} />}
        {totals.members > 0 && <Stat label="Top share" value={`${totals.topShare}%`} />}
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
      </div>
    </>
  );
}

// ── Rankings tab · Hall of Champions ─────────────────────────────────────────────
// The leaderboards reframed as an honours hall: a crowned podium for the top three,
// an honour roll for the rest, and medal-tiered category boards. Each dataset
// (roster, conquest) keeps its own snapshot + compare selector.
function RankingsView({ rosterSnaps, conquestSnaps, onPlayerClick }) {
  return (
    <div className="rank-scope" style={S.rankWrap}>
      <header style={S.hallHero}>
        <div style={S.hallHeroKicker}>LIMITLESS · SWORD × STAFF</div>
        <h1 style={S.hallHeroTitle}>Hall of Champions</h1>
        <p style={S.hallHeroSub}>Every name here earned its place. Tap a champion to see how they stack up.</p>
      </header>
      <RankingSection
        kind="roster" snaps={rosterSnaps} onPlayerClick={onPlayerClick}
        kicker="Power Rankings" title="The Strongest"
        subtitle="The mightiest members of Limitless, ranked by total power."
        championLabel="Guild Champion"
      />
      {conquestSnaps.length > 0 && (
        <RankingSection
          kind="conquest" snaps={conquestSnaps} onPlayerClick={onPlayerClick}
          kicker="Conquest Rankings" title="Top Damage"
          subtitle="The biggest hitters in Conquest."
          championLabel="Conquest Champion"
        />
      )}
    </div>
  );
}

function RankingSection({ kind, snaps, onPlayerClick, kicker, title, subtitle, championLabel }) {
  const { activeId, setActiveId, compareId, setCompareId } = useSnapshotState(snaps);
  const active = snaps.find((s) => s.id === activeId);
  const compare = snaps.find((s) => s.id === compareId) || null;
  const cmap = useMemo(() => { const m = {}; if (compare) compare.rows.forEach((r) => { m[r.key] = r; }); return m; }, [compare]);

  // Same visibility rule as the dashboard tables: only current, non-left members.
  const currentKeys = useMemo(() => new Set(snaps[snaps.length - 1].rows.map((r) => r.key).filter((k) => !hasLeft(k))), [snaps]);
  const present = useMemo(() => active.rows.filter((r) => currentKeys.has(r.key)), [active, currentKeys]);
  const r = useMemo(() => (kind === "roster" ? rosterRankings(present, cmap) : conquestRankings(present, cmap)), [kind, present, cmap]);

  const marquee = kind === "roster" ? r?.byPower : r?.byDmg;        // headline board
  const value = kind === "roster" ? ((x) => x.power) : ((x) => x.dmg);
  const gainFmt = (d) => `${d > 0 ? "+" : ""}${fmtNum(d)}`;

  return (
    <section style={S.hall}>
      <div style={S.hallHead}>
        <div style={S.hallKicker}>{kicker}</div>
        <h2 style={S.hallTitle}>{title}</h2>
        <p style={S.hallSub}>{subtitle}</p>
      </div>
      <SnapBar snaps={snaps} activeId={activeId} setActiveId={setActiveId} compareId={compareId} setCompareId={setCompareId} />
      {compare && <div style={S.diffNote}>Gain boards compare <b>{fmtDate(active.capturedAt)}</b> against <b>{fmtDate(compare.capturedAt)}</b>.</div>}

      {!r || !marquee.length ? (
        <div style={S.empty}>No data for this snapshot.</div>
      ) : (
        <>
          <Podium items={marquee} value={value} fmt={fmtNum} championLabel={championLabel} runnerLabels={["Runner-up", "Third place"]} onPlayerClick={onPlayerClick} />
          {marquee.length > 3 && (
            <>
              <div style={S.rollHead}>Ranks 4–{marquee.length}</div>
              <HonorRoll items={marquee.slice(3)} value={value} fmt={fmtNum} startRank={4} onPlayerClick={onPlayerClick} />
            </>
          )}

          {kind === "roster" ? (
            <>
              <div style={S.boardsHead}>Category leaders</div>
              <div style={S.rankGrid}>
                {r.byGain.length > 0 && <RankBoard icon={<IconTrendingUp />} title="Biggest power gain" items={r.byGain} value={(x) => x.d} fmt={gainFmt} onPlayerClick={onPlayerClick} />}
                <RankBoard icon={<IconFlame />} title="Top contribution this week" items={r.byWeek} value={(x) => x.week} fmt={fmtNum} onPlayerClick={onPlayerClick} />
                <RankBoard icon={<IconTrophy />} title="Most total contrib." items={r.byTotal} value={(x) => x.total} fmt={fmtNum} onPlayerClick={onPlayerClick} />
                <RankBoard icon={<IconSword />} title="Highest attack" items={r.byAtk} value={(x) => x.atk} fmt={fmtNum} onPlayerClick={onPlayerClick} />
                <RankBoard icon={<IconShield />} title="Highest defense" items={r.byDef} value={(x) => x.def} fmt={fmtNum} onPlayerClick={onPlayerClick} />
                <RankBoard icon={<IconHeart />} title="Highest HP" items={r.byHp} value={(x) => x.hp} fmt={fmtNum} onPlayerClick={onPlayerClick} />
                <RankBoard icon={<IconGauge />} title="Highest speed" items={r.bySpd} value={(x) => x.spd} fmt={fmtNum} onPlayerClick={onPlayerClick} />
                {r.classes.length > 0 && (
                  <div className="board rank-rise">
                    <div className="board-head"><span>Class split</span></div>
                    {r.classes.map(([c, n]) => <ClassBar key={c} name={c} count={n} total={r.count} />)}
                  </div>
                )}
              </div>
            </>
          ) : (
            r.byGain.length > 0 && (
              <>
                <div style={S.boardsHead}>Category leaders</div>
                <div style={S.rankGrid}>
                  <RankBoard icon={<IconTrendingUp />} title="Biggest increase" items={r.byGain} value={(x) => x.d} fmt={gainFmt} onPlayerClick={onPlayerClick} />
                </div>
              </>
            )
          )}
        </>
      )}
    </section>
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

// Per-metric placement index: max / avg / count / rankOf for any set of members.
// Reused for the whole-guild index and for class-scoped peer rankings.
function statIndex(members, keys) {
  const stat = {};
  for (const m of keys) {
    const vals = members.map((x) => x[m]).filter((v) => v != null);
    const sorted = [...vals].sort((a, b) => b - a);
    stat[m] = {
      max: sorted[0] ?? 0,
      avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0,
      count: vals.length,
      rankOf: (v) => (v == null ? null : sorted.filter((x) => x > v).length + 1),
    };
  }
  return stat;
}

// Every metric a member is ranked against the guild on.
const INDEX_KEYS = ["power", "atk", "def", "hp", "spd", "dmg", "likes", "gearAvg", "dmgPerPow", "contribPerPow", "gain", "total", "week"];

// Build a one-shot index of the CURRENT guild: every present member with their
// power, combat stats, progression, social + efficiency figures and latest
// conquest DMG, plus per-metric max/avg/rank so any single player can be placed
// against the rest. Also groups members by class and tallies companion usage.
// Cheap (≈50 members), runs once when a profile opens.
function buildGuildIndex() {
  const roster = ROSTER_SNAPS[ROSTER_SNAPS.length - 1];
  const lastConquest = [...CONQUEST_SNAPS].reverse().find((s) => s.rows.length) || null;
  const dmgMap = {};
  if (lastConquest) lastConquest.rows.forEach((r) => { dmgMap[r.key] = r.dmg; });

  // Earliest power on record per player — powers the all-time "gain" ranking.
  const firstPower = {};
  for (const snap of ROSTER_SNAPS) for (const row of snap.rows) if (!(row.key in firstPower)) firstPower[row.key] = row.power;

  const members = roster.rows.filter((r) => !hasLeft(r.key)).map((r) => {
    const pr = getProfile(r.key);
    const s = pr?.stats || {};
    const num = (v) => (v != null ? parseNum(v) : null);
    const power = r.power;
    const dmg = dmgMap[r.key] ?? null;
    const total = r.total ?? null;
    const per1M = (v) => (v != null && power ? v / (power / 1e6) : null);
    return {
      key: r.key, name: r.name, power,
      atk: num(s.atk), def: num(s.def), hp: num(s.hp), spd: num(s.spd),
      dmg, likes: num(pr?.likes), total, week: r.week ?? null,
      klass: pr?.class || null, level: pr?.level ?? null, classLevel: pr?.classLevel ?? null,
      gear: pr?.gear || null, gearAvg: gearAvg(pr),
      technique: Array.isArray(pr?.technique) ? pr.technique : null,
      charm: Array.isArray(pr?.charm) ? pr.charm : null,
      dmgPerPow: per1M(dmg), contribPerPow: per1M(total),
      gain: firstPower[r.key] != null ? power - firstPower[r.key] : null,
    };
  });

  const classGroups = {};
  for (const m of members) {
    if (m.klass) (classGroups[m.klass] ||= []).push(m);
  }

  return { members, stat: statIndex(members, INDEX_KEYS), classGroups };
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

function Sparkline({ series, color = C.accent, dots = false, highlight = -1 }) {
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
      {dots && pts.map((c, i) => (
        i === highlight
          ? <circle key={i} cx={c[0]} cy={c[1]} r="4" fill={C.up} stroke={C.bg} strokeWidth="1.5" />
          : i < pts.length - 1 && <circle key={i} cx={c[0]} cy={c[1]} r="2.2" fill={color} fillOpacity="0.55" />
      ))}
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

// ── Profile insight building blocks ─────────────────────────────────────────────
const WARN = "#f5b21a"; // upgrade-priority amber (matches the Leader role accent)

// Tooltip whose bubble is portaled to <body> with position:fixed, so the modal's
// scroll/overflow can never clip it. Shows on hover and keyboard focus.
function Tip({ text, children, style, className }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  const show = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(r.left + r.width / 2, 124), window.innerWidth - 124);
    setPos({ x, y: r.bottom + 9 });
  };
  const hide = () => setPos(null);
  return (
    <span ref={ref} style={style} className={["tip-trig", className].filter(Boolean).join(" ")} tabIndex={0} aria-label={text}
      onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {pos && createPortal(<span className="tip-pop" style={{ left: pos.x, top: pos.y }}>{text}</span>, document.body)}
    </span>
  );
}

// ── Combat identity: radar + derived archetype ──
const RADAR_AXES = [["atk", "ATK"], ["spd", "SPD"], ["def", "DEF"], ["hp", "HP"]];

// Label a build from the shape of its stats (each read relative to the guild's
// strongest in that stat, so the comparison is apples-to-apples across stats).
function deriveArchetype(me, stat) {
  if (!me || me.atk == null || me.def == null || me.hp == null) return null;
  const n = (k) => (stat[k]?.max ? Math.min(1, (me[k] ?? 0) / stat[k].max) : 0);
  const atk = n("atk"), def = n("def"), hp = n("hp"), spd = n("spd");
  const off = atk, bulk = (def + hp) / 2;
  if (spd >= Math.max(atk, def, hp) + 0.12) return { label: "Striker", desc: "Speed outpaces everything — moves first." };
  if (off - bulk > 0.15) return { label: "Glass Cannon", desc: "Big attack, lighter defenses." };
  if (bulk - off > 0.15) return { label: "Tank", desc: "Built to absorb — heavy bulk." };
  if (off > 0.55 && bulk > 0.55) return { label: "Bruiser", desc: "Hits hard and takes hits." };
  return { label: "Balanced", desc: "An even spread across stats." };
}

// Class-average shape (0..1 vs guild max per axis), for the radar overlay.
function classRadarAvg(group, stat) {
  const out = {};
  for (const [k] of RADAR_AXES) {
    const vals = group.map((m) => m[k]).filter((v) => v != null);
    const a = vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : 0;
    out[k] = stat[k]?.max ? a / stat[k].max : 0;
  }
  return out;
}

function Radar({ vals, avg, size = 232 }) {
  const c = size / 2, r = c - 34;
  const ang = (i) => ((-90 + i * 90) * Math.PI) / 180;
  const pt = (i, v) => [c + r * v * Math.cos(ang(i)), c + r * v * Math.sin(ang(i))];
  const poly = (o) => RADAR_AXES.map(([k], i) => pt(i, Math.max(0.02, Math.min(1, o?.[k] ?? 0))).map((n) => n.toFixed(1)).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ display: "block", margin: "0 auto", maxWidth: "100%", height: "auto" }} aria-hidden="true">
      {[0.33, 0.66, 1].map((rr, i) => (
        <polygon key={i} points={RADAR_AXES.map((_, idx) => pt(idx, rr).map((n) => n.toFixed(1)).join(",")).join(" ")} fill="none" stroke={C.line} strokeWidth="1" />
      ))}
      {RADAR_AXES.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke={C.line} strokeWidth="1" />; })}
      {avg && <polygon points={poly(avg)} fill="none" stroke={C.accent2} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.85" />}
      <polygon points={poly(vals)} fill={C.accent} fillOpacity="0.16" stroke={C.accent} strokeWidth="2" />
      {RADAR_AXES.map(([k, lbl], i) => { const [x, y] = pt(i, 1.18); return <text key={k} x={x} y={y} fill={C.dim} fontSize="10" fontFamily={F.mono} textAnchor="middle" dominantBaseline="middle">{lbl}</text>; })}
    </svg>
  );
}

// ── Progression / upgrade advisor (gear · technique · charm) ──
const SLOT_NUM = ["I", "II", "III", "IV", "V"];
function ProgressionSection({ p }) {
  const tracks = [];
  if (p.gear) tracks.push({ name: "Gear", slots: GEAR_SLOTS.map(([k, l]) => ({ label: l, lvl: p.gear[k] })).filter((s) => s.lvl != null) });
  if (Array.isArray(p.technique)) tracks.push({ name: "Technique", slots: p.technique.map((lvl, i) => ({ label: SLOT_NUM[i] || `${i + 1}`, lvl })) });
  if (Array.isArray(p.charm)) tracks.push({ name: "Charm", slots: p.charm.map((lvl, i) => ({ label: SLOT_NUM[i] || `${i + 1}`, lvl })) });
  const usable = tracks.filter((t) => t.slots.length);
  if (!usable.length) return null;

  let lowest = null, highest = null;
  for (const t of usable) for (const s of t.slots) {
    if (s.lvl == null) continue;
    if (!lowest || s.lvl < lowest.lvl) lowest = { ...s, track: t.name };
    if (!highest || s.lvl > highest.lvl) highest = { ...s, track: t.name };
  }
  const gap = lowest && highest ? highest.lvl - lowest.lvl : 0;

  return (
    <div style={S.pmSection}>
      <div style={S.pmSectionLabel}>Progression & upgrades</div>
      {usable.map((t) => {
        const min = Math.min(...t.slots.map((s) => s.lvl));
        return (
          <div key={t.name} style={S.progTrack}>
            <div style={S.progName}>{t.name}</div>
            <div style={S.progChips}>
              {t.slots.map((s, i) => (
                <div key={i} style={{ ...S.progChip, ...(s.lvl === min ? S.progChipLow : {}) }}>
                  <span style={S.progLvl}>+{s.lvl}</span>
                  <span style={S.progSlot}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {lowest && (
        <div style={S.advisor}>
          <span style={S.advisorIcon}>▲</span>
          <span>
            <b>Upgrade priority:</b> {lowest.track} · {lowest.label} <b style={{ color: WARN }}>+{lowest.lvl}</b>
            {gap > 0 ? <> — your lowest, {gap} {gap === 1 ? "level" : "levels"} behind your best (+{highest.lvl}).</> : <> — everything is even; push your whole kit up together.</>}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Efficiency (output relative to power) ──
function EfficiencyCard({ label, value, info, hint }) {
  if (value == null || !info || !info.count) return null;
  const rank = info.rankOf(value);
  const pct = info.avg ? ((value - info.avg) / info.avg) * 100 : 0;
  return (
    <div style={S.effCard}>
      <div style={S.growthLabel}>{label}</div>
      <div style={S.growthValue}>{fmtNum(Math.round(value))}</div>
      <div style={S.effMeta}>
        <span style={S.rankChip}>#{rank} of {info.count}</span>
        <span style={{ color: pct >= 0 ? C.up : C.down, fontWeight: 600 }}>{pct >= 0 ? "+" : ""}{pct.toFixed(0)}%</span>
      </div>
      <div style={S.growthBase}>{hint}</div>
    </div>
  );
}

// ── Class peer ranking ──
const CLASS_METRICS = [["power", "Power"], ["dmg", "DMG"], ["atk", "ATK"], ["def", "DEF"], ["hp", "HP"], ["spd", "SPD"]];
function ClassRankSection({ me, group }) {
  if (!me?.klass || !group || group.length < 2) return null;
  const stat = statIndex(group, CLASS_METRICS.map(([k]) => k));
  return (
    <div style={S.pmSection}>
      <div style={S.pmSectionLabel}>Among {me.klass}s · {group.length} in guild</div>
      <div style={S.classRankGrid}>
        {CLASS_METRICS.map(([k, lbl]) => {
          const info = stat[k];
          const rank = me[k] != null ? info.rankOf(me[k]) : null;
          if (rank == null || !info.count) return null;
          const best = rank === 1;
          return (
            <div key={k} style={{ ...S.classRankCell, ...(best ? S.classRankBest : {}) }}>
              <span style={S.classRankLbl}>{lbl}</span>
              <span style={{ ...S.classRankVal, ...(best ? { color: WARN } : {}) }}>#{rank}<span style={S.classRankOf}>/{info.count}</span></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Auto-earned badges ──
// Each badge is derived purely from where the player lands in the guild — no
// manual tagging. Ordered by prestige; capped so the row stays readable.
function computeBadges(me, guild, archetype) {
  if (!me) return [];
  const out = [];
  const st = guild.stat;
  const rk = (k) => (me[k] != null && st[k]?.count ? st[k].rankOf(me[k]) : null);
  const top = (k, n) => { const r = rk(k); return r != null && r <= n ? r : null; };

  if (rk("power") === 1) out.push({ label: "Guild Champion", tone: "gold", tip: "Ranked #1 in the guild by total power." });
  else if (top("power", 5)) out.push({ label: "Top 5 Power", tone: "accent", tip: "Among the five highest-power members." });
  if (rk("dmg") === 1) out.push({ label: "Conquest MVP", tone: "gold", tip: "Ranked #1 in the guild for Conquest damage." });
  else if (top("dmg", 5)) out.push({ label: "Top 5 Conquest", tone: "accent", tip: "Among the five biggest Conquest hitters." });
  if (me.gain > 0 && top("gain", 3)) out.push({ label: "Most Improved", tone: "accent2", tip: "One of the three biggest power gains on record." });
  if (rk("dmgPerPow") === 1) out.push({ label: "Most Efficient", tone: "accent", tip: "Highest Conquest damage per 1M power — punches above their weight." });
  if (rk("gearAvg") === 1) out.push({ label: "Best Geared", tone: "accent", tip: "Highest average gear enhancement in the guild." });
  if (rk("likes") === 1) out.push({ label: "Most Loved", tone: "accent2", tip: "Most likes received of anyone in the guild." });
  else if (top("likes", 3)) out.push({ label: "Crowd Favourite", tone: "plain", tip: "Among the three most-liked members." });
  for (const [k, lbl, name] of [["atk", "Top ATK", "attack"], ["def", "Top DEF", "defense"], ["hp", "Top HP", "HP"], ["spd", "Top SPD", "speed"]]) {
    if (rk(k) === 1) out.push({ label: lbl, tone: "plain", tip: `Highest ${name} in the guild.` });
  }
  if (ROSTER_FIRST_SEEN[me.key] && ROSTER_FIRST_SEEN[me.key] === ROSTER_SNAPS[0].id) out.push({ label: "Founding Member", tone: "plain", tip: "Present in the guild since the very first capture." });
  if (archetype) out.push({ label: archetype.label, tone: "trait", tip: `${archetype.label} — ${archetype.desc}` });
  return out.slice(0, 8);
}

function BadgeRow({ badges }) {
  if (!badges.length) return null;
  return (
    <div style={S.badgeRow}>
      {badges.map((b, i) => {
        const st = { ...S.badge, ...(S[`badge_${b.tone}`] || {}) };
        return b.tip
          ? <Tip key={i} text={`${b.label}: ${b.tip}`} style={st}>{b.label}</Tip>
          : <span key={i} style={st}>{b.label}</span>;
      })}
    </div>
  );
}

// ── Trend card: metric switch + milestone markers + projection ──
function niceStep(v) {
  const a = Math.abs(v);
  if (a >= 1e9) return 1e9;
  if (a >= 1e8) return 5e7;
  if (a >= 1e7) return 5e6;
  if (a >= 1e6) return 5e5;
  if (a >= 1e5) return 5e4;
  if (a >= 1e4) return 5e3;
  if (a >= 1e3) return 1e3;
  return 100;
}
// Milestone boundaries (multiples of `step`) the series climbed through, tagged
// with the date they were first reached.
function crossings(series, step) {
  const lo = series[0].value, hi = series[series.length - 1].value;
  if (hi <= lo) return [];
  const out = [];
  for (let b = (Math.floor(lo / step) + 1) * step; b <= hi + 1e-6; b += step) {
    const pt = series.find((p) => p.value >= b - 1e-6);
    if (pt) out.push({ value: b, date: pt.date });
  }
  return out;
}
// Linear extrapolation to the next milestone from the all-window growth rate.
function projectNext(series, step) {
  const first = series[0], last = series[series.length - 1];
  const days = (new Date(last.date) - new Date(first.date)) / 86400000;
  if (days <= 0) return null;
  const rate = (last.value - first.value) / days;
  if (rate <= 0) return null;
  const next = (Math.floor(last.value / step) + 1) * step;
  const etaDays = (next - last.value) / rate;
  if (!isFinite(etaDays) || etaDays <= 0 || etaDays > 3650) return null;
  return { rate, next, etaDays, etaDate: new Date(new Date(last.date).getTime() + etaDays * 86400000).toISOString() };
}

function TrendCard({ options }) {
  const avail = options.filter((o) => o.data.length >= 2);
  const [mk, setMk] = useState(avail[0]?.key);
  if (!avail.length) return null;
  const cur = avail.find((o) => o.key === mk) || avail[0];
  const data = cur.data;
  const step = niceStep(data[data.length - 1].value);
  const cross = crossings(data, step);
  const proj = projectNext(data, step);
  let jump = null;
  for (let i = 1; i < data.length; i++) { const d = data[i].value - data[i - 1].value; if (!jump || d > jump.d) jump = { d, idx: i }; }

  return (
    <div style={S.trendCard}>
      <div style={S.trendHead}>
        <span>{cur.label} trend</span>
        <span style={S.trendVals}>{fmtNum(data[0].value)} → {fmtNum(data[data.length - 1].value)}</span>
      </div>
      {avail.length > 1 && (
        <div style={{ ...S.seg, marginBottom: 10 }} role="group" aria-label="Trend metric">
          {avail.map((o) => <button key={o.key} style={segStyle(cur.key === o.key)} onClick={() => setMk(o.key)}>{o.label}</button>)}
        </div>
      )}
      <Sparkline series={data} color={cur.color || C.accent} dots highlight={jump && jump.d > 0 ? jump.idx : -1} />
      <div style={S.trendAxis}>
        <span>{fmtDate(data[0].date)}</span>
        <span>{fmtDate(data[data.length - 1].date)}</span>
      </div>
      {(cross.length > 0 || jump?.d > 0) && (
        <div style={S.milestoneRow}>
          {jump?.d > 0 && <span style={S.milestone}>Best jump · +{fmtNum(jump.d)}</span>}
          {cross.slice(-2).map((c, i) => <span key={i} style={S.milestone}>Reached {fmtNum(c.value)} · {fmtDate(c.date)}</span>)}
        </div>
      )}
      {proj && (
        <div style={S.projection}>
          <span style={S.projIcon}>↗</span>
          <span>At <b>+{fmtNum(Math.round(proj.rate))}/day</b>, reaches <b style={{ color: C.accent }}>{fmtNum(proj.next)}</b> around <b>{fmtDate(proj.etaDate)}</b> (~{Math.round(proj.etaDays)}d). Estimate.</span>
        </div>
      )}
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

  // Derived insight: archetype, radar shape, class peers, auto-badges.
  const archetype = useMemo(() => (me ? deriveArchetype(me, guild.stat) : null), [me, guild]);
  const classGroup = me?.klass ? guild.classGroups[me.klass] : null;
  const hasRadar = !!(me && me.atk != null && me.def != null && me.hp != null);
  const radarVals = useMemo(() => {
    if (!me) return null;
    const n = (k) => (guild.stat[k]?.max ? (me[k] ?? 0) / guild.stat[k].max : 0);
    return { atk: n("atk"), spd: n("spd"), def: n("def"), hp: n("hp") };
  }, [me, guild]);
  const classAvg = useMemo(
    () => (classGroup && classGroup.length > 1 ? classRadarAvg(classGroup, guild.stat) : null),
    [classGroup, guild]
  );
  const badges = useMemo(() => computeBadges(me, guild, archetype), [me, guild, archetype]);
  const likesInfo = guild.stat.likes;
  const likesRank = me?.likes != null && likesInfo?.count ? likesInfo.rankOf(me.likes) : null;

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

                <BadgeRow badges={badges} />

                {headPower != null && (
                  <div style={S.pmPowerRow}>
                    <span style={S.pmPowerLabel}>POWER</span>
                    <span style={S.pmPowerValue}>{headPower}</span>
                  </div>
                )}

                {likesRank != null && (
                  <div style={S.likesLine} title="Likes received">
                    <span style={S.likesHeart}>♥</span>
                    <b>{fmtNum(me.likes)}</b> likes
                    <span style={S.likesRank}>#{likesRank} of {likesInfo.count}</span>
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

            {/* ── Combat identity (radar + archetype) ── */}
            {hasRadar && (
              <div style={S.pmSection}>
                <div style={S.pmSectionHead}>
                  <span style={S.pmSectionLabel}>Combat identity</span>
                  {archetype && <Tip text={archetype.desc} style={S.archetypePill}>{archetype.label}</Tip>}
                </div>
                <div style={S.identityWrap}>
                  <Radar vals={radarVals} avg={classAvg} />
                  <div style={S.identityText}>
                    {archetype && <div style={S.archetypeDesc}>{archetype.desc}</div>}
                    <div style={S.radarLegend}>
                      <span style={S.legItem}><i style={{ ...S.legSwatch, background: C.accent }} /> {displayName}</span>
                      {classAvg && <span style={S.legItem}><i style={{ ...S.legSwatch, background: C.accent2 }} /> {me.klass} avg</span>}
                    </div>
                    <div style={S.identityNote}>Each axis is scaled to the guild's best in that stat.</div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Progression & upgrade advisor ── */}
            {p && <ProgressionSection p={p} />}

            {/* ── Efficiency ── */}
            {me && (me.dmgPerPow != null || me.contribPerPow != null) && (
              <div style={S.pmSection}>
                <div style={S.pmSectionLabel}>Efficiency · output vs power</div>
                <div style={S.effGrid}>
                  <EfficiencyCard label="DMG / 1M power" value={me.dmgPerPow} info={guild.stat.dmgPerPow} hint="conquest damage per 1M power" />
                  <EfficiencyCard label="Contrib / 1M power" value={me.contribPerPow} info={guild.stat.contribPerPow} hint="total contribution per 1M power" />
                </div>
              </div>
            )}

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
              <TrendCard options={[
                { key: "power", label: "Power", data: powerSeries, color: C.accent },
                { key: "total", label: "Contribution", data: totalSeries, color: C.accent2 },
                { key: "dmg", label: "Conquest", data: dmgSeries, color: C.up },
              ]} />
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

            {/* ── Class peer ranking ── */}
            {me && classGroup && <ClassRankSection me={me} group={classGroup} />}

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
const IconTrendingUp = () => <svg {...ICON}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>;
const IconFlame = () => <svg {...ICON}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>;
const IconTrophy = () => <svg {...ICON}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>;
const IconSword = () => <svg {...ICON}><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" /><line x1="13" y1="19" x2="19" y2="13" /><line x1="16" y1="16" x2="20" y2="20" /><line x1="19" y1="21" x2="21" y2="19" /></svg>;
const IconShield = () => <svg {...ICON}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></svg>;
const IconHeart = () => <svg {...ICON}><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>;
const IconGauge = () => <svg {...ICON}><path d="m12 14 4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" /></svg>;

// ── Side widgets ─────────────────────────────────────────────────────────────────
function topN(arr, f, n = 5) {
  return [...arr].sort((a, b) => f(b) - f(a)).slice(0, n);
}

// Leaderboard data for the Rankings tab. `present` is the current (non-left)
// members of the chosen snapshot; `cmap` maps key -> the compared snapshot's row,
// powering the "biggest gain" boards. Returns null when there's nothing to rank.
function rosterRankings(present, cmap) {
  if (!present.length) return null;
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
    byPower: topN(present, (r) => r.power, 10),
    byGain: gainers.length ? topN(gainers, (r) => r.d) : [],
    byWeek: topN(present, (r) => r.week),
    byTotal: topN(present, (r) => r.total),
    byAtk: topN(withStats, (r) => r.atk),
    byDef: topN(withStats, (r) => r.def),
    byHp: topN(withStats, (r) => r.hp),
    bySpd: topN(withStats.filter((r) => r.spd > 0), (r) => r.spd),
    classes: Object.entries(classCount).sort((a, b) => b[1] - a[1]),
  };
}

function conquestRankings(present, cmap) {
  if (!present.length) return null;
  const gainers = present.map((r) => ({ ...r, d: cmap[r.key] ? r.dmg - cmap[r.key].dmg : null })).filter((r) => r.d != null);
  return {
    count: present.length,
    byDmg: topN(present, (r) => r.dmg, 10),
    byGain: gainers.length ? topN(gainers, (r) => r.d) : [],
  };
}
// ── Rankings: Hall of Champions building blocks ─────────────────────────────────
function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

// Ease a number from 0 up to `target` once, for the ceremonial reveal. Honours
// reduced-motion by jumping straight to the final value.
function useCountUp(target, ms = 950) {
  const [v, setV] = useState(() => (prefersReducedMotion() ? target : 0));
  useEffect(() => {
    if (prefersReducedMotion()) { setV(target); return; }
    let raf, start = null;
    const tick = (t) => {
      if (start == null) start = t;
      const p = Math.min(1, (t - start) / ms);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setV(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function Crown() {
  return (
    <svg className="crown" width="32" height="20" viewBox="0 0 24 16" fill="currentColor" aria-hidden="true">
      <path d="M2 14.5 3 5l5.5 4L12 2.5 15.5 9 21 5l1 9.5z" />
      <rect x="2" y="13.5" width="20" height="2" rx="1" />
    </svg>
  );
}

function Medal({ rank, size = 40 }) {
  return (
    <span className={`medal medal-${rank}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}>
      <span>{rank}</span>
    </span>
  );
}

function PodiumValue({ target, fmt }) {
  const v = useCountUp(target);
  return <span className="ped-val">{fmt(Math.round(v))}</span>;
}

// Top-3 dais. `value` reads the ranked metric off an item; items must be sorted.
function Podium({ items, value, fmt, championLabel, runnerLabels, onPlayerClick }) {
  return (
    <div className="podium">
      {items.slice(0, 3).map((it, i) => (
        <button
          key={it.key}
          className={`ped rank-rise ped-${i + 1}${i === 0 ? " ped-champion" : ""}`}
          style={{ animationDelay: `${i * 90}ms` }}
          onClick={() => onPlayerClick(it.key)}
        >
          {i === 0 && <Crown />}
          <Medal rank={i + 1} size={i === 0 ? 54 : 42} />
          <span className="ped-name">{it.name}</span>
          <PodiumValue target={value(it)} fmt={fmt} />
          <span className="ped-label">{i === 0 ? championLabel : runnerLabels[i - 1]}</span>
        </button>
      ))}
    </div>
  );
}

// Ranks 4..N below the dais — still an honour to make the list.
function HonorRoll({ items, value, fmt, startRank, onPlayerClick }) {
  if (!items.length) return null;
  return (
    <div className="roll">
      {items.map((it, i) => (
        <button key={it.key} className="roll-row rank-rise" style={{ animationDelay: `${i * 40}ms` }} onClick={() => onPlayerClick(it.key)}>
          <span className="roll-rank">{startRank + i}</span>
          <span className="roll-name">{it.name}</span>
          <span className="roll-val">{fmt(value(it))}</span>
        </button>
      ))}
    </div>
  );
}

// One category leaderboard (top 5): medals on the podium spots, plus a bar that
// shows how far ahead the leader sits.
function RankBoard({ icon, title, items, value, fmt, onPlayerClick }) {
  if (!items || !items.length) return null;
  const top = value(items[0]) || 1;
  return (
    <div className="board rank-rise">
      <div className="board-head">{icon}<span>{title}</span></div>
      <ul className="board-list">
        {items.map((it, i) => {
          const pct = Math.max(4, Math.round((value(it) / top) * 100));
          return (
            <li key={it.key} className="board-row">
              {i < 3 ? <Medal rank={i + 1} size={20} /> : <span className="board-rank">{i + 1}</span>}
              <button className="board-name" onClick={() => onPlayerClick(it.key)}>{it.name}</button>
              <span className="board-val">{fmt(value(it))}</span>
              <span className="board-bar"><i style={{ width: `${pct}%` }} /></span>
            </li>
          );
        })}
      </ul>
    </div>
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
// Champion metals — the "award" layer for the Rankings hall. Warm precious metals
// against the cool dark base read as earned, not decorative.
const METAL = {
  gold:   { base: "#f7c948", hi: "#ffe9a8", lo: "#a8761c", ink: "#3a2a05", glow: "rgba(247,201,72,.45)" },
  silver: { base: "#d4dde9", hi: "#f4f8fd", lo: "#8793a6", ink: "#23292f", glow: "rgba(212,221,233,.32)" },
  bronze: { base: "#e0975c", hi: "#f6cca0", lo: "#965827", ink: "#33200f", glow: "rgba(224,151,92,.34)" },
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

/* Tooltip trigger + portaled bubble (rendered to <body>, fixed-positioned, so it
   layers above everything and never clips against the modal's scroll edge). */
.tip-trig { cursor: help; }
.tip-trig:focus-visible { outline: 2px solid ${C.accent}; outline-offset: 2px; border-radius: 999px; }
.tip-pop {
  position: fixed; transform: translateX(-50%);
  width: max-content; max-width: 230px; white-space: normal; text-align: center;
  background: #060810; color: ${C.ink}; border: 1px solid ${C.line}; border-radius: 8px;
  padding: 7px 10px; font-family: ${F.body}; font-size: 12px; font-weight: 500; line-height: 1.4;
  letter-spacing: 0; text-transform: none; box-shadow: 0 8px 24px rgba(0,0,0,.5);
  pointer-events: none; z-index: 100; animation: tipIn .12s ease-out;
}
@keyframes tipIn { from { opacity: 0; transform: translateX(-50%) translateY(-4px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
@media (prefers-reduced-motion: reduce) { .tip-pop { animation: none; } }
@keyframes pmIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
/* Side-by-side modal: pin the screenshot to the info column's height, cropping
   from the top so it ends level with the gear cards. Stacks full-height below. */
@media (min-width: 520px) {
  .pm-shot-wrap { align-self: stretch; }
  .pm-shot { position: absolute; inset: 0; width: 100%; height: 100%; }
}

/* ── Rankings · Hall of Champions ── */
.rank-scope, .rank-scope *, .rank-scope *::before, .rank-scope *::after { box-sizing: border-box; }
@keyframes rankRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes growX { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes sheen { 0% { transform: translateX(-160%); } 100% { transform: translateX(260%); } }
@keyframes crownFloat { 0%,100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-4px) rotate(3deg); } }
@keyframes haloPulse { 0%,100% { opacity: .5; } 50% { opacity: .85; } }
.rank-rise { animation: rankRise .5s cubic-bezier(.2,.7,.2,1) both; }

/* Podium */
.podium { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 4px; }
.ped { position: relative; flex: 1 1 calc(50% - 6px); min-width: 0; display: flex; flex-direction: column;
  align-items: center; gap: 7px; padding: 18px 12px 16px; border: 1px solid ${C.line}; border-radius: 16px; cursor: pointer;
  background: radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,.045), transparent 60%), linear-gradient(180deg, ${C.panel2}, ${C.panel});
  text-align: center; color: ${C.ink}; transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease; }
.ped:hover { transform: translateY(-3px); border-color: ${C.faint}; }
.ped:focus-visible { outline: 2px solid ${C.accent}; outline-offset: 2px; }
.ped-champion { flex-basis: 100%; order: -1; padding: 22px 14px 20px;
  border-color: rgba(247,201,72,.42); box-shadow: 0 12px 44px ${METAL.gold.glow}; }
.ped-champion::before { content: ""; position: absolute; inset: -1px; border-radius: 16px; pointer-events: none;
  background: radial-gradient(60% 42% at 50% 0%, ${METAL.gold.glow}, transparent 70%); animation: haloPulse 3.2s ease-in-out infinite; }
.ped-name { position: relative; font-family: ${F.display}; font-weight: 700; font-size: 16px; letter-spacing: -.2px;
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ped-champion .ped-name { font-size: clamp(22px, 5vw, 28px);
  background: linear-gradient(95deg, ${METAL.gold.hi}, ${METAL.gold.base} 52%, ${METAL.gold.hi});
  -webkit-background-clip: text; background-clip: text; color: transparent; }
.ped-val { position: relative; font-family: ${F.mono}; font-weight: 600; font-size: 14px; color: ${C.ink}; }
.ped-champion .ped-val { font-size: clamp(18px, 4vw, 22px); color: ${METAL.gold.base}; }
.ped-label { position: relative; font-family: ${F.mono}; font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; color: ${C.dim}; }
.ped-champion .ped-label { color: ${METAL.gold.base}; }
.crown { color: ${METAL.gold.base}; filter: drop-shadow(0 2px 6px ${METAL.gold.glow}); animation: crownFloat 3s ease-in-out infinite; }

/* Medals */
.medal { position: relative; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px;
  overflow: hidden; font-family: ${F.display}; font-weight: 700; flex: 0 0 auto; }
.medal > span { position: relative; z-index: 1; }
.medal-1 { background: radial-gradient(circle at 34% 28%, ${METAL.gold.hi}, ${METAL.gold.base} 52%, ${METAL.gold.lo}); color: ${METAL.gold.ink}; box-shadow: inset 0 0 0 1px rgba(255,255,255,.4), 0 4px 14px ${METAL.gold.glow}; }
.medal-2 { background: radial-gradient(circle at 34% 28%, ${METAL.silver.hi}, ${METAL.silver.base} 52%, ${METAL.silver.lo}); color: ${METAL.silver.ink}; box-shadow: inset 0 0 0 1px rgba(255,255,255,.45), 0 4px 12px ${METAL.silver.glow}; }
.medal-3 { background: radial-gradient(circle at 34% 28%, ${METAL.bronze.hi}, ${METAL.bronze.base} 52%, ${METAL.bronze.lo}); color: ${METAL.bronze.ink}; box-shadow: inset 0 0 0 1px rgba(255,255,255,.35), 0 4px 12px ${METAL.bronze.glow}; }
.medal-1::after { content: ""; position: absolute; top: 0; left: 0; width: 45%; height: 100%; z-index: 2;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.85), transparent); animation: sheen 2.8s ease-in-out infinite; }

/* Honour roll (ranks 4+) */
.roll { display: flex; flex-direction: column; gap: 3px; }
.roll-row { display: grid; grid-template-columns: 30px 1fr auto; align-items: center; column-gap: 10px; width: 100%;
  padding: 9px 12px; border-radius: 10px; background: ${C.panel}; border: 1px solid transparent; cursor: pointer;
  transition: border-color .15s ease, transform .15s ease, background .15s ease; }
.roll-row:hover { border-color: ${C.line}; transform: translateX(2px); background: ${C.panel2}; }
.roll-row:focus-visible { outline: 2px solid ${C.accent}; outline-offset: 2px; }
.roll-rank { font-family: ${F.mono}; font-size: 13px; color: ${C.dim}; text-align: center; }
.roll-name { min-width: 0; text-align: left; color: ${C.ink}; font-family: ${F.display}; font-weight: 600; font-size: 15px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.roll-val { font-family: ${F.mono}; font-weight: 600; font-size: 14px; color: ${C.ink}; white-space: nowrap; }

/* Category boards */
.board { background: ${C.panel}; border: 1px solid ${C.line}; border-radius: 14px; padding: 14px; }
.board-head { display: flex; align-items: center; gap: 7px; color: ${C.accent}; font-family: ${F.mono};
  font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 10px; }
.board-list { list-style: none; margin: 0; padding: 0; }
.board-row { display: grid; grid-template-columns: 22px 1fr auto; align-items: center; column-gap: 9px; padding: 7px 0;
  border-top: 1px solid ${C.line}; }
.board-row:first-child { border-top: none; }
.board-rank { font-family: ${F.mono}; font-size: 11px; color: ${C.faint}; text-align: center; }
.board-name { grid-column: 2; min-width: 0; text-align: left; color: ${C.ink}; font-family: ${F.display};
  font-weight: 600; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.board-val { font-family: ${F.mono}; font-weight: 600; font-size: 13px; color: ${C.ink}; white-space: nowrap; }
.board-bar { grid-column: 1 / -1; height: 3px; border-radius: 999px; background: ${C.panel2}; overflow: hidden; margin-top: 5px; }
.board-bar > i { display: block; height: 100%; border-radius: 999px; background: ${C.accent}; opacity: .65;
  transform-origin: left; animation: growX .8s cubic-bezier(.2,.7,.2,1) both; }

/* Name buttons inside the hall inherit type + reset chrome */
.ped, .roll-row, .board-name { font: inherit; background: none; appearance: none; }
.board-name { border: none; padding: 0; margin: 0; cursor: pointer; }
.board-name:hover, .roll-name { transition: color .12s; }
.board-name:hover { color: ${C.accent}; text-decoration: underline; }
.board-name:focus-visible { outline: 2px solid ${C.accent}; outline-offset: 2px; border-radius: 4px; }

/* Desktop dais: #2 · #1 (raised, wider) · #3 */
@media (min-width: 600px) {
  .podium { flex-wrap: nowrap; align-items: flex-end; gap: 16px; }
  .ped { flex: 1 1 0; }
  .ped-champion { flex: 1.35 1 0; order: 0; transform: translateY(-16px); }
  .ped-champion:hover { transform: translateY(-19px); }
  .ped-2 { order: -1; }
  .ped-3 { order: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .rank-rise, .crown, .board-bar > i, .ped-champion::before, .medal-1::after { animation: none !important; }
  .board-bar > i { transform: none !important; }
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

  // ── Rankings tab · Hall of Champions ──
  rankWrap: { display: "flex", flexDirection: "column", gap: 30 },
  hallHero: { textAlign: "center", padding: "6px 0 2px" },
  hallHeroKicker: { fontFamily: F.mono, fontSize: 11, letterSpacing: 3, color: C.accent, textTransform: "uppercase" },
  hallHeroTitle: {
    fontFamily: F.display, fontWeight: 700, fontSize: "clamp(30px,6.5vw,48px)", letterSpacing: -1, lineHeight: 1.04, margin: "8px 0 10px",
    background: `linear-gradient(95deg, ${METAL.gold.hi}, ${METAL.gold.base} 48%, ${METAL.gold.hi})`,
    WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
  },
  hallHeroSub: { color: C.dim, fontSize: 14, lineHeight: 1.5, maxWidth: 480, margin: "0 auto" },
  hall: {},
  hallHead: { marginBottom: 12 },
  hallKicker: { fontFamily: F.mono, fontSize: 10, letterSpacing: 2.5, color: C.accent, textTransform: "uppercase" },
  hallTitle: { fontFamily: F.display, fontWeight: 700, fontSize: "clamp(22px,4vw,30px)", letterSpacing: -0.5, margin: "5px 0 4px" },
  hallSub: { color: C.dim, fontSize: 13, margin: 0 },
  rollHead: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: C.dim, margin: "18px 0 8px" },
  boardsHead: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: C.dim, margin: "22px 0 10px" },
  rankGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, alignItems: "start" },
  kvValue: { fontFamily: F.mono, fontWeight: 600, color: C.ink },
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

  // ── Badges (auto-earned) ──
  badgeRow: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 },
  badge: { fontFamily: F.display, fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 999, background: C.panel2, border: `1px solid ${C.line}`, color: C.dim, whiteSpace: "nowrap" },
  badge_gold: { background: "rgba(247,201,72,.12)", border: `1px solid ${METAL.gold.lo}`, color: METAL.gold.base },
  badge_accent: { background: "rgba(124,242,196,.10)", border: "1px solid #27503f", color: C.accent },
  badge_accent2: { background: "rgba(185,140,255,.12)", border: "1px solid #3d2c5c", color: C.accent2 },
  badge_plain: { background: C.panel2, border: `1px solid ${C.line}`, color: C.ink },
  badge_trait: { background: "transparent", border: `1px dashed ${C.faint}`, color: C.dim },

  // ── Likes (discreet inline line) ──
  likesLine: { display: "flex", alignItems: "center", gap: 5, marginTop: 10, fontFamily: F.mono, fontSize: 12, color: C.dim },
  likesHeart: { color: C.accent2 },
  likesRank: { color: C.faint, marginLeft: 2 },

  // ── Combat identity (radar) ──
  archetypePill: { fontFamily: F.display, fontWeight: 600, fontSize: 13, padding: "4px 12px", borderRadius: 999, background: "rgba(185,140,255,.12)", border: "1px solid #3d2c5c", color: C.accent2 },
  identityWrap: { display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" },
  identityText: { flex: "1 1 160px", minWidth: 150 },
  archetypeDesc: { fontSize: 14, color: C.ink, lineHeight: 1.5 },
  radarLegend: { display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10 },
  legItem: { display: "inline-flex", alignItems: "center", gap: 6, fontFamily: F.mono, fontSize: 11, color: C.dim },
  legSwatch: { width: 10, height: 10, borderRadius: 3, display: "inline-block" },
  identityNote: { fontSize: 10, color: C.faint, marginTop: 10 },

  // ── Progression / upgrade advisor ──
  progTrack: { marginBottom: 10 },
  progName: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: C.dim, marginBottom: 5 },
  progChips: { display: "flex", flexWrap: "wrap", gap: 6 },
  progChip: { flex: "1 1 60px", background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 9, padding: "7px 4px", textAlign: "center" },
  progChipLow: { border: `1px solid ${WARN}`, background: "rgba(245,178,26,.10)" },
  progLvl: { display: "block", fontFamily: F.display, fontWeight: 700, fontSize: 15, color: C.ink },
  progSlot: { display: "block", fontSize: 9, letterSpacing: 0.5, color: C.dim, marginTop: 2 },
  advisor: { display: "flex", gap: 8, alignItems: "flex-start", marginTop: 10, padding: "10px 12px", background: "rgba(245,178,26,.07)", border: `1px solid #4d3a12`, borderRadius: 10, fontSize: 13, color: C.ink, lineHeight: 1.45 },
  advisorIcon: { color: WARN, fontSize: 11, lineHeight: "20px" },

  // ── Efficiency ──
  effGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 },
  effCard: { background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px" },
  effMeta: { display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: F.mono, fontSize: 11, marginTop: 6 },

  // ── Class peer ranking ──
  classRankGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(92px,1fr))", gap: 8 },
  classRankCell: { background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 10px", display: "flex", flexDirection: "column", gap: 3 },
  classRankBest: { border: `1px solid ${WARN}`, background: "rgba(245,178,26,.08)" },
  classRankLbl: { fontFamily: F.mono, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: C.dim },
  classRankVal: { fontFamily: F.display, fontWeight: 700, fontSize: 18, color: C.ink },
  classRankOf: { fontFamily: F.mono, fontSize: 11, fontWeight: 400, color: C.faint },

  // ── Trend extras (milestones / projection) ──
  milestoneRow: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 },
  milestone: { fontFamily: F.mono, fontSize: 10, color: C.dim, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 999, padding: "3px 9px" },
  projection: { display: "flex", gap: 8, alignItems: "flex-start", marginTop: 8, fontSize: 12, color: C.dim, lineHeight: 1.45 },
  projIcon: { color: C.accent, fontWeight: 700 },
};
