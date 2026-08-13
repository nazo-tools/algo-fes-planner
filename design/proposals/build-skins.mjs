// 見た目とフォントの5案。
//
//   node design/proposals/build-skins.mjs → design/proposals/ui-skins.html
//
// 中身・画面幅・操作はすべて build-flow.mjs の承認済みプロトタイプと同一。
// 変えるのは色とタイポと形だけ。有利不利が出ないよう、5案とも同じ初期状態で動かす。
//
// 前提: 日本語のWebフォントはArtifactに埋め込めない（数MB、CSPで外部読み込みも不可）。
// 5案とも端末に入っている書体から選ぶ。差が出るのは「どの系統を優先するか」
// 「太さの使い方」「数字の書体」「大きさと字間」の4点。

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { engine, CSS, APP } from "./build-flow.mjs";

const here = dirname(fileURLToPath(import.meta.url));

// 各インスタンスが自分の #stageN に描くようにする。状態は関数スコープで分かれる。
let APP_FN = APP.replace(
  'const host = document.getElementById("stage");',
  "const host = document.getElementById(HOST_ID);",
);
if (APP_FN === APP) throw new Error("host の差し替えに失敗した（build-flow.mjs 側が変わった？）");

// 見た目を比べるページなので、空の盤面では判断できない。
// 3会場ぶんの色と休憩と★が同時に見える状態を初期値にする（下のアサーションで実在を確かめる）。
const DEMO = [
  { day: "09-12", start: "13:10", end: "15:00", showId: "genkai" },
  { day: "09-12", start: "15:10", end: "16:00", label: "休憩" },
  { day: "09-12", start: "16:35", end: "17:05", showId: "timer-castle" },
  { day: "09-12", start: "18:30", end: "19:30", showId: "change-challenge" },
  { day: "09-13", start: "10:00", end: "12:10", showId: "innocent-girl" },
  { day: "09-13", start: "12:30", end: "14:10", showId: "destrain" },
];
const DEMO_FAV = ["oitoke", "kuuki-yomi"];

{
  const { SHOWS } = await import("../../shows.js");
  const { toMinutes } = await import("../../planner.js");
  for (const f of DEMO) {
    if (!f.showId) continue;
    const s = SHOWS.find((x) => x.id === f.showId);
    if (!s) throw new Error(`デモの公演が見つからない: ${f.showId}`);
    if (!s.slots.some((x) => x.day === f.day && x.start === f.start && x.end === f.end))
      throw new Error(`デモの回が実在しない: ${f.showId} ${f.day} ${f.start}-${f.end}`);
  }
  for (const id of DEMO_FAV)
    if (!SHOWS.some((x) => x.id === id)) throw new Error(`デモのお気に入りが無い: ${id}`);
  const byDay = {};
  for (const f of DEMO) (byDay[f.day] ??= []).push(f);
  for (const [day, list] of Object.entries(byDay)) {
    list.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    for (let i = 1; i < list.length; i++) {
      const gap = toMinutes(list[i].start) - toMinutes(list[i - 1].end);
      if (gap < 10) throw new Error(`デモが詰まりすぎ: ${day} ${list[i].start} の前が ${gap}分`);
    }
  }
}

APP_FN = APP_FN.replace("fixed: [], phase: 1", `fixed: ${JSON.stringify(DEMO)}, phase: 1`).replace(
  "favorites: new Set()",
  `favorites: new Set(${JSON.stringify(DEMO_FAV)})`,
);
if (!APP_FN.includes("genkai") || !APP_FN.includes('"oitoke"'))
  throw new Error("デモ状態の差し込みに失敗した（build-flow.mjs 側の初期状態が変わった？）");

const SKINS = [
  {
    id: 1,
    name: "掲示板",
    aim: "会場の壁に貼ってある表そのもの。飾りを引いて、時刻だけがはっきり立つ。",
    type: "ヒラギノ角ゴ／数字は等幅",
    cost: "地味。楽しさや高揚感はまったく出ない。",
    tokens: `
      --bg:#f2f1ee; --surface:#fff; --sunken:#e8e7e3;
      --ink:#17181b; --muted:#55595f; --subtle:#868b91;
      --line:#d5d4cf; --line-soft:#e6e5e1;
      --v-hallHigh:#a8354c; --v-room2f:#0b6f68; --v-hall2f:#57409c;
      --onblk:#fff; --ghost:.14;
      --star:#b8790a; --warn-bg:#f4efe2; --warn-bd:#ded0ae; --warn-fg:#7d5300;
      --font-ui:"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Noto Sans JP",system-ui,sans-serif;
      --font-num:ui-monospace,"SF Mono",SFMono-Regular,"Cascadia Mono",Consolas,monospace;
      --shadow:none;`,
    rules: `
      .phone{border-radius:3px;box-shadow:none}
      .srow,.daycol,.gapc,.phases button,.btn,.godays button,.rescue{border-radius:2px}
      .sc button,.ev,.winrow input,.brk select,.brk input{border-radius:2px}
      .chip{border-radius:2px}
      .sc button{font-size:.73rem;letter-spacing:.01em}
      .ev .ee,.axc .tk{letter-spacing:.01em}
      .vh{letter-spacing:.16em}`,
  },
  {
    id: 2,
    name: "暗室",
    aim: "会場は暗い。眩しくない地の上で、会場の色だけがほのかに光る。",
    type: "ヒラギノ角ゴ／数字は等幅",
    cost: "ダーク一本の設計。明るい屋外では見えにくい。",
    tokens: `
      --bg:#101318; --surface:#171b21; --sunken:#1c2027;
      --ink:#e6e9ed; --muted:#9aa2ac; --subtle:#6e7783;
      --line:#2a3038; --line-soft:#232830;
      --v-hallHigh:#ff7d95; --v-room2f:#35d6c3; --v-hall2f:#b295ff;
      --onblk:#0c0f13; --ghost:.24;
      --star:#f0c04f; --warn-bg:#2d2617; --warn-bd:#45391f; --warn-fg:#e8bb6b;
      --font-ui:"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Noto Sans JP",system-ui,sans-serif;
      --font-num:ui-monospace,"SF Mono",SFMono-Regular,"Cascadia Mono",Consolas,monospace;
      --shadow:0 0 0 1px rgba(255,255,255,.03),0 8px 24px rgba(0,0,0,.55);`,
    rules: `
      .phone{border-radius:22px}
      .srow,.daycol,.gapc,.rescue{border-radius:11px}
      .ev{box-shadow:0 0 14px -5px var(--venue)}
      .phases button[aria-selected="true"]{background:var(--ink);color:#101318}
      .btn{background:var(--ink);color:#101318;border-color:var(--ink)}
      .btn.sub{background:transparent;color:var(--ink)}
      .godays button[aria-pressed="true"]{background:var(--ink);color:#101318}`,
  },
  {
    id: 3,
    name: "紙の栞",
    aim: "謎解きは本の側の遊び。見出しだけ明朝にして、しおりのような落ち着きを出す。",
    type: "見出し=明朝／本文=角ゴ／数字=Georgia",
    cost: "明朝が入っていない端末では角ゴに落ちて、案1とほぼ同じ見た目になる。字幅も広く、細い画面ではタイトルが少し切れる。",
    tokens: `
      --bg:#faf9f6; --surface:#fff; --sunken:#f0eeea;
      --ink:#1a1a1a; --muted:#56534e; --subtle:#8a867f;
      --line:#ddd9d1; --line-soft:#eae7e1;
      --v-hallHigh:#b0402f; --v-room2f:#1c5a6b; --v-hall2f:#6b4a8a;
      --onblk:#fff; --ghost:.13;
      --star:#a8801c; --warn-bg:#f5efe3; --warn-bd:#e0d3b6; --warn-fg:#7a5410;
      --font-ui:"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Noto Sans JP",system-ui,sans-serif;
      --font-disp:"Hiragino Mincho ProN","Yu Mincho",YuMincho,"Noto Serif JP","Times New Roman",serif;
      --font-num:Georgia,"Times New Roman","Hiragino Mincho ProN",serif;
      --shadow:0 1px 2px rgba(26,26,26,.05);`,
    rules: `
      .phone{border-radius:8px}
      .srow,.daycol,.gapc,.phases button,.btn,.rescue{border-radius:5px}
      .sc button,.ev{border-radius:4px}
      .shead .nm,.ev .et,.gapc .gt,.tot b{font-family:var(--font-disp);font-weight:600}
      .phases button{font-family:var(--font-disp);font-weight:600}
      .vh{font-family:var(--font-disp);font-weight:600;letter-spacing:.14em}
      .sc button,.chip,.axc .tk,.ev .ee{font-variant-numeric:tabular-nums lining-nums}`,
  },
  {
    id: 4,
    name: "フェスのポスター",
    aim: "公式のタイムテーブルと地続きに見せる。同じ祭りの持ち物だと一目でわかる。",
    type: "丸ゴシック／数字は幾何学サンセリフ",
    cost: "色数が多く、会場色と地の色が競る。時刻の読み取りは案1に劣る。",
    tokens: `
      --bg:#fdf3dc; --surface:#fffdf6; --sunken:#f6e9cc;
      --ink:#23201a; --muted:#6b6353; --subtle:#9a917d;
      --line:#e6d5ad; --line-soft:#efe3c6;
      --v-hallHigh:#e2456b; --v-room2f:#12a596; --v-hall2f:#7b4fe0;
      --onblk:#fffdf6; --ghost:.16;
      --star:#e08b12; --warn-bg:#fbe6c4; --warn-bd:#e8c898; --warn-fg:#8c5108;
      --font-ui:"Hiragino Maru Gothic ProN","Rounded Mplus 1c","Yu Gothic UI","Hiragino Sans",system-ui,sans-serif;
      --font-num:"Avenir Next",Futura,"Century Gothic","Segoe UI",system-ui,sans-serif;
      --shadow:0 2px 0 rgba(35,32,26,.07),0 8px 20px rgba(35,32,26,.06);`,
    rules: `
      .phone{border-radius:26px}
      .srow,.daycol,.gapc,.rescue{border-radius:14px}
      .phases button,.btn,.godays button{border-radius:999px}
      .sc button{border-radius:999px;padding:4px 10px}
      .ev{border-radius:9px}
      .shead .nm{font-weight:800}
      .phases button{font-weight:800;letter-spacing:.03em}
      .btn{font-weight:800}
      .sc button,.chip,.axc .tk,.ev .ee,.tot{font-variant-numeric:tabular-nums}`,
  },
  {
    id: 5,
    name: "大きく太く",
    aim: "歩きながら、急ぎながら見る前提。字を大きく、当たり判定を広く、色は最大コントラスト。",
    type: "BIZ UDPゴシック／数字も同じ",
    cost: "1画面に入る情報が減る。スクロールが増える。",
    tokens: `
      --bg:#fff; --surface:#fff; --sunken:#ededed;
      --ink:#000; --muted:#3d3d3d; --subtle:#5f5f5f;
      --line:#9a9a9a; --line-soft:#c8c8c8;
      --v-hallHigh:#b00030; --v-room2f:#00615a; --v-hall2f:#4b2ea8;
      --onblk:#fff; --ghost:.2;
      --star:#9a6a00; --warn-bg:#fdf0d2; --warn-bd:#c9a24a; --warn-fg:#6b4300;
      --font-ui:"BIZ UDPGothic","UD デジタル教科書体 NP-B","Yu Gothic UI","Hiragino Sans",system-ui,sans-serif;
      --font-num:"BIZ UDPGothic","Yu Gothic UI","Hiragino Sans",system-ui,sans-serif;
      --shadow:0 1px 3px rgba(0,0,0,.12);`,
    rules: `
      .phone{border-radius:10px}
      .srow,.daycol,.gapc,.phases button,.btn,.rescue{border-radius:6px}
      .srow{border-left-width:5px}
      .shead .nm{font-size:.93rem;font-weight:700}
      .fav{font-size:.95rem;padding:9px 3px 9px 9px}
      .stitle{padding:9px 9px 9px 6px}
      .sc button{font-size:.82rem;padding:6px 10px;font-weight:700}
      .chip{font-size:.79rem;padding:5px 11px;border-width:2px}
      .phases button{font-size:.86rem}
      .btn{font-size:.88rem;padding:12px 6px}
      .hint,.gapc .gt{font-size:.8rem}
      .gapc .gs,.dl,.vh,.shead .mt{font-size:.72rem}
      .tot{font-size:.79rem}
      .tot b{font-size:.96rem}
      .ev .et{font-size:.7rem}
      .ev .ee{font-size:.62rem}
      .axc .tk{font-size:.66rem}
      .sc button,.chip,.axc .tk,.ev .ee,.tot{font-variant-numeric:tabular-nums}`,
  },
];

const skinCSS = `
.swrap{max-width:1320px;margin:0 auto;padding:0 14px 48px}
.grid{display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(372px,1fr))}
.card{min-width:0}
.chead{margin:0 0 10px}
.chead h2{margin:0;font-size:1rem;font-weight:800;display:flex;align-items:baseline;gap:7px}
.chead h2 .n{font-family:var(--font-num);font-size:.72rem;color:var(--subtle);font-weight:700}
.chead p{margin:4px 0 0;font-size:.79rem;color:var(--muted);line-height:1.55}
.meta{margin:7px 0 0;display:flex;flex-direction:column;gap:3px;font-size:.73rem;color:var(--subtle)}
.meta b{color:var(--muted);font-weight:700}
.sw{display:flex;gap:4px;margin:8px 0 0;align-items:center}
.sw i{width:20px;height:20px;border-radius:4px;border:1px solid var(--line);display:block}

/* 案ごとに固まった見た目を見せるため、閲覧側のテーマに追従させない。
   採用案には端末のダーク設定に沿うダーク版を別途作る。 */
${SKINS.map((s) => `.skinhost[data-skin="${s.id}"]{${s.tokens.replace(/\s+/g, " ").trim()}}`).join("\n")}
${SKINS.map((s) =>
  s.rules
    .trim()
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (!t || t.startsWith("/*")) return "";
      const i = t.indexOf("{");
      const sels = t
        .slice(0, i)
        .split(",")
        .map((x) => `.skinhost[data-skin="${s.id}"] ${x.trim()}`)
        .join(",");
      return sels + t.slice(i);
    })
    .filter(Boolean)
    .join("\n"),
).join("\n")}

/* ベースCSSで直書きだった色をトークン化して差し替える。
   [data-skin] を噛ませて :root[data-theme] 側と詳細度を並べ、後勝ちにする。 */
.skinhost[data-skin] .fav[aria-pressed="true"]{color:var(--star)}
.skinhost[data-skin] .rescue{background:var(--warn-bg);border-color:var(--warn-bd);color:var(--warn-fg)}
.skinhost[data-skin] .warnq{color:var(--warn-fg)}
.skinhost[data-skin] .chip .lc{color:var(--warn-fg)}
.skinhost[data-skin] .phone{background:var(--bg);color:var(--ink);font-family:var(--font-ui)}
`;

const cards = SKINS.map(
  (s) => `
  <section class="card">
    <div class="chead">
      <h2><span class="n">案${s.id}</span>${s.name}</h2>
      <p>${s.aim}</p>
      <div class="meta">
        <span><b>書体</b> ${s.type}</span>
        <span><b>引き換え</b> ${s.cost}</span>
      </div>
      <div class="sw" aria-hidden="true">
        ${["--bg", "--surface", "--ink", "--v-hallHigh", "--v-room2f", "--v-hall2f"]
          .map((t) => `<i style="background:var(${t})"></i>`)
          .join("")}
      </div>
    </div>
    <div class="skinhost" data-skin="${s.id}">
      <div id="stage${s.id}"></div>
    </div>
  </section>`,
).join("\n");

const html = `<title>見た目とフォント 5案 — algoフェス2026 はしごプランナー</title>
<style>${CSS}${skinCSS}</style>

<div class="swrap">
  <header class="hero">
    <h1>見た目とフォント 5案</h1>
    <p>中身・画面幅・初期状態はすべて同じ。変えたのは色とタイポと形だけです。5案とも実データで動きます。</p>
  </header>

  <div class="note">
    <b>共通で決めていること</b>
    <ul>
      <li><b>色相＝会場</b>、<b>濃さ＝優先度</b>。会場を色で見分け、大事さは濃さで見分ける</li>
      <li><b>日本語のWebフォントは埋め込めない</b>（数MBあり、Artifactは外部読み込みも塞がれる）。5案とも端末に入っている書体を使う。差が出るのは <b>系統の優先順・太さの使い方・数字の書体・大きさと字間</b> の4点</li>
      <li>この見本では案ごとの見た目を固定表示にしています。採用案には端末のダーク設定に沿うダーク版を別途作ります（案2はダーク一本の設計）</li>
    </ul>
  </div>

  <div class="grid">
${cards}
  </div>

  <p class="foot">触って比べられます。気になった案の番号を教えてください。</p>
</div>

<script>
${engine}
</script>
<script>
function boot(HOST_ID){
${APP_FN}
}
${SKINS.map((s) => `boot("stage${s.id}");`).join("\n")}
</script>
`;

writeFileSync(join(here, "ui-skins.html"), html);
console.log(`design/proposals/ui-skins.html （${(Buffer.byteLength(html) / 1024).toFixed(1)}KB）`);
