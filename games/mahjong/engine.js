(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  const type = (id) => Math.floor(id / 4),
    honors = ["东", "南", "西", "北", "中", "发", "白"];
  const label = (t) =>
    t < 27
      ? `${(t % 9) + 1}${["万", "筒", "条"][Math.floor(t / 9)]}`
      : honors[t - 27];
  const counts = (hand) => {
    const c = Array(34).fill(0);
    for (const id of hand) c[type(id)]++;
    return c;
  };
  const terminals = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
  function winning(hand, open = 0) {
    if (!Array.isArray(hand) || hand.length !== 14 - open * 3) return null;
    const c = counts(hand);
    if (c.some((n) => n > 4)) return null;
    if (open === 0) {
      if (c.every((n) => n % 2 === 0)) return "七对";
      if (
        terminals.every((t) => c[t] > 0) &&
        terminals.reduce((n, t) => n + c[t], 0) === 14
      )
        return "十三幺";
    }
    function melds(left) {
      const t = c.findIndex((n) => n > 0);
      if (t < 0) return left === 0;
      if (left <= 0) return false;
      if (c[t] >= 3) {
        c[t] -= 3;
        const ok = melds(left - 1);
        c[t] += 3;
        if (ok) return true;
      }
      if (t < 27 && t % 9 <= 6 && c[t + 1] && c[t + 2]) {
        c[t]--;
        c[t + 1]--;
        c[t + 2]--;
        const ok = melds(left - 1);
        c[t]++;
        c[t + 1]++;
        c[t + 2]++;
        if (ok) return true;
      }
      return false;
    }
    for (let t = 0; t < 34; t++)
      if (c[t] >= 2) {
        c[t] -= 2;
        const ok = melds(4 - open);
        c[t] += 2;
        if (ok) return "四组面子加一对将";
      }
    return null;
  }
  function waits(hand, melds = []) {
    if (hand.length !== 13 - melds.length * 3) return [];
    const used = counts([...hand, ...melds.flatMap((m) => m.cards)]);
    return Array.from({ length: 34 }, (_, t) => t).filter(
      (t) => used[t] < 4 && winning([...hand, t * 4], melds.length),
    );
  }
  const shapeCache = new Map();
  function shanten(hand, open = 0) {
    const c = counts(hand),
      key = open + ":" + c.join("");
    if (shapeCache.has(key)) return shapeCache.get(key);
    let best = 8;
    function search(start, m, t, p) {
      while (start < 34 && !c[start]) start++;
      if (start === 34) {
        best = Math.min(
          best,
          8 - 2 * (m + open) - Math.min(t, 4 - m - open) - p,
        );
        return;
      }
      const i = start;
      if (m + open < 4 && c[i] >= 3) {
        c[i] -= 3;
        search(i, m + 1, t, p);
        c[i] += 3;
      }
      if (m + open < 4 && i < 27 && i % 9 <= 6 && c[i + 1] && c[i + 2]) {
        c[i]--;
        c[i + 1]--;
        c[i + 2]--;
        search(i, m + 1, t, p);
        c[i]++;
        c[i + 1]++;
        c[i + 2]++;
      }
      if (c[i] >= 2) {
        c[i] -= 2;
        if (!p) search(i, m, t, 1);
        if (t < 4) search(i, m, t + 1, p);
        c[i] += 2;
      }
      if (t < 4 && i < 27) {
        for (const gap of [1, 2])
          if ((i % 9) + gap < 9 && c[i + gap]) {
            c[i]--;
            c[i + gap]--;
            search(i, m, t + 1, p);
            c[i]++;
            c[i + gap]++;
          }
      }
      c[i]--;
      search(i, m, t, p);
      c[i]++;
    }
    search(0, 0, 0, 0);
    if (!open) {
      best = Math.min(
        best,
        6 - c.reduce((s, n) => s + Math.floor(n / 2), 0),
        13 -
          terminals.filter((t) => c[t]).length -
          Number(terminals.some((t) => c[t] >= 2)),
      );
    }
    if (shapeCache.size > 60000) shapeCache.clear();
    shapeCache.set(key, best);
    return best;
  }
  function random(seed) {
    let v = seed >>> 0;
    return () => {
      v = (Math.imul(v, 1664525) + 1013904223) >>> 0;
      return v / 4294967296;
    };
  }
  function note(s, text) {
    s.log = [...s.log, text].slice(-16);
  }
  const person = (p) => (p === 0 ? "你" : ["", "下家", "对家", "上家"][p]);
  function finish(s, player, source, selfDraw, pattern) {
    s.phase = "over";
    s.result = { winner: player, source, selfDraw, pattern };
    s.queue = [];
    s.pending = null;
    note(
      s,
      player < 0
        ? "牌墙摸完，本局流局。"
        : `${person(player)}${selfDraw ? "自摸" : "胡牌"} · ${pattern}`,
    );
  }
  function draw(s, p, tail = false) {
    if (!s.wall.length) {
      finish(s, -1, -1, false, "流局");
      return;
    }
    s.turn = p;
    s.phase = "play";
    const id = tail ? s.wall.pop() : s.wall.shift();
    s.hands[p].push(id);
    s.hands[p].sort((a, b) => a - b);
    s.drawn = id;
    s.hasDrawn = true;
    s.queue = [];
    s.pending = null;
    note(s, `${person(p)}${tail ? "补牌" : "摸牌"}。`);
  }
  function create(seed = Date.now() >>> 0) {
    const r = random(seed),
      deck = Array.from({ length: 136 }, (_, i) => i);
    for (let i = 135; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const s = {
      seed,
      dealer: seed % 4,
      turn: seed % 4,
      hands: Array.from({ length: 4 }, () =>
        deck.splice(0, 13).sort((a, b) => a - b),
      ),
      wall: deck,
      melds: [[], [], [], []],
      rivers: [[], [], [], []],
      phase: "play",
      hasDrawn: false,
      drawn: null,
      pending: null,
      queue: [],
      log: [],
      result: null,
      turns: 0,
    };
    draw(s, s.dealer);
    return s;
  }
  function chows(hand, t) {
    if (t >= 27) return [];
    const c = counts(hand),
      out = [];
    for (let base = t - 2; base <= t; base++) {
      if (
        base < 0 ||
        Math.floor(base / 9) !== Math.floor(t / 9) ||
        base % 9 > 6
      )
        continue;
      const need = [base, base + 1, base + 2].filter((x) => x !== t);
      if (need.every((x) => c[x] > 0)) out.push({ kind: "chow", base });
    }
    return out;
  }
  function claims(s, from, id, rob = false) {
    const t = type(id),
      queue = [];
    for (let d = 1; d <= 3; d++) {
      const p = (from + d) % 4;
      if (winning([...s.hands[p], id], s.melds[p].length))
        queue.push({ player: p, options: [{ kind: "hu" }] });
    }
    if (rob) return queue;
    for (let d = 1; d <= 3; d++) {
      const p = (from + d) % 4,
        n = counts(s.hands[p])[t],
        options = [];
      if (n >= 3 && s.wall.length) options.push({ kind: "kong" });
      if (n >= 2) options.push({ kind: "pung" });
      if (options.length) queue.push({ player: p, options });
    }
    const p = (from + 1) % 4,
      options = chows(s.hands[p], t);
    if (options.length) queue.push({ player: p, options });
    return queue;
  }
  function selfOptions(s) {
    if (s.phase !== "play" || !s.hasDrawn) return [];
    const p = s.turn,
      c = counts(s.hands[p]),
      options = [];
    if (winning(s.hands[p], s.melds[p].length)) options.push({ kind: "hu" });
    if (s.wall.length) {
      for (let t = 0; t < 34; t++)
        if (c[t] === 4) options.push({ kind: "concealed", tile: t });
      s.melds[p].forEach((m, index) => {
        if (m.kind === "pung" && c[type(m.cards[0])])
          options.push({ kind: "added", index });
      });
    }
    return options;
  }
  function removeTypes(s, p, types) {
    const out = [];
    for (const t of types) {
      const i = s.hands[p].findIndex((id) => type(id) === t);
      if (i < 0) throw Error("Invalid validated meld");
      out.push(...s.hands[p].splice(i, 1));
    }
    return out;
  }
  function resolvePending(s) {
    const pending = s.pending;
    if (pending.kind === "rob") {
      const t = type(pending.id);
      removeTypes(s, pending.from, [t]);
      const m = s.melds[pending.from][pending.index];
      m.cards.push(pending.id);
      m.kind = "added";
      note(s, `${person(pending.from)}加杠${label(t)}。`);
      draw(s, pending.from, true);
    } else draw(s, (pending.from + 1) % 4);
  }
  function act(state, a) {
    if (!state || !a || state.phase === "over") return state;
    const s = JSON.parse(JSON.stringify(state));
    if (s.phase === "claim") {
      const request = s.queue[0],
        p = request.player,
        pending = s.pending,
        t = type(pending.id);
      if (a.pass === true) {
        s.queue.shift();
        if (!s.queue.length) resolvePending(s);
        return s;
      }
      const option = request.options.find(
        (o) => o.kind === a.claim && (o.kind !== "chow" || o.base === a.base),
      );
      if (!option) return state;
      if (option.kind === "hu") {
        const pattern = winning([...s.hands[p], pending.id], s.melds[p].length);
        if (pending.kind === "rob")
          s.hands[pending.from] = s.hands[pending.from].filter(
            (id) => id !== pending.id,
          );
        else s.rivers[pending.from].pop();
        s.hands[p].push(pending.id);
        s.hands[p].sort((a, b) => a - b);
        finish(s, p, pending.from, false, pattern);
        return s;
      }
      const need =
          option.kind === "chow"
            ? [option.base, option.base + 1, option.base + 2].filter(
                (x) => x !== t,
              )
            : Array(option.kind === "kong" ? 3 : 2).fill(t),
        taken = removeTypes(s, p, need);
      s.rivers[pending.from].pop();
      s.melds[p].push({
        kind: option.kind,
        cards: [...taken, pending.id].sort((a, b) => a - b),
        from: pending.from,
      });
      note(
        s,
        `${person(p)}${{ chow: "吃", pung: "碰", kong: "明杠" }[option.kind]}${label(t)}。`,
      );
      s.pending = null;
      s.queue = [];
      s.turn = p;
      s.phase = "play";
      s.hasDrawn = false;
      s.drawn = null;
      if (option.kind === "kong") draw(s, p, true);
      return s;
    }
    if (s.phase !== "play") return state;
    const p = s.turn;
    if (Number.isInteger(a.discard)) {
      if (!s.hands[p].includes(a.discard)) return state;
      if (s.practice && s.guideStep === 0 && type(a.discard) !== 27)
        return state;
      s.hands[p] = s.hands[p].filter((id) => id !== a.discard);
      s.rivers[p].push(a.discard);
      s.turns++;
      s.hasDrawn = false;
      s.drawn = null;
      note(s, `${person(p)}打出${label(type(a.discard))}。`);
      if (s.practice && s.guideStep === 0) {
        s.guideStep = 1;
        draw(s, 0);
        note(s, "教学略过电脑回合：你摸到了五万，现在可以自摸。");
        return s;
      }
      s.pending = { kind: "discard", from: p, id: a.discard };
      s.queue = claims(s, p, a.discard);
      if (s.queue.length) s.phase = "claim";
      else resolvePending(s);
      return s;
    }
    const option = selfOptions(s).find(
      (o) =>
        o.kind === a.self &&
        (o.kind !== "concealed" || o.tile === a.tile) &&
        (o.kind !== "added" || o.index === a.index),
    );
    if (!option) return state;
    if (option.kind === "hu") {
      finish(s, p, p, true, winning(s.hands[p], s.melds[p].length));
      return s;
    }
    if (option.kind === "concealed") {
      const taken = removeTypes(s, p, Array(4).fill(option.tile));
      s.melds[p].push({ kind: "concealed", cards: taken, from: p });
      note(s, `${person(p)}暗杠。`);
      draw(s, p, true);
      return s;
    }
    const m = s.melds[p][option.index],
      id = s.hands[p].find((id) => type(id) === type(m.cards[0]));
    s.pending = { kind: "rob", from: p, id, index: option.index };
    s.queue = claims(s, p, id, true);
    if (s.queue.length) {
      s.phase = "claim";
      note(s, `${person(p)}尝试加杠${label(type(id))}，等待抢杠胡。`);
    } else resolvePending(s);
    return s;
  }
  function bestDiscard(s, p = s.turn) {
    const hand = s.hands[p],
      c = counts(hand),
      open = s.melds[p].length,
      seen = new Set();
    let best = null;
    for (const id of hand) {
      const t = type(id);
      if (seen.has(t)) continue;
      seen.add(t);
      const rest = hand.filter((x) => x !== id),
        distance = shanten(rest, open);
      let utility = (c[t] - 1) * 4;
      if (t < 27) {
        for (const delta of [-2, -1, 1, 2])
          if (
            t + delta >= 0 &&
            t + delta < 27 &&
            Math.floor((t + delta) / 9) === Math.floor(t / 9)
          )
            utility += c[t + delta] * (Math.abs(delta) === 1 ? 2 : 1);
      }
      const safe = s.rivers
        .filter((_, i) => i !== p)
        .flat()
        .some((x) => type(x) === t)
        ? 1
        : 0;
      const score = distance * 100 + utility - safe;
      if (!best || score < best.score) best = { id, score, shanten: distance };
    }
    return best;
  }
  function ai(s) {
    if (s.phase === "claim") {
      const request = s.queue[0],
        p = request.player;
      for (const o of request.options)
        if (o.kind === "hu" || o.kind === "kong") return { claim: o.kind };
      const baseline = shanten(s.hands[p], s.melds[p].length);
      let best = null;
      for (const o of request.options) {
        const a = {
            claim: o.kind,
            ...(o.kind === "chow" ? { base: o.base } : {}),
          },
          next = act(s, a),
          d = bestDiscard(next, p);
        if (d && d.shanten <= baseline && (!best || d.shanten < best.distance))
          best = { action: a, distance: d.shanten };
      }
      return best?.action || { pass: true };
    }
    if (s.phase === "play") {
      const options = selfOptions(s);
      if (options.some((o) => o.kind === "hu")) return { self: "hu" };
      const kong = options.find(
        (o) => o.kind === "concealed" || o.kind === "added",
      );
      if (kong) return { self: kong.kind, tile: kong.tile, index: kong.index };
      return { discard: bestDiscard(s).id };
    }
    return null;
  }
  function visibleCounts(s, p = 0) {
    return counts([
      ...s.hands[p],
      ...s.rivers.flat(),
      ...s.melds.flatMap((melds, i) =>
        melds
          .filter((m) => i === p || m.kind !== "concealed")
          .flatMap((m) => m.cards),
      ),
    ]);
  }
  function restore(packet) {
    if (
      !packet ||
      packet.version !== 1 ||
      !Number.isInteger(packet.seed) ||
      packet.seed < 0 ||
      packet.seed > 4294967295 ||
      !Array.isArray(packet.actions) ||
      packet.actions.length > 2000
    )
      return null;
    let s = create(packet.seed);
    for (const a of packet.actions) {
      const next = act(s, a);
      if (next === s) return null;
      s = next;
    }
    return s;
  }
  function practice() {
    const s = create(0),
      ts = [0, 1, 2, 9, 10, 11, 18, 19, 20, 6, 7, 8, 4, 27],
      used = new Set(),
      hand = ts.map((t) => {
        const id = t * 4;
        used.add(id);
        return id;
      });
    const win = 17;
    used.add(win);
    const rest = Array.from({ length: 136 }, (_, i) => i).filter(
      (i) => !used.has(i),
    );
    s.hands = [
      hand.sort((a, b) => a - b),
      rest.splice(0, 13),
      rest.splice(0, 13),
      rest.splice(0, 13),
    ];
    s.wall = [win, ...rest];
    s.turn = 0;
    s.drawn = 108;
    s.hasDrawn = true;
    s.practice = true;
    s.guideStep = 0;
    s.log = ["教学：打出东，听五万；下一步体验自摸。"];
    return s;
  }
  return {
    type,
    label,
    counts,
    winning,
    waits,
    shanten,
    create,
    act,
    claims,
    chows,
    selfOptions,
    bestDiscard,
    ai,
    visibleCounts,
    restore,
    practice,
  };
});
