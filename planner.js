// はしごプランの探索ロジック。DOM には一切触れない純粋関数だけを置く。

const RANK_KEYS = ["must", "want", "maybe"];

/** ビットマスクDPの上限。2^18 = 262144 マスクまで。フェスの公演数(12)には十分な余裕がある。 */
export const MAX_SELECTABLE_SHOWS = 18;

/** "HH:MM" を 0時からの分に変換する。 */
export function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? "").trim());
  if (!m) throw new Error(`時刻の形式が不正です: ${hhmm}`);
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) throw new Error(`時刻の範囲が不正です: ${hhmm}`);
  return h * 60 + mi;
}

/** 分を "H:MM" 表記に戻す（テキスト出力用）。 */
export function toHHMM(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/**
 * prev の直後に next を入れられるか。
 * あきが 0 分ちょうど（前の終了と次の開始が同時刻）は、バッファ0でも繋がらない扱いにする。
 */
export function canFollow(prev, next, bufferMin = 0) {
  const gap = toMinutes(next.start) - toMinutes(prev.end);
  return gap > 0 && gap >= bufferMin;
}

/** あき(分)がバッファ条件を満たすか。 */
function gapOk(gap, bufferMin) {
  return gap > 0 && gap >= bufferMin;
}

/** 対象公演の、条件に合う枠だけを集める。 */
function collectSlots(show, { day, minStartMin, maxEndMin }) {
  const out = [];
  for (const slot of show.slots ?? []) {
    if (day && slot.day !== day) continue;
    const startMin = toMinutes(slot.start);
    const endMin = toMinutes(slot.end);
    if (startMin < minStartMin || endMin > maxEndMin) continue;
    out.push({
      showId: show.id,
      title: show.title,
      venue: show.venue,
      day: slot.day,
      start: slot.start,
      end: slot.end,
      startMin,
      endMin,
    });
  }
  out.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  return out;
}

function normalizeOpts(opts = {}) {
  return {
    day: opts.day ?? null,
    bufferMin: opts.bufferMin ?? 10,
    minStartMin: opts.earliestStart == null ? -Infinity : toMinutes(opts.earliestStart),
    maxEndMin: opts.latestEnd == null ? Infinity : toMinutes(opts.latestEnd),
    maxPlans: opts.maxPlans ?? 20,
  };
}

/**
 * 成立するプランを探して、良い順に返す。
 *
 * 「どの公演を観るか」の集合ごとにビットマスクDPで最小終了時刻を求める。
 * 同じ公演の組み合わせは1プランにまとめるので、結果が似たものだらけにならない。
 *
 * @param shows 公演の配列（shows.js の SHOWS 形式）
 * @param ranks { showId: "must" | "want" | "maybe" }
 * @returns { plans, tooManyShows, feasibleCount }
 */
export function findPlans(shows, ranks, opts = {}) {
  const o = normalizeOpts(opts);
  const selected = (shows ?? []).filter((s) => RANK_KEYS.includes(ranks?.[s.id]));

  if (selected.length === 0) {
    return { plans: [], tooManyShows: false, feasibleCount: 0 };
  }
  if (selected.length > MAX_SELECTABLE_SHOWS) {
    return { plans: [], tooManyShows: true, feasibleCount: 0 };
  }

  const slotsByShow = selected.map((s) => collectSlots(s, o));
  const n = selected.length;
  const { best, from, size } = buildDP(slotsByShow, o.bufferMin);

  // 極大な集合（これ以上どの公演も足せない）だけをプランにする。
  const plans = [];
  let feasibleCount = 0;
  for (let mask = 1; mask < size; mask++) {
    if (best[mask] === Infinity) continue;
    feasibleCount++;

    let maximal = true;
    for (let k = 0; k < n && maximal; k++) {
      const bit = 1 << k;
      if (mask & bit) continue;
      if (best[mask | bit] < Infinity) maximal = false;
    }
    if (!maximal) continue;

    const order = reconstructOrder(mask, from);
    const slots = compact(order, slotsByShow, from, mask, best, o.bufferMin);
    plans.push(buildPlan(order, slots, selected, ranks));
  }

  plans.sort(comparePlans);
  return { plans: plans.slice(0, o.maxPlans), tooManyShows: false, feasibleCount };
}

/**
 * 公演ごとの候補枠から、部分集合ごとの「ありうる最も早い終了時刻」を求める。
 *
 * best[mask] が Infinity なら、その組み合わせは1日に収まらない。
 * 最も早く終わる組み方を持てば、そのあとに足せるものは必ず足せるので、この値だけで足りる。
 */
function buildDP(slotsByShow, bufferMin) {
  const n = slotsByShow.length;
  const size = 1 << n;
  const best = new Float64Array(size).fill(Infinity);
  const from = new Array(size).fill(null);
  best[0] = -Infinity;

  for (let mask = 0; mask < size; mask++) {
    const cur = best[mask];
    if (cur === Infinity) continue;
    for (let k = 0; k < n; k++) {
      const bit = 1 << k;
      if (mask & bit) continue;

      let pick = null;
      for (const slot of slotsByShow[k]) {
        if (!gapOk(slot.startMin - cur, bufferMin)) continue;
        if (pick === null || slot.endMin < pick.endMin) pick = slot;
      }
      if (pick === null) continue;

      const next = mask | bit;
      if (pick.endMin < best[next]) {
        best[next] = pick.endMin;
        from[next] = { prevMask: mask, showIndex: k };
      }
    }
  }
  return { best, from, size, n };
}

/** from を辿って、mask の公演を観る順（時系列）の showIndex 配列を返す。 */
function reconstructOrder(mask, from) {
  const order = [];
  let cur = mask;
  while (cur !== 0) {
    const step = from[cur];
    order.push(step.showIndex);
    cur = step.prevMask;
  }
  order.reverse();
  return order;
}

/**
 * DP は「最も早く終わる」枠を選ぶので、途中に無駄なあきが残ることがある。
 * 最後の公演は DP の選択を保ったまま、手前の公演を後ろへ寄せて待ち時間を詰める。
 */
function compact(order, slotsByShow, from, mask, best, bufferMin) {
  const dpSlots = dpSlotsOf(order, slotsByShow, best, from, mask, bufferMin);
  if (order.length <= 1) return dpSlots;

  const result = new Array(order.length);
  result[order.length - 1] = dpSlots[order.length - 1];
  let limit = result[order.length - 1].startMin;

  for (let i = order.length - 2; i >= 0; i--) {
    let pick = null;
    for (const slot of slotsByShow[order[i]]) {
      if (!gapOk(limit - slot.endMin, bufferMin)) continue;
      if (pick === null || slot.startMin > pick.startMin) pick = slot;
    }
    if (pick === null) return dpSlots; // 詰められないときは DP の結果をそのまま使う
    result[i] = pick;
    limit = pick.startMin;
  }
  return result;
}

/** DP が実際に選んだ枠を、前から順に引き直す。 */
function dpSlotsOf(order, slotsByShow, best, from, mask, bufferMin) {
  // from はマスク単位でしか持っていないので、前から貪欲に引き直す（DP と同じ選び方）。
  const slots = [];
  let cur = -Infinity;
  for (const k of order) {
    let pick = null;
    for (const slot of slotsByShow[k]) {
      if (!gapOk(slot.startMin - cur, bufferMin)) continue;
      if (pick === null || slot.endMin < pick.endMin) pick = slot;
    }
    slots.push(pick);
    cur = pick.endMin;
  }
  return slots;
}

function buildPlan(order, slots, selected, ranks) {
  const items = order.map((k, i) => {
    const slot = slots[i];
    const next = slots[i + 1];
    return {
      showId: selected[k].id,
      title: selected[k].title,
      venue: selected[k].venue,
      price: selected[k].price ?? 0,
      unit: selected[k].unit ?? "person",
      rank: ranks[selected[k].id],
      day: slot.day,
      start: slot.start,
      end: slot.end,
      startMin: slot.startMin,
      endMin: slot.endMin,
      gapAfterMin: next ? next.startMin - slot.endMin : null,
    };
  });

  const score = {
    must: 0, want: 0, maybe: 0, count: items.length,
    idleMin: 0, spanMin: 0,
    // 1人あたりの料金と、1組あたりの料金は足し合わせられないので分けて持つ
    pricePerPerson: 0, priceGroup: 0,
  };
  for (const it of items) {
    score[it.rank]++;
    if (it.unit === "group") score.priceGroup += it.price;
    else score.pricePerPerson += it.price;
  }
  for (let i = 1; i < items.length; i++) score.idleMin += items[i].startMin - items[i - 1].endMin;
  if (items.length) score.spanMin = items[items.length - 1].endMin - items[0].startMin;

  return {
    key: items.map((i) => i.showId).sort().join("+"),
    items,
    score,
  };
}

function comparePlans(a, b) {
  return (
    b.score.must - a.score.must ||
    b.score.want - a.score.want ||
    b.score.maybe - a.score.maybe ||
    a.score.idleMin - b.score.idleMin ||
    a.score.spanMin - b.score.spanMin ||
    a.items[0].startMin - b.items[0].startMin
  );
}

/* ------------------------------------------------------------------
   ここから下は「自分で置いた予定を前提に、残りを埋める」ための関数。
   fixed には置いた公演も休憩も同じ形で入れる:
     { day, start, end, showId?, label? }
   showId があるものはその公演を配置済みとみなす。無いものは単に時間を塞ぐ。
   ------------------------------------------------------------------ */

/** その枠が、固定された予定のどれかとぶつかるか。 */
function hitsFixed(slot, fixedOnDay, bufferMin) {
  return fixedOnDay.some((f) => {
    const fa = toMinutes(f.start);
    const fb = toMinutes(f.end);
    const after = gapOk(slot.startMin - fb, bufferMin);
    const before = gapOk(fa - slot.endMin, bufferMin);
    return !after && !before;
  });
}

/**
 * まだ置いていない公演について、いま置ける枠を日をまたいで列挙する。
 *
 * options が1件だけなら「ここを逃すともう入らない」ということ。UIで警告に使う。
 */
export function placementOptions(shows, fixed = [], opts = {}) {
  const { days = [], bufferMin = 10, windows = {} } = opts;
  const placed = new Set(fixed.filter((f) => f.showId).map((f) => f.showId));

  return (shows ?? [])
    .filter((s) => !placed.has(s.id))
    .map((show) => {
      const options = [];
      for (const day of days) {
        const fixedOnDay = fixed.filter((f) => f.day === day);
        // 入れてよい時間の指定があれば、その外の枠は最初から候補にしない
        const w = windows?.[day] ?? {};
        const bounds = {
          day,
          minStartMin: w.from ? toMinutes(w.from) : -Infinity,
          maxEndMin: w.to ? toMinutes(w.to) : Infinity,
        };
        for (const slot of collectSlots(show, bounds)) {
          if (!hitsFixed(slot, fixedOnDay, bufferMin)) options.push(slot);
        }
      }
      return { showId: show.id, title: show.title, venue: show.venue, options };
    });
}

/** その日の予定を並べたときの、あいだの空き時間の合計。 */
function totalIdle(entries) {
  const s = [...entries].sort((a, b) => a.startMin - b.startMin);
  let idle = 0;
  for (let i = 1; i < s.length; i++) idle += s[i].startMin - s[i - 1].endMin;
  return idle;
}

/** その枠が、並んでいる予定のどれともぶつからないか。 */
function freeAgainst(slot, entries, bufferMin) {
  return entries.every(
    (e) => gapOk(slot.startMin - e.endMin, bufferMin) || gapOk(e.startMin - slot.endMin, bufferMin),
  );
}

/**
 * 入れる公演はそのままに、それぞれを別の回へ振り替えて待ち時間を減らす。
 *
 * 何を入れるかは部分集合DPで決めたあとなので、ここでは「どの回にするか」だけを動かす。
 * 1つずつ最良の回へ移すのを、改善が止まるまで繰り返す。
 */
function minimizeIdle(fixedOnDay, added, slotsByShowId, bufferMin) {
  const cur = added.map((a) => ({ ...a }));
  for (let pass = 0; pass < 4; pass++) {
    let improved = false;
    for (let i = 0; i < cur.length; i++) {
      const others = [...fixedOnDay, ...cur.filter((_, j) => j !== i)];
      let bestIdle = totalIdle([...others, cur[i]]);
      let bestSlot = null;
      for (const slot of slotsByShowId.get(cur[i].showId) ?? []) {
        if (slot.startMin === cur[i].startMin) continue;
        if (!freeAgainst(slot, others, bufferMin)) continue;
        const idle = totalIdle([...others, slot]);
        if (idle < bestIdle) {
          bestIdle = idle;
          bestSlot = slot;
        }
      }
      if (bestSlot) {
        cur[i] = {
          ...cur[i],
          start: bestSlot.start,
          end: bestSlot.end,
          startMin: bestSlot.startMin,
          endMin: bestSlot.endMin,
        };
        improved = true;
      }
    }
    if (!improved) break;
  }
  return cur;
}

/**
 * 自分で置いた予定を動かさずに、残りの公演を詰める。
 *
 * 日ごとに部分集合DPを作ってから、どの公演をどちらの日に回すかを部分集合の
 * 組み合わせで決める。土曜のこの枠を逃すと日曜にも入らない、が正しく効くようにするため、
 * 片方ずつ貪欲に埋めるのではなく両日を同時に見る。
 *
 * 優先順位は「お気に入りの数 → 全体の数」。何を入れるかが決まったあと、
 * 待ち時間が短くなる回へ振り替える。
 *
 * @param opts.favoriteIds 先に入れたい公演
 * @param opts.onlyFavorites お気に入り以外を候補にしない
 * @param opts.windows { [day]: { from, to } } その日に入れてよい時間帯
 */
export function suggestFills(shows, fixed = [], opts = {}) {
  const { days = [], bufferMin = 10, favoriteIds = [], onlyFavorites = false, windows = {} } = opts;
  const placed = new Set(fixed.filter((f) => f.showId).map((f) => f.showId));
  const favs = new Set(favoriteIds);
  let targets = (shows ?? []).filter((s) => !placed.has(s.id));
  if (onlyFavorites) targets = targets.filter((s) => favs.has(s.id));

  const none = { added: [], tooManyShows: false, idleByDay: {} };
  if (targets.length === 0 || days.length === 0) return none;
  if (targets.length > MAX_SELECTABLE_SHOWS) return { added: [], tooManyShows: true, idleByDay: {} };

  // 日ごとに、固定された予定とぶつからない枠だけを候補にしてDPを作る。
  // 個別にぶつからない枠どうしが繋がっていれば、固定ぶんと合わせても必ず成立する。
  const dps = days.map((day) => {
    const fixedOnDay = fixed.filter((f) => f.day === day);
    const w = windows[day] ?? {};
    const bounds = {
      day,
      minStartMin: w.from == null || w.from === "" ? -Infinity : toMinutes(w.from),
      maxEndMin: w.to == null || w.to === "" ? Infinity : toMinutes(w.to),
    };
    const slotsByShow = targets.map((s) =>
      collectSlots(s, bounds).filter((slot) => !hitsFixed(slot, fixedOnDay, bufferMin)),
    );
    return { day, slotsByShow, ...buildDP(slotsByShow, bufferMin) };
  });

  // どの公演をどの日に回すか。reach[mask] = その集合を今までの日で全部さばけるか。
  const size = 1 << targets.length;
  let reach = new Uint8Array(size);
  reach[0] = 1;
  const picks = [];

  for (const dp of dps) {
    const next = new Uint8Array(size);
    const pick = new Int32Array(size).fill(-1);
    for (let mask = 0; mask < size; mask++) {
      for (let sub = mask; ; sub = (sub - 1) & mask) {
        if (reach[mask ^ sub] && dp.best[sub] < Infinity) {
          next[mask] = 1;
          pick[mask] = sub;
          break;
        }
        if (sub === 0) break;
      }
    }
    reach = next;
    picks.push(pick);
  }

  // お気に入りの数を先に、次に全体の数を最大にする
  let favMask = 0;
  targets.forEach((s, k) => {
    if (favs.has(s.id)) favMask |= 1 << k;
  });

  let bestMask = 0;
  let bestScore = 0;
  for (let mask = 1; mask < size; mask++) {
    if (!reach[mask]) continue;
    const score = popcount(mask & favMask) * 1000 + popcount(mask);
    if (score > bestScore) {
      bestScore = score;
      bestMask = mask;
    }
  }
  if (bestMask === 0) return none;

  // 日ごとの担当を後ろから割り戻す
  const perDay = new Array(dps.length).fill(0);
  let rest = bestMask;
  for (let i = dps.length - 1; i >= 0; i--) {
    perDay[i] = picks[i][rest];
    rest ^= perDay[i];
  }

  const added = [];
  const idleByDay = {};
  dps.forEach((dp, i) => {
    const mask = perDay[i];
    const fixedOnDay = fixed
      .filter((f) => f.day === dp.day)
      .map((f) => ({ startMin: toMinutes(f.start), endMin: toMinutes(f.end) }));

    if (!mask) {
      idleByDay[dp.day] = totalIdle(fixedOnDay);
      return;
    }

    const order = reconstructOrder(mask, dp.from);
    const slots = compact(order, dp.slotsByShow, dp.from, mask, dp.best, bufferMin);
    let dayAdds = order.map((k, j) => {
      const show = targets[k];
      const slot = slots[j];
      return {
        showId: show.id,
        title: show.title,
        venue: show.venue,
        price: show.price ?? 0,
        unit: show.unit ?? "person",
        day: dp.day,
        start: slot.start,
        end: slot.end,
        startMin: slot.startMin,
        endMin: slot.endMin,
      };
    });

    // 入れるものは変えずに、待ち時間が短くなる回へ振り替える
    const slotsByShowId = new Map(order.map((k) => [targets[k].id, dp.slotsByShow[k]]));
    dayAdds = minimizeIdle(fixedOnDay, dayAdds, slotsByShowId, bufferMin);

    idleByDay[dp.day] = totalIdle([...fixedOnDay, ...dayAdds]);
    added.push(...dayAdds);
  });

  added.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.startMin - b.startMin));
  return { added, tooManyShows: false, idleByDay };
}

/**
 * お気に入りが入らなくなったとき、置いてある公演を別の回へ移せば助かるかを探す。
 *
 * 休憩は動かさない（自分で置いた予定なので）。移す先は元の予定とぶつからない回だけ。
 *
 * @returns [{ showId, title, swaps: [{ showId, title, from, to, thenAt }] }]
 */
export function rescueSuggestions(shows, fixed = [], favoriteIds = [], opts = {}) {
  const { days = [], bufferMin = 10, maxSwaps = 3 } = opts;
  const byId = new Map((shows ?? []).map((s) => [s.id, s]));
  const placed = new Set(fixed.filter((f) => f.showId).map((f) => f.showId));

  const optMap = new Map(
    placementOptions(shows, fixed, { days, bufferMin }).map((o) => [o.showId, o.options]),
  );
  const blocked = favoriteIds.filter(
    (id) => byId.has(id) && !placed.has(id) && (optMap.get(id)?.length ?? 0) === 0,
  );
  if (blocked.length === 0) return [];

  /** その予定の並びで、show がどこかに入れるか。 */
  const canStillFit = (show, trial) => {
    for (const day of days) {
      const onDay = trial.filter((f) => f.day === day);
      for (const slot of collectSlots(show, { day, minStartMin: -Infinity, maxEndMin: Infinity })) {
        if (!hitsFixed(slot, onDay, bufferMin)) return slot;
      }
    }
    return null;
  };

  const movable = fixed.filter((f) => f.showId && byId.has(f.showId));

  return blocked.map((id) => {
    const target = byId.get(id);
    const swaps = [];
    for (const f of movable) {
      if (swaps.length >= maxSwaps) break;
      const moving = byId.get(f.showId);
      const others = fixed.filter((g) => g !== f);
      for (const alt of moving.slots) {
        if (!days.includes(alt.day)) continue; // 参加しない日へは移さない
        if (alt.day === f.day && alt.start === f.start) continue;
        const altSlot = { startMin: toMinutes(alt.start), endMin: toMinutes(alt.end) };
        if (hitsFixed(altSlot, others.filter((g) => g.day === alt.day), bufferMin)) continue;

        const trial = [...others, { ...f, day: alt.day, start: alt.start, end: alt.end }];
        const spot = canStillFit(target, trial);
        if (!spot) continue;

        swaps.push({
          showId: f.showId,
          title: moving.title,
          from: { day: f.day, start: f.start, end: f.end },
          to: { day: alt.day, start: alt.start, end: alt.end },
          thenAt: { day: spot.day, start: spot.start, end: spot.end },
        });
        break; // 同じ公演で複数の移し先は出さない
      }
    }
    return { showId: id, title: target.title, swaps };
  });
}

function popcount(x) {
  let c = 0;
  while (x) {
    x &= x - 1;
    c++;
  }
  return c;
}

/**
 * あきに入れられる公演の組み合わせを、入る数の多い順に返す。
 *
 * 判定は findPlans をそのまま使う。衝突の考え方が2本に分かれると必ずズレるため。
 * afterMin は直前の公演の終了、beforeMin は直後の公演の開始（どちらも分、null で制限なし）。
 *
 * @returns findPlans と同じ形。plans[0] が一番多く入る組み合わせ。
 */
export function fillGap(shows, opts = {}) {
  const {
    day = null,
    bufferMin = 10,
    afterMin = null,
    beforeMin = null,
    excludeIds = [],
    maxPlans = 5,
  } = opts;

  const margin = Math.max(bufferMin, 1); // 0分乗り換えは認めない
  const empty = { plans: [], tooManyShows: false, feasibleCount: 0 };

  const lo = afterMin == null ? null : afterMin + margin;
  const hi = beforeMin == null ? null : beforeMin - margin;
  if (lo != null && (lo < 0 || lo > 1439)) return empty;
  if (hi != null && (hi < 0 || hi > 1439)) return empty;
  if (lo != null && hi != null && lo >= hi) return empty;

  const exclude = new Set(excludeIds);
  const targets = (shows ?? []).filter((s) => !exclude.has(s.id));
  if (targets.length === 0) return empty;

  const ranks = Object.fromEntries(targets.map((s) => [s.id, "want"]));
  return findPlans(targets, ranks, {
    day,
    bufferMin,
    maxPlans,
    earliestStart: lo == null ? null : toHHMM(lo),
    latestEnd: hi == null ? null : toHHMM(hi),
  });
}

/**
 * 必須が全部入らないときに、原因を名指しするための診断。
 * @returns { pairs, noSlot } pairs はどの枠を選んでも両立しない必須ペア
 */
export function diagnoseConflicts(shows, mustIds, opts = {}) {
  const o = normalizeOpts(opts);
  const byId = new Map((shows ?? []).map((s) => [s.id, s]));

  const noSlot = [];
  const usable = [];
  for (const id of mustIds ?? []) {
    const show = byId.get(id);
    if (!show) continue;
    const slots = collectSlots(show, o);
    if (slots.length === 0) noSlot.push({ id: show.id, title: show.title });
    else usable.push({ show, slots });
  }

  const pairs = [];
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const A = usable[i];
      const B = usable[j];
      const compatible = A.slots.some((a) =>
        B.slots.some(
          (b) =>
            gapOk(b.startMin - a.endMin, o.bufferMin) ||
            gapOk(a.startMin - b.endMin, o.bufferMin),
        ),
      );
      if (!compatible) {
        pairs.push({
          a: A.show.id,
          b: B.show.id,
          aTitle: A.show.title,
          bTitle: B.show.title,
        });
      }
    }
  }

  return { pairs, noSlot };
}

/** プランを共有用のプレーンテキストにする。 */
export function formatPlanAsText(plan, { dayLabel = "", venueLabels = {}, title = "はしごプラン" } = {}) {
  const header = dayLabel ? `${title}｜${dayLabel}` : title;
  const lines = [header, ""];

  plan.items.forEach((it, i) => {
    const venue = venueLabels[it.venue] ?? it.venue;
    lines.push(`${it.start}-${it.end}  ${it.title}（${venue}）`);
    if (i < plan.items.length - 1) {
      lines.push(`　　↓ ${it.gapAfterMin}分あき`);
    }
  });

  const money = [];
  if (plan.score.pricePerPerson) money.push(`¥${plan.score.pricePerPerson.toLocaleString("ja-JP")}/人`);
  if (plan.score.priceGroup) money.push(`¥${plan.score.priceGroup.toLocaleString("ja-JP")}/回`);
  if (money.length) lines.push("", `公演の合計 ${money.join(" ＋ ")}（入場チケットは別）`);

  return lines.join("\n");
}

/* ---------------- 当日 ---------------- */

/**
 * 今が会期中かどうかを、端末の時計から見る。
 * 会期中なら { day, min }、そうでなければ null。
 * 日付は端末のローカル時刻で見る（現地で開くので、それでいい）。
 */
export function festivalNow(date, fes) {
  if (date.getFullYear() !== fes.year) return null;
  const id =
    String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  if (!fes.days.some((d) => d.id === id)) return null;
  return { day: id, min: date.getHours() * 60 + date.getMinutes() };
}

/**
 * 立てた予定を「今」で切って、いま出ているもの・次のもの・終わったものに分ける。
 * 当日は全体を見渡したいわけではなく、次に何をすればいいかだけが知りたい。
 *
 * untilNext は次が始まるまでの分。leftOfCurrent は今出ているものが終わるまでの分。
 */
export function nowNext(fixed, now) {
  const today = fixed
    .filter((f) => f.day === now.day)
    .map((f) => ({ ...f, a: toMinutes(f.start), b: toMinutes(f.end) }))
    .sort((x, y) => x.a - y.a);

  const t = now.min;
  const current = today.find((f) => f.a <= t && t < f.b) ?? null;
  const upcoming = today.filter((f) => f.a > t);
  const next = upcoming[0] ?? null;

  return {
    current,
    next,
    later: upcoming.slice(1),
    done: today.filter((f) => f.b <= t),
    untilNext: next ? next.a - t : null,
    leftOfCurrent: current ? current.b - t : null,
  };
}
