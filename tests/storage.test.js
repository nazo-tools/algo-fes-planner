// 保存データは古くなる。読み戻しが今のデータと食い違ったときに何を捨てるか、をここで固める。
import { describe, it, expect } from "vitest";
import {
  encodeState,
  decodeState,
  loadState,
  saveState,
  encodePlan,
  decodePlan,
  STORAGE_KEY,
} from "../storage.js";

const SHOWS = [
  {
    id: "a",
    slots: [
      { day: "09-12", start: "13:00", end: "14:00" },
      { day: "09-13", start: "10:00", end: "11:00" },
    ],
  },
  { id: "b", slots: [{ day: "09-12", start: "15:00", end: "16:00" }] },
];
const DAYS = ["09-12", "09-13"];
const CTX = { shows: SHOWS, days: DAYS };

const dec = (raw) => decodeState(raw, CTX);
const base = (over = {}) => ({ v: 1, fixed: [], favorites: [], going: DAYS, windows: {}, ...over });

/** 画面の状態に近い形。encode が受け取るのはこの形。 */
const state = (over = {}) => ({
  fixed: [],
  favorites: new Set(),
  going: new Set(DAYS),
  windows: {},
  onlyFav: false,
  intro: true,
  ...over,
});

describe("encodeState", () => {
  it("Set を配列にして保存できる形にする", () => {
    const e = encodeState(
      state({ favorites: new Set(["a"]), going: new Set(["09-12"]), intro: false }),
    );
    expect(e.favorites).toEqual(["a"]);
    expect(e.going).toEqual(["09-12"]);
    expect(e.introDone).toBe(true);
  });

  it("使い方を出したままなら introDone は false", () => {
    expect(encodeState(state({ intro: true })).introDone).toBe(false);
  });
});

describe("decodeState", () => {
  it("素直な保存データはそのまま戻る", () => {
    const r = dec(
      base({
        fixed: [{ day: "09-12", start: "13:00", end: "14:00", showId: "a" }],
        favorites: ["b"],
        windows: { "09-12": { from: "13:00", to: "18:00" } },
        onlyFav: true,
        introDone: true,
      }),
    );
    expect(r.fixed).toEqual([{ day: "09-12", start: "13:00", end: "14:00", showId: "a" }]);
    expect(r.favorites).toEqual(["b"]);
    expect(r.windows).toEqual({ "09-12": { from: "13:00", to: "18:00" } });
    expect(r.onlyFav).toBe(true);
    expect(r.introDone).toBe(true);
  });

  it("中身がなければ null", () => {
    expect(dec(null)).toBeNull();
    expect(dec("こわれている")).toBeNull();
    expect(dec({ fixed: [] })).toBeNull(); // バージョンなし
    expect(dec({ v: 2, fixed: [] })).toBeNull(); // 知らないバージョン
  });

  it("消えた公演の予定は捨てる", () => {
    const r = dec(base({ fixed: [{ day: "09-12", start: "13:00", end: "14:00", showId: "zzz" }] }));
    expect(r.fixed).toEqual([]);
  });

  it("時間割が直って実在しなくなった回は捨てる", () => {
    const r = dec(base({ fixed: [{ day: "09-12", start: "13:05", end: "14:05", showId: "a" }] }));
    expect(r.fixed).toEqual([]);
  });

  it("同じ公演が二重に入っていたら最初のひとつだけ残す", () => {
    const r = dec(
      base({
        fixed: [
          { day: "09-12", start: "13:00", end: "14:00", showId: "a" },
          { day: "09-13", start: "10:00", end: "11:00", showId: "a" },
        ],
      }),
    );
    expect(r.fixed).toEqual([{ day: "09-12", start: "13:00", end: "14:00", showId: "a" }]);
  });

  it("行かない日の予定は捨てる", () => {
    const r = dec(
      base({
        going: ["09-12"],
        fixed: [
          { day: "09-12", start: "13:00", end: "14:00", showId: "a" },
          { day: "09-13", start: "10:00", end: "11:00", showId: "b" },
        ],
      }),
    );
    expect(r.going).toEqual(["09-12"]);
    expect(r.fixed).toHaveLength(1);
    expect(r.fixed[0].showId).toBe("a");
  });

  it("行く日が全部消えていたら全日に戻す", () => {
    expect(dec(base({ going: ["まちがい"] })).going).toEqual(DAYS);
  });

  it("休憩は公演データに無くても残す", () => {
    const r = dec(base({ fixed: [{ day: "09-12", start: "12:00", end: "13:00", label: "ごはん" }] }));
    expect(r.fixed).toEqual([{ day: "09-12", start: "12:00", end: "13:00", label: "ごはん" }]);
  });

  it("終わりが始まりより前の休憩は捨てる", () => {
    const r = dec(base({ fixed: [{ day: "09-12", start: "14:00", end: "12:00", label: "休憩" }] }));
    expect(r.fixed).toEqual([]);
  });

  it("時刻の形をしていない予定は捨てる", () => {
    const r = dec(base({ fixed: [{ day: "09-12", start: "ひる", end: "14:00", label: "休憩" }] }));
    expect(r.fixed).toEqual([]);
  });

  it("知らない公演のお気に入りは落とす", () => {
    expect(dec(base({ favorites: ["a", "zzz"] })).favorites).toEqual(["a"]);
  });

  it("時刻になっていない時間帯は空にする", () => {
    const r = dec(base({ windows: { "09-12": { from: "あさ", to: "18:00" } } }));
    expect(r.windows).toEqual({ "09-12": { from: "", to: "18:00" } });
  });

  it("両方とも空の時間帯は持たない", () => {
    expect(dec(base({ windows: { "09-12": { from: "", to: "" } } })).windows).toEqual({});
  });

  it("fixed が配列でなくても落ちない", () => {
    expect(dec(base({ fixed: "こわれている", favorites: 42 })).fixed).toEqual([]);
  });
});

describe("loadState / saveState", () => {
  const fakeStore = () => {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, v),
      _map: m,
    };
  };

  it("保存して読み戻せる", () => {
    const store = fakeStore();
    expect(saveState(store, state({ fixed: [{ day: "09-12", start: "13:00", end: "14:00", showId: "a" }] }))).toBe(true);
    expect(store._map.has(STORAGE_KEY)).toBe(true);
    expect(loadState(store, CTX).fixed).toHaveLength(1);
  });

  it("何も保存されていなければ null", () => {
    expect(loadState(fakeStore(), CTX)).toBeNull();
  });

  it("壊れた文字列が入っていても落ちない", () => {
    const store = fakeStore();
    store.setItem(STORAGE_KEY, "{{{");
    expect(loadState(store, CTX)).toBeNull();
  });

  it("保存できない環境でも例外を投げない", () => {
    const store = {
      getItem: () => {
        throw new Error("使えません");
      },
      setItem: () => {
        throw new Error("使えません");
      },
    };
    expect(saveState(store, state())).toBe(false);
    expect(loadState(store, CTX)).toBeNull();
  });
});

describe("encodePlan / decodePlan", () => {
  const LABELS = ["休憩", "ごはん", "移動", "用事"];
  const PCTX = { shows: SHOWS, days: DAYS, labels: LABELS };
  const round = (fixed) => decodePlan(encodePlan(fixed, PCTX), PCTX);

  it("公演も空けた時間も往復して同じに戻る", () => {
    const fixed = [
      { day: "09-12", start: "13:00", end: "14:00", showId: "a" },
      { day: "09-12", start: "12:00", end: "12:45", label: "ごはん" },
    ];
    expect(round(fixed)).toEqual(fixed);
  });

  it("日本語はURLに出ない", () => {
    const s = encodePlan([{ day: "09-12", start: "12:00", end: "12:45", label: "ごはん" }], PCTX);
    expect(s).toMatch(/^[\x20-\x7e]+$/);
    expect(s).toBe("1~!0.720.765.1");
  });

  it("予定がなければ空文字", () => {
    expect(encodePlan([], PCTX)).toBe("");
  });

  it("読めないものは null ではなく空の予定として返す", () => {
    expect(decodePlan("", PCTX)).toEqual([]);
    expect(decodePlan("こわれている", PCTX)).toEqual([]);
    expect(decodePlan("2~a.0", PCTX)).toEqual([]); // 知らないバージョン
    expect(decodePlan(null, PCTX)).toEqual([]);
  });

  it("知らない公演や無い回は落として、残りは通す", () => {
    expect(decodePlan("1~zzz.0.780~a.0.999~b.0.900", PCTX)).toEqual([
      { day: "09-12", start: "15:00", end: "16:00", showId: "b" },
    ]);
  });

  it("同じ公演が二重に入っていたら最初だけ残す", () => {
    expect(decodePlan("1~a.0.780~a.1.600", PCTX)).toHaveLength(1);
  });

  it("時刻がおかしい空け時間は落とす", () => {
    expect(decodePlan("1~!0.800.700.0", PCTX)).toEqual([]); // 終わりが先
    expect(decodePlan("1~!9.700.800.0", PCTX)).toEqual([]); // 無い日
    expect(decodePlan("1~!0.x.800.0", PCTX)).toEqual([]);
  });

  it("知らない名札は先頭の名札に寄せる", () => {
    expect(decodePlan("1~!0.720.780.7", PCTX)[0].label).toBe("休憩");
  });

  it("時間割が直って回が消えたら、黙って別の回にせず落とす", () => {
    const s = encodePlan([{ day: "09-12", start: "13:00", end: "14:00", showId: "a" }], PCTX);
    const 直った = [{ id: "a", slots: [{ day: "09-12", start: "13:30", end: "14:30" }] }];
    expect(decodePlan(s, { ...PCTX, shows: 直った })).toEqual([]);
  });

  it("終了時刻が直っていれば、その回として通す", () => {
    const s = encodePlan([{ day: "09-12", start: "13:00", end: "14:00", showId: "a" }], PCTX);
    const 直った = [{ id: "a", slots: [{ day: "09-12", start: "13:00", end: "14:30" }] }];
    expect(decodePlan(s, { ...PCTX, shows: 直った })).toEqual([
      { day: "09-12", start: "13:00", end: "14:30", showId: "a" },
    ]);
  });
});
