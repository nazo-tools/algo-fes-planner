// デザイン案の比較プロトタイプ。実装ではなく、選んでもらうための比較物。
//
//   node design/proposals/build-compare.mjs → design/proposals/gap-view-compare.html
//
// 本物の shows.js / planner.js をそのまま埋め込んでいるので、
// 「何公演入るか」の判定は製品と同じコードが動く。

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { toPlainScript, bundle } from "../../tools/inline.mjs";
import { SHOWS, FES } from "../../shows.js";
import { findPlans, toMinutes } from "../../planner.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");

const DAY = "09-13";
const BUFFER = 10;
const d = FES.days.find((x) => x.id === DAY);
const DAY_LABEL = `${d.label}(${d.weekday})`;

// 初期状態は「大物を3つ押さえたが、あいだに穴が残っている」場面。
// この機能が要るのはまさにその状態なので、詰めきったプランでは比較にならない。
const INITIAL = ["otose@10:00", "gobousei@14:30", "destrain@17:40"];

// 手で選んだ枠なので、実在して衝突しないことを書き出し時に確かめる
{
  const picked = INITIAL.map((k) => {
    const [id, start] = k.split("@");
    const show = SHOWS.find((s) => s.id === id);
    const slot = show?.slots.find((x) => x.day === DAY && x.start === start);
    if (!slot) throw new Error(`初期プランの枠が実在しません: ${k}`);
    return { a: toMinutes(slot.start), b: toMinutes(slot.end) };
  }).sort((x, y) => x.a - y.a);
  for (let i = 1; i < picked.length; i++) {
    if (picked[i].a - picked[i - 1].b < BUFFER) {
      throw new Error(`初期プランが衝突しています: ${INITIAL[i - 1]} → ${INITIAL[i]}`);
    }
  }
  const ranks = Object.fromEntries(INITIAL.map((k) => [k.split("@")[0], "must"]));
  if (findPlans(SHOWS, ranks, { day: DAY, bufferMin: BUFFER }).plans[0]?.score.must !== 3) {
    throw new Error("初期プランの3公演がプランナーで成立しません");
  }
}

const read = (p) => readFileSync(join(root, p), "utf8");
const engine = bundle([
  { name: "shows.js", code: toPlainScript(read("shows.js")) },
  { name: "planner.js", code: toPlainScript(read("planner.js")) },
].map(({ name, code }) => ({ name, code })))
  // IIFE の外から使いたいので、必要なものだけ window に出す
  .replace(/\n\}\)\(\);$/, "\nwindow.__E = { SHOWS, VENUES, FES, findPlans, fillGap, toMinutes };\n})();");

const CSS = `
:root {
  color-scheme: light dark;
  --bg:#f1f0ed; --surface:#fff; --sunken:#e9e8e4;
  --ink:#1c1e21; --muted:#5c6066; --subtle:#8b9096;
  --line:#dbdad5; --line-soft:#e8e7e3;
  --v-hallHigh:#bd3350; --v-room2f:#0e7a72; --v-hall2f:#5f45a8;
  --ghost:.14;
  --font-ui:"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Noto Sans JP",system-ui,sans-serif;
  --font-num:ui-monospace,"SF Mono",SFMono-Regular,"Cascadia Mono",Consolas,monospace;
  --radius:10px;
  --shadow:0 1px 1px rgba(20,22,26,.04),0 3px 10px rgba(20,22,26,.05);
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --bg:#15161a; --surface:#1e2024; --sunken:#26282d;
  --ink:#e8e9ea; --muted:#a0a4aa; --subtle:#767b82;
  --line:#32353b; --line-soft:#2a2d32;
  --v-hallHigh:#f2778c; --v-room2f:#3fbfb2; --v-hall2f:#a38ef0;
  --ghost:.22;
  --shadow:0 1px 1px rgba(0,0,0,.4),0 3px 10px rgba(0,0,0,.3);
}}
:root[data-theme="dark"]{
  --bg:#15161a; --surface:#1e2024; --sunken:#26282d;
  --ink:#e8e9ea; --muted:#a0a4aa; --subtle:#767b82;
  --line:#32353b; --line-soft:#2a2d32;
  --v-hallHigh:#f2778c; --v-room2f:#3fbfb2; --v-hall2f:#a38ef0;
  --ghost:.22;
  --shadow:0 1px 1px rgba(0,0,0,.4),0 3px 10px rgba(0,0,0,.3);
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--font-ui);
  font-size:15px;line-height:1.6;-webkit-text-size-adjust:100%}
:where(button):focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.wrap{max-width:760px;margin:0 auto;padding:0 14px 70px}

.hero{padding:22px 0 16px;border-bottom:1px solid var(--line);margin-bottom:20px}
.hero h1{margin:0;font-size:1.2rem;font-weight:800}
.hero p{margin:6px 0 0;color:var(--muted);font-size:.85rem}
.hero .fixed{margin-top:10px;font-size:.77rem;color:var(--subtle);font-variant-numeric:tabular-nums}

h2.sec{font-size:.72rem;letter-spacing:.13em;color:var(--subtle);margin:0 0 4px;font-weight:700}
.lead{font-size:.83rem;color:var(--muted);margin:0 0 12px}
section{margin-bottom:34px}

.switch{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap}
.switch button{flex:1 1 0;min-width:98px;padding:9px 6px;border-radius:8px;cursor:pointer;
  border:1px solid var(--line);background:var(--surface);color:var(--muted);
  font:inherit;font-size:.83rem;font-weight:700}
.switch button[aria-selected="true"]{background:var(--ink);border-color:var(--ink);color:var(--surface)}
.aim{font-size:.81rem;color:var(--muted);margin:0 0 14px;min-height:2.6em}
.aim b{color:var(--ink)}

.status{display:flex;flex-wrap:wrap;gap:9px;align-items:baseline;
  background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);
  padding:10px 13px;margin-bottom:14px;box-shadow:var(--shadow);
  font-size:.81rem;font-variant-numeric:tabular-nums;position:sticky;top:0;z-index:5}
.status b{font-size:.95rem}
.status .sub{color:var(--subtle);margin-left:auto}

/* ---- 予定の1件 ---- */
.tl{list-style:none;margin:0;padding:0}
.row{display:grid;grid-template-columns:4.2em 1fr;gap:10px}
.time{font-family:var(--font-num);font-variant-numeric:tabular-nums;
  font-size:.85rem;font-weight:700;color:var(--muted);padding-top:11px}
.item{background:var(--surface);border:1px solid var(--line);
  border-left:3px solid var(--venue);border-radius:var(--radius);
  padding:9px 11px;margin-bottom:3px;box-shadow:var(--shadow)}
.item .t{font-weight:700;font-size:.93rem;line-height:1.35}
.item .v{font-size:.74rem;color:var(--subtle);font-variant-numeric:tabular-nums}
.item .rm{float:right;margin:-2px -4px 0 8px;border:0;background:none;cursor:pointer;
  color:var(--subtle);font:inherit;font-size:1.1rem;line-height:1;padding:2px 6px}

/* ---- 共通のあき ---- */
.gapcell{grid-column:2}
.gaplab{font-size:.75rem;color:var(--subtle);font-variant-numeric:tabular-nums}
.fits{color:var(--ink);font-weight:700}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.chip{border:1px dashed var(--venue);background:transparent;color:var(--ink);
  border-radius:999px;padding:5px 11px;cursor:pointer;font:inherit;font-size:.77rem;
  font-variant-numeric:tabular-nums;display:inline-flex;gap:5px;align-items:center}
.chip::before{content:"＋";color:var(--venue);font-weight:700}
.chip .w{color:var(--subtle)}
.none{font-size:.74rem;color:var(--subtle);opacity:.8}

/* 変化1: そのまま並べる */
.v1 .gapcell{padding:8px 0 8px 14px;position:relative}
.v1 .gapcell::before{content:"";position:absolute;left:0;top:0;bottom:0;border-left:2px dotted var(--line)}
.v1 .bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.v1 .bulk{border:1px solid var(--ink);background:var(--ink);color:var(--surface);
  border-radius:7px;padding:4px 10px;cursor:pointer;font:inherit;font-size:.75rem;font-weight:700}

/* 変化2: 最良の組み合わせを主役に */
.v2 .gapcell{padding:8px 0 8px 14px;position:relative}
.v2 .gapcell::before{content:"";position:absolute;left:0;top:0;bottom:0;border-left:2px dotted var(--line)}
.v2 .card{background:var(--sunken);border:1px dashed var(--line);border-radius:var(--radius);
  padding:10px 12px;margin-top:6px}
.v2 .card h4{margin:0 0 7px;font-size:.83rem;font-weight:700}
.v2 .mini{list-style:none;margin:0 0 9px;padding:0;font-size:.8rem}
.v2 .mini li{display:flex;gap:9px;align-items:baseline;padding:2px 0;
  border-left:3px solid var(--venue);padding-left:9px;margin-bottom:3px}
.v2 .mini .mt{font-family:var(--font-num);font-variant-numeric:tabular-nums;
  color:var(--muted);font-size:.76rem;flex:none}
.v2 .acts{display:flex;gap:7px;flex-wrap:wrap}
.v2 .primary{border:1px solid var(--ink);background:var(--ink);color:var(--surface);
  border-radius:7px;padding:6px 12px;cursor:pointer;font:inherit;font-size:.78rem;font-weight:700}
.v2 .ghost{border:1px solid var(--line);background:transparent;color:var(--muted);
  border-radius:7px;padding:6px 12px;cursor:pointer;font:inherit;font-size:.78rem;font-weight:700}

/* 変化3: 空きを高さで描く */
.v3 .gapcell{padding:4px 0}
.v3 .band{position:relative;border-radius:8px;background:repeating-linear-gradient(
    135deg,var(--sunken) 0 7px,transparent 7px 14px);
  border:1px dashed var(--line);display:flex;align-items:center;
  padding:0 12px;cursor:pointer;width:100%;font:inherit;color:inherit;text-align:left}
.v3 .band[data-empty="1"]{cursor:default}
.v3 .band .lab{font-size:.75rem;color:var(--subtle);font-variant-numeric:tabular-nums}
.v3 .band .lab .fits{color:var(--ink)}
.v3 .open{margin:6px 0 2px}

/* ---- 完成した予定 ---- */
.mineWrap{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);
  box-shadow:var(--shadow);padding:12px 13px}
.mine{position:relative;margin-left:46px}
.mine .tick{position:absolute;left:-46px;width:42px;text-align:right;
  font-family:var(--font-num);font-size:.68rem;color:var(--subtle);
  transform:translateY(-.55em);font-variant-numeric:tabular-nums}
.mine .hr{position:absolute;left:-4px;right:0;border-top:1px solid var(--line-soft)}
.mine .blk{position:absolute;left:0;right:0;border-radius:7px;padding:5px 9px;
  background:var(--venue);color:#fff;overflow:hidden}
.mine .blk .bt{font-weight:700;font-size:.8rem;line-height:1.25}
.mine .blk .bv{font-size:.68rem;opacity:.85;font-family:var(--font-num);font-variant-numeric:tabular-nums}
.mine .free{position:absolute;left:0;right:0;display:flex;align-items:center;justify-content:center;
  font-size:.7rem;color:var(--subtle);font-variant-numeric:tabular-nums}

.gridwrap{overflow-x:auto;background:var(--surface);border:1px solid var(--line);
  border-radius:var(--radius);box-shadow:var(--shadow);-webkit-overflow-scrolling:touch}
.grid{display:grid;position:relative}
.axis{position:sticky;left:0;z-index:3;background:var(--surface);
  border-right:1px solid var(--line);width:46px}
.axis .h{height:var(--headH);border-bottom:1px solid var(--line);background:var(--surface)}
.gtick{position:absolute;left:0;width:46px;font-family:var(--font-num);font-size:.67rem;
  color:var(--subtle);padding-left:5px;transform:translateY(-.55em);
  font-variant-numeric:tabular-nums;background:var(--surface);z-index:2}
.col{border-right:1px solid var(--line-soft);position:relative}
.col:last-child{border-right:0}
.colh{height:var(--headH);border-bottom:1px solid var(--line);padding:5px 5px 0;
  font-size:.62rem;line-height:1.25;color:var(--muted);overflow:hidden;border-top:3px solid var(--venue)}
.colh b{display:block;font-size:.65rem;color:var(--ink);font-weight:700}
.line{position:absolute;left:0;right:0;border-top:1px solid var(--line-soft);z-index:0}
.blk2{position:absolute;left:3px;right:3px;border-radius:5px;cursor:pointer;
  border:1px solid transparent;padding:2px 4px;overflow:hidden;
  font-family:var(--font-num);font-size:.6rem;line-height:1.25;text-align:left;
  font-variant-numeric:tabular-nums;z-index:1}
.blk2.off{background:color-mix(in srgb,var(--venue) calc(var(--ghost)*100%),transparent);
  color:var(--subtle);border-color:color-mix(in srgb,var(--venue) 30%,transparent)}
.blk2.on{background:var(--venue);color:#fff;border-color:var(--venue);font-weight:700}
.blk2.bad{animation:shake .3s}
@keyframes shake{25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
.legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:9px;font-size:.74rem;color:var(--subtle)}
.legend i{display:inline-block;width:11px;height:11px;border-radius:3px;vertical-align:-1px;margin-right:5px}

.verdict{margin-top:8px;background:var(--sunken);border:1px solid var(--line);
  border-radius:var(--radius);padding:14px 15px;font-size:.85rem}
.verdict h3{margin:0 0 6px;font-size:.72rem;letter-spacing:.13em;color:var(--subtle);font-weight:700}
.verdict p{margin:0 0 8px}
.verdict p:last-child{margin-bottom:0}
.foot{margin-top:24px;color:var(--subtle);font-size:.73rem;text-align:center}
@media (prefers-reduced-motion: reduce){*{animation:none!important}}
`;

const APP = `
const { SHOWS, VENUES, fillGap, toMinutes } = window.__E;
const DAY = ${JSON.stringify(DAY)};
const DAY_LABEL = ${JSON.stringify(DAY_LABEL)};
const BUFFER = ${BUFFER};

const dayShows = SHOWS
  .map(s => ({ ...s, slots: s.slots.filter(x => x.day === DAY)
      .map(x => ({ ...x, a: toMinutes(x.start), b: toMinutes(x.end) }))
      .sort((p, q) => p.a - q.a) }))
  .filter(s => s.slots.length > 0);
const byId = new Map(dayShows.map(s => [s.id, s]));

const allSlots = dayShows.flatMap(s => s.slots);
const DAY_START = Math.floor(Math.min(...allSlots.map(s => s.a)) / 30) * 30;
const DAY_END = Math.ceil(Math.max(...allSlots.map(s => s.b)) / 30) * 30;

const K = (id, start) => id + "@" + start;
const unK = k => { const [id, start] = k.split("@"); return { id, start }; };
const yen = n => "¥" + n.toLocaleString("ja-JP");
const hhmm = m => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const vcol = v => "var(--v-" + v + ")";
const el = (tag, cls, txt) => { const e = document.createElement(tag);
  if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

let plan = new Set(${JSON.stringify(INITIAL)});
let editView = "v1";
let finalView = "mine";
const opened = new Set();   // 変化3で開いているあき

function items() {
  return [...plan].map(k => {
    const { id, start } = unK(k);
    const show = byId.get(id);
    return { key: k, show, slot: show.slots.find(s => s.start === start) };
  }).sort((x, y) => x.slot.a - y.slot.a);
}

/** 予定のあいだのあき。開演前・終演後も含める。 */
function gaps() {
  const list = items();
  if (!list.length) return [];
  const out = [{ id: "pre", after: null, before: list[0].slot.a, label: "開演前" }];
  for (let i = 0; i + 1 < list.length; i++) {
    const a = list[i].slot.b, b = list[i + 1].slot.a;
    out.push({ id: "g" + i, after: a, before: b, label: (b - a) + "分あき" });
  }
  const last = list[list.length - 1].slot.b;
  out.push({ id: "post", after: last, before: null, label: "終演後" });
  return out;
}

/** そのあきに入る組み合わせ。判定は製品と同じ fillGap を使う。 */
function fillsFor(gap) {
  const res = fillGap(SHOWS, {
    day: DAY, bufferMin: BUFFER,
    afterMin: gap.after, beforeMin: gap.before,
    excludeIds: [...plan].map(k => unK(k).id),
    maxPlans: 4,
  });
  return res.plans;
}

/**
 * そのあきに単独で入れられる公演を、公演ごとに一番早い枠で1件ずつ。
 * 組み合わせ(fillsFor)から逆算すると上位に入らなかった公演が落ちるので、個別に判定する。
 */
function singles(gap) {
  const used = new Set([...plan].map(k => unK(k).id));
  const margin = Math.max(BUFFER, 1);
  const lo = gap.after == null ? -Infinity : gap.after + margin;
  const hi = gap.before == null ? Infinity : gap.before - margin;
  const out = [];
  for (const show of dayShows) {
    if (used.has(show.id)) continue;
    const slot = show.slots.find(s => s.a >= lo && s.b <= hi);
    if (slot) out.push({ showId: show.id, title: show.title, start: slot.start, end: slot.end, startMin: slot.a });
  }
  return out.sort((x, y) => x.startMin - y.startMin);
}

const addItem = it => { plan.add(K(it.showId, it.start)); render(); };
const addAll = its => { for (const it of its) plan.add(K(it.showId, it.start)); render(); };

function chip(it) {
  const b = el("button", "chip");
  b.style.setProperty("--venue", vcol(byId.get(it.showId).venue));
  b.append(it.title, " ");
  b.appendChild(el("span", "w", it.start + "–" + it.end));
  b.onclick = () => addItem(it);
  return b;
}

function itemRow(it) {
  const li = el("li", "row");
  li.appendChild(el("span", "time", it.slot.start));
  const card = el("div", "item");
  card.style.setProperty("--venue", vcol(it.show.venue));
  const rm = el("button", "rm", "×");
  rm.title = "はずす";
  rm.setAttribute("aria-label", it.show.title + " をはずす");
  rm.onclick = () => { plan.delete(it.key); render(); };
  card.appendChild(rm);
  card.appendChild(el("div", "t", it.show.title));
  card.appendChild(el("div", "v", it.slot.start + "–" + it.slot.end + " ・ "
    + VENUES[it.show.venue].label + " ・ " + yen(it.show.price)));
  li.appendChild(card);
  return li;
}

/* ============ 変化1: そのまま並べる ============ */
function renderV1(root) {
  const ul = el("ul", "tl v1");
  const list = items();
  const gs = gaps();

  const gapRow = g => {
    const li = el("li", "row"); li.appendChild(el("span"));
    const cell = el("div", "gapcell");
    const best = fillsFor(g)[0];
    const bar = el("div", "bar");
    const lab = el("span", "gaplab");
    lab.append(g.label);
    if (best) {
      lab.append(" ・ ");
      lab.appendChild(el("span", "fits", "最大" + best.items.length + "公演入ります"));
    }
    bar.appendChild(lab);
    if (best && best.items.length > 1) {
      const b = el("button", "bulk", "この" + best.items.length + "つを入れる");
      b.onclick = () => addAll(best.items);
      bar.appendChild(b);
    }
    cell.appendChild(bar);
    const cands = singles(g);
    if (cands.length) {
      const chips = el("div", "chips");
      for (const c of cands) chips.appendChild(chip(c));
      cell.appendChild(chips);
    } else {
      cell.appendChild(el("div", "none", "ここに入る公演はありません"));
    }
    li.appendChild(cell);
    return li;
  };

  ul.appendChild(gapRow(gs[0]));
  list.forEach((it, i) => { ul.appendChild(itemRow(it)); ul.appendChild(gapRow(gs[i + 1])); });
  root.replaceChildren(ul);
}

/* ============ 変化2: 最良の組み合わせを主役に ============ */
function renderV2(root) {
  const ul = el("ul", "tl v2");
  const list = items();
  const gs = gaps();

  const gapRow = g => {
    const li = el("li", "row"); li.appendChild(el("span"));
    const cell = el("div", "gapcell");
    cell.appendChild(el("div", "gaplab", g.label));

    const best = fillsFor(g)[0];
    if (!best) {
      cell.appendChild(el("div", "none", "ここに入る公演はありません"));
      li.appendChild(cell); return li;
    }

    const card = el("div", "card");
    const h = el("h4"); h.appendChild(el("span", "fits", best.items.length + "公演入ります"));
    card.appendChild(h);
    const mini = el("ul", "mini");
    for (const it of best.items) {
      const row = el("li");
      row.style.setProperty("--venue", vcol(byId.get(it.showId).venue));
      row.appendChild(el("span", "mt", it.start + "–" + it.end));
      row.appendChild(el("span", null, it.title));
      mini.appendChild(row);
    }
    card.appendChild(mini);

    const acts = el("div", "acts");
    const go = el("button", "primary",
      best.items.length > 1 ? "この" + best.items.length + "つを入れる" : "これを入れる");
    go.onclick = () => addAll(best.items);
    acts.appendChild(go);

    const others = singles(g).filter(s => !best.items.some(b => b.showId === s.showId));
    if (others.length) {
      const more = el("button", "ghost", "他の候補 " + others.length + "件");
      more.onclick = () => {
        more.remove();
        const chips = el("div", "chips");
        for (const c of others) chips.appendChild(chip(c));
        card.appendChild(chips);
      };
      acts.appendChild(more);
    }
    card.appendChild(acts);
    cell.appendChild(card);
    li.appendChild(cell);
    return li;
  };

  ul.appendChild(gapRow(gs[0]));
  list.forEach((it, i) => { ul.appendChild(itemRow(it)); ul.appendChild(gapRow(gs[i + 1])); });
  root.replaceChildren(ul);
}

/* ============ 変化3: 空きを高さで描く ============ */
const PPM3 = 0.55;
function renderV3(root) {
  const ul = el("ul", "tl v3");
  const list = items();
  const gs = gaps();

  const gapRow = g => {
    const li = el("li", "row"); li.appendChild(el("span"));
    const cell = el("div", "gapcell");
    const mins = (g.before ?? DAY_END) - (g.after ?? DAY_START);
    const best = fillsFor(g)[0];

    const band = el("button", "band");
    band.style.height = Math.max(30, Math.min(mins * PPM3, 130)) + "px";
    if (!best) band.dataset.empty = "1";
    const lab = el("span", "lab");
    lab.append(g.label);
    if (best) {
      lab.append(" ・ ");
      lab.appendChild(el("span", "fits", best.items.length + "公演入る"));
      lab.append(opened.has(g.id) ? " ▾" : " ▸");
    } else {
      lab.append(" ・ 入る公演なし");
    }
    band.appendChild(lab);
    if (best) {
      band.onclick = () => {
        opened.has(g.id) ? opened.delete(g.id) : opened.add(g.id);
        render();
      };
    }
    cell.appendChild(band);

    if (best && opened.has(g.id)) {
      const box = el("div", "open");
      if (best.items.length > 1) {
        const b = el("button", "bulk", "この" + best.items.length + "つをまとめて入れる");
        b.onclick = () => addAll(best.items);
        box.appendChild(b);
      }
      const chips = el("div", "chips");
      for (const c of singles(g)) chips.appendChild(chip(c));
      box.appendChild(chips);
      cell.appendChild(box);
    }
    li.appendChild(cell);
    return li;
  };

  ul.appendChild(gapRow(gs[0]));
  list.forEach((it, i) => { ul.appendChild(itemRow(it)); ul.appendChild(gapRow(gs[i + 1])); });
  root.replaceChildren(ul);
}

/* ============ 完成した予定: 自分のぶんだけ ============ */
const PPM_MINE = 1.15;
function renderMine(root) {
  const list = items();
  const wrap = el("div", "mineWrap");
  if (!list.length) { root.replaceChildren(el("div", "none", "予定がありません")); return; }

  const from = Math.floor(list[0].slot.a / 30) * 30;
  const to = Math.ceil(list[list.length - 1].slot.b / 30) * 30;
  const box = el("div", "mine");
  box.style.height = (to - from) * PPM_MINE + "px";

  for (let m = from; m <= to; m += 60) {
    const t = el("div", "tick", hhmm(m));
    t.style.top = (m - from) * PPM_MINE + "px";
    box.appendChild(t);
    const hr = el("div", "hr");
    hr.style.top = (m - from) * PPM_MINE + "px";
    box.appendChild(hr);
  }

  list.forEach((it, i) => {
    const b = el("div", "blk");
    b.style.setProperty("--venue", vcol(it.show.venue));
    b.style.top = (it.slot.a - from) * PPM_MINE + "px";
    b.style.height = ((it.slot.b - it.slot.a) * PPM_MINE - 3) + "px";
    b.appendChild(el("div", "bt", it.show.title));
    b.appendChild(el("div", "bv", it.slot.start + "–" + it.slot.end + " ・ "
      + VENUES[it.show.venue].label));
    box.appendChild(b);

    const next = list[i + 1];
    if (next) {
      const g = el("div", "free", (next.slot.a - it.slot.b) + "分あき");
      g.style.top = (it.slot.b - from) * PPM_MINE + "px";
      g.style.height = ((next.slot.a - it.slot.b) * PPM_MINE) + "px";
      box.appendChild(g);
    }
  });

  wrap.appendChild(box);
  const legend = el("div", "legend");
  legend.textContent = "帯の高さが実際の長さ。当日はこれをスクショして持ち歩く想定。";
  root.replaceChildren(wrap, legend);
}

/* ============ 完成した予定: 全公演に重ねる ============ */
const PPM_GRID = 1.25, HEAD = 46;
function renderGrid(root) {
  const wrap = el("div", "gridwrap");
  const grid = el("div", "grid");
  grid.style.setProperty("--headH", HEAD + "px");
  grid.style.gridTemplateColumns = "46px repeat(" + dayShows.length + ", 92px)";
  const bodyH = (DAY_END - DAY_START) * PPM_GRID;

  const axis = el("div", "axis");
  axis.style.height = (HEAD + bodyH) + "px";
  axis.appendChild(el("div", "h"));
  for (let m = DAY_START; m <= DAY_END; m += 60) {
    const t = el("div", "gtick", hhmm(m));
    t.style.top = (HEAD + (m - DAY_START) * PPM_GRID) + "px";
    axis.appendChild(t);
  }
  grid.appendChild(axis);

  for (const show of dayShows) {
    const col = el("div", "col");
    col.style.setProperty("--venue", vcol(show.venue));
    col.style.height = (HEAD + bodyH) + "px";
    const h = el("div", "colh");
    h.appendChild(el("b", null, show.title));
    h.append(VENUES[show.venue].label.replace("11・12F", "11.12F"));
    col.appendChild(h);

    for (let m = DAY_START; m <= DAY_END; m += 60) {
      const l = el("div", "line");
      l.style.top = (HEAD + (m - DAY_START) * PPM_GRID) + "px";
      col.appendChild(l);
    }

    for (const slot of show.slots) {
      const on = plan.has(K(show.id, slot.start));
      const b = el("button", "blk2 " + (on ? "on" : "off"), slot.start);
      b.style.top = (HEAD + (slot.a - DAY_START) * PPM_GRID) + "px";
      b.style.height = ((slot.b - slot.a) * PPM_GRID - 2) + "px";
      b.title = show.title + " " + slot.start + "–" + slot.end;
      b.setAttribute("aria-label", show.title + " " + slot.start + "から" + slot.end);
      b.onclick = () => {
        if (on) { plan.delete(K(show.id, slot.start)); render(); return; }
        const clash = items().some(it =>
          slot.a - it.slot.b < BUFFER && it.slot.a - slot.b < BUFFER);
        const dup = [...plan].some(k => unK(k).id === show.id);
        if (clash || dup) {
          b.classList.add("bad");
          setTimeout(() => b.classList.remove("bad"), 320);
          return;
        }
        plan.add(K(show.id, slot.start));
        render();
      };
      col.appendChild(b);
    }
    grid.appendChild(col);
  }

  wrap.appendChild(grid);
  const legend = el("div", "legend");
  legend.innerHTML =
    '<span><i style="background:var(--v-room2f)"></i>自分の予定</span>' +
    '<span><i style="background:color-mix(in srgb,var(--v-room2f) 22%,transparent);' +
    'border:1px solid var(--v-room2f)"></i>選ばなかった枠（タップで追加）</span>' +
    '<span>横にスクロールできます</span>';
  root.replaceChildren(wrap, legend);
}

/* ============ 描画 ============ */
const EDIT_AIM = {
  v1: "<b>変化1「そのまま並べる」</b> — あきの見出しに「最大◯公演入ります」を出し、下に候補を全部チップで並べる。何があるか一覧で見えるが、縦に伸びる。",
  v2: "<b>変化2「組み合わせを提案する」</b> — 一番多く入る組み合わせを主役にして、ボタン1つで埋める。他の候補は畳んでおく。決めるのが速い。",
  v3: "<b>変化3「あきを高さで描く」</b> — あきを実際の長さに比例した帯として描く。140分と20分の差が見た目で分かり、下の完成ビューと地続きになる。",
};
const FINAL_AIM = {
  mine: "<b>自分の予定だけ</b> — 選んだ公演を実際の長さの帯で並べる。当日これだけ見ればいい。",
  grid: "<b>全公演に重ねる</b> — 元の表と同じ12列に自分の予定を塗る。並走していた公演が見える。",
};

function renderStatus() {
  const list = items();
  let per = 0, grp = 0, idle = 0;
  list.forEach((it, i) => {
    if (it.show.unit === "group") grp += it.show.price; else per += it.show.price;
    if (i) idle += it.slot.a - list[i - 1].slot.b;
  });
  const money = [per && yen(per) + "/人", grp && yen(grp) + "/回"].filter(Boolean).join(" ＋ ");
  const s = document.getElementById("status");
  s.replaceChildren();
  s.appendChild(el("b", null, list.length + "公演"));
  s.appendChild(el("span", null, "あき計 " + idle + "分"));
  s.appendChild(el("span", null, money || "—"));
  s.appendChild(el("span", "sub",
    list.length ? list[0].slot.start + "〜" + list[list.length - 1].slot.end : ""));
}

function render() {
  renderStatus();
  const edit = document.getElementById("edit");
  ({ v1: renderV1, v2: renderV2, v3: renderV3 })[editView](edit);
  document.getElementById("edit-aim").innerHTML = EDIT_AIM[editView];

  const fin = document.getElementById("final");
  (finalView === "mine" ? renderMine : renderGrid)(fin);
  document.getElementById("final-aim").innerHTML = FINAL_AIM[finalView];
}

for (const b of document.querySelectorAll("[data-edit]")) {
  b.onclick = () => {
    editView = b.dataset.edit;
    for (const o of document.querySelectorAll("[data-edit]")) {
      o.setAttribute("aria-selected", String(o === b));
    }
    render();
  };
}
for (const b of document.querySelectorAll("[data-final]")) {
  b.onclick = () => {
    finalView = b.dataset.final;
    for (const o of document.querySelectorAll("[data-final]")) {
      o.setAttribute("aria-selected", String(o === b));
    }
    render();
  };
}
render();
`;

const html = `<title>デザイン案の比較 — algoフェス2026 はしごプランナー</title>
<style>${CSS}</style>

<div class="wrap">
  <header class="hero">
    <h1>デザイン案の比較</h1>
    <p>編集中の画面（案Aの3変化）と、出来上がった予定の見せ方（2案）。上下は同じプランを共有しているので、上で足すと下も変わります。<strong>全部タップできます。</strong></p>
    <p class="fixed">algoフェス2026 ${DAY_LABEL}／移動の余裕 ${BUFFER}分／「大物を3つ押さえたが穴が残っている」場面から始まります</p>
  </header>

  <div class="status" id="status"></div>

  <section>
    <h2 class="sec">1. 編集中の画面</h2>
    <p class="lead">あきに何公演入るかは、製品と同じ判定ロジックがその場で計算しています。</p>
    <div class="switch" role="tablist">
      <button type="button" role="tab" data-edit="v1" aria-selected="true">変化1　並べる</button>
      <button type="button" role="tab" data-edit="v2" aria-selected="false">変化2　提案する</button>
      <button type="button" role="tab" data-edit="v3" aria-selected="false">変化3　高さで描く</button>
    </div>
    <p class="aim" id="edit-aim"></p>
    <div id="edit"></div>
  </section>

  <section>
    <h2 class="sec">2. 出来上がった予定</h2>
    <p class="lead">当日に見るのはこちら。上で足した公演がそのまま反映されます。</p>
    <div class="switch" role="tablist">
      <button type="button" role="tab" data-final="mine" aria-selected="true">自分の予定だけ</button>
      <button type="button" role="tab" data-final="grid" aria-selected="false">全公演に重ねる</button>
    </div>
    <p class="aim" id="final-aim"></p>
    <div id="final"></div>
  </section>

  <div class="verdict">
    <h3>おすすめ</h3>
    <p><strong>編集中は変化2、完成ビューは「自分の予定だけ」を推します。</strong></p>
    <p>変化2は「140分あいてる」で終わらず「タイマー城 → OITOKE! で2つ入る」まで出してボタン1つで埋まります。はしごで一番面倒な組み合わせ探しを機械側が引き受ける形で、変化1・変化3は結局そこを人がやることになります。</p>
    <p>完成ビューは、当日スマホで見るなら選ばなかった80枠はノイズです。ただし<strong>「全公演に重ねる」は前日までの検討には効く</strong>ので、切り替えで両方残すのもありです。</p>
  </div>

  <p class="foot">比較用のプロトタイプです。データは公式タイムスケジュールの実データ。</p>
</div>

<script>
${engine}
</script>
<script>
${APP}
</script>
`;

writeFileSync(join(here, "gap-view-compare.html"), html);
console.log(`design/proposals/gap-view-compare.html （${(Buffer.byteLength(html) / 1024).toFixed(1)}KB）`);
