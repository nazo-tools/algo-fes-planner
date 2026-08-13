// 公演データの転記ミスを機械で拾うためのテスト。
// タイムテーブルは目で写すので、ここが最後の砦になる。
import { describe, it, expect } from "vitest";
import { FES, VENUES, SHOWS } from "../shows.js";
import { SHOW_IMAGES } from "../show-images.js";
import { toMinutes } from "../planner.js";

const dayIds = new Set(FES.days.map((d) => d.id));

/**
 * 枠の長さが所要時間と一致しない、既知の例外。
 * 増やすときは必ず原本を見直すこと。
 */
const KNOWN_LENGTH_EXCEPTIONS = new Set([
  "oitoke 09-13 18:30-19:20", // 最終回だけ50分。原本を確認済みで、誤記ではない
]);

describe("公演データ", () => {
  it("idが重複していない", () => {
    const ids = SHOWS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("会場がVENUESに存在する", () => {
    for (const s of SHOWS) expect(Object.keys(VENUES)).toContain(s.venue);
  });

  it("すべての枠が既知の開催日に属する", () => {
    for (const s of SHOWS) {
      for (const slot of s.slots) expect(dayIds.has(slot.day)).toBe(true);
    }
  });

  it("すべての枠で開始 < 終了", () => {
    for (const s of SHOWS) {
      for (const slot of s.slots) {
        expect(toMinutes(slot.end)).toBeGreaterThan(toMinutes(slot.start));
      }
    }
  });

  it("枠の長さが所要時間と一致する（既知の例外を除く）", () => {
    const mismatches = [];
    for (const s of SHOWS) {
      for (const slot of s.slots) {
        const len = toMinutes(slot.end) - toMinutes(slot.start);
        if (len === s.durationMin) continue;
        const key = `${s.id} ${slot.day} ${slot.start}-${slot.end}`;
        if (KNOWN_LENGTH_EXCEPTIONS.has(key)) continue;
        mismatches.push(`${key} は ${len}分（所要 ${s.durationMin}分）`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("同じ公演の枠どうしが重なっていない", () => {
    for (const s of SHOWS) {
      for (const day of dayIds) {
        const slots = s.slots
          .filter((x) => x.day === day)
          .map((x) => ({ ...x, a: toMinutes(x.start), b: toMinutes(x.end) }))
          .sort((x, y) => x.a - y.a);
        for (let i = 1; i < slots.length; i++) {
          expect(
            `${s.id} ${day}: ${slots[i - 1].start}-${slots[i - 1].end} → ${slots[i].start}`,
          ).toBe(
            slots[i].a >= slots[i - 1].b
              ? `${s.id} ${day}: ${slots[i - 1].start}-${slots[i - 1].end} → ${slots[i].start}`
              : "重なっている",
          );
        }
      }
    }
  });

  it("両日ともすべての公演に枠がある", () => {
    for (const s of SHOWS) {
      for (const day of dayIds) {
        expect(s.slots.some((x) => x.day === day)).toBe(true);
      }
    }
  });

  it("料金と人数が入っている", () => {
    for (const s of SHOWS) {
      expect(typeof s.price).toBe("number");
      expect(s.price).toBeGreaterThan(0);
      expect(["person", "group"]).toContain(s.unit);
      expect(s.people).toMatch(/人$/);
    }
  });
});

describe("定員の表記", () => {
  // 人数で絞り込むことはしない（ソロでも相席で参加できる）。
  // ただし画面にそのまま出すので、転記ミスはここで拾う。
  it("全公演の people が「N〜M人」の形をしていて、下限が上限を超えない", () => {
    for (const s of SHOWS) {
      const m = /^(\d+)〜(\d+)人$/.exec(s.people);
      expect(m, `${s.id}: ${s.people}`).not.toBeNull();
      expect(Number(m[1]), s.id).toBeLessThanOrEqual(Number(m[2]));
    }
  });
});

describe("公演ページと画像", () => {
  it("全公演に escape.id の公演ページURLがある", () => {
    for (const s of SHOWS) {
      expect(s.url, s.id).toMatch(/^https:\/\/escape\.id\/algo-org\/[a-z0-9_-]+\/$/);
    }
  });

  it("URLが公演どうしで重複していない", () => {
    const urls = SHOWS.map((s) => s.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("全公演にキービジュアルが data URI で入っている", () => {
    for (const s of SHOWS) {
      expect(SHOW_IMAGES[s.id], s.id).toMatch(/^data:image\/webp;base64,/);
    }
  });

  it("画像の合計が 200KB を超えない（1枚ものとして配る前提）", () => {
    const bytes = Object.values(SHOW_IMAGES).reduce((a, v) => a + v.length, 0);
    expect(bytes).toBeLessThan(200 * 1024);
  });

  it("画像の余りがない（消した公演の画像が残っていない）", () => {
    expect(Object.keys(SHOW_IMAGES).sort()).toEqual(SHOWS.map((s) => s.id).sort());
  });
});
