// shows.js / planner.js / ui.js を index.html に埋め込んで、自己完結の1枚を吐く。
//
//   dist/index.html    ローカルのブラウザで確認する用（<html> ごと入っている完全なHTML）
//   dist/artifact.html Artifact に渡す用（骨組みは公開時に付くので中身だけ）
//   docs/index.html    GitHub Pages で配る用。非公式であることの断りを足したもの
//
// Artifact は CSP で外部リクエストを全部止めるので、公開物に <script src> は残せない。
//
// 人に配るものには断りが要る。時間割は公式の画像から書き写したもので、
// 満席かどうかも反映できない。見た人が公演を逃さないよう、公式へ戻す導線を必ず付ける。

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { toPlainScript, bundle as makeBundle } from "./tools/inline.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(root, name), "utf8");

const SOURCES = ["shows.js", "show-images.js", "planner.js", "storage.js", "ui.js"];

const bundle = makeBundle(SOURCES.map((name) => ({ name, code: toPlainScript(read(name)) })));

const html = read("index.html");

const withInlineScript = html.replace(
  /<script type="module" src="ui\.js"><\/script>/,
  () => `<script>\n${bundle}\n</script>`,
);
if (withInlineScript === html) {
  throw new Error("index.html の <script type=\"module\" src=\"ui.js\"> が見つかりません");
}

// Artifact 用: <title> + <style> + <body> の中身だけを取り出す
const title = /<title>([\s\S]*?)<\/title>/.exec(withInlineScript);
const style = /<style>[\s\S]*?<\/style>/.exec(withInlineScript);
const body = /<body>([\s\S]*?)<\/body>/.exec(withInlineScript);
if (!title || !style || !body) throw new Error("index.html から title/style/body を取り出せません");

const artifact = [`<title>${title[1]}</title>`, style[0], body[1].trim()].join("\n");

// 配る用。非公式であることと、最新は公式で確かめてほしいことを本文に置く
const NOTICE = `<footer class="notice">
  <p><b>非公式のファンツールです。</b>早稲田大学謎解き企画algo および ESCAPE.ID とは関係ありません。</p>
  <p>時間割は公式のタイムテーブルから書き写したもので、間違いが残っているかもしれません。
  <b>満席かどうかは反映されません。</b>予約と最新の情報は
  <a href="https://escape.id/fes/algo-fes-2026/" target="_blank" rel="noopener noreferrer">escape.id の公式ページ</a>
  で確かめてください。</p>
</footer>`;

const NOTICE_CSS = `
.notice{max-width:480px;margin:0 auto;padding:12px 14px 22px;border-top:1px solid var(--line);
  font-size:.71rem;line-height:1.6;color:var(--subtle);background:var(--bg)}
.notice p{margin:0 0 5px}
.notice b{color:var(--muted)}
.notice a{color:var(--muted)}
</style>`;

const shared = withInlineScript
  // 断りを読ませるぶん、画面の高さいっぱいに広げるのをやめる
  .replace(".shell{max-width:480px;margin:0 auto;height:100dvh;", ".shell{max-width:480px;margin:0 auto;height:min(100dvh,760px);")
  .replace("</style>", NOTICE_CSS)
  .replace("</body>", `${NOTICE}\n</body>`);
if (!shared.includes("notice")) throw new Error("配布用の断りを差し込めませんでした");

mkdirSync(join(root, "dist"), { recursive: true });
mkdirSync(join(root, "docs"), { recursive: true });
writeFileSync(join(root, "dist/index.html"), withInlineScript);
writeFileSync(join(root, "dist/artifact.html"), artifact);
writeFileSync(join(root, "docs/index.html"), shared);

const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)}KB`;
console.log(`dist/index.html    ${kb(withInlineScript)}`);
console.log(`dist/artifact.html ${kb(artifact)}`);
console.log(`docs/index.html    ${kb(shared)}  ← GitHub Pages で配る用`);
