// 立てた予定の保存と読み戻し。
//
// 当日、電車の中で開き直したら予定が消えていた、が一番困る。
// ただし保存したデータのほうが古くなることはある（公演データを直したあとなど）ので、
// 読み戻すときは今のデータと突き合わせて、実在しないものは黙って捨てる。

import { toMinutes, toHHMM } from "./planner.js";

export const STORAGE_KEY = "algo-fes-planner/v1";

const isHHMM = (v) => typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v);

/** 保存する形に落とす。Set は配列にする。 */
export function encodeState(s) {
  return {
    v: 1,
    fixed: s.fixed,
    favorites: [...s.favorites],
    going: [...s.going],
    windows: s.windows,
    onlyFav: s.onlyFav,
    introDone: !s.intro,
  };
}

/**
 * 読み戻す。壊れていたり古かったりする前提で、通ったものだけを返す。
 * 何も残らなければ null（=初期状態で始める）。
 */
export function decodeState(raw, { shows, days }) {
  if (!raw || typeof raw !== "object" || raw.v !== 1) return null;

  const byId = new Map(shows.map((s) => [s.id, s]));
  const dayset = new Set(days);

  const going = Array.isArray(raw.going) ? raw.going.filter((d) => dayset.has(d)) : [];
  const goingSet = new Set(going.length ? going : days);

  const fixed = [];
  const seen = new Set();
  for (const f of Array.isArray(raw.fixed) ? raw.fixed : []) {
    if (!f || !goingSet.has(f.day) || !isHHMM(f.start) || !isHHMM(f.end)) continue;

    if (f.showId != null) {
      const show = byId.get(f.showId);
      if (!show) continue; // 消えた公演
      if (seen.has(f.showId)) continue; // 同じ公演を二重には持てない
      // 保存したあとで時間割が直っているかもしれない。実在する回だけ通す
      if (!show.slots.some((x) => x.day === f.day && x.start === f.start && x.end === f.end)) continue;
      seen.add(f.showId);
      fixed.push({ day: f.day, start: f.start, end: f.end, showId: f.showId });
    } else {
      if (f.start >= f.end) continue;
      fixed.push({ day: f.day, start: f.start, end: f.end, label: String(f.label ?? "休憩") });
    }
  }

  const windows = {};
  const w = raw.windows;
  if (w && typeof w === "object") {
    for (const d of goingSet) {
      const x = w[d];
      if (!x || typeof x !== "object") continue;
      const from = isHHMM(x.from) ? x.from : "";
      const to = isHHMM(x.to) ? x.to : "";
      if (from || to) windows[d] = { from, to };
    }
  }

  return {
    fixed,
    favorites: (Array.isArray(raw.favorites) ? raw.favorites : []).filter((id) => byId.has(id)),
    going: [...goingSet],
    windows,
    onlyFav: raw.onlyFav === true,
    introDone: raw.introDone === true,
  };
}

/** localStorage が使えない環境（プライベートモードなど）でも落とさない。 */
export function loadState(store, ctx) {
  try {
    return decodeState(JSON.parse(store.getItem(STORAGE_KEY)), ctx);
  } catch {
    return null;
  }
}

export function saveState(store, s) {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(encodeState(s)));
    return true;
  } catch {
    return false;
  }
}

/* ---------------- 共有 ---------------- */
//
// 立てた予定をURLに畳む。LINEに貼れる長さに収めたいので、
// 公演は「id と何回目か」、空けた時間は「日・開始・終了・名札の番号」だけを持つ。
// 名札は決まった4つからしか選べないので、番号にすれば日本語がURLに出ない。

/** 予定をURLの断片にする。何も無ければ空文字。 */
export function encodePlan(fixed, { shows, days, labels }) {
  const byId = new Map(shows.map((s) => [s.id, s]));
  const parts = [];

  for (const f of fixed) {
    if (f.showId != null) {
      const show = byId.get(f.showId);
      if (!show) continue;
      const d = days.indexOf(f.day);
      if (d < 0) continue;
      // 何回目か、ではなく何時からか、で持つ。時間割を直したときに
      // 黙って別の回にすり替わるより、その予定が落ちるほうがましなので
      if (!show.slots.some((x) => x.day === f.day && x.start === f.start)) continue;
      parts.push([f.showId, d, toMinutes(f.start)].join("."));
    } else {
      const d = days.indexOf(f.day);
      if (d < 0) continue;
      const li = labels.indexOf(f.label);
      parts.push("!" + [d, toMinutes(f.start), toMinutes(f.end), li < 0 ? 0 : li].join("."));
    }
  }

  return parts.length ? ["1", ...parts].join("~") : "";
}

/**
 * URLの断片を予定に戻す。
 * 人からもらうものなので、読めない部分は落として、通ったぶんだけ返す。
 */
export function decodePlan(str, { shows, days, labels }) {
  if (typeof str !== "string" || !str) return [];
  const parts = str.split("~");
  if (parts.shift() !== "1") return [];

  const byId = new Map(shows.map((s) => [s.id, s]));
  const out = [];
  const seen = new Set();

  for (const p of parts) {
    if (p.startsWith("!")) {
      const [d, a, b, li] = p.slice(1).split(".").map(Number);
      if (!days[d]) continue;
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b > 1440 || a >= b) continue;
      out.push({ day: days[d], start: toHHMM(a), end: toHHMM(b), label: labels[li] ?? labels[0] });
    } else {
      const seg = p.split(".");
      if (seg.length < 3) continue;
      const at = Number(seg.pop());
      const day = days[Number(seg.pop())];
      const id = seg.join(".");
      const show = byId.get(id);
      if (!show || !day || !Number.isInteger(at) || seen.has(id)) continue;
      const sl = show.slots.find((x) => x.day === day && toMinutes(x.start) === at);
      if (!sl) continue;
      seen.add(id);
      out.push({ day: sl.day, start: sl.start, end: sl.end, showId: id });
    }
  }

  return out;
}
