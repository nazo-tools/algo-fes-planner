// 作り直した導線のプロトタイプ。
//
//   node design/proposals/build-flow.mjs → design/proposals/flow-prototype.html
//
// 変えたところ:
//   - 主役は手動。自分で回まで選んで置く。プランナーは残った空きを埋める役に回る
//   - 推奨は土日を同時に見る（土曜のこの枠を逃すと日曜にも入らない、が効く）
//   - 休憩は時間帯を自分で置く
//   - 導線は「1 押さえる → 2 埋める」の二段階
//   - 用語を謎解きに合わせた（見たい→やりたい、観る→参加する）
//
// 見た目とフォントは別途。ここでは構造と流れだけを見る。

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { toPlainScript, bundle } from "../../tools/inline.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const read = (p) => readFileSync(join(root, p), "utf8");

export const engine = bundle([
  { name: "shows.js", code: toPlainScript(read("shows.js")) },
  { name: "planner.js", code: toPlainScript(read("planner.js")) },
]).replace(
  /\n\}\)\(\);$/,
  "\nwindow.__E = { SHOWS, VENUES, FES, suggestFills, placementOptions, rescueSuggestions, toMinutes };\n})();",
);

export const CSS = `
:root{
  color-scheme:light dark;
  --bg:#f1f0ed; --surface:#fff; --sunken:#e9e8e4;
  --ink:#1c1e21; --muted:#5c6066; --subtle:#8b9096;
  --line:#dbdad5; --line-soft:#e8e7e3;
  --v-hallHigh:#bd3350; --v-room2f:#0e7a72; --v-hall2f:#5f45a8;
  --onblk:#fff; --ghost:.14;
  --font-ui:"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Noto Sans JP",system-ui,sans-serif;
  --font-num:ui-monospace,"SF Mono",SFMono-Regular,"Cascadia Mono",Consolas,monospace;
  --shadow:0 1px 1px rgba(20,22,26,.04),0 3px 10px rgba(20,22,26,.05);
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#15161a; --surface:#1e2024; --sunken:#26282d;
  --ink:#e8e9ea; --muted:#a0a4aa; --subtle:#767b82;
  --line:#32353b; --line-soft:#2a2d32;
  --v-hallHigh:#f2778c; --v-room2f:#3fbfb2; --v-hall2f:#a38ef0;
  --onblk:#14151a; --ghost:.22;
  --shadow:0 1px 1px rgba(0,0,0,.4),0 3px 10px rgba(0,0,0,.3);
}}
:root[data-theme="dark"]{
  --bg:#15161a; --surface:#1e2024; --sunken:#26282d;
  --ink:#e8e9ea; --muted:#a0a4aa; --subtle:#767b82;
  --line:#32353b; --line-soft:#2a2d32;
  --v-hallHigh:#f2778c; --v-room2f:#3fbfb2; --v-hall2f:#a38ef0;
  --onblk:#14151a; --ghost:.22;
  --shadow:0 1px 1px rgba(0,0,0,.4),0 3px 10px rgba(0,0,0,.3);
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--font-ui);
  font-size:15px;line-height:1.6;-webkit-text-size-adjust:100%}
:where(button,input,select):focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.wrap{max-width:760px;margin:0 auto;padding:0 14px 40px}
.hero{padding:22px 0 10px}
.hero h1{margin:0;font-size:1.16rem;font-weight:800}
.hero p{margin:6px 0 0;color:var(--muted);font-size:.83rem}
.note{margin:12px 0 16px;background:var(--sunken);border:1px solid var(--line);
  border-radius:9px;padding:11px 13px;font-size:.8rem;color:var(--muted)}
.note b{color:var(--ink)}
.note ul{margin:6px 0 0;padding-left:1.1em}

.phone{max-width:390px;margin:0 auto;border:1px solid var(--line);border-radius:20px;
  background:var(--bg);box-shadow:var(--shadow);overflow:hidden}
.pane{height:680px;display:flex;flex-direction:column}

/* ---- 上ペイン ---- */
.top{flex:0 0 47%;display:flex;flex-direction:column;border-bottom:1px solid var(--line);
  background:var(--bg);min-height:0}
.phases{display:flex;gap:5px;padding:10px 11px 8px}
.phases button{flex:1;padding:7px 5px;border-radius:8px;cursor:pointer;
  border:1px solid var(--line);background:var(--surface);color:var(--muted);
  font:inherit;font-size:.77rem;font-weight:700;line-height:1.25}
.phases button b{display:block;font-size:.66rem;color:var(--subtle)}
.phases button[aria-selected="true"]{background:var(--ink);border-color:var(--ink);color:var(--surface)}
.phases button[aria-selected="true"] b{color:var(--surface);opacity:.6}
.topbody{flex:1;overflow-y:auto;padding:0 11px 12px;min-height:0}
.hint{font-size:.73rem;color:var(--subtle);margin:0 0 8px}

.vh{font-size:.66rem;letter-spacing:.1em;color:var(--subtle);font-weight:700;margin:10px 0 5px}
.vh:first-child{margin-top:0}
.slist{display:flex;flex-direction:column;gap:4px}
.srow{border:1px solid var(--line);border-left:3px solid var(--venue);border-radius:8px;
  background:var(--surface);overflow:hidden}
.srow.done{border-left-color:var(--venue);background:var(--sunken)}
.shead{display:flex;align-items:center;width:100%}
.fav{flex:none;border:0;background:none;cursor:pointer;padding:7px 2px 7px 8px;
  font-size:.82rem;line-height:1;color:var(--subtle)}
.fav[aria-pressed="true"]{color:#d08a12}
:root[data-theme="dark"] .fav[aria-pressed="true"],
:root:not([data-theme="light"]) .fav[aria-pressed="true"]{color:#e8b552}
.stitle{display:flex;align-items:center;gap:8px;flex:1;min-width:0;padding:7px 9px 7px 6px;
  cursor:pointer;background:none;border:0;font:inherit;color:inherit;text-align:left}
.shead .nm{flex:1;min-width:0;font-size:.81rem;font-weight:700;line-height:1.3;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rescue{border:1px solid var(--warn-line,#e4d3ab);background:var(--warn-soft,#f7eeda);
  color:#8a5a00;border-radius:8px;padding:9px 10px;margin-bottom:9px;font-size:.74rem}
:root[data-theme="dark"] .rescue,:root:not([data-theme="light"]) .rescue{
  background:#2e2718;border-color:#453a22;color:#e3b768}
.rescue b{display:block;margin-bottom:4px;font-size:.76rem}
.rescue button{display:block;width:100%;text-align:left;margin-top:5px;border-radius:6px;
  border:1px solid currentColor;background:transparent;color:inherit;cursor:pointer;
  font:inherit;font-size:.72rem;padding:5px 8px;line-height:1.35}
.winrow{display:flex;gap:5px;align-items:center;font-size:.7rem;color:var(--muted);
  margin-bottom:4px;flex-wrap:wrap}
.winrow input{font:inherit;font-family:var(--font-num);font-size:.7rem;padding:3px 5px;
  border-radius:5px;border:1px solid var(--line);background:var(--surface);color:var(--ink)}
.winrow .lbl{font-weight:700;min-width:4.6em}
.godays{display:flex;gap:5px;align-items:center;margin-bottom:8px}
.godays .lbl{font-size:.7rem;color:var(--subtle);font-weight:700}
.godays button{flex:1;padding:5px 6px;border-radius:7px;cursor:pointer;
  border:1px dashed var(--line);background:transparent;color:var(--subtle);
  font:inherit;font-size:.73rem;font-weight:700}
.godays button[aria-pressed="true"]{border-style:solid;border-color:var(--ink);
  background:var(--ink);color:var(--surface)}
.favonly{display:flex;align-items:center;gap:5px;font-size:.72rem;color:var(--muted);
  margin:6px 0 2px}
.shead .mt{font-size:.66rem;color:var(--subtle);font-variant-numeric:tabular-nums;flex:none}
.shead .tick{flex:none;font-size:.72rem;font-weight:700;color:var(--venue)}
.srow.done .shead .nm{color:var(--muted)}
.slots{padding:0 9px 9px;border-top:1px solid var(--line-soft)}
.dl{font-size:.66rem;color:var(--subtle);margin:7px 0 4px;font-weight:700}
.sc{display:flex;flex-wrap:wrap;gap:4px}
.sc button{border:1px solid var(--line);background:var(--surface);color:var(--ink);
  border-radius:6px;padding:3px 7px;cursor:pointer;font:inherit;font-size:.7rem;
  font-variant-numeric:tabular-nums;font-family:var(--font-num)}
.sc button:disabled{opacity:.3;cursor:not-allowed;text-decoration:line-through}
.warnq{font-size:.68rem;color:#a4560a;font-weight:700}
:root[data-theme="dark"] .warnq,:root:not([data-theme="light"]) .warnq{color:#e0a75f}

.restbar{display:flex;gap:6px;margin:9px 0 4px}
.btn{flex:1;padding:9px 6px;border-radius:8px;cursor:pointer;border:1px solid var(--ink);
  background:var(--ink);color:var(--surface);font:inherit;font-size:.79rem;font-weight:700}
.btn.sub{background:transparent;color:var(--ink)}
.btn:disabled{opacity:.4;cursor:not-allowed}
.brk{display:flex;gap:5px;align-items:center;margin-top:8px;flex-wrap:wrap}
.brk select,.brk input{font:inherit;font-size:.72rem;padding:4px 6px;border-radius:6px;
  border:1px solid var(--line);background:var(--surface);color:var(--ink);
  font-family:var(--font-num)}
.brk .btn{flex:none;padding:5px 10px;font-size:.72rem}

.gapc{border:1px dashed var(--line);border-radius:8px;padding:8px 9px;margin-bottom:6px;
  background:var(--surface)}
.gapc .gt{font-size:.72rem;font-weight:700;font-variant-numeric:tabular-nums}
.gapc .gs{font-size:.66rem;color:var(--subtle);font-variant-numeric:tabular-nums}
.chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.chip{border:1px dashed var(--venue);background:transparent;color:var(--ink);border-radius:999px;
  padding:3px 9px;cursor:pointer;font:inherit;font-size:.7rem;font-variant-numeric:tabular-nums}
.chip::before{content:"＋";color:var(--venue);font-weight:700;margin-right:3px}
.chip .lc{color:#a4560a;font-weight:700}
:root[data-theme="dark"] .chip .lc,:root:not([data-theme="light"]) .chip .lc{color:#e0a75f}
.none{font-size:.7rem;color:var(--subtle)}

/* ---- 下ペイン ---- */
.bot{flex:1;overflow-y:auto;background:var(--sunken);padding:9px 11px 14px;min-height:0}
.tot{display:flex;gap:8px;flex-wrap:wrap;align-items:baseline;font-size:.73rem;
  font-variant-numeric:tabular-nums;margin-bottom:8px;color:var(--muted)}
.tot b{font-size:.88rem;color:var(--ink)}
.tot .sp{margin-left:auto;color:var(--subtle)}
.board{display:grid;grid-template-columns:30px 1fr 1fr;gap:5px;position:relative}
.dh{font-size:.68rem;font-weight:700;color:var(--muted);text-align:center;
  padding-bottom:3px;position:sticky;top:0;background:var(--sunken);z-index:2}
.dh.ax{color:transparent}
.axc{position:relative}
.axc .tk{position:absolute;right:2px;font-family:var(--font-num);font-size:.6rem;
  color:var(--subtle);transform:translateY(-.5em)}
.daycol{position:relative;background:var(--surface);border:1px solid var(--line);border-radius:7px}
.daycol .hr{position:absolute;left:0;right:0;border-top:1px solid var(--line-soft)}
.ev{position:absolute;left:2px;right:2px;border-radius:5px;padding:2px 5px;overflow:hidden;
  background:var(--venue);color:var(--onblk)}
.ev .et{font-size:.63rem;font-weight:700;line-height:1.2;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.ev .ee{font-size:.57rem;opacity:.85;font-family:var(--font-num)}
.ev .x{position:absolute;top:0;right:1px;border:0;background:none;cursor:pointer;
  color:var(--onblk);opacity:.8;font-size:.72rem;line-height:1;padding:2px 3px}
.ev.rest{background:repeating-linear-gradient(135deg,var(--sunken) 0 5px,transparent 5px 10px);
  border:1px dashed var(--line);color:var(--muted)}
.ev.rest .x{color:var(--muted)}
.ev.new{outline:2px solid var(--ink);outline-offset:-2px}
.emptyday{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:.68rem;color:var(--subtle)}

.foot{margin-top:18px;color:var(--subtle);font-size:.73rem;text-align:center}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
`;

export const APP = `
const { SHOWS, VENUES, FES, suggestFills, placementOptions, rescueSuggestions, toMinutes } = window.__E;
const BUFFER = 10;
const ALL_DAYS = FES.days.map(d => d.id);
const DAY_LABEL = Object.fromEntries(FES.days.map(d => [d.id, d.label + "(" + d.weekday + ")"]));
const VENUE_ORDER = ["hallHigh", "room2f", "hall2f"];

const yen = n => "¥" + n.toLocaleString("ja-JP");
const hhmm = m => String(Math.floor(m/60)).padStart(2,"0") + ":" + String(m%60).padStart(2,"0");
const vcol = v => "var(--v-" + v + ")";
const byId = new Map(SHOWS.map(s => [s.id, s]));
function el(t, c, x) { const e = document.createElement(t);
  if (c) e.className = c; if (x != null) e.textContent = x; return e; }

/* fixed が予定の唯一の状態。置いた公演も休憩も同じ形で持つ。 */
const S = {
  fixed: [], phase: 1, open: null, justAdded: new Set(),
  favorites: new Set(), windows: {}, onlyFav: false,
  going: new Set(ALL_DAYS), // 参加する日
};
const winOf = day => S.windows[day] ?? { from: "", to: "" };
const DAYS = () => ALL_DAYS.filter(d => S.going.has(d));

const placedIds = () => new Set(S.fixed.filter(f => f.showId).map(f => f.showId));
const onDay = day => S.fixed.filter(f => f.day === day)
  .map(f => ({ ...f, a: toMinutes(f.start), b: toMinutes(f.end) }))
  .sort((x, y) => x.a - y.a);

const optionsIndex = () => new Map(
  placementOptions(SHOWS, S.fixed, { days: DAYS(), bufferMin: BUFFER }).map(p => [p.showId, p.options]));

/* 全日の時間軸をそろえる */
const ALL = SHOWS.flatMap(s => s.slots.map(x => [toMinutes(x.start), toMinutes(x.end)]));
const T0 = Math.floor(Math.min(...ALL.map(x => x[0])) / 60) * 60;
const T1 = Math.ceil(Math.max(...ALL.map(x => x[1])) / 60) * 60;
const PPM = 1.02;

/* ---------------- 上ペイン: 段階1 押さえる ---------------- */
function phase1(host) {
  // 参加する日
  const go = el("div", "godays");
  go.appendChild(el("span", "lbl", "行く日"));
  for (const d of ALL_DAYS) {
    const b = el("button", null, DAY_LABEL[d]);
    b.setAttribute("aria-pressed", String(S.going.has(d)));
    b.onclick = () => {
      if (S.going.has(d)) {
        if (S.going.size === 1) return; // 全部消させない
        S.going.delete(d);
        S.fixed = S.fixed.filter(f => f.day !== d); // 行かない日の予定は落とす
      } else {
        S.going.add(d);
      }
      render();
    };
    go.appendChild(b);
  }
  host.appendChild(go);

  host.appendChild(el("p", "hint",
    "★を付けた公演は「埋める」で先に入れます。ひらいて参加する回を選ぶと、その回で確定します。"));

  // お気に入りが入らなくなったら、入れ替え案を出す
  for (const r of rescueSuggestions(SHOWS, S.fixed, [...S.favorites], { days: DAYS(), bufferMin: BUFFER })) {
    const box = el("div", "rescue");
    box.appendChild(el("b", null, "★" + r.title + " が入らなくなりました"));
    if (!r.swaps.length) {
      box.append("どの予定を動かしても入りません。どれかをはずしてください。");
    } else {
      box.append("こう入れ替えると入ります:");
      for (const s of r.swaps) {
        const b = el("button", null,
          s.title + " を " + DAY_LABEL[s.to.day] + " " + s.to.start + " に移す"
          + "（" + r.title + " は " + DAY_LABEL[s.thenAt.day] + " " + s.thenAt.start + "）");
        b.onclick = () => {
          const t = S.fixed.find(f => f.showId === s.showId && f.day === s.from.day && f.start === s.from.start);
          if (t) { t.day = s.to.day; t.start = s.to.start; t.end = s.to.end; }
          S.fixed.push({ day: s.thenAt.day, start: s.thenAt.start, end: s.thenAt.end, showId: r.showId });
          S.justAdded.add(r.showId);
          render();
        };
        box.appendChild(b);
      }
    }
    host.appendChild(box);
  }

  // 休憩を置く
  const brk = el("div", "brk");
  const dsel = el("select");
  for (const d of DAYS()) dsel.appendChild(new Option(DAY_LABEL[d], d));
  const tin = el("input"); tin.type = "time"; tin.value = "12:30";
  const lsel = el("select");
  for (const n of [30, 45, 60, 90]) lsel.appendChild(new Option(n + "分", String(n)));
  lsel.value = "60";
  const put = el("button", "btn", "休憩を置く");
  put.onclick = () => {
    if (!/^\\d{1,2}:\\d{2}$/.test(tin.value)) return;
    const a = toMinutes(tin.value), b = a + Number(lsel.value);
    S.fixed.push({ day: dsel.value, start: hhmm(a), end: hhmm(b), label: "休憩" });
    render();
  };
  brk.append(dsel, tin, lsel, put);
  host.appendChild(brk);

  const opts = optionsIndex();
  const placed = placedIds();

  for (const v of VENUE_ORDER) {
    const list = SHOWS.filter(s => s.venue === v);
    if (!list.length) continue;
    host.appendChild(el("div", "vh", VENUES[v].label));
    const box = el("div", "slist");
    for (const show of list) box.appendChild(showRow(show, opts, placed));
    host.appendChild(box);
  }
}

function showRow(show, opts, placed) {
  const done = placed.has(show.id);
  const row = el("div", "srow" + (done ? " done" : ""));
  row.style.setProperty("--venue", vcol(show.venue));

  const head = el("div", "shead");
  const fav = el("button", "fav", S.favorites.has(show.id) ? "★" : "☆");
  fav.setAttribute("aria-pressed", String(S.favorites.has(show.id)));
  fav.setAttribute("aria-label", show.title + " をお気に入りにする");
  fav.onclick = () => {
    S.favorites.has(show.id) ? S.favorites.delete(show.id) : S.favorites.add(show.id);
    render();
  };
  head.appendChild(fav);

  const title = el("button", "stitle");
  title.setAttribute("aria-expanded", String(S.open === show.id));
  if (done) title.appendChild(el("span", "tick", "✓"));
  title.appendChild(el("span", "nm", show.title));
  const left = opts.get(show.id)?.length ?? 0;
  title.appendChild(el("span", "mt", done ? "参加する" : show.durationMin + "分 " + yen(show.price)));
  if (!done && left > 0 && left <= 2) title.appendChild(el("span", "warnq", "残り" + left));
  if (!done && left === 0) title.appendChild(el("span", "warnq", "入らない"));
  title.onclick = () => { S.open = S.open === show.id ? null : show.id; render(); };
  head.appendChild(title);
  row.appendChild(head);

  if (S.open !== show.id) return row;

  const box = el("div", "slots");
  if (done) {
    const cur = S.fixed.find(f => f.showId === show.id);
    box.appendChild(el("div", "dl",
      DAY_LABEL[cur.day] + " " + cur.start + "–" + cur.end + " で参加"));
    const off = el("button", "btn sub", "やめる");
    off.onclick = () => {
      S.fixed = S.fixed.filter(f => f.showId !== show.id);
      S.justAdded.delete(show.id); render();
    };
    box.appendChild(off);
    row.appendChild(box);
    return row;
  }

  const ok = new Set((opts.get(show.id) ?? []).map(o => o.day + o.start));
  for (const day of DAYS()) {
    const slots = show.slots.filter(s => s.day === day);
    if (!slots.length) continue;
    box.appendChild(el("div", "dl", DAY_LABEL[day]));
    const sc = el("div", "sc");
    for (const s of slots) {
      const b = el("button", null, s.start);
      b.disabled = !ok.has(day + s.start);
      b.title = s.start + "–" + s.end + (b.disabled ? "（他の予定とぶつかります）" : "");
      b.setAttribute("aria-label", DAY_LABEL[day] + " " + s.start + "から参加する");
      b.onclick = () => {
        S.fixed.push({ day, start: s.start, end: s.end, showId: show.id });
        S.open = null; render();
      };
      sc.appendChild(b);
    }
    box.appendChild(sc);
  }
  row.appendChild(box);
  return row;
}

/* ---------------- 上ペイン: 段階2 埋める ---------------- */
function phase2(host) {
  const placed = placedIds();
  if (placed.size === 0) {
    host.appendChild(el("p", "hint",
      "まず「押さえる」で参加する回をいくつか置いてください。ここは残りを埋める段階です。"));
    return;
  }

  host.appendChild(el("p", "hint",
    "置いた予定は動かしません。土日どちらも見たうえで、待ち時間が短くなるように詰めます。"));

  // 日ごとの時間帯
  for (const day of DAYS()) {
    const w = winOf(day);
    const r = el("div", "winrow");
    r.appendChild(el("span", "lbl", DAY_LABEL[day]));
    const a = el("input"); a.type = "time"; a.value = w.from;
    a.setAttribute("aria-label", DAY_LABEL[day] + " これ以降に入れる");
    const b = el("input"); b.type = "time"; b.value = w.to;
    b.setAttribute("aria-label", DAY_LABEL[day] + " これ以前に終える");
    const set = () => {
      S.windows[day] = { from: a.value, to: b.value };
      render();
    };
    a.onchange = set; b.onchange = set;
    r.append(a, el("span", null, "〜"), b, el("span", null, "の間だけ"));
    host.appendChild(r);
  }

  const favOnly = el("label", "favonly");
  const cb = el("input"); cb.type = "checkbox"; cb.checked = S.onlyFav;
  cb.onchange = () => { S.onlyFav = cb.checked; render(); };
  favOnly.append(cb, "★を付けた公演だけを入れる");
  host.appendChild(favOnly);

  const res = suggestFills(SHOWS, S.fixed, {
    days: DAYS(), bufferMin: BUFFER,
    favoriteIds: [...S.favorites], onlyFavorites: S.onlyFav, windows: S.windows,
  });
  const favIn = res.added.filter(a => S.favorites.has(a.showId)).length;

  const bar = el("div", "restbar");
  const go = el("button", "btn",
    res.added.length
      ? "おまかせで " + res.added.length + "公演 入れる" + (favIn ? "（★" + favIn + "）" : "")
      : "もう入りません");
  go.disabled = !res.added.length;
  go.onclick = () => {
    for (const a of res.added) {
      S.fixed.push({ day: a.day, start: a.start, end: a.end, showId: a.showId });
      S.justAdded.add(a.showId);
    }
    render();
  };
  bar.appendChild(go);
  host.appendChild(bar);
  if (res.added.length) {
    host.appendChild(el("p", "hint", "入れたあとのあき合計: "
      + DAYS().map(d => DAY_LABEL[d] + " " + (res.idleByDay[d] ?? 0) + "分").join(" / ")));
  }

  const opts = optionsIndex();
  let any = false;
  for (const day of DAYS()) {
    const gaps = gapsOf(day);
    for (const g of gaps) {
      const cands = [];
      for (const [id, list] of opts) {
        const hit = list.find(o => o.day === day && o.startMin >= g.a && o.endMin <= g.b);
        if (hit) cands.push({ id, hit, left: list.length });
      }
      if (!cands.length) continue;
      any = true;
      const c = el("div", "gapc");
      c.appendChild(el("div", "gt", DAY_LABEL[day] + "　" + hhmm(g.a) + "〜" + hhmm(g.b)));
      c.appendChild(el("div", "gs", (g.b - g.a) + "分あいています"));
      const chips = el("div", "chips");
      cands.sort((x, y) => x.left - y.left || x.hit.startMin - y.hit.startMin);
      for (const cd of cands.slice(0, 6)) {
        const show = byId.get(cd.id);
        const b = el("button", "chip");
        b.style.setProperty("--venue", vcol(show.venue));
        b.append(show.title + " " + cd.hit.start);
        if (cd.left === 1) b.appendChild(el("span", "lc", "　最後の枠"));
        b.onclick = () => {
          S.fixed.push({ day, start: cd.hit.start, end: cd.hit.end, showId: cd.id });
          S.justAdded.add(cd.id); render();
        };
        chips.appendChild(b);
      }
      c.appendChild(chips);
      host.appendChild(c);
    }
  }
  if (!any) host.appendChild(el("p", "none", "空いているところに入る公演はもうありません。"));
}

/** その日の予定のあいだの空き。前後の余裕(バッファ)を引いた実効の範囲で返す。 */
function gapsOf(day) {
  const list = onDay(day);
  const out = [];
  let cur = T0;
  for (const f of list) {
    if (f.a - cur > BUFFER) out.push({ a: cur, b: f.a });
    cur = Math.max(cur, f.b);
  }
  if (T1 - cur > BUFFER) out.push({ a: cur, b: T1 });
  return out;
}

/* ---------------- 下ペイン: 両日の予定 ---------------- */
function board(host) {
  const list = S.fixed.filter(f => f.showId).map(f => byId.get(f.showId));
  let per = 0, grp = 0;
  for (const s of list) (s.unit === "group" ? (grp += s.price) : (per += s.price));
  const money = [per && yen(per) + "/人", grp && yen(grp) + "/回"].filter(Boolean).join(" ＋ ") || "—";

  const tot = el("div", "tot");
  tot.appendChild(el("b", null, list.length + "公演"));
  for (const d of DAYS()) {
    const evs = onDay(d);
    let idle = 0;
    for (let i = 1; i < evs.length; i++) idle += evs[i].a - evs[i - 1].b;
    tot.appendChild(el("span", null,
      DAY_LABEL[d] + " " + evs.filter(f => f.showId).length + "（あき" + idle + "分）"));
  }
  tot.appendChild(el("span", "sp", money));
  host.appendChild(tot);

  const board = el("div", "board");
  board.appendChild(el("div", "dh ax", "."));
  for (const d of DAYS()) board.appendChild(el("div", "dh", DAY_LABEL[d]));

  const H = (T1 - T0) * PPM;
  const ax = el("div", "axc");
  ax.style.height = H + "px";
  for (let m = T0; m <= T1; m += 60) {
    const t = el("div", "tk", hhmm(m));
    t.style.top = (m - T0) * PPM + "px";
    ax.appendChild(t);
  }
  board.appendChild(ax);

  for (const day of DAYS()) {
    const col = el("div", "daycol");
    col.style.height = H + "px";
    for (let m = T0; m <= T1; m += 60) {
      const h = el("div", "hr"); h.style.top = (m - T0) * PPM + "px"; col.appendChild(h);
    }
    const evs = onDay(day);
    if (!evs.length) col.appendChild(el("div", "emptyday", "まだ予定なし"));
    for (const f of evs) {
      const show = f.showId ? byId.get(f.showId) : null;
      const e = el("div", "ev" + (show ? "" : " rest")
        + (show && S.justAdded.has(show.id) ? " new" : ""));
      if (show) e.style.setProperty("--venue", vcol(show.venue));
      e.style.top = (f.a - T0) * PPM + "px";
      e.style.height = ((f.b - f.a) * PPM - 2) + "px";
      const x = el("button", "x", "×");
      x.setAttribute("aria-label", (show ? show.title : "休憩") + " をはずす");
      x.onclick = () => {
        S.fixed = S.fixed.filter(g => !(g.day === f.day && g.start === f.start && g.showId === f.showId
          && g.label === f.label));
        render();
      };
      e.appendChild(x);
      e.appendChild(el("div", "et", show ? show.title : (f.label ?? "休憩")));
      e.appendChild(el("div", "ee", f.start + "–" + f.end));
      col.appendChild(e);
    }
    board.appendChild(col);
  }
  host.appendChild(board);
}

/* ---------------- 描画 ---------------- */
function render() {
  const host = document.getElementById("stage");
  const phone = el("div", "phone");
  const pane = el("div", "pane");

  const top = el("div", "top");
  const ph = el("div", "phases");
  for (const [n, ttl, sub] of [[1, "押さえる", "STEP 1"], [2, "埋める", "STEP 2"]]) {
    const b = el("button");
    b.appendChild(el("b", null, sub));
    b.append(ttl);
    b.setAttribute("aria-selected", String(S.phase === n));
    b.onclick = () => { S.phase = n; S.open = null; render(); };
    ph.appendChild(b);
  }
  const body = el("div", "topbody");
  (S.phase === 1 ? phase1 : phase2)(body);
  top.append(ph, body);

  const bot = el("div", "bot");
  board(bot);

  pane.append(top, bot);
  phone.appendChild(pane);
  host.replaceChildren(phone);
}

render();
`;

const html = `<title>作り直した導線 — algoフェス2026 はしごプランナー</title>
<style>${CSS}</style>

<div class="wrap">
  <header class="hero">
    <h1>作り直した導線</h1>
    <p>上下2ペイン。上が「押さえる → 埋める」の二段階、下は土日ぶんの予定です。実データで動きます。</p>
  </header>

  <div class="note">
    <b>直したところ</b>
    <ul>
      <li><b>主役を手動に</b> — 自分で参加する回まで選んで置く。プランナーは残った空きを埋める役</li>
      <li><b>回を自分で選ぶ</b> — 両日ぶんの回が出て、ぶつかる回は選べない</li>
      <li><b>土日をまたいで推奨</b> — 「おまかせ」は両日を同時に見て最大化する。土曜のこの枠を逃すと日曜にも入らない、が効く</li>
      <li><b>休憩を置ける</b> — 日・開始・長さを指定。プランナーはそこを避ける</li>
      <li><b>用語</b> — 「見たい公演」→「やりたい公演」、「観る」→「参加する」</li>
    </ul>
  </div>

  <div id="stage"></div>

  <p class="foot">構造と流れを見るためのプロトタイプです。見た目とフォントは別途。</p>
</div>

<script>
${engine}
</script>
<script>
${APP}
</script>
`;

writeFileSync(join(here, "flow-prototype.html"), html);
console.log(`design/proposals/flow-prototype.html （${(Buffer.byteLength(html) / 1024).toFixed(1)}KB）`);
