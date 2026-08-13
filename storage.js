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
// 立てた予定をURLに畳む。区切り文字を使わず、桁数を決め打ちにして詰める。
//
//   公演      code(1) 日(1) 開始(2)             → 4文字   例 g0q4
//   空け時間  "-" 日(1) 開始(2) 終了(2) 名札(1) → 7文字   例 -0nwo81
//
// 時刻は分を36進で2桁。20:20 = 1220 = "xw" で収まる（36進2桁は1295まで）。
// 名札は決まった4つなので番号1桁。おかげで日本語がURLに出ない。
//
// 回は「何回目か」ではなく「何時からか」で持つ。時間割を直したときに
// 黙って別の回にすり替わるより、その予定が落ちるほうがましなので。

const PLAN_VERSION = "2";
const MAX36 = 36 * 36; // 36進2桁で表せる分数の上限

const b36 = (n) => n.toString(36).padStart(2, "0");
const un36 = (s) => (/^[0-9a-z]{2}$/.test(s) ? parseInt(s, 36) : NaN);

/** 予定をURLの断片にする。何も無ければ空文字。 */
export function encodePlan(fixed, { shows, days, labels }) {
  const byId = new Map(shows.map((s) => [s.id, s]));
  const parts = [];

  for (const f of fixed) {
    const d = days.indexOf(f.day);
    if (d < 0 || d > 9) continue;
    const a = toMinutes(f.start);
    const b = toMinutes(f.end);
    if (a >= MAX36 || b >= MAX36) continue;

    if (f.showId != null) {
      const show = byId.get(f.showId);
      if (!show || !show.code) continue;
      if (!show.slots.some((x) => x.day === f.day && x.start === f.start)) continue;
      parts.push(show.code + d + b36(a));
    } else {
      const li = labels.indexOf(f.label);
      parts.push("-" + d + b36(a) + b36(b) + (li < 0 ? 0 : li));
    }
  }

  return parts.length ? PLAN_VERSION + parts.join("") : "";
}

/**
 * URLの断片を予定に戻す。
 * 人からもらうものなので、読めない部分は落として、通ったぶんだけ返す。
 */
export function decodePlan(str, { shows, days, labels }) {
  if (typeof str !== "string" || str[0] !== PLAN_VERSION) return [];

  const byCode = new Map(shows.filter((s) => s.code).map((s) => [s.code, s]));
  const out = [];
  const seen = new Set();

  let i = 1;
  while (i < str.length) {
    if (str[i] === "-") {
      const [d, a, b, li] = [str[i + 1], un36(str.slice(i + 2, i + 4)), un36(str.slice(i + 4, i + 6)), str[i + 6]];
      i += 7;
      if (!days[d] || !(a >= 0) || !(b >= 0) || a >= b) continue;
      out.push({ day: days[d], start: toHHMM(a), end: toHHMM(b), label: labels[li] ?? labels[0] });
    } else {
      const show = byCode.get(str[i]);
      const day = days[str[i + 1]];
      const at = un36(str.slice(i + 2, i + 4));
      i += 4;
      if (!show || !day || !(at >= 0) || seen.has(show.id)) continue;
      const sl = show.slots.find((x) => x.day === day && toMinutes(x.start) === at);
      if (!sl) continue;
      seen.add(show.id);
      out.push({ day: sl.day, start: sl.start, end: sl.end, showId: show.id });
    }
  }

  return out;
}
