// 画面。ロジックは planner.js、データは shows.js。ここは描画と操作だけ。
//
// 導線は上下2ペイン。
//   上 = 「1 押さえる → 2 埋める」の二段階
//   下 = 土日ぶんの自分の予定
// 主役は手動。自分で参加する回まで選んで置く。プランナーは残った空きを埋める役に回る。

import { SHOWS, VENUES, FES } from "./shows.js";
import { SHOW_IMAGES } from "./show-images.js";
import {
  suggestFills,
  placementOptions,
  rescueSuggestions,
  toMinutes,
  festivalNow,
  nowNext,
} from "./planner.js";
import { loadState, saveState, encodePlan, decodePlan } from "./storage.js";

const BUFFER = 10;
/** 空けておく時間の名前。ここに無いものは「用事」で足りる、という想定 */
const BREAK_LABELS = ["休憩", "ごはん", "移動", "用事"];
const ALL_DAYS = FES.days.map((d) => d.id);
const DAY_LABEL = Object.fromEntries(FES.days.map((d) => [d.id, d.label + "(" + d.weekday + ")"]));
const VENUE_ORDER = ["hallHigh", "room2f", "hall2f"];

const yen = (n) => "¥" + n.toLocaleString("ja-JP");
const hhmm = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const vcol = (v) => "var(--v-" + v + ")";
const byId = new Map(SHOWS.map((s) => [s.id, s]));

function el(t, c, x) {
  const e = document.createElement(t);
  if (c) e.className = c;
  if (x != null) e.textContent = x;
  return e;
}

/** 公演のキービジュアル。data URI で同梱してあるので、圏外でも出る。 */
function thumb(show, cls) {
  const img = el("img", "th " + cls);
  img.src = SHOW_IMAGES[show.id];
  img.alt = "";
  return img;
}

/* ---------------- 時刻の入力 ---------------- */
// OS の time 入力は端末ごとに見た目も操作も違うので使わない。
// フェスの開催時間だけを、時→分の2タップで選ばせる。

const PICK_MIN_STEP = 5;

/**
 * 押すと下に時と分が開く時刻ボタン。
 * key はどのボタンが開いているかを覚えるための識別子。
 */
function timeField(key, value, onChange, opts = {}) {
  const wrap = el("div", "tf");

  const btn = el("button", "tfb" + (value ? "" : " empty"));
  btn.append(value || opts.placeholder || "指定なし");
  btn.setAttribute("aria-expanded", String(S.picker === key));
  btn.setAttribute("aria-label", (opts.label ?? "時刻") + (value ? " " + value : " 未指定"));
  btn.onclick = () => {
    S.picker = S.picker === key ? null : key;
    render();
  };
  wrap.appendChild(btn);

  if (value && opts.clearable) {
    const c = el("button", "tfx", "×");
    c.setAttribute("aria-label", (opts.label ?? "時刻") + " の指定をやめる");
    c.onclick = () => {
      S.picker = null;
      onChange("");
    };
    wrap.appendChild(c);
  }

  if (S.picker !== key) return wrap;

  const cur = value ? toMinutes(value) : null;
  const h0 = Math.floor(T0 / 60);
  const h1 = Math.floor((T1 - 1) / 60);

  const pop = el("div", "tfp");
  const hr = el("div", "tfr");
  for (let h = h0; h <= h1; h++) {
    const b = el("button", null, String(h));
    b.setAttribute("aria-pressed", String(cur !== null && Math.floor(cur / 60) === h));
    b.onclick = () => {
      onChange(hhmm(h * 60 + (cur === null ? 0 : cur % 60)));
    };
    hr.appendChild(b);
  }
  pop.append(el("div", "tfl", "時"), hr);

  const mr = el("div", "tfr min");
  for (let m = 0; m < 60; m += PICK_MIN_STEP) {
    const b = el("button", null, String(m).padStart(2, "0"));
    b.setAttribute("aria-pressed", String(cur !== null && cur % 60 === m));
    b.onclick = () => {
      const h = cur === null ? h0 : Math.floor(cur / 60);
      S.picker = null;
      onChange(hhmm(h * 60 + m));
    };
    mr.appendChild(b);
  }
  pop.append(el("div", "tfl", "分"), mr);

  wrap.appendChild(pop);
  return wrap;
}

/* fixed が予定の唯一の状態。置いた公演も休憩も同じ形で持つ。 */
const S = {
  fixed: [],
  phase: 1,
  open: null,
  justAdded: new Set(),
  favorites: new Set(),
  windows: {},
  onlyFav: false,
  going: new Set(ALL_DAYS), // 参加する日
  picker: null, // 開いている時刻ボタン
  intro: true, // 使い方を出しているか
  clearing: false, // 全部はずすの確認中か
  brk: { day: ALL_DAYS[0], start: "12:30", end: "13:30", label: BREAK_LABELS[0] },
  mode: "make", // つくる / みる
  viewDay: "auto", // みる で出す日。auto は会期中なら今日、ふだんは両日
  topOpen: true, // つくる のとき、上の一覧をひらいているか
  brkOpen: false, // 「空けておく」をひらいているか
  shareOpen: false, // 共有のURLを出しているか
  copied: false,
  shared: false, // 人からもらった予定を見ているか（この間は保存しない）
  mine: null, // もらった予定を見ている間、自分の予定を預かっておく
};

/** 共有まわりで使う、今のデータの形。 */
const PCTX = { shows: SHOWS, days: ALL_DAYS, labels: BREAK_LABELS };

/* 前に立てた予定を読み戻す。当日に開き直して消えていたら困る。 */
const store = (() => {
  try {
    return window.localStorage;
  } catch {
    return null; // ブラウザの設定で使えないことがある
  }
})();

if (store) {
  const saved = loadState(store, { shows: SHOWS, days: ALL_DAYS });
  if (saved) {
    S.fixed = saved.fixed;
    S.favorites = new Set(saved.favorites);
    S.going = new Set(saved.going);
    S.windows = saved.windows;
    S.onlyFav = saved.onlyFav;
    S.intro = !saved.introDone;
  }
}

// URLに予定が乗っていたら、それを見せる。ただし相手の予定で自分の保存を
// 上書きはしない。取り込むと言われるまでは、預かったまま表示だけ差し替える。
function takeShared() {
  const m = /[#&]p=([^&]+)/.exec(location.hash);
  const plan = m ? decodePlan(decodeURIComponent(m[1]), PCTX) : [];
  if (!plan.length) return false;
  if (!S.shared) S.mine = S.fixed; // 預かるのは最初の一度だけ
  S.fixed = plan;
  S.shared = true;
  S.intro = false;
  return true;
}

takeShared();

const dropHash = () => history.replaceState(null, "", location.pathname + location.search);

function shareUrl() {
  const p = encodePlan(S.fixed, PCTX);
  return location.origin + location.pathname + (p ? "#p=" + p : "");
}

const winOf = (day) => S.windows[day] ?? { from: "", to: "" };
const DAYS = () => ALL_DAYS.filter((d) => S.going.has(d));

/**
 * 板に出す日。つくる のときは常に両日（片方だけ見ながら組むと、
 * もう片方に回せる、が見えなくなる）。みる のときだけ片日に絞れる。
 * 会期中に みる を開いたら、何も選ばなくても今日だけにする。
 */
function viewDays() {
  const all = DAYS();
  if (S.mode !== "view" || all.length < 2) return all;
  const v = S.viewDay === "auto" ? festivalNow(new Date(), FES)?.day ?? null : S.viewDay;
  return v && all.includes(v) ? [v] : all;
}

const placedIds = () => new Set(S.fixed.filter((f) => f.showId).map((f) => f.showId));
const onDay = (day) =>
  S.fixed
    .filter((f) => f.day === day)
    .map((f) => ({ ...f, a: toMinutes(f.start), b: toMinutes(f.end) }))
    .sort((x, y) => x.a - y.a);

const optionsIndex = () =>
  new Map(
    placementOptions(SHOWS, S.fixed, { days: DAYS(), bufferMin: BUFFER }).map((p) => [
      p.showId,
      p.options,
    ]),
  );

/* 全日の時間軸をそろえる */
const ALL = SHOWS.flatMap((s) => s.slots.map((x) => [toMinutes(x.start), toMinutes(x.end)]));
const T0 = Math.floor(Math.min(...ALL.map((x) => x[0])) / 60) * 60;
const T1 = Math.ceil(Math.max(...ALL.map((x) => x[1])) / 60) * 60;
const PPM = 1.02;

/* ---------------- 上ペイン: 段階1 押さえる ---------------- */
function phase1(host) {
  const bar = el("div", "setbar");

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
        S.fixed = S.fixed.filter((f) => f.day !== d); // 行かない日の予定は落とす
      } else {
        S.going.add(d);
      }
      render();
    };
    go.appendChild(b);
  }
  bar.appendChild(go);
  host.appendChild(bar);

  host.appendChild(
    el("p", "hint", "公演をひらいて回を選ぶと、その回で確定します。★は「埋める」で先に入ります。"),
  );

  // お気に入りが入らなくなったら、入れ替え案を出す
  for (const r of rescueSuggestions(SHOWS, S.fixed, [...S.favorites], {
    days: DAYS(),
    bufferMin: BUFFER,
  })) {
    const box = el("div", "rescue");
    box.appendChild(el("b", null, "★" + r.title + " が入らなくなりました"));
    if (!r.swaps.length) {
      box.append("どの予定を動かしても入りません。どれかをはずしてください。");
    } else {
      box.append("こう入れ替えると入ります:");
      for (const s of r.swaps) {
        const b = el(
          "button",
          null,
          s.title +
            " を " +
            DAY_LABEL[s.to.day] +
            " " +
            s.to.start +
            " に移す（" +
            r.title +
            " は " +
            DAY_LABEL[s.thenAt.day] +
            " " +
            s.thenAt.start +
            "）",
        );
        b.onclick = () => {
          const t = S.fixed.find(
            (f) => f.showId === s.showId && f.day === s.from.day && f.start === s.from.start,
          );
          if (t) {
            t.day = s.to.day;
            t.start = s.to.start;
            t.end = s.to.end;
          }
          S.fixed.push({ day: s.thenAt.day, start: s.thenAt.start, end: s.thenAt.end, showId: r.showId });
          S.justAdded.add(r.showId);
          render();
        };
        box.appendChild(b);
      }
    }
    host.appendChild(box);
  }

  host.appendChild(breakPanel());

  const opts = optionsIndex();
  const placed = placedIds();

  for (const v of VENUE_ORDER) {
    const list = SHOWS.filter((s) => s.venue === v);
    if (!list.length) continue;
    host.appendChild(el("div", "vh", VENUES[v].label));
    const box = el("div", "slist");
    for (const show of list) box.appendChild(showRow(show, opts, placed));
    host.appendChild(box);
  }
}

/**
 * 入れてほしくない時間を先に取っておく。
 * ごはんも移動も用事も、押さえた予定と同じ扱いにすれば埋める側が勝手に避ける。
 */
function breakPanel() {
  const box = el("div", "brk" + (S.brkOpen ? " open" : ""));

  // 毎回使うものではないので、畳んでおいて一覧に場所を譲る
  const head = el("button", "brkh");
  head.setAttribute("aria-expanded", String(S.brkOpen));
  head.append(el("span", "sign", S.brkOpen ? "−" : "＋"), "この時間は空けておく");
  head.onclick = () => {
    S.brkOpen = !S.brkOpen;
    S.picker = null;
    render();
  };
  box.appendChild(head);
  if (!S.brkOpen) return box;

  const days = DAYS();
  if (!days.includes(S.brk.day)) S.brk.day = days[0];

  if (days.length > 1) {
    const row = el("div", "brkrow");
    const seg = el("div", "seg");
    for (const d of days) {
      const b = el("button", null, DAY_LABEL[d]);
      b.setAttribute("aria-pressed", String(S.brk.day === d));
      b.onclick = () => {
        S.brk.day = d;
        render();
      };
      seg.appendChild(b);
    }
    row.appendChild(seg);
    box.appendChild(row);
  }

  // 「午後ぜんぶ」もありうるので、長さを選ばせるのではなく終わりの時刻を選ばせる。
  // どちらを動かしても start < end は崩さない。相手を追い出す形で守る
  const trow = el("div", "brkrow times");
  trow.appendChild(
    timeField("brk-a", S.brk.start, (v) => {
      if (!v) return;
      S.brk.start = v;
      if (toMinutes(S.brk.end) <= toMinutes(v)) {
        S.brk.end = hhmm(Math.min(toMinutes(v) + 60, T1));
      }
      render();
    }, { label: "空ける時間の始まり" }),
  );
  trow.appendChild(el("span", "tfsep", "〜"));
  trow.appendChild(
    timeField("brk-b", S.brk.end, (v) => {
      if (!v) return;
      S.brk.end = v;
      if (toMinutes(v) <= toMinutes(S.brk.start)) {
        S.brk.start = hhmm(Math.max(toMinutes(v) - 60, T0));
      }
      render();
    }, { label: "空ける時間の終わり" }),
  );
  box.appendChild(trow);

  const labrow = el("div", "seg lab");
  for (const t of BREAK_LABELS) {
    const b = el("button", null, t);
    b.setAttribute("aria-pressed", String(S.brk.label === t));
    b.onclick = () => {
      S.brk.label = t;
      render();
    };
    labrow.appendChild(b);
  }
  box.appendChild(labrow);

  const a = toMinutes(S.brk.start);
  const b = toMinutes(S.brk.end);
  // 予定に重ねて置けてしまうと、あきの合計がマイナスになる。ぴったり隣は許す
  const hit = onDay(S.brk.day).find((f) => a < f.b && f.a < b);

  const put = el(
    "button",
    "btn",
    hit
      ? (hit.showId ? byId.get(hit.showId).title : hit.label) + " と重なります"
      : DAY_LABEL[S.brk.day] + " " + S.brk.start + "–" + S.brk.end + " を" + S.brk.label + "で空ける",
  );
  put.disabled = Boolean(hit);
  put.onclick = () => {
    S.fixed.push({ day: S.brk.day, start: hhmm(a), end: hhmm(b), label: S.brk.label });
    S.picker = null;
    render();
  };
  box.appendChild(put);
  return box;
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
  title.appendChild(thumb(show, "sm"));

  const txt = el("div", "stxt");
  const line1 = el("div", "nmline");
  if (done) line1.appendChild(el("span", "tick", "✓"));
  line1.appendChild(el("span", "nm", show.title));
  txt.appendChild(line1);

  const left = opts.get(show.id)?.length ?? 0;
  const meta = el("div", "meta");
  meta.appendChild(el("span", null, show.durationMin + "分"));
  meta.appendChild(el("span", null, show.people));
  meta.appendChild(el("span", null, yen(show.price) + (show.unit === "group" ? "/回" : "")));
  if (done) meta.appendChild(el("span", "okq", "参加する"));
  else if (left === 0) meta.appendChild(el("span", "warnq", "入らない"));
  else if (left <= 2) meta.appendChild(el("span", "warnq", "残り" + left));
  txt.appendChild(meta);
  title.appendChild(txt);

  title.onclick = () => {
    S.open = S.open === show.id ? null : show.id;
    render();
  };
  head.appendChild(title);
  row.appendChild(head);

  if (S.open !== show.id) return row;

  const box = el("div", "slots");

  const link = el("a", "slink", "escape.id で詳細・予約");
  link.href = show.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  if (done) {
    const cur = S.fixed.find((f) => f.showId === show.id);
    box.appendChild(el("div", "dl", DAY_LABEL[cur.day] + " " + cur.start + "–" + cur.end + " で参加"));
    const off = el("button", "btn sub", "やめる");
    off.onclick = () => {
      S.fixed = S.fixed.filter((f) => f.showId !== show.id);
      S.justAdded.delete(show.id);
      render();
    };
    box.appendChild(off);
    box.appendChild(link);
    row.appendChild(box);
    return row;
  }

  if (show.priceNote) box.appendChild(el("div", "dl", show.priceNote));

  const ok = new Set((opts.get(show.id) ?? []).map((o) => o.day + o.start));
  for (const day of DAYS()) {
    const slots = show.slots.filter((s) => s.day === day);
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
        S.open = null;
        render();
      };
      sc.appendChild(b);
    }
    box.appendChild(sc);
  }
  box.appendChild(link);
  row.appendChild(box);
  return row;
}

/* ---------------- 上ペイン: 段階2 埋める ---------------- */
function phase2(host) {
  // 公演がひとつも無くても、空けた時間だけ置いて全部おまかせ、は成り立つ
  if (S.fixed.length === 0) {
    host.appendChild(
      el("p", "hint", "まず「押さえる」で参加する回を置くか、空けておきたい時間を決めてください。ここは残りを埋める段階です。"),
    );
    return;
  }

  host.appendChild(
    el("p", "hint", "置いた予定は動かしません。土日どちらも見たうえで、待ち時間が短くなるように詰めます。"),
  );

  // 日ごとの時間帯。入れてほしい時間の範囲を絞る
  for (const day of DAYS()) {
    const w = winOf(day);
    const set = (k) => (v) => {
      S.windows[day] = { ...w, [k]: v };
      render();
    };
    const r = el("div", "winrow");
    r.appendChild(el("span", "lbl", DAY_LABEL[day]));
    r.appendChild(
      timeField("w-" + day + "-from", w.from, set("from"), {
        label: DAY_LABEL[day] + " これ以降に入れる",
        placeholder: "はじめから",
        clearable: true,
      }),
    );
    r.appendChild(el("span", "tilde", "〜"));
    r.appendChild(
      timeField("w-" + day + "-to", w.to, set("to"), {
        label: DAY_LABEL[day] + " これ以前に終える",
        placeholder: "おわりまで",
        clearable: true,
      }),
    );
    host.appendChild(r);
  }

  const favOnly = el("label", "favonly");
  const cb = el("input");
  cb.type = "checkbox";
  cb.checked = S.onlyFav;
  cb.onchange = () => {
    S.onlyFav = cb.checked;
    render();
  };
  favOnly.append(cb, "★を付けた公演だけを入れる");
  host.appendChild(favOnly);

  const res = suggestFills(SHOWS, S.fixed, {
    days: DAYS(),
    bufferMin: BUFFER,
    favoriteIds: [...S.favorites],
    onlyFavorites: S.onlyFav,
    windows: S.windows,
  });
  const favIn = res.added.filter((a) => S.favorites.has(a.showId)).length;

  const bar = el("div", "restbar");
  const go = el(
    "button",
    "btn",
    res.added.length
      ? "おまかせで " + res.added.length + "公演 入れる" + (favIn ? "（★" + favIn + "）" : "")
      : "もう入りません",
  );
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
    host.appendChild(
      el(
        "p",
        "hint",
        "入れたあとのあき合計: " +
          DAYS()
            .map((d) => DAY_LABEL[d] + " " + (res.idleByDay[d] ?? 0) + "分")
            .join(" / "),
      ),
    );
  }

  const opts = optionsIndex();
  let any = false;
  for (const day of DAYS()) {
    for (const g of gapsOf(day)) {
      const cands = [];
      for (const [id, list] of opts) {
        const hit = list.find((o) => o.day === day && o.startMin >= g.a && o.endMin <= g.b);
        if (hit) cands.push({ id, hit, left: list.length });
      }
      if (!cands.length) continue;
      any = true;
      const c = el("div", "gapc");
      c.appendChild(el("div", "gt", DAY_LABEL[day] + "　" + hhmm(g.a) + "〜" + hhmm(g.b)));
      c.appendChild(el("div", "gs", g.b - g.a + "分あいています"));
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
          S.justAdded.add(cd.id);
          render();
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
/* ---------------- 当日 ---------------- */
// 当日、会場で見るのは全体図ではなく「次に何をするか」だけ。
// 端末の時計が会期の中に入っている間だけ、板の一番上に出す。

/** 分を読める長さにする。 */
function dur(m) {
  if (m < 60) return m + "分";
  const h = Math.floor(m / 60);
  return h + "時間" + (m % 60 ? (m % 60) + "分" : "");
}

/** 予定1件を「15:40 タイトル」と「会場」に開く。 */
function itemText(f) {
  const show = f.showId ? byId.get(f.showId) : null;
  return {
    title: show ? show.title : f.label ?? "空けた時間",
    where: show ? VENUES[show.venue].label : "",
    venue: show ? show.venue : null,
  };
}

function nowRow(kind, label, f, tail) {
  const t = itemText(f);
  const row = el("div", "nrow " + kind);
  if (t.venue) row.style.setProperty("--venue", vcol(t.venue));
  const head = el("div", "nh");
  head.appendChild(el("span", "nk", label));
  head.appendChild(el("span", "nt", t.title));
  row.appendChild(head);

  // 残り時間は題名の横に置くと、狭い画面で題名が削られる。下の行に逃がす
  const sub = el("div", "nsub");
  sub.appendChild(el("span", null, [f.start + "–" + f.end, t.where].filter(Boolean).join(" ／ ")));
  if (tail) sub.appendChild(el("span", "nx", tail));
  row.appendChild(sub);
  return row;
}

function nowPanel(host, now) {
  if (!S.fixed.length) return;

  // 会期外は、当日ここに何が出るのかだけ見せておく
  if (!now) {
    const first = S.fixed
      .slice()
      .sort((a, b) => (a.day + a.start).localeCompare(b.day + b.start))[0];
    const box = el("div", "now pre");
    box.appendChild(el("div", "npre", "当日はここに次の予定が出ます"));
    box.appendChild(nowRow("nxt", DAY_LABEL[first.day], first, null));
    host.appendChild(box);
    return;
  }

  const r = nowNext(S.fixed, now);
  const box = el("div", "now");

  if (r.current) box.appendChild(nowRow("cur", "いま", r.current, "残り" + dur(r.leftOfCurrent)));
  if (r.next) box.appendChild(nowRow("nxt", "次", r.next, "あと" + dur(r.untilNext)));

  if (!r.current && !r.next) {
    box.appendChild(el("div", "nend", r.done.length ? "今日はこれで終わり。おつかれさま" : "今日の予定はありません"));
  } else if (r.later.length) {
    box.appendChild(el("div", "nfoot", "このあと " + r.later.length + "件"));
  }

  host.appendChild(box);
}

/* ---------------- 共有 ---------------- */

/** もらった予定を見ているあいだの断り。取り込むまでは自分の予定に触らない。 */
function sharedBar(host) {
  const bar = el("div", "shbar");
  bar.appendChild(
    el("b", null, "送られてきた予定です（" + S.fixed.length + "件）"),
  );
  bar.appendChild(
    el("span", "q", "まだ保存していません。取り込むと、いま自分が立てている予定は置き換わります。"),
  );

  const take = el("button", "clr armed", "自分の予定にする");
  take.onclick = () => {
    S.shared = false;
    S.mine = null;
    dropHash();
    render();
  };
  const back = el("button", "clr", "見るだけ（元に戻す）");
  back.onclick = () => {
    S.fixed = S.mine ?? [];
    S.shared = false;
    S.mine = null;
    dropHash();
    render();
  };
  bar.append(take, back);
  host.appendChild(bar);
}

/** 自分の予定を渡す。URLに畳んであるので、貼れればどこでも渡る。 */
function sharePanel(host) {
  const box = el("div", "share");
  const url = shareUrl();

  const inp = el("input", "surl");
  inp.value = url;
  inp.readOnly = true;
  inp.setAttribute("aria-label", "この予定のURL");
  inp.onfocus = () => inp.select();
  box.appendChild(inp);

  const cp = el("button", "clr" + (S.copied ? " armed" : ""), S.copied ? "コピーしました" : "コピー");
  cp.onclick = () => {
    const done = () => {
      S.copied = true;
      render();
    };
    // クリップボードは使えないことがある。そのときは選ばせる
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(done, () => inp.select());
    } else {
      inp.select();
    }
  };
  box.appendChild(cp);

  box.appendChild(
    el("p", "fine", "開いた人には、この予定が「送られてきた予定」として出ます。その人が今立てている予定は、取り込むと言うまで消えません。"),
  );
  host.appendChild(box);
}

function board(host) {
  if (S.shared) sharedBar(host);

  if (S.mode === "view" && !S.fixed.length) {
    const b = el("div", "vacant");
    b.appendChild(el("b", null, "まだ予定がありません"));
    const go = el("button", "btn", "つくる にもどる");
    go.onclick = () => {
      S.mode = "make";
      render();
    };
    b.appendChild(go);
    host.appendChild(b);
    return;
  }

  const now = festivalNow(new Date(), FES);
  nowPanel(host, now);

  const days = viewDays();

  // 片日だけ出しているときは、合計もその日のぶんだけにする
  const list = S.fixed
    .filter((f) => f.showId && days.includes(f.day))
    .map((f) => byId.get(f.showId));
  let per = 0;
  let grp = 0;
  for (const s of list) (s.unit === "group" ? (grp += s.price) : (per += s.price));
  const money = [per && yen(per) + "/人", grp && yen(grp) + "/回"].filter(Boolean).join(" ＋ ") || "—";

  const tot = el("div", "tot");
  tot.appendChild(el("b", null, list.length + "公演"));
  for (const d of days) {
    const evs = onDay(d);
    let idle = 0;
    for (let i = 1; i < evs.length; i++) idle += evs[i].a - evs[i - 1].b;
    tot.appendChild(
      el("span", null, DAY_LABEL[d] + " " + evs.filter((f) => f.showId).length + "（あき" + idle + "分）"),
    );
  }
  tot.appendChild(el("span", "sp", money));
  host.appendChild(tot);

  // 当日は片方しか行かない。みる のときだけ、日で絞れるようにする
  if (S.mode === "view" && DAYS().length > 1) {
    const seg = el("div", "seg vday");
    const shown = days.length > 1 ? null : days[0];
    for (const [key, label] of [[null, "両日"], ...DAYS().map((d) => [d, DAY_LABEL[d]])]) {
      const b = el("button", null, label);
      b.setAttribute("aria-pressed", String(shown === key));
      b.onclick = () => {
        S.viewDay = key;
        render();
      };
      seg.appendChild(b);
    }
    host.appendChild(seg);
  }

  // 全部はずす。取り返しがつかないので、押した先で一度止める
  if (S.fixed.length) {
    const bar = el("div", "clrbar");
    if (!S.clearing) {
      const b = el("button", "clr", "全部はずす");
      b.onclick = () => {
        S.clearing = true;
        render();
      };
      bar.appendChild(b);

      const sh = el("button", "clr", S.shareOpen ? "とじる" : "この予定を送る");
      sh.setAttribute("aria-expanded", String(S.shareOpen));
      sh.onclick = () => {
        S.shareOpen = !S.shareOpen;
        S.copied = false;
        render();
      };
      bar.appendChild(sh);
    } else {
      bar.appendChild(el("span", "q", S.fixed.length + "件の予定を全部はずします。★は残ります。"));
      const yes = el("button", "clr armed", "はずす");
      yes.onclick = () => {
        S.fixed = [];
        S.justAdded.clear();
        S.open = null;
        S.clearing = false;
        render();
      };
      const no = el("button", "clr", "やめる");
      no.onclick = () => {
        S.clearing = false;
        render();
      };
      bar.append(yes, no);
    }
    host.appendChild(bar);
    if (S.shareOpen && !S.clearing) sharePanel(host);
  }

  const grid = el("div", "board");
  // 出す日の数だけ列を引く。1日だけなら幅が倍になって題名が読める
  grid.style.gridTemplateColumns = "32px " + "1fr ".repeat(days.length).trim();
  grid.appendChild(el("div", "dh ax", "."));
  for (const d of days) grid.appendChild(el("div", "dh", DAY_LABEL[d]));

  const H = (T1 - T0) * PPM;
  const ax = el("div", "axc");
  ax.style.height = H + "px";
  for (let m = T0; m <= T1; m += 60) {
    const t = el("div", "tk", hhmm(m));
    t.style.top = (m - T0) * PPM + "px";
    ax.appendChild(t);
  }
  grid.appendChild(ax);

  for (const day of days) {
    const col = el("div", "daycol");
    col.style.height = H + "px";
    for (let m = T0; m <= T1; m += 60) {
      const h = el("div", "hr");
      h.style.top = (m - T0) * PPM + "px";
      col.appendChild(h);
    }
    const evs = onDay(day);
    if (!evs.length) col.appendChild(el("div", "emptyday", "まだ予定なし"));
    for (const f of evs) {
      const show = f.showId ? byId.get(f.showId) : null;
      // 終わったものは薄くする。当日、残りだけを目で拾えるように
      const past = now && (day < now.day || (day === now.day && f.b <= now.min));
      const e = el(
        "div",
        "ev" + (show ? "" : " rest") + (past ? " past" : "") +
          (show && S.justAdded.has(show.id) ? " new" : ""),
      );
      if (show) e.style.setProperty("--venue", vcol(show.venue));
      e.style.top = (f.a - T0) * PPM + "px";
      e.style.height = (f.b - f.a) * PPM - 2 + "px";
      const x = el("button", "x", "×");
      x.setAttribute("aria-label", (show ? show.title : f.label ?? "空けた時間") + " をはずす");
      x.onclick = () => {
        S.fixed = S.fixed.filter(
          (g) => !(g.day === f.day && g.start === f.start && g.showId === f.showId && g.label === f.label),
        );
        render();
      };
      e.appendChild(x);
      // 絵は文字の上に重ねない。横に並べて、文字の場所を絵に譲る
      if (show && (f.b - f.a) * PPM >= 44) e.appendChild(thumb(show, "xs"));
      const txt = el("div", "evt");
      txt.appendChild(el("div", "et", show ? show.title : f.label ?? "休憩"));
      txt.appendChild(el("div", "ee", f.start + "–" + f.end));
      e.appendChild(txt);
      col.appendChild(e);
    }
    grid.appendChild(col);
  }
  host.appendChild(grid);
}

/* ---------------- 使い方 ---------------- */
// 二段階の導線は、言われないと伝わらない。最初に一度だけ出して、
// 閉じたあとは見出しの「使い方」からいつでも戻せるようにする。
function intro() {
  const box = el("div", "intro");
  box.appendChild(el("h2", null, "2段階で組みます"));

  const ol = el("ol");
  for (const [n, ttl, body] of [
    [
      "1",
      "押さえる",
      "これだけは外せない公演を、参加する回まで自分で選んで置きます。ごはんや移動、用事で埋めたくない時間も、ここで先に空けておきます。",
    ],
    [
      "2",
      "埋める",
      "残った空き時間に入る公演を出します。押さえた予定は動かしません。土日どちらも同時に見て、待ち時間が短くなる入れ方を選びます。",
    ],
  ]) {
    const li = el("li");
    li.appendChild(el("span", "no", n));
    const d = el("div");
    d.appendChild(el("b", null, ttl));
    d.appendChild(el("p", null, body));
    li.appendChild(d);
    ol.appendChild(li);
  }
  box.appendChild(ol);

  box.appendChild(
    el("p", "fine", "★を付けた公演は「埋める」で優先して入ります。入らなくなったときは入れ替え方を出します。"),
  );

  const ok = el("button", "btn", "はじめる");
  ok.onclick = () => {
    S.intro = false;
    render();
  };
  box.appendChild(ok);
  return box;
}

/* ---------------- 描画 ---------------- */
let renderedPhase = null;

const modeBtn = { make: document.getElementById("m-make"), view: document.getElementById("m-view") };
for (const [m, b] of Object.entries(modeBtn)) {
  b.onclick = () => {
    S.mode = m;
    S.picker = null;
    render();
  };
}

function render() {
  const host = document.getElementById("app");
  // 描き直しで一覧の位置が戻ってしまうと、回を選ぶだけで迷子になる。
  // ただし段階を切り替えたときは中身が別物なので、頭から見せる。
  const keep = renderedPhase === S.phase ? host.querySelector(".topbody")?.scrollTop ?? 0 : 0;
  renderedPhase = S.phase;

  for (const [m, b] of Object.entries(modeBtn)) b.setAttribute("aria-pressed", String(S.mode === m));

  if (S.intro) {
    host.replaceChildren(intro());
    return;
  }

  // みる: 作る道具を全部しまって、でき上がった予定表だけにする
  if (S.mode === "view") {
    const only = el("div", "bot only");
    board(only);
    host.replaceChildren(only);
    if (store && !S.shared) saveState(store, S);
    return;
  }

  const top = el("div", "top" + (S.topOpen ? "" : " folded"));
  const ph = el("div", "phases");
  for (const [n, ttl, sub] of [
    [1, "押さえる", "STEP 1"],
    [2, "埋める", "STEP 2"],
  ]) {
    const b = el("button");
    b.appendChild(el("b", null, sub));
    b.append(ttl);
    b.setAttribute("aria-selected", String(S.phase === n));
    b.onclick = () => {
      S.phase = n;
      S.open = null;
      S.topOpen = true; // 畳んだまま段階だけ変わっても何も起きない
      render();
    };
    ph.appendChild(b);
  }

  const body = el("div", "topbody");
  (S.phase === 1 ? phase1 : phase2)(body);

  // 動かすのは2つのペインの境目なので、つまみもそこに置く。
  // 畳めば、みるに移らなくてもその場で予定表が広がる
  const fold = el("button", "fold");
  fold.setAttribute("aria-expanded", String(S.topOpen));
  fold.setAttribute("aria-label", S.topOpen ? "一覧を畳んで予定表を広げる" : "一覧をひらく");
  fold.append(el("span", "grip"), el("span", "chev"), el("span", "grip"));
  fold.onclick = () => {
    S.topOpen = !S.topOpen;
    S.picker = null;
    render();
  };

  top.append(ph, body, fold);

  const bot = el("div", "bot");
  board(bot);

  host.replaceChildren(top, bot);
  host.querySelector(".topbody").scrollTop = keep;
  // もらった予定を見ているあいだは、自分の保存に手を出さない
  if (store && !S.shared) saveState(store, S);
}

document.getElementById("howto").onclick = () => {
  S.intro = true;
  render();
};

// 開いたままのタブで共有リンクを踏むと、読み込み直しは起きない
window.addEventListener("hashchange", () => {
  if (takeShared()) render();
});

// 当日は時計が進むぶんだけ表示が古くなる。分が変わったときだけ描き直す
let lastMin = -1;
setInterval(() => {
  const n = festivalNow(new Date(), FES);
  if (!n || n.min === lastMin || S.intro) return;
  lastMin = n.min;
  render();
}, 20000);

render();
