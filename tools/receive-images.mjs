// 公演のキービジュアルを受け取って shows-images.js に書き出す、使い捨ての受け口。
//
//   node tools/receive-images.mjs
//
// Artifact は外部リクエストを全部止めるので、画像は data URI で同梱するしかない。
// escape.id の画像は別オリジン(static.escape.id)にあって CORS が無いため、
// ブラウザ側を static.escape.id のオリジンに置いて縮小し、ここへ POST してもらう。
// 一度作れば用済み。作り直したいときだけ動かす。

import { createServer } from "node:http";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5199;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "POST,OPTIONS",
};

const server = createServer((req, res) => {
  if (req.method === "OPTIONS") return res.writeHead(204, CORS).end();
  if (req.method !== "POST") return res.writeHead(405, CORS).end();

  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    let images;
    try {
      images = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch (e) {
      res.writeHead(400, CORS).end(String(e));
      return;
    }

    const ids = Object.keys(images).sort();
    const bad = ids.filter((id) => !/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(images[id]));
    if (bad.length) {
      res.writeHead(400, CORS).end("data URI ではない値: " + bad.join(", "));
      return;
    }

    const body = ids.map((id) => `  ${JSON.stringify(id)}: ${JSON.stringify(images[id])},`).join("\n");
    const out = `// 公演のキービジュアル。escape.id の各公演ページの og:image を 96px 幅の WebP に縮めたもの。
// Artifact は外部リクエストを止めるので data URI で同梱する。
// 作り直すときは tools/receive-images.mjs を参照。手で編集しない。

export const SHOW_IMAGES = {
${body}
};
`;
    writeFileSync(join(root, "show-images.js"), out);
    const kb = (Buffer.byteLength(out) / 1024).toFixed(1);
    console.log(`show-images.js  ${ids.length}件  ${kb}KB`);
    res.writeHead(200, CORS).end(`ok ${ids.length} ${kb}KB`);
    server.close();
  });
});

server.listen(PORT, () => console.log(`待機中 http://localhost:${PORT}/`));
