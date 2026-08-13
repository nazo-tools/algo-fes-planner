import { describe, it, expect } from "vitest";
import {
  toMinutes,
  canFollow,
  findPlans,
  fillGap,
  placementOptions,
  suggestFills,
  rescueSuggestions,
  diagnoseConflicts,
  formatPlanAsText,
  festivalNow,
  nowNext,
} from "../planner.js";

/** テスト用の公演を作るヘルパー。slots は [day, start, end] の配列。 */
function show(id, slots, extra = {}) {
  return {
    id,
    title: id.toUpperCase(),
    venue: "room2f",
    durationMin: 60,
    people: "1〜4人",
    slots: slots.map(([day, start, end]) => ({ day, start, end })),
    ...extra,
  };
}

const D = "09-12";

describe("toMinutes", () => {
  it("HH:MM を分に変換する", () => {
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("13:10")).toBe(790);
    expect(toMinutes("23:59")).toBe(1439);
  });

  it("1桁の時にも対応する", () => {
    expect(toMinutes("9:05")).toBe(545);
  });

  it("形式が不正なら投げる", () => {
    expect(() => toMinutes("1310")).toThrow();
    expect(() => toMinutes("")).toThrow();
    expect(() => toMinutes("24:00")).toThrow();
    expect(() => toMinutes("12:60")).toThrow();
  });
});

describe("canFollow", () => {
  const a = { start: "13:00", end: "14:00" };

  it("バッファ以上あいていれば繋がる", () => {
    expect(canFollow(a, { start: "14:10", end: "15:00" }, 10)).toBe(true);
    expect(canFollow(a, { start: "14:30", end: "15:00" }, 10)).toBe(true);
  });

  it("バッファに足りなければ繋がらない", () => {
    expect(canFollow(a, { start: "14:05", end: "15:00" }, 10)).toBe(false);
  });

  it("時間が重なっていれば繋がらない", () => {
    expect(canFollow(a, { start: "13:30", end: "15:00" }, 0)).toBe(false);
  });

  it("0分乗り換え（終了と開始が同時刻）はバッファ0でも繋がらない", () => {
    expect(canFollow(a, { start: "14:00", end: "15:00" }, 0)).toBe(false);
  });

  it("バッファ0なら1分でもあいていれば繋がる", () => {
    expect(canFollow(a, { start: "14:01", end: "15:00" }, 0)).toBe(true);
  });
});

describe("findPlans", () => {
  it("何も選ばれていなければプランは空", () => {
    const res = findPlans([show("a", [[D, "10:00", "11:00"]])], {}, { day: D });
    expect(res.plans).toEqual([]);
  });

  it("全枠が重なる2公演は同時に入らない", () => {
    const shows = [
      show("a", [[D, "10:00", "12:00"]]),
      show("b", [[D, "11:00", "13:00"]]),
    ];
    const res = findPlans(shows, { a: "want", b: "want" }, { day: D, bufferMin: 10 });
    expect(res.plans).toHaveLength(2); // a だけ / b だけ
    for (const plan of res.plans) {
      expect(plan.items).toHaveLength(1);
    }
  });

  it("繋がる枠があれば両方入る", () => {
    const shows = [
      show("a", [[D, "10:00", "11:00"]]),
      show("b", [[D, "11:30", "12:30"]]),
    ];
    const res = findPlans(shows, { a: "want", b: "want" }, { day: D, bufferMin: 10 });
    expect(res.plans).toHaveLength(1);
    expect(res.plans[0].items.map((i) => i.showId)).toEqual(["a", "b"]);
  });

  it("同じ公演の複数枠のうち、後続が繋がるほうを選ぶ", () => {
    const shows = [
      show("a", [
        [D, "10:00", "12:00"], // これを選ぶと b が入らない
        [D, "10:00", "11:00"], // こちらなら b が入る
      ]),
      show("b", [[D, "11:30", "12:30"]]),
    ];
    const res = findPlans(shows, { a: "want", b: "want" }, { day: D, bufferMin: 10 });
    expect(res.plans[0].items).toHaveLength(2);
    expect(res.plans[0].items[0].end).toBe("11:00");
  });

  it("同じ公演を2回入れない", () => {
    const shows = [show("a", [[D, "10:00", "11:00"], [D, "12:00", "13:00"]])];
    const res = findPlans(shows, { a: "want" }, { day: D, bufferMin: 10 });
    for (const plan of res.plans) {
      expect(plan.items).toHaveLength(1);
    }
  });

  it("必須を全部含むプランが上に来る", () => {
    const shows = [
      show("a", [[D, "10:00", "11:00"]]),
      show("b", [[D, "10:30", "11:30"]]), // a と重なる
      show("c", [[D, "12:00", "13:00"]]),
    ];
    const res = findPlans(
      shows,
      { a: "must", b: "want", c: "must" },
      { day: D, bufferMin: 10 },
    );
    expect(res.plans[0].score.must).toBe(2);
    expect(res.plans[0].items.map((i) => i.showId)).toEqual(["a", "c"]);
  });

  it("極大解のみを返す（部分集合は混ざらない）", () => {
    const shows = [
      show("a", [[D, "10:00", "11:00"]]),
      show("b", [[D, "11:30", "12:30"]]),
    ];
    const res = findPlans(shows, { a: "want", b: "want" }, { day: D, bufferMin: 10 });
    // {a,b} が成立するので {a} だけ・{b} だけは返らない
    expect(res.plans).toHaveLength(1);
  });

  it("公演の組み合わせが同じプランは重複させず、空き時間が短いほうを残す", () => {
    const shows = [
      show("a", [[D, "10:00", "11:00"]]),
      show("b", [
        [D, "15:00", "16:00"], // 空き 240分
        [D, "11:30", "12:30"], // 空き 30分
      ]),
    ];
    const res = findPlans(shows, { a: "want", b: "want" }, { day: D, bufferMin: 10 });
    expect(res.plans).toHaveLength(1);
    expect(res.plans[0].items[1].start).toBe("11:30");
    expect(res.plans[0].score.idleMin).toBe(30);
  });

  it("手前の公演を後ろに寄せて待ち時間を詰める", () => {
    const shows = [
      show("a", [
        [D, "10:00", "11:00"], // 最も早く終わるのはこちら
        [D, "12:00", "13:00"], // b の直前まで寄せられるのはこちら
      ]),
      show("b", [[D, "13:30", "14:30"]]),
    ];
    const res = findPlans(shows, { a: "want", b: "want" }, { day: D, bufferMin: 10 });
    expect(res.plans[0].items.map((i) => i.showId)).toEqual(["a", "b"]);
    expect(res.plans[0].items[0].start).toBe("12:00");
    expect(res.plans[0].score.idleMin).toBe(30);
  });

  it("詰め寄せても最後の公演は動かさない（無駄に遅い回に飛ばない）", () => {
    const shows = [
      show("a", [[D, "10:00", "11:00"]]),
      show("b", [
        [D, "11:30", "12:30"],
        [D, "18:00", "19:00"], // こちらに寄せてはいけない
      ]),
    ];
    const res = findPlans(shows, { a: "want", b: "want" }, { day: D, bufferMin: 10 });
    expect(res.plans[0].items[1].start).toBe("11:30");
  });

  it("各項目に次までのあき(gapAfterMin)が入り、最後は null", () => {
    const shows = [
      show("a", [[D, "10:00", "11:00"]]),
      show("b", [[D, "11:30", "12:30"]]),
    ];
    const res = findPlans(shows, { a: "want", b: "want" }, { day: D, bufferMin: 10 });
    expect(res.plans[0].items[0].gapAfterMin).toBe(30);
    expect(res.plans[0].items[1].gapAfterMin).toBeNull();
  });

  it("充足数が同じなら空き時間が少ないプランが上に来る", () => {
    const shows = [
      show("a", [[D, "10:00", "11:00"]]),
      show("b", [[D, "11:30", "12:30"]]), // a のあと 30分あき
      show("c", [[D, "16:00", "17:00"]]), // a のあと 300分あき
    ];
    const res = findPlans(shows, { a: "want", b: "want", c: "want" }, { day: D, bufferMin: 10 });
    // a+b+c が全部入るのでそれが唯一の極大解
    expect(res.plans[0].items.map((i) => i.showId)).toEqual(["a", "b", "c"]);
    expect(res.plans[0].score.idleMin).toBe(30 + 210);
  });

  it("指定した日以外の枠は混ざらない", () => {
    const shows = [
      show("a", [["09-13", "10:00", "11:00"]]),
      show("b", [[D, "10:00", "11:00"]]),
    ];
    const res = findPlans(shows, { a: "want", b: "want" }, { day: D, bufferMin: 10 });
    expect(res.plans).toHaveLength(1);
    expect(res.plans[0].items.map((i) => i.showId)).toEqual(["b"]);
  });

  it("最早開始・最遅終了の外にある枠は候補から外れる", () => {
    const shows = [
      show("a", [[D, "09:00", "10:00"], [D, "13:00", "14:00"]]),
      show("b", [[D, "20:00", "21:00"]]),
    ];
    const res = findPlans(shows, { a: "want", b: "want" }, {
      day: D,
      bufferMin: 10,
      earliestStart: "12:00",
      latestEnd: "19:00",
    });
    expect(res.plans).toHaveLength(1);
    expect(res.plans[0].items.map((i) => i.showId)).toEqual(["a"]);
    expect(res.plans[0].items[0].start).toBe("13:00");
  });

  it("枠のない公演を選んでも落ちない", () => {
    const shows = [show("a", []), show("b", [[D, "10:00", "11:00"]])];
    const res = findPlans(shows, { a: "must", b: "want" }, { day: D });
    expect(res.plans[0].items.map((i) => i.showId)).toEqual(["b"]);
  });

  it("バッファを広げると繋がらなくなる", () => {
    const shows = [
      show("a", [[D, "10:00", "11:00"]]),
      show("b", [[D, "11:20", "12:20"]]),
    ];
    expect(findPlans(shows, { a: "want", b: "want" }, { day: D, bufferMin: 10 }).plans[0].items).toHaveLength(2);
    expect(findPlans(shows, { a: "want", b: "want" }, { day: D, bufferMin: 30 }).plans[0].items).toHaveLength(1);
  });

  it("プランは開始時刻の昇順に並ぶ", () => {
    const shows = [
      show("a", [[D, "14:00", "15:00"]]),
      show("b", [[D, "10:00", "11:00"]]),
      show("c", [[D, "12:00", "13:00"]]),
    ];
    const res = findPlans(shows, { a: "want", b: "want", c: "want" }, { day: D, bufferMin: 10 });
    expect(res.plans[0].items.map((i) => i.showId)).toEqual(["b", "c", "a"]);
  });

  it("maxPlans を超えた分は返さない", () => {
    const shows = Array.from({ length: 6 }, (_, i) =>
      show(`s${i}`, [[D, `1${i}:00`, `1${i}:30`], [D, `1${i}:00`, `1${i}:50`]]),
    );
    const ranks = Object.fromEntries(shows.map((s) => [s.id, "want"]));
    const res = findPlans(shows, ranks, { day: D, bufferMin: 10, maxPlans: 3 });
    expect(res.plans.length).toBeLessThanOrEqual(3);
  });

  it("料金を1人あたりと1組あたりに分けて合計する", () => {
    const shows = [
      show("a", [[D, "10:00", "11:00"]], { price: 3000, unit: "person" }),
      show("b", [[D, "11:30", "12:30"]], { price: 2000, unit: "group" }),
      show("c", [[D, "13:00", "14:00"]], { price: 1500, unit: "person" }),
    ];
    const res = findPlans(shows, { a: "want", b: "want", c: "want" }, { day: D, bufferMin: 10 });
    expect(res.plans[0].score.pricePerPerson).toBe(4500);
    expect(res.plans[0].score.priceGroup).toBe(2000);
  });

  it("料金が入っていない公演があっても落ちない", () => {
    const shows = [show("a", [[D, "10:00", "11:00"]])];
    const res = findPlans(shows, { a: "want" }, { day: D });
    expect(res.plans[0].score.pricePerPerson).toBe(0);
    expect(res.plans[0].score.priceGroup).toBe(0);
  });

  it("スコアに各ランクの充足数が入る", () => {
    const shows = [
      show("a", [[D, "10:00", "11:00"]]),
      show("b", [[D, "11:30", "12:30"]]),
      show("c", [[D, "13:00", "14:00"]]),
    ];
    const res = findPlans(shows, { a: "must", b: "want", c: "maybe" }, { day: D, bufferMin: 10 });
    expect(res.plans[0].score).toMatchObject({ must: 1, want: 1, maybe: 1, count: 3 });
  });
});

describe("fillGap", () => {
  const m = (hhmm) => toMinutes(hhmm);

  it("あきに複数公演が入るなら、多いほうを先に返す", () => {
    const shows = [
      show("x", [[D, "12:20", "12:50"]]),
      show("y", [[D, "13:05", "13:50"]]),
    ];
    const res = fillGap(shows, {
      day: D, bufferMin: 10, afterMin: m("12:10"), beforeMin: m("14:30"),
    });
    expect(res.plans[0].items.map((i) => i.showId)).toEqual(["x", "y"]);
  });

  it("あきが足りなければ何も返さない", () => {
    const shows = [show("x", [[D, "12:20", "13:40"]])];
    const res = fillGap(shows, {
      day: D, bufferMin: 10, afterMin: m("12:10"), beforeMin: m("13:00"),
    });
    expect(res.plans).toEqual([]);
  });

  it("直前・直後との余裕を両端で守る", () => {
    // 12:10終了 → 12:15開始は余裕5分しかないので入らない
    const tooEarly = [show("x", [[D, "12:15", "12:45"]])];
    expect(
      fillGap(tooEarly, { day: D, bufferMin: 10, afterMin: m("12:10"), beforeMin: m("14:30") }).plans,
    ).toEqual([]);

    // 14:25終了 → 14:30開始も同じく入らない
    const tooLate = [show("y", [[D, "13:55", "14:25"]])];
    expect(
      fillGap(tooLate, { day: D, bufferMin: 10, afterMin: m("12:10"), beforeMin: m("14:30") }).plans,
    ).toEqual([]);
  });

  it("すでにプランに入っている公演は候補から外す", () => {
    const shows = [
      show("x", [[D, "12:20", "12:50"]]),
      show("y", [[D, "13:05", "13:50"]]),
    ];
    const res = fillGap(shows, {
      day: D, bufferMin: 10, afterMin: m("12:10"), beforeMin: m("14:30"), excludeIds: ["x"],
    });
    expect(res.plans[0].items.map((i) => i.showId)).toEqual(["y"]);
  });

  it("開演前（直前がない）は上限だけを見る", () => {
    const shows = [show("x", [[D, "09:00", "09:40"]])];
    const res = fillGap(shows, { day: D, bufferMin: 10, afterMin: null, beforeMin: m("10:00") });
    expect(res.plans[0].items.map((i) => i.showId)).toEqual(["x"]);
  });

  it("終演後（直後がない）は下限だけを見る", () => {
    const shows = [show("x", [[D, "20:00", "20:40"]])];
    const res = fillGap(shows, { day: D, bufferMin: 10, afterMin: m("19:20"), beforeMin: null });
    expect(res.plans[0].items.map((i) => i.showId)).toEqual(["x"]);
  });

  it("あきの前後が逆でも落ちない", () => {
    const shows = [show("x", [[D, "12:00", "12:30"]])];
    expect(
      fillGap(shows, { day: D, bufferMin: 10, afterMin: m("15:00"), beforeMin: m("13:00") }).plans,
    ).toEqual([]);
  });

  it("候補が空でも落ちない", () => {
    expect(fillGap([], { day: D, afterMin: 0, beforeMin: 600 }).plans).toEqual([]);
  });
});

describe("placementOptions", () => {
  const D2 = "09-13";

  it("固定した予定とぶつかる枠は候補から外す", () => {
    const shows = [show("a", [[D, "10:00", "11:00"], [D, "14:00", "15:00"]])];
    const fixed = [{ day: D, start: "09:30", end: "10:30", showId: "z" }];
    const res = placementOptions(shows, fixed, { days: [D], bufferMin: 10 });
    expect(res[0].options.map((o) => o.start)).toEqual(["14:00"]);
  });

  it("すでに置いた公演は、別の回が空いていても候補に出さない", () => {
    const shows = [
      show("a", [[D, "10:00", "11:00"], [D, "15:00", "16:00"]]), // 15:00 は空いている
      show("b", [[D, "12:00", "13:00"]]),
    ];
    const fixed = [{ day: D, start: "10:00", end: "11:00", showId: "a" }];
    const res = placementOptions(shows, fixed, { days: [D], bufferMin: 10 });
    expect(res.map((r) => r.showId)).toEqual(["b"]);
  });

  it("両日ぶんの候補をまとめて返す", () => {
    const shows = [show("a", [[D, "10:00", "11:00"], [D2, "13:00", "14:00"]])];
    const res = placementOptions(shows, [], { days: [D, D2], bufferMin: 10 });
    expect(res[0].options.map((o) => o.day)).toEqual([D, D2]);
  });

  it("残り1枠になったことが分かる", () => {
    const shows = [show("a", [[D, "10:00", "11:00"], [D2, "13:00", "14:00"]])];
    const fixed = [{ day: D2, start: "13:30", end: "14:30", showId: "z" }];
    const res = placementOptions(shows, fixed, { days: [D, D2], bufferMin: 10 });
    expect(res[0].options).toHaveLength(1);
    expect(res[0].options[0].day).toBe(D);
  });

  it("休憩ブロック（showIdなし）も時間を塞ぐ", () => {
    const shows = [show("a", [[D, "12:00", "13:00"]])];
    const fixed = [{ day: D, start: "12:00", end: "13:00", label: "昼ごはん" }];
    const res = placementOptions(shows, fixed, { days: [D], bufferMin: 10 });
    expect(res[0].options).toEqual([]);
  });
});

describe("suggestFills", () => {
  const D2 = "09-13";

  it("固定した予定を動かさずに空きへ詰める", () => {
    const shows = [
      show("fixed", [[D, "10:00", "12:00"]]),
      show("a", [[D, "12:30", "13:30"]]),
      show("b", [[D, "14:00", "15:00"]]),
    ];
    const fixed = [{ day: D, start: "10:00", end: "12:00", showId: "fixed" }];
    const res = suggestFills(shows, fixed, { days: [D], bufferMin: 10 });
    expect(res.added.map((x) => x.showId)).toEqual(["a", "b"]);
  });

  it("片方の日が埋まっていても、もう片方に回せるなら入れる", () => {
    const shows = [
      show("a", [[D, "10:00", "11:00"], [D2, "10:00", "11:00"]]),
      show("b", [[D, "10:00", "11:00"]]), // 土曜のこの時間しかない
    ];
    const res = suggestFills(shows, [], { days: [D, D2], bufferMin: 10 });
    expect(res.added).toHaveLength(2);
    // b は土曜に固定されるので、a は日曜に回るしかない
    expect(res.added.find((x) => x.showId === "b").day).toBe(D);
    expect(res.added.find((x) => x.showId === "a").day).toBe(D2);
  });

  it("片方ずつ貪欲に埋めると取りこぼす形でも、両日を見て最大にする", () => {
    // 土曜の同じ時間に3公演。a と b は土曜しかなく、c は両日ある。
    const shows = [
      show("a", [[D, "10:00", "11:00"]]),
      show("b", [[D, "12:00", "13:00"]]),
      show("c", [[D, "10:00", "11:00"], [D2, "10:00", "11:00"]]),
    ];
    const res = suggestFills(shows, [], { days: [D, D2], bufferMin: 10 });
    expect(res.added).toHaveLength(3);
    expect(res.added.find((x) => x.showId === "c").day).toBe(D2);
  });

  it("休憩ブロックを避けて詰める", () => {
    const shows = [
      show("a", [[D, "12:00", "13:00"], [D, "14:00", "15:00"]]),
    ];
    const fixed = [{ day: D, start: "11:30", end: "13:30", label: "昼ごはん" }];
    const res = suggestFills(shows, fixed, { days: [D], bufferMin: 10 });
    expect(res.added.map((x) => x.start)).toEqual(["14:00"]);
  });

  it("すでに置いた公演を、別の回でもう一度入れない", () => {
    const shows = [
      show("a", [[D, "10:00", "11:00"], [D, "15:00", "16:00"]]), // 15:00 は空いている
    ];
    const fixed = [{ day: D, start: "10:00", end: "11:00", showId: "a" }];
    expect(suggestFills(shows, fixed, { days: [D], bufferMin: 10 }).added).toEqual([]);
  });

  it("同じ公演を両日に入れない", () => {
    const shows = [show("a", [[D, "10:00", "11:00"], [D2, "10:00", "11:00"]])];
    const res = suggestFills(shows, [], { days: [D, D2], bufferMin: 10 });
    expect(res.added).toHaveLength(1);
  });

  it("入るものがなければ空を返す", () => {
    const shows = [show("a", [[D, "10:00", "11:00"]])];
    const fixed = [{ day: D, start: "09:00", end: "12:00", label: "用事" }];
    expect(suggestFills(shows, fixed, { days: [D], bufferMin: 10 }).added).toEqual([]);
  });

  it("公演が無くても落ちない", () => {
    expect(suggestFills([], [], { days: [D] }).added).toEqual([]);
  });

  it("結果は日付・開始時刻の順に並ぶ", () => {
    const shows = [
      show("a", [[D2, "10:00", "11:00"]]),
      show("b", [[D, "15:00", "16:00"]]),
      show("c", [[D, "10:00", "11:00"]]),
    ];
    const res = suggestFills(shows, [], { days: [D, D2], bufferMin: 10 });
    expect(res.added.map((x) => x.showId)).toEqual(["c", "b", "a"]);
  });
});

describe("suggestFills / お気に入り・時間帯・待ち時間", () => {
  const D2 = "09-13";

  it("お気に入りを優先して入れる（総数が同じなら）", () => {
    // a と b は同じ時間なので片方しか入らない
    const shows = [
      show("a", [[D, "10:00", "11:00"]]),
      show("b", [[D, "10:00", "11:00"]]),
    ];
    const res = suggestFills(shows, [], { days: [D], bufferMin: 10, favoriteIds: ["b"] });
    expect(res.added.map((x) => x.showId)).toEqual(["b"]);
  });

  it("お気に入りが多く入る組み合わせを、総数より優先する", () => {
    // c を選ぶと a,b の2公演が入る。x（お気に入り）を選ぶと1公演だけ。
    const shows = [
      show("x", [[D, "10:00", "14:00"]]),
      show("a", [[D, "10:00", "11:00"]]),
      show("b", [[D, "12:00", "13:00"]]),
    ];
    const res = suggestFills(shows, [], { days: [D], bufferMin: 10, favoriteIds: ["x"] });
    expect(res.added.map((x) => x.showId)).toEqual(["x"]);
  });

  it("onlyFavorites ならお気に入り以外を入れない", () => {
    const shows = [
      show("a", [[D, "10:00", "11:00"]]),
      show("b", [[D, "12:00", "13:00"]]),
    ];
    const res = suggestFills(shows, [], {
      days: [D], bufferMin: 10, favoriteIds: ["a"], onlyFavorites: true,
    });
    expect(res.added.map((x) => x.showId)).toEqual(["a"]);
  });

  it("時間帯の指定を守る", () => {
    const shows = [
      show("a", [[D, "09:00", "10:00"], [D, "15:00", "16:00"]]),
      show("b", [[D, "21:00", "22:00"]]),
    ];
    const res = suggestFills(shows, [], {
      days: [D], bufferMin: 10, windows: { [D]: { from: "13:00", to: "20:00" } },
    });
    expect(res.added.map((x) => x.showId)).toEqual(["a"]);
    expect(res.added[0].start).toBe("15:00");
  });

  it("時間帯は日ごとに別々に効く", () => {
    const shows = [
      show("a", [[D, "09:00", "10:00"]]),
      show("b", [[D2, "09:00", "10:00"]]),
    ];
    const res = suggestFills(shows, [], {
      days: [D, D2], bufferMin: 10, windows: { [D]: { from: "12:00" } },
    });
    expect(res.added.map((x) => x.showId)).toEqual(["b"]);
  });

  it("待ち時間が短くなる回へ振り替える", () => {
    // 固定は 10:00-11:00。a は 11:30 と 18:00 の回があり、11:30 のほうがあきが短い
    const shows = [
      show("fix", [[D, "10:00", "11:00"]]),
      show("a", [[D, "11:30", "12:30"], [D, "18:00", "19:00"]]),
    ];
    const fixed = [{ day: D, start: "10:00", end: "11:00", showId: "fix" }];
    const res = suggestFills(shows, fixed, { days: [D], bufferMin: 10 });
    expect(res.added[0].start).toBe("11:30");
    expect(res.idleByDay[D]).toBe(30);
  });

  it("待ち時間を減らすために、DPが選んだ回から後ろへずらす", () => {
    // 固定が 14:00-15:00。a は 09:00 と 13:00 の回がある。
    // 最も早く終わるのは 09:00 だが、13:00 のほうがあきが短い。
    const shows = [
      show("fix", [[D, "14:00", "15:00"]]),
      show("a", [[D, "09:00", "10:00"], [D, "13:00", "13:45"]]),
    ];
    const fixed = [{ day: D, start: "14:00", end: "15:00", showId: "fix" }];
    const res = suggestFills(shows, fixed, { days: [D], bufferMin: 10 });
    expect(res.added[0].start).toBe("13:00");
    expect(res.idleByDay[D]).toBe(15);
  });

  it("待ち時間が縮むように見えても、他の予定とぶつかる回へは移さない", () => {
    // a を 12:30 に移すと見かけの待ち時間は激減するが、b(12:00-13:00) と重なる。
    // 重なりを「マイナスのあき」として数えてしまうと、この回を選んでしまう。
    const shows = [
      show("fix", [[D, "10:00", "11:00"]]),
      show("b", [[D, "12:00", "13:00"]]),
      show("a", [[D, "12:30", "13:30"], [D, "17:00", "18:00"]]),
    ];
    const fixed = [{ day: D, start: "10:00", end: "11:00", showId: "fix" }];
    const res = suggestFills(shows, fixed, { days: [D], bufferMin: 10 });
    const a = res.added.find((x) => x.showId === "a");
    expect(a.start).toBe("17:00");
    expect(res.idleByDay[D]).toBe(300);
  });

  it("あき時間を日ごとに返す", () => {
    const shows = [show("a", [[D, "10:00", "11:00"]]), show("b", [[D, "11:30", "12:30"]])];
    const res = suggestFills(shows, [], { days: [D, D2], bufferMin: 10 });
    expect(res.idleByDay[D]).toBe(30);
    expect(res.idleByDay[D2]).toBe(0);
  });
});

describe("rescueSuggestions", () => {
  const D2 = "09-13";

  it("置いた公演を別の回に移せばお気に入りが入る、と提案する", () => {
    // fav は 10:00 の回しかない。blocker が 10:00 を塞いでいるが、14:00 にも回がある。
    const shows = [
      show("blocker", [[D, "10:00", "11:00"], [D, "14:00", "15:00"]]),
      show("fav", [[D, "10:00", "11:00"]]),
    ];
    const fixed = [{ day: D, start: "10:00", end: "11:00", showId: "blocker" }];
    const res = rescueSuggestions(shows, fixed, ["fav"], { days: [D], bufferMin: 10 });
    expect(res).toHaveLength(1);
    expect(res[0].showId).toBe("fav");
    expect(res[0].swaps[0]).toMatchObject({
      showId: "blocker",
      from: { start: "10:00" },
      to: { start: "14:00" },
      thenAt: { start: "10:00" },
    });
  });

  it("お気に入りがまだ入るなら何も返さない", () => {
    const shows = [
      show("blocker", [[D, "10:00", "11:00"]]),
      show("fav", [[D, "10:00", "11:00"], [D, "14:00", "15:00"]]),
    ];
    const fixed = [{ day: D, start: "10:00", end: "11:00", showId: "blocker" }];
    expect(rescueSuggestions(shows, fixed, ["fav"], { days: [D], bufferMin: 10 })).toEqual([]);
  });

  it("すでに置いたお気に入りは対象にしない", () => {
    const shows = [show("fav", [[D, "10:00", "11:00"]])];
    const fixed = [{ day: D, start: "10:00", end: "11:00", showId: "fav" }];
    expect(rescueSuggestions(shows, fixed, ["fav"], { days: [D], bufferMin: 10 })).toEqual([]);
  });

  it("助ける手がなければ swaps は空で返す（入らない事実は伝える）", () => {
    const shows = [
      show("blocker", [[D, "10:00", "11:00"]]), // 他の回がない
      show("fav", [[D, "10:00", "11:00"]]),
    ];
    const fixed = [{ day: D, start: "10:00", end: "11:00", showId: "blocker" }];
    const res = rescueSuggestions(shows, fixed, ["fav"], { days: [D], bufferMin: 10 });
    expect(res[0].swaps).toEqual([]);
  });

  it("休憩は動かさない", () => {
    const shows = [show("fav", [[D, "10:00", "11:00"]])];
    const fixed = [{ day: D, start: "10:00", end: "11:00", label: "休憩" }];
    const res = rescueSuggestions(shows, fixed, ["fav"], { days: [D], bufferMin: 10 });
    expect(res[0].swaps).toEqual([]);
  });

  it("移し先が他の予定とぶつかる回は提案しない", () => {
    const shows = [
      show("blocker", [[D, "10:00", "11:00"], [D, "13:00", "14:00"]]),
      show("other", [[D, "13:00", "14:00"]]),
      show("fav", [[D, "10:00", "11:00"]]),
    ];
    const fixed = [
      { day: D, start: "10:00", end: "11:00", showId: "blocker" },
      { day: D, start: "13:00", end: "14:00", showId: "other" },
    ];
    const res = rescueSuggestions(shows, fixed, ["fav"], { days: [D], bufferMin: 10 });
    expect(res[0].swaps).toEqual([]);
  });

  it("参加しない日の回へは移さない", () => {
    const shows = [
      show("blocker", [[D, "10:00", "11:00"], [D2, "10:00", "11:00"]]),
      show("fav", [[D, "10:00", "11:00"]]),
    ];
    const fixed = [{ day: D, start: "10:00", end: "11:00", showId: "blocker" }];
    // 土曜しか行かないので、日曜へ移す提案は出してはいけない
    const res = rescueSuggestions(shows, fixed, ["fav"], { days: [D], bufferMin: 10 });
    expect(res[0].swaps).toEqual([]);
  });

  it("別の日へ移す提案もできる", () => {
    const shows = [
      show("blocker", [[D, "10:00", "11:00"], [D2, "10:00", "11:00"]]),
      show("fav", [[D, "10:00", "11:00"]]),
    ];
    const fixed = [{ day: D, start: "10:00", end: "11:00", showId: "blocker" }];
    const res = rescueSuggestions(shows, fixed, ["fav"], { days: [D, D2], bufferMin: 10 });
    expect(res[0].swaps[0].to.day).toBe(D2);
  });
});

describe("diagnoseConflicts", () => {
  it("全枠が両立しない必須ペアを検出する", () => {
    const shows = [
      show("a", [[D, "10:00", "12:00"]]),
      show("b", [[D, "11:00", "13:00"]]),
    ];
    const res = diagnoseConflicts(shows, ["a", "b"], { day: D, bufferMin: 10 });
    expect(res.pairs).toEqual([{ a: "a", b: "b", aTitle: "A", bTitle: "B" }]);
  });

  it("どこかで両立できるペアは挙げない", () => {
    const shows = [
      show("a", [[D, "10:00", "12:00"], [D, "14:00", "16:00"]]),
      show("b", [[D, "11:00", "13:00"]]),
    ];
    const res = diagnoseConflicts(shows, ["a", "b"], { day: D, bufferMin: 10 });
    expect(res.pairs).toEqual([]);
  });

  it("その日に枠がない公演を挙げる", () => {
    const shows = [show("a", [["09-13", "10:00", "11:00"]]), show("b", [[D, "10:00", "11:00"]])];
    const res = diagnoseConflicts(shows, ["a", "b"], { day: D, bufferMin: 10 });
    expect(res.noSlot).toEqual([{ id: "a", title: "A" }]);
  });

  it("時刻制約で枠が全部消えた公演も挙げる", () => {
    const shows = [show("a", [[D, "09:00", "10:00"]])];
    const res = diagnoseConflicts(shows, ["a"], { day: D, bufferMin: 10, earliestStart: "12:00" });
    expect(res.noSlot).toEqual([{ id: "a", title: "A" }]);
  });
});

describe("formatPlanAsText", () => {
  it("時系列と空き時間を含む文字列を返す", () => {
    const shows = [
      show("a", [[D, "10:00", "11:00"]], { title: "公演A", venue: "room2f" }),
      show("b", [[D, "11:30", "12:30"]], { title: "公演B", venue: "hall2f" }),
    ];
    const res = findPlans(shows, { a: "want", b: "want" }, { day: D, bufferMin: 10 });
    const text = formatPlanAsText(res.plans[0], {
      dayLabel: "9/12(土)",
      venueLabels: { room2f: "2Fルーム", hall2f: "2Fホール" },
    });
    expect(text).toContain("9/12(土)");
    expect(text).toContain("10:00-11:00");
    expect(text).toContain("公演A");
    expect(text).toContain("2Fルーム");
    expect(text).toContain("30分");
    expect(text).toContain("公演B");
  });
});

describe("festivalNow", () => {
  const FES = { year: 2026, days: [{ id: "09-12" }, { id: "09-13" }] };

  it("会期中の日時なら、その日と分に直す", () => {
    expect(festivalNow(new Date(2026, 8, 12, 15, 40), FES)).toEqual({ day: "09-12", min: 940 });
  });

  it("2日目も拾う", () => {
    expect(festivalNow(new Date(2026, 8, 13, 10, 0), FES)).toEqual({ day: "09-13", min: 600 });
  });

  it("会期の前後は null", () => {
    expect(festivalNow(new Date(2026, 8, 11, 23, 59), FES)).toBeNull();
    expect(festivalNow(new Date(2026, 8, 14, 0, 0), FES)).toBeNull();
  });

  it("日付が合っていても年が違えば null", () => {
    expect(festivalNow(new Date(2025, 8, 12, 12, 0), FES)).toBeNull();
    expect(festivalNow(new Date(2027, 8, 12, 12, 0), FES)).toBeNull();
  });
});

describe("nowNext", () => {
  const F = [
    { day: "09-12", start: "10:00", end: "11:00", showId: "a" },
    { day: "09-12", start: "12:00", end: "13:00", label: "ごはん" },
    { day: "09-12", start: "15:40", end: "17:30", showId: "b" },
    { day: "09-13", start: "10:00", end: "11:00", showId: "c" },
  ];

  it("開いている最中のものを current にする", () => {
    const r = nowNext(F, { day: "09-12", min: toMinutes("10:30") });
    expect(r.current.showId).toBe("a");
    expect(r.leftOfCurrent).toBe(30);
    expect(r.next.label).toBe("ごはん");
    expect(r.untilNext).toBe(90);
  });

  it("終わった直後は current が無く、次だけになる", () => {
    const r = nowNext(F, { day: "09-12", min: toMinutes("11:00") });
    expect(r.current).toBeNull();
    expect(r.next.label).toBe("ごはん");
    expect(r.untilNext).toBe(60);
    expect(r.done).toHaveLength(1);
  });

  it("最後が終わったら次は無い", () => {
    const r = nowNext(F, { day: "09-12", min: toMinutes("18:00") });
    expect(r.current).toBeNull();
    expect(r.next).toBeNull();
    expect(r.untilNext).toBeNull();
    expect(r.done).toHaveLength(3);
  });

  it("その日の予定だけを見る", () => {
    const r = nowNext(F, { day: "09-13", min: toMinutes("09:00") });
    expect(r.next.showId).toBe("c");
    expect(r.later).toHaveLength(0);
    expect(r.done).toHaveLength(0);
  });

  it("始まる前は全部これから", () => {
    const r = nowNext(F, { day: "09-12", min: toMinutes("09:00") });
    expect(r.next.showId).toBe("a");
    expect(r.later).toHaveLength(2);
  });

  it("並んでいなくても時刻順に見る", () => {
    const r = nowNext([...F].reverse(), { day: "09-12", min: toMinutes("09:00") });
    expect(r.next.showId).toBe("a");
    expect(r.later.map((f) => f.start)).toEqual(["12:00", "15:40"]);
  });
});
