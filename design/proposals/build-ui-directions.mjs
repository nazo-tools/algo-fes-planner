// 全体UIの方向性5案。実装ではなく、選んでもらうための比較物。
//
//   node design/proposals/build-ui-directions.mjs → design/proposals/ui-directions.html
//
// 5案は「見た目の違い」ではなく「操作モデルの違い」で分けている。
// 予定(picked)は5案で共有するので、案を切り替えても作業が消えない。

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { toPlainScript, bundle } from "../../tools/inline.mjs";
import { FES } from "../../shows.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const DAY = "09-13";
const BUFFER = 10;
const d = FES.days.find((x) => x.id === DAY);
const DAY_LABEL = `${d.label}(${d.weekday})`;

const engine = bundle([
  { name: "shows.js", code: toPlainScript(read("shows.js")) },
  { name: "planner.js", code: toPlainScript(read("planner.js")) },
]).replace(/\n\}\)\(\);$/, "\nwindow.__E = { SHOWS, VENUES, FES, findPlans, toMinutes };\n})();");

const CSS = `
:root{
  color-scheme:light dark;
  --bg:#f1f0ed; --surface:#fff; --sunken:#e9e8e4; --raised:#fff;
  --ink:#1c1e21; --muted:#5c6066; --subtle:#8b9096;
  --line:#dbdad5; --line-soft:#e8e7e3;
  --v-hallHigh:#bd3350; --v-room2f:#0e7a72; --v-hall2f:#5f45a8;
  --ghost:.14; --onblk:#fff;
  --font-ui:"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Noto Sans JP",system-ui,sans-serif;
  --font-num:ui-monospace,"SF Mono",SFMono-Regular,"Cascadia Mono",Consolas,monospace;
  --radius:10px;
  --shadow:0 1px 1px rgba(20,22,26,.04),0 3px 10px rgba(20,22,26,.05);
  --lift:0 -2px 14px rgba(20,22,26,.09);
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#15161a; --surface:#1e2024; --sunken:#26282d; --raised:#272a30;
  --ink:#e8e9ea; --muted:#a0a4aa; --subtle:#767b82;
  --line:#32353b; --line-soft:#2a2d32;
  --v-hallHigh:#f2778c; --v-room2f:#3fbfb2; --v-hall2f:#a38ef0;
  --ghost:.22; --onblk:#14151a;
  --shadow:0 1px 1px rgba(0,0,0,.4),0 3px 10px rgba(0,0,0,.3);
  --lift:0 -2px 14px rgba(0,0,0,.5);
}}
:root[data-theme="dark"]{
  --bg:#15161a; --surface:#1e2024; --sunken:#26282d; --raised:#272a30;
  --ink:#e8e9ea; --muted:#a0a4aa; --subtle:#767b82;
  --line:#32353b; --line-soft:#2a2d32;
  --v-hallHigh:#f2778c; --v-room2f:#3fbfb2; --v-hall2f:#a38ef0;
  --ghost:.22; --onblk:#14151a;
  --shadow:0 1px 1px rgba(0,0,0,.4),0 3px 10px rgba(0,0,0,.3);
  --lift:0 -2px 14px rgba(0,0,0,.5);
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--font-ui);
  font-size:15px;line-height:1.6;-webkit-text-size-adjust:100%}
:where(button):focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.wrap{max-width:760px;margin:0 auto;padding:0 14px 40px}

.hero{padding:22px 0 14px}
.hero h1{margin:0;font-size:1.18rem;font-weight:800}
.hero p{margin:6px 0 0;color:var(--muted);font-size:.84rem}

.picker{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:6px;
  margin:14px 0 10px}
.picker button{padding:9px 8px;border-radius:8px;cursor:pointer;text-align:left;
  border:1px solid var(--line);background:var(--surface);color:var(--muted);
  font:inherit;font-size:.79rem;font-weight:700;line-height:1.3}
.picker button b{display:block;font-size:.72rem;color:var(--subtle);font-weight:700}
.picker button[aria-selected="true"]{background:var(--ink);border-color:var(--ink);color:var(--surface)}
.picker button[aria-selected="true"] b{color:var(--surface);opacity:.65}
.aim{font-size:.82rem;color:var(--muted);margin:0 0 6px}
.aim b{color:var(--ink)}
.tradeoff{font-size:.77rem;color:var(--subtle);margin:0 0 16px}

/* 端末の枠。各案を同じ幅で見せる */
.phone{max-width:390px;margin:0 auto;border:1px solid var(--line);border-radius:20px;
  background:var(--bg);box-shadow:var(--shadow);overflow:hidden;position:relative}
.screen{height:640px;overflow-y:auto;overflow-x:hidden;padding:12px 12px 0;
  scroll-behavior:smooth;-webkit-overflow-scrolling:touch}
.screen.hasbar{padding-bottom:70px}
.bar{position:absolute;left:0;right:0;bottom:0;background:var(--surface);
  border-top:1px solid var(--line);box-shadow:var(--lift);padding:10px 12px;
  display:flex;gap:9px;align-items:center}
.bar .cnt{font-size:.78rem;color:var(--muted);font-variant-numeric:tabular-nums;line-height:1.25}
.bar .cnt b{display:block;font-size:.9rem;color:var(--ink)}
.go{flex:1;padding:12px;border:1px solid var(--ink);border-radius:9px;
  background:var(--ink);color:var(--surface);font:inherit;font-size:.9rem;font-weight:700;cursor:pointer}
.go.sub{background:transparent;color:var(--ink)}
.go:disabled{opacity:.4;cursor:not-allowed}

h3.blk{font-size:.68rem;letter-spacing:.13em;color:var(--subtle);margin:14px 0 7px;font-weight:700}
h3.blk:first-child{margin-top:2px}

/* --- 公演の行（圧縮版） --- */
.rows{display:flex;flex-direction:column;gap:5px}
.r{display:flex;align-items:center;gap:9px;background:var(--surface);
  border:1px solid var(--line);border-left:3px solid var(--venue);
  border-radius:8px;padding:7px 9px}
.r .txt{min-width:0;flex:1}
.r .nm{font-size:.83rem;font-weight:700;line-height:1.3;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.r .mt{font-size:.68rem;color:var(--subtle);font-variant-numeric:tabular-nums}
.segs{display:flex;gap:3px;flex:none}
.seg{width:34px;padding:5px 0;border-radius:6px;cursor:pointer;text-align:center;
  border:1px dashed var(--line);background:transparent;color:var(--subtle);
  font:inherit;font-size:.68rem;font-weight:700}
.seg[aria-pressed="true"]{border-style:solid}
.seg[data-r="must"][aria-pressed="true"]{background:var(--ink);border-color:var(--ink);color:var(--surface)}
.seg[data-r="want"][aria-pressed="true"]{border-color:var(--ink);color:var(--ink)}
.seg[data-r="maybe"][aria-pressed="true"]{background:var(--sunken);border-color:var(--line);color:var(--muted)}

/* --- タイル（案2） --- */
.tiles{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.tile{border:1px solid var(--line);border-top:3px solid var(--venue);border-radius:9px;
  background:var(--surface);padding:8px 9px;cursor:pointer;text-align:left;
  font:inherit;color:var(--ink);position:relative;min-height:62px}
.tile[aria-pressed="true"]{background:var(--ink);color:var(--surface);border-color:var(--ink)}
.tile .nm{font-size:.78rem;font-weight:700;line-height:1.3}
.tile .mt{font-size:.66rem;color:var(--subtle);font-variant-numeric:tabular-nums;margin-top:2px}
.tile[aria-pressed="true"] .mt{color:var(--surface);opacity:.7}
.star{position:absolute;top:4px;right:4px;border:0;background:none;cursor:pointer;
  font-size:.75rem;line-height:1;padding:3px;color:var(--subtle)}
.star[aria-pressed="true"]{color:var(--ink)}
.tile[aria-pressed="true"] .star{color:var(--surface);opacity:.55}
.tile[aria-pressed="true"] .star[aria-pressed="true"]{opacity:1}

/* --- ステップ（案1） --- */
.steps{display:flex;gap:4px;margin-bottom:12px}
.steps span{flex:1;height:3px;border-radius:2px;background:var(--line)}
.steps span.on{background:var(--ink)}
.stepttl{font-size:1rem;font-weight:800;margin:0 0 2px}
.stepsub{font-size:.76rem;color:var(--subtle);margin:0 0 12px}

/* --- カード送り（案5） --- */
.deck{display:flex;flex-direction:column;gap:10px;align-items:center;padding-top:6px}
.card{width:100%;border:1px solid var(--line);border-top:4px solid var(--venue);
  border-radius:14px;background:var(--surface);box-shadow:var(--shadow);padding:16px 15px}
.card .cn{font-size:1.02rem;font-weight:800;line-height:1.3}
.card .cm{font-size:.78rem;color:var(--subtle);margin-top:4px;font-variant-numeric:tabular-nums}
.card .cs{margin-top:10px;font-size:.72rem;color:var(--muted);font-variant-numeric:tabular-nums;
  display:flex;flex-wrap:wrap;gap:4px}
.card .cs i{font-style:normal;border:1px solid var(--line);border-radius:5px;padding:1px 6px}
.deck .acts{display:grid;grid-template-columns:1fr 1fr;gap:6px;width:100%}
.deck .acts button{padding:11px 6px;border-radius:9px;cursor:pointer;border:1px solid var(--line);
  background:var(--surface);color:var(--ink);font:inherit;font-size:.83rem;font-weight:700}
.deck .acts .prim{background:var(--ink);border-color:var(--ink);color:var(--surface)}
.deck .prog{font-size:.72rem;color:var(--subtle);font-variant-numeric:tabular-nums}

/* --- 時間割から選ぶ（案4） --- */
.gwrap{overflow-x:auto;border:1px solid var(--line);border-radius:9px;background:var(--surface)}
.g{display:grid;position:relative}
.gax{position:sticky;left:0;z-index:3;background:var(--surface);border-right:1px solid var(--line);width:40px}
.gax .h{height:var(--hh);border-bottom:1px solid var(--line)}
.gt{position:absolute;left:0;width:40px;font-family:var(--font-num);font-size:.62rem;
  color:var(--subtle);padding-left:4px;transform:translateY(-.55em);background:var(--surface);z-index:2}
.gc{border-right:1px solid var(--line-soft);position:relative}
.gch{height:var(--hh);border-bottom:1px solid var(--line);border-top:3px solid var(--venue);
  padding:4px 4px 0;font-size:.58rem;line-height:1.2;color:var(--ink);overflow:hidden;font-weight:700}
.gl{position:absolute;left:0;right:0;border-top:1px solid var(--line-soft)}
.gb{position:absolute;left:2px;right:2px;border-radius:4px;cursor:pointer;border:1px solid transparent;
  padding:1px 3px;overflow:hidden;font-family:var(--font-num);font-size:.56rem;line-height:1.2;
  text-align:left;z-index:1}
.gb.off{background:color-mix(in srgb,var(--venue) calc(var(--ghost)*100%),transparent);
  color:var(--subtle);border-color:color-mix(in srgb,var(--venue) 32%,transparent)}
.gb.on{background:var(--venue);color:var(--onblk);border-color:var(--venue);font-weight:700}
.gb.bad{animation:shake .3s}
@keyframes shake{25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}

/* --- 完成した予定（全案で共通） --- */
.sum{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline;background:var(--surface);
  border:1px solid var(--line);border-radius:9px;padding:8px 11px;margin-bottom:9px;
  font-size:.76rem;font-variant-numeric:tabular-nums}
.sum b{font-size:.92rem}
.sum .sp{margin-left:auto;color:var(--subtle)}
.mineWrap{background:var(--surface);border:1px solid var(--line);border-radius:9px;padding:11px 12px}
.mine{position:relative;margin-left:42px}
.mine .tk{position:absolute;left:-42px;width:38px;text-align:right;font-family:var(--font-num);
  font-size:.64rem;color:var(--subtle);transform:translateY(-.55em)}
.mine .hr{position:absolute;left:-3px;right:0;border-top:1px solid var(--line-soft)}
.mine .b{position:absolute;left:0;right:0;border-radius:6px;padding:4px 8px;
  background:var(--venue);color:var(--onblk);overflow:hidden}
.mine .b .bt{font-weight:700;font-size:.76rem;line-height:1.25;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mine .b .bv{font-size:.63rem;opacity:.85;font-family:var(--font-num)}
.mine .b .x{position:absolute;top:2px;right:4px;border:0;background:none;cursor:pointer;
  color:var(--onblk);opacity:.75;font-size:.85rem;line-height:1;padding:2px 4px}
.mine .fr{position:absolute;left:0;right:0;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:3px;font-size:.65rem;color:var(--subtle)}
.mine .fr .cw{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;padding:0 2px}
.chip{border:1px dashed var(--venue);background:var(--surface);color:var(--ink);border-radius:999px;
  padding:2px 8px;cursor:pointer;font:inherit;font-size:.65rem;font-variant-numeric:tabular-nums}
.chip::before{content:"＋";color:var(--venue);font-weight:700;margin-right:3px}
.empty{font-size:.78rem;color:var(--subtle);text-align:center;padding:30px 10px}

.verdict{margin-top:22px;background:var(--sunken);border:1px solid var(--line);
  border-radius:var(--radius);padding:14px 15px;font-size:.85rem}
.verdict h3{margin:0 0 6px;font-size:.7rem;letter-spacing:.13em;color:var(--subtle);font-weight:700}
.verdict p{margin:0 0 8px}
.verdict p:last-child{margin-bottom:0}
.foot{margin-top:20px;color:var(--subtle);font-size:.73rem;text-align:center}
@media (prefers-reduced-motion:reduce){*{animation:none!important;scroll-behavior:auto!important}}
`;

const APP = `
const { SHOWS, VENUES, findPlans, toMinutes } = window.__E;
const DAY = ${JSON.stringify(DAY)};
const DAY_LABEL = ${JSON.stringify(DAY_LABEL)};
const BUFFER = ${BUFFER};

const dayShows = SHOWS.map(s => ({ ...s,
  slots: s.slots.filter(x => x.day === DAY)
    .map(x => ({ ...x, a: toMinutes(x.start), b: toMinutes(x.end) }))
    .sort((p, q) => p.a - q.a) })).filter(s => s.slots.length);
const byId = new Map(dayShows.map(s => [s.id, s]));
const VENUE_ORDER = ["hallHigh", "room2f", "hall2f"];

const K = (id, st) => id + "@" + st;
const unK = k => { const [id, start] = k.split("@"); return { id, start }; };
const yen = n => "¥" + n.toLocaleString("ja-JP");
const hhmm = m => String(Math.floor(m/60)).padStart(2,"0") + ":" + String(m%60).padStart(2,"0");
const vcol = v => "var(--v-" + v + ")";
function el(tag, cls, txt) { const e = document.createElement(tag);
  if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

/* 5案で共有する状態。案を切り替えても作業が消えないようにする。 */
const S = { picked: new Set(), ranks: {}, step: 1, cursor: 0 };
let design = "d1";

const items = () => [...S.picked].map(k => {
  const { id, start } = unK(k); const show = byId.get(id);
  return { key: k, show, slot: show.slots.find(s => s.start === start) };
}).sort((x, y) => x.slot.a - y.slot.a);

function canAdd(show, slot) {
  if ([...S.picked].some(k => unK(k).id === show.id)) return false;
  return items().every(it => slot.a - it.slot.b >= BUFFER || it.slot.a - slot.b >= BUFFER);
}
const add = (show, slot) => { S.picked.add(K(show.id, slot.start)); render(); };

/** ranks からプランを組んで picked に反映する（案1・案2・案3が使う）。 */
function runPlanner() {
  const { plans } = findPlans(SHOWS, S.ranks, { day: DAY, bufferMin: BUFFER });
  S.picked = new Set((plans[0]?.items ?? []).map(i => K(i.showId, i.start)));
}

/** その公演を今の予定に足せる最初の枠。 */
const firstFit = show => show.slots.find(s => canAdd(show, s)) ?? null;

const money = list => {
  let per = 0, grp = 0;
  for (const it of list) (it.show.unit === "group" ? (grp += it.show.price) : (per += it.show.price));
  return [per && yen(per) + "/人", grp && yen(grp) + "/回"].filter(Boolean).join(" ＋ ") || "—";
};

/* ---------- 共通: 完成した予定 ---------- */
const PPM = 1.1;
function planView(host, { chips = true } = {}) {
  const list = items();
  if (!list.length) {
    host.appendChild(el("div", "empty", "まだ予定がありません。公演を選ぶとここに出ます。"));
    return;
  }
  let idle = 0;
  list.forEach((it, i) => { if (i) idle += it.slot.a - list[i-1].slot.b; });

  const sum = el("div", "sum");
  sum.appendChild(el("b", null, list.length + "公演"));
  sum.appendChild(el("span", null, "あき計 " + idle + "分"));
  sum.appendChild(el("span", null, money(list)));
  sum.appendChild(el("span", "sp", list[0].slot.start + "〜" + list[list.length-1].slot.end));
  host.appendChild(sum);

  const from = Math.floor(list[0].slot.a / 30) * 30;
  const to = Math.ceil(list[list.length-1].slot.b / 30) * 30;
  const wrap = el("div", "mineWrap");
  const box = el("div", "mine");
  box.style.height = (to - from) * PPM + "px";

  for (let m = from; m <= to; m += 60) {
    const t = el("div", "tk", hhmm(m)); t.style.top = (m - from) * PPM + "px"; box.appendChild(t);
    const h = el("div", "hr"); h.style.top = (m - from) * PPM + "px"; box.appendChild(h);
  }

  list.forEach((it, i) => {
    const b = el("div", "b");
    b.style.setProperty("--venue", vcol(it.show.venue));
    b.style.top = (it.slot.a - from) * PPM + "px";
    b.style.height = ((it.slot.b - it.slot.a) * PPM - 3) + "px";
    const x = el("button", "x", "×");
    x.setAttribute("aria-label", it.show.title + " をはずす");
    x.onclick = e => { e.stopPropagation(); S.picked.delete(it.key); render(); };
    b.appendChild(x);
    b.appendChild(el("div", "bt", it.show.title));
    b.appendChild(el("div", "bv", it.slot.start + "–" + it.slot.end + " ・ " + VENUES[it.show.venue].label));
    box.appendChild(b);

    const next = list[i+1];
    if (!next) return;
    const gapMin = next.slot.a - it.slot.b;
    const fr = el("div", "fr");
    fr.style.top = (it.slot.b - from) * PPM + "px";
    fr.style.height = gapMin * PPM + "px";
    fr.appendChild(el("span", null, gapMin + "分あき"));
    if (chips && gapMin >= 45) {
      const lo = it.slot.b + BUFFER, hi = next.slot.a - BUFFER;
      const cw = el("div", "cw");
      let n = 0;
      for (const s of dayShows) {
        if (n >= 3) break;
        if ([...S.picked].some(k => unK(k).id === s.id)) continue;
        const slot = s.slots.find(x => x.a >= lo && x.b <= hi);
        if (!slot) continue;
        const c = el("button", "chip", s.title + " " + slot.start);
        c.style.setProperty("--venue", vcol(s.venue));
        c.onclick = () => add(s, slot);
        cw.appendChild(c); n++;
      }
      if (n) fr.appendChild(cw);
    }
    box.appendChild(fr);
  });

  wrap.appendChild(box);
  host.appendChild(wrap);
}

/* ---------- 共通: 公演の1行（優先度3段階） ---------- */
function rankRow(show) {
  const r = el("div", "r");
  r.style.setProperty("--venue", vcol(show.venue));
  const txt = el("div", "txt");
  txt.appendChild(el("div", "nm", show.title));
  txt.appendChild(el("div", "mt", show.durationMin + "分 ・ " + yen(show.price)
    + " ・ " + show.slots.length + "回"));
  r.appendChild(txt);
  const segs = el("div", "segs");
  for (const [rk, lb] of [["must","必須"],["want","希望"],["maybe","予備"]]) {
    const b = el("button", "seg", lb);
    b.dataset.r = rk;
    b.setAttribute("aria-pressed", String(S.ranks[show.id] === rk));
    b.setAttribute("aria-label", show.title + " を" + lb + "にする");
    b.onclick = () => {
      S.ranks[show.id] === rk ? delete S.ranks[show.id] : (S.ranks[show.id] = rk);
      render();
    };
    segs.appendChild(b);
  }
  r.appendChild(segs);
  return r;
}

function venueGroups(host, make) {
  for (const v of VENUE_ORDER) {
    const list = dayShows.filter(s => s.venue === v);
    if (!list.length) continue;
    host.appendChild(el("h3", "blk", VENUES[v].label));
    const box = el("div", make === tile ? "tiles" : "rows");
    for (const s of list) box.appendChild(make(s));
    host.appendChild(box);
  }
}

/* =========================================================
   案1  段階送り
   ========================================================= */
function d1(phone) {
  const scr = el("div", "screen hasbar");
  const steps = el("div", "steps");
  for (let i = 1; i <= 3; i++) {
    const s = el("span"); if (i <= S.step) s.className = "on"; steps.appendChild(s);
  }
  scr.appendChild(steps);

  const bar = el("div", "bar");
  const n = Object.keys(S.ranks).length;

  if (S.step === 1) {
    scr.appendChild(el("h2", "stepttl", "見たい公演を選ぶ"));
    scr.appendChild(el("p", "stepsub", DAY_LABEL + "　優先度を付けた公演だけが対象になります"));
    venueGroups(scr, rankRow);
    const c = el("div", "cnt"); c.appendChild(el("b", null, n + "公演"));
    c.append("選択中"); bar.appendChild(c);
    const go = el("button", "go", "条件へ");
    go.disabled = n === 0;
    go.onclick = () => { S.step = 2; render(); };
    bar.appendChild(go);
  } else if (S.step === 2) {
    scr.appendChild(el("h2", "stepttl", "条件を決める"));
    scr.appendChild(el("p", "stepsub", "移動と受付にどれだけ余裕を見るか"));
    const box = el("div", "rows");
    for (const min of [5, 10, 15, 20, 30]) {
      const b = el("button", "r");
      b.style.setProperty("--venue", "var(--line)");
      b.style.cursor = "pointer";
      const t = el("div", "txt");
      t.appendChild(el("div", "nm", min + "分あける"));
      t.appendChild(el("div", "mt", min <= 5 ? "詰め込み重視" : min >= 20 ? "余裕重視" : "ふつう"));
      b.appendChild(t);
      b.appendChild(el("div", "mt", BUFFER === min ? "選択中" : ""));
      b.onclick = () => { S.step = 3; runPlanner(); render(); };
      box.appendChild(b);
    }
    scr.appendChild(box);
    const back = el("button", "go sub", "戻る");
    back.onclick = () => { S.step = 1; render(); };
    bar.appendChild(back);
  } else {
    scr.appendChild(el("h2", "stepttl", "できあがり"));
    scr.appendChild(el("p", "stepsub", DAY_LABEL + "　あきをタップすると足せます"));
    planView(scr);
    const back = el("button", "go sub", "選び直す");
    back.onclick = () => { S.step = 1; render(); };
    bar.appendChild(back);
    const sv = el("button", "go", "保存する");
    bar.appendChild(sv);
  }
  phone.append(scr, bar);
}

/* =========================================================
   案2  上下2ペイン（即時反映）
   ========================================================= */
function tile(show) {
  const t = el("button", "tile");
  t.style.setProperty("--venue", vcol(show.venue));
  const on = S.ranks[show.id] != null;
  t.setAttribute("aria-pressed", String(on));
  const st = el("button", "star", "★");
  st.setAttribute("aria-pressed", String(S.ranks[show.id] === "must"));
  st.setAttribute("aria-label", show.title + " を必須にする");
  st.onclick = e => {
    e.stopPropagation();
    S.ranks[show.id] = S.ranks[show.id] === "must" ? "want" : "must";
    runPlanner(); render();
  };
  t.appendChild(st);
  t.appendChild(el("div", "nm", show.title));
  t.appendChild(el("div", "mt", show.durationMin + "分 ・ " + yen(show.price)));
  t.onclick = () => {
    on ? delete S.ranks[show.id] : (S.ranks[show.id] = "want");
    runPlanner(); render();
  };
  return t;
}

function d2(phone) {
  const scr = el("div", "screen");
  scr.style.display = "flex";
  scr.style.flexDirection = "column";
  scr.style.padding = "0";

  const top = el("div");
  top.style.cssText = "flex:0 0 46%;overflow-y:auto;padding:12px 12px 10px;"
    + "border-bottom:1px solid var(--line)";
  top.appendChild(el("p", "stepsub", "タップで選ぶ／★で必須。選んだ瞬間に下が組み直されます"));
  venueGroups(top, tile);

  const bot = el("div");
  bot.style.cssText = "flex:1 1 auto;overflow-y:auto;padding:11px 12px 14px;background:var(--sunken)";
  planView(bot);

  scr.append(top, bot);
  phone.appendChild(scr);
}

/* =========================================================
   案3  1行リスト＋固定バー
   ========================================================= */
function d3(phone) {
  const scr = el("div", "screen hasbar");
  const list = items();
  if (list.length) {
    scr.appendChild(el("h3", "blk", "いまの予定"));
    planView(scr);
  }
  scr.appendChild(el("h3", "blk", "見たい公演を選ぶ"));
  venueGroups(scr, rankRow);

  const bar = el("div", "bar");
  const n = Object.keys(S.ranks).length;
  const c = el("div", "cnt");
  c.appendChild(el("b", null, n + "公演"));
  c.append("に優先度");
  bar.appendChild(c);
  const go = el("button", "go", "プランを作る");
  go.disabled = n === 0;
  go.onclick = () => { runPlanner(); render();
    setTimeout(() => phone.querySelector(".screen").scrollTo({ top: 0 }), 0); };
  bar.appendChild(go);
  phone.append(scr, bar);
}

/* =========================================================
   案4  時間割から直接選ぶ
   ========================================================= */
const GPPM = 1.1, GH = 40;
function d4(phone) {
  const scr = el("div", "screen");
  scr.appendChild(el("p", "stepsub", "枠を直接タップして予定にします。ぶつかる枠は入りません"));

  const all = dayShows.flatMap(s => s.slots);
  const from = Math.floor(Math.min(...all.map(s => s.a)) / 30) * 30;
  const to = Math.ceil(Math.max(...all.map(s => s.b)) / 30) * 30;

  const wrap = el("div", "gwrap");
  const g = el("div", "g");
  g.style.setProperty("--hh", GH + "px");
  g.style.gridTemplateColumns = "40px repeat(" + dayShows.length + ", 74px)";
  const bodyH = (to - from) * GPPM;

  const ax = el("div", "gax");
  ax.style.height = (GH + bodyH) + "px";
  ax.appendChild(el("div", "h"));
  for (let m = from; m <= to; m += 60) {
    const t = el("div", "gt", hhmm(m));
    t.style.top = (GH + (m - from) * GPPM) + "px";
    ax.appendChild(t);
  }
  g.appendChild(ax);

  for (const show of dayShows) {
    const col = el("div", "gc");
    col.style.setProperty("--venue", vcol(show.venue));
    col.style.height = (GH + bodyH) + "px";
    col.appendChild(el("div", "gch", show.title));
    for (let m = from; m <= to; m += 60) {
      const l = el("div", "gl"); l.style.top = (GH + (m - from) * GPPM) + "px"; col.appendChild(l);
    }
    for (const slot of show.slots) {
      const on = S.picked.has(K(show.id, slot.start));
      const b = el("button", "gb " + (on ? "on" : "off"), slot.start);
      b.style.top = (GH + (slot.a - from) * GPPM) + "px";
      b.style.height = ((slot.b - slot.a) * GPPM - 2) + "px";
      b.setAttribute("aria-label", show.title + " " + slot.start + "から" + slot.end);
      b.onclick = () => {
        if (on) { S.picked.delete(K(show.id, slot.start)); render(); return; }
        if (!canAdd(show, slot)) {
          b.classList.add("bad"); setTimeout(() => b.classList.remove("bad"), 320); return;
        }
        add(show, slot);
      };
      col.appendChild(b);
    }
    g.appendChild(col);
  }
  wrap.appendChild(g);
  scr.appendChild(wrap);
  scr.appendChild(el("h3", "blk", "いまの予定"));
  planView(scr, { chips: false });
  phone.appendChild(scr);
}

/* =========================================================
   案5  1件ずつ捌く
   ========================================================= */
function d5(phone) {
  const scr = el("div", "screen");
  const queue = dayShows.filter(s => ![...S.picked].some(k => unK(k).id === s.id));

  if (S.cursor < queue.length) {
    const show = queue[S.cursor];
    const fit = firstFit(show);
    const deck = el("div", "deck");
    deck.appendChild(el("div", "prog", (S.cursor + 1) + " / " + queue.length + "件目"));

    const card = el("div", "card");
    card.style.setProperty("--venue", vcol(show.venue));
    card.appendChild(el("div", "cn", show.title));
    card.appendChild(el("div", "cm", VENUES[show.venue].label + " ・ " + show.durationMin
      + "分 ・ " + show.people + " ・ " + yen(show.price)));
    const cs = el("div", "cs");
    cs.append(fit ? "いま入れるなら " : "いまは入る回がありません");
    for (const s of show.slots.slice(0, 6)) {
      const i = el("i", null, s.start);
      if (!canAdd(show, s)) i.style.opacity = ".35";
      cs.appendChild(i);
    }
    card.appendChild(cs);
    deck.appendChild(card);

    const acts = el("div", "acts");
    const skip = el("button", null, "見ない");
    skip.onclick = () => { S.cursor++; render(); };
    const take = el("button", "prim", fit ? "入れる（" + fit.start + "）" : "入れられない");
    take.disabled = !fit;
    take.onclick = () => { S.picked.add(K(show.id, fit.start)); S.cursor = 0; render(); };
    acts.append(skip, take);
    deck.appendChild(acts);
    scr.appendChild(deck);
  } else {
    scr.appendChild(el("h2", "stepttl", "ひととおり見ました"));
    scr.appendChild(el("p", "stepsub", "はずすとまた候補に戻ります"));
  }

  scr.appendChild(el("h3", "blk", "いまの予定"));
  planView(scr, { chips: false });
  phone.appendChild(scr);
}

/* ---------- 描画 ---------- */
const DESIGNS = {
  d1: { n: "案1", t: "段階送り", r: d1,
    aim: "<b>1画面に1つの仕事だけ置く。</b>「選ぶ→条件→できあがり」を順に進む。今なにをすればいいか迷わない。",
    to: "画面を行ったり来たりしにくい。選び直しに戻る手間がある。" },
  d2: { n: "案2", t: "上下2ペイン", r: d2,
    aim: "<b>選んだ瞬間に下の予定が組み直る。</b>「プランを作る」ボタンがない。試し打ちの回転が一番速い。",
    to: "上下それぞれが狭い。公演一覧はタイル2列まで削る必要がある。" },
  d3: { n: "案3", t: "1行＋固定バー", r: d3,
    aim: "<b>いまの形を圧縮したもの。</b>公演を1行にして縦を半分に、実行ボタンを画面下に固定した。",
    to: "情報は詰まるが、操作の流れ自体は今と変わらない。" },
  d4: { n: "案4", t: "時間割から選ぶ", r: d4,
    aim: "<b>元の表そのものを操作盤にする。</b>枠を直接タップして予定にする。時間の把握と選択が同時。",
    to: "自動で組む機能が消える。組み合わせ探しは自分でやることになる。" },
  d5: { n: "案5", t: "1件ずつ捌く", r: d5,
    aim: "<b>12公演を1枚ずつ出して「入れる／見ない」だけ答える。</b>入る回は自動で選ばれる。考える量が最小。",
    to: "全体像が見えない。優先度の概念がなく、後から順番を変えにくい。" },
};

function render() {
  const host = document.getElementById("stage");
  const phone = el("div", "phone");
  DESIGNS[design].r(phone);
  host.replaceChildren(phone);
  document.getElementById("aim").innerHTML = DESIGNS[design].aim;
  document.getElementById("tradeoff").textContent = "引き換えに: " + DESIGNS[design].to;
}

const picker = document.getElementById("picker");
for (const [id, dd] of Object.entries(DESIGNS)) {
  const b = el("button");
  b.appendChild(el("b", null, dd.n));
  b.append(dd.t);
  b.setAttribute("aria-selected", String(id === design));
  b.onclick = () => {
    design = id; S.step = 1; S.cursor = 0;
    for (const o of picker.children) o.setAttribute("aria-selected", String(o === b));
    render();
  };
  picker.appendChild(b);
}

// 最初から少し入っている状態にする（空の画面では比べにくいため）
S.ranks = { otose: "must", gobousei: "want", destrain: "want", "timer-castle": "maybe" };
runPlanner();
render();
`;

const html = `<title>全体UIの方向性 5案 — algoフェス2026 はしごプランナー</title>
<style>${CSS}</style>

<div class="wrap">
  <header class="hero">
    <h1>全体UIの方向性　5案</h1>
    <p>見た目の違いではなく<strong>操作モデルの違い</strong>で分けています。予定は5案で共有しているので、案を切り替えても作業は消えません。実データ・${DAY_LABEL}・移動の余裕${BUFFER}分。</p>
  </header>

  <div class="picker" id="picker" role="tablist"></div>
  <p class="aim" id="aim"></p>
  <p class="tradeoff" id="tradeoff"></p>

  <div id="stage"></div>

  <div class="verdict">
    <h3>おすすめ</h3>
    <p><strong>案2（上下2ペイン）を推します。</strong>判断基準は「1回の試行にかかる手数」です。このツールは一発で決まるものではなく、あれを入れたらこれが落ちる、を何度も試すもの。案2だけが「プランを作る」を押す手数と、結果を見に行くスクロールの両方をゼロにしています。</p>
    <p>次点は<strong>案3</strong>。今の作りからの変更が一番小さく、確実に良くなります。案1は初めて使う人には親切ですが、2回目以降は遠回りになります。</p>
    <p>案4は自動で組む機能が消えるので、このツールの一番おいしいところを捨てることになります。案5は考える量が最小ですが、優先度が持てず「必須が入らないから組み直す」ができません。</p>
  </div>

  <p class="foot">比較用のプロトタイプです。公演データは公式タイムスケジュールの実データ。</p>
</div>

<script>
${engine}
</script>
<script>
${APP}
</script>
`;

writeFileSync(join(here, "ui-directions.html"), html);
console.log(`design/proposals/ui-directions.html （${(Buffer.byteLength(html) / 1024).toFixed(1)}KB）`);
