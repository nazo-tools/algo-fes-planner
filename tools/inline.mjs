// ES モジュールを <script> にそのまま貼れる形へ落とす。
// 本体のビルドと、design/proposals のプロトタイプの両方から使う。

/** import 文を落とし、export キーワードを外す。 */
export function toPlainScript(code) {
  return code
    .replace(/^import\s+[\s\S]*?from\s+["'][^"']+["'];?[ \t]*$/gm, "")
    .replace(/^export\s+/gm, "")
    .trim();
}

/** 連結したときにトップレベルの名前がぶつかっていないか確かめる。 */
export function assertNoDuplicateNames(parts) {
  const seen = new Map();
  const pattern = /^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm;
  for (const { name, code } of parts) {
    for (const m of code.matchAll(pattern)) {
      const id = m[1];
      if (seen.has(id)) {
        throw new Error(`トップレベルの名前が重複しています: "${id}" (${seen.get(id)} と ${name})`);
      }
      seen.set(id, name);
    }
  }
}

/** 複数のモジュールを1つの IIFE にまとめる。 */
export function bundle(parts) {
  assertNoDuplicateNames(parts);
  return [
    "(function () {",
    '"use strict";',
    ...parts.map(({ name, code }) => `\n/* ===== ${name} ===== */\n${code}`),
    "})();",
  ].join("\n");
}
