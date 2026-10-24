(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  const rank = (id) => (id < 52 ? Math.floor(id / 4) + 3 : id - 36);
  const labels = {
    11: "J",
    12: "Q",
    13: "K",
    14: "A",
    15: "2",
    16: "小王",
    17: "大王",
  };
  const label = (id) => labels[rank(id)] || String(rank(id));
  const names = {
    single: "单张",
    pair: "对子",
    triple: "三张",
    triple1: "三带一",
    triple2: "三带二",
    straight: "顺子",
    pairs: "连对",
    plane: "飞机",
    plane1: "飞机带单",
    plane2: "飞机带对",
    four1: "四带两单",
    four2: "四带两对",
    bomb: "炸弹",
    rocket: "王炸",
  };
  function groups(cards) {
    const out = {};
    for (const id of cards) (out[rank(id)] ??= []).push(id);
    return out;
  }
  function classify(cards, target = null) {
    if (
      !Array.isArray(cards) ||
      !cards.length ||
      cards.length > 20 ||
      new Set(cards).size !== cards.length ||
      !cards.every((x) => Number.isInteger(x) && x >= 0 && x < 54)
    )
      return null;
    const g = groups(cards),
      rs = Object.keys(g)
        .map(Number)
        .sort((a, b) => a - b),
      n = cards.length;
    const make = (type, high) => ({ type, high, length: n, name: names[type] });
    if (n === 2 && rs[0] === 16 && rs[1] === 17) return make("rocket", 17);
    if (rs.length === 1)
      return make({ 1: "single", 2: "pair", 3: "triple", 4: "bomb" }[n], rs[0]);
    const three = rs.find((r) => g[r].length === 3),
      four = rs.find((r) => g[r].length === 4);
    if (n === 4 && three) return make("triple1", three);
    if (n === 5 && three && rs.length === 2) return make("triple2", three);
    const seq =
      rs.at(-1) <= 14 && rs.every((r, i) => !i || r === rs[i - 1] + 1);
    if (seq && n >= 5 && rs.every((r) => g[r].length === 1))
      return make("straight", rs.at(-1));
    if (seq && rs.length >= 3 && rs.every((r) => g[r].length === 2))
      return make("pairs", rs.at(-1));
    if (
      seq &&
      rs.length >= 2 &&
      rs.every((r) => g[r].length === 3) &&
      target?.type !== "plane1"
    )
      return make("plane", rs.at(-1));
    for (const wing of [1, 2]) {
      const count = n / (3 + wing);
      if (!Number.isInteger(count) || count < 2) continue;
      for (let top = 14; top >= count + 2; top--) {
        const core = Array.from({ length: count }, (_, i) => top - i);
        if (!core.every((r) => g[r]?.length === 3)) continue;
        const rest = rs.filter((r) => !core.includes(r));
        if (
          wing === 1 &&
          rest.reduce((sum, r) => sum + g[r].length, 0) === count &&
          rest.every((r) => g[r].length < 4) &&
          !(g[16] && g[17])
        )
          return make("plane1", top);
        if (
          wing === 2 &&
          rest.length === count &&
          rest.every((r) => g[r].length === 2)
        )
          return make("plane2", top);
      }
    }
    if (four && n === 6 && rs.length === 3 && !(g[16] && g[17]))
      return make("four1", four);
    if (
      four &&
      n === 8 &&
      rs.length === 3 &&
      rs.filter((r) => r !== four).every((r) => g[r].length === 2)
    )
      return make("four2", four);
    return null;
  }
  function beats(a, b) {
    if (!a) return false;
    if (!b) return true;
    if (b.type === "rocket") return false;
    if (a.type === "rocket") return true;
    if (a.type === "bomb" && b.type !== "bomb") return true;
    return a.type === b.type && a.length === b.length && a.high > b.high;
  }
  function moves(hand, target = null) {
    const g = groups(hand),
      rs = Object.keys(g)
        .map(Number)
        .sort((a, b) => a - b),
      out = [],
      seen = new Set();
    const add = (cards) => {
      const p = classify(cards, target);
      if (!beats(p, target)) return;
      const key = cards
        .slice()
        .sort((a, b) => a - b)
        .join(",");
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ cards, pattern: p });
      }
    };
    function wings(core, count, unit) {
      const banned = new Set(core.map(rank)),
        available = rs.filter((r) => !banned.has(r));
      function walk(i, left, picked) {
        if (left === 0) {
          add([...core, ...picked]);
          return;
        }
        if (i >= available.length) return;
        const r = available[i],
          max =
            unit === 2
              ? Math.min(1, Math.floor(g[r].length / 2))
              : Math.min(3, g[r].length, left);
        for (let k = 0; k <= Math.min(max, left); k++)
          walk(i + 1, left - k, [...picked, ...g[r].slice(0, k * unit)]);
      }
      walk(0, count, []);
    }
    for (const r of rs) {
      for (let n = 1; n <= g[r].length; n++) add(g[r].slice(0, n));
      if (g[r].length >= 3) {
        for (const k of rs)
          if (k !== r) {
            add([...g[r].slice(0, 3), g[k][0]]);
            if (g[k].length >= 2)
              add([...g[r].slice(0, 3), ...g[k].slice(0, 2)]);
          }
      }
      if (g[r].length === 4) {
        wings(g[r], 2, 1);
        wings(g[r], 2, 2);
      }
    }
    if (g[16] && g[17]) add([52, 53]);
    for (const unit of [1, 2, 3])
      for (let start = 3; start <= 14; start++) {
        let core = [];
        for (let top = start; top <= 14 && g[top]?.length >= unit; top++) {
          core.push(...g[top].slice(0, unit));
          const count = top - start + 1;
          if (count < (unit === 1 ? 5 : unit === 2 ? 3 : 2)) continue;
          add([...core]);
          if (unit === 3) {
            if (core.length + count <= hand.length) wings(core, count, 1);
            if (core.length + count * 2 <= hand.length) wings(core, count, 2);
          }
        }
      }
    return out;
  }
  function random(seed) {
    let n = seed >>> 0;
    return () => {
      n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
      return n / 4294967296;
    };
  }
  function create(seed = Date.now() >>> 0) {
    const rnd = random(seed),
      deck = Array.from({ length: 54 }, (_, i) => i);
    for (let i = 53; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return {
      seed,
      phase: "bid",
      hands: [deck.slice(0, 17), deck.slice(17, 34), deck.slice(34, 51)].map(
        (h) => h.sort((a, b) => b - a),
      ),
      bottom: deck.slice(51),
      turn: seed % 3,
      landlord: -1,
      bid: 0,
      bids: 0,
      bidPass: 0,
      passes: 0,
      last: null,
      lastPlayer: -1,
      played: [],
      turnPlays: [null, null, null],
      playCounts: [0, 0, 0],
      multiplier: 1,
      winner: -1,
      log: [],
    };
  }
  function act(s, action) {
    if (!s || !action || !["bid", "play"].includes(s.phase)) return s;
    const next = JSON.parse(JSON.stringify(s)),
      p = s.turn;
    let message = "";
    if (s.phase === "bid") {
      const value = action.bid;
      if (
        !Number.isInteger(value) ||
        value < 0 ||
        value > 3 ||
        (value > 0 && value <= s.bid)
      )
        return s;
      next.bids++;
      next.bidPass = value ? 0 : s.bidPass + 1;
      if (value) {
        next.bid = value;
        next.landlord = p;
      }
      message = value ? `叫 ${value} 分` : "不叫";
      if (value === 3 || (next.bid > 0 && next.bidPass === 2)) {
        next.phase = "play";
        next.turn = next.landlord;
        next.hands[next.landlord].push(...next.bottom);
        next.hands[next.landlord].sort((a, b) => b - a);
      } else if (next.bids >= 3 && next.bid === 0) {
        next.phase = "redeal";
      } else next.turn = (p + 1) % 3;
    } else {
      const cards = action.cards;
      if (!Array.isArray(cards)) return s;
      if (!cards.length) {
        if (!s.last || s.lastPlayer === p) return s;
        next.passes++;
        next.turnPlays[p] = [];
        message = "不出";
        if (next.passes === 2) {
          next.last = null;
          next.lastPlayer = -1;
          next.passes = 0;
          next.turnPlays = [null, null, null];
        }
      } else {
        if (!cards.every((c) => s.hands[p].includes(c))) return s;
        const pattern = classify(cards, s.last?.pattern);
        if (!beats(pattern, s.last?.pattern)) return s;
        next.hands[p] = next.hands[p].filter((c) => !cards.includes(c));
        next.played.push(...cards);
        next.last = { cards: [...cards], pattern };
        next.lastPlayer = p;
        next.passes = 0;
        next.turnPlays[p] = [...cards];
        next.playCounts[p]++;
        message = `${pattern.name} ${cards.map(label).join(" ")}`;
        if (["bomb", "rocket"].includes(pattern.type)) next.multiplier *= 2;
        if (!next.hands[p].length) {
          next.phase = "over";
          next.winner = p;
          if (
            p === s.landlord
              ? next.playCounts.every((n, i) => i === s.landlord || n === 0)
              : next.playCounts[s.landlord] === 1
          ) {
            next.multiplier *= 2;
            next.spring = true;
          }
        }
      }
      next.turn = (p + 1) % 3;
    }
    next.log = [
      ...s.log,
      `${p === 0 ? "你" : p === 1 ? "下家" : "上家"}：${message}`,
    ].slice(-12);
    return next;
  }
  function ai(s) {
    const hand = s.hands[s.turn];
    if (s.phase === "bid") {
      const g = groups(hand);
      const power =
        hand.filter((c) => rank(c) >= 15).length +
        Object.values(g).filter((v) => v.length === 4).length * 3;
      const bid = power >= 6 ? 3 : power >= 4 ? 2 : power >= 2 ? 1 : 0;
      return { bid: bid > s.bid ? bid : 0 };
    }
    const options = moves(hand, s.last?.pattern);
    if (!options.length) return { cards: [] };
    const finish = options.find((m) => m.cards.length === hand.length);
    if (finish) return { cards: finish.cards };
    // Cooperation uses only public information: roles, cards already played and hand sizes.
    if (s.last && s.turn !== s.landlord && s.lastPlayer !== s.landlord)
      return { cards: [] };
    const urgent =
      s.hands[(s.turn + 1) % 3].length <= 2 &&
      ((s.turn + 1) % 3 === s.landlord || s.turn === s.landlord);
    options.sort((a, b) => {
      const score = (m) => {
        const rest = hand.filter((c) => !m.cards.includes(c)),
          g = groups(rest);
        return (
          m.cards.length * 8 -
          Object.keys(g).length * 2 -
          (["bomb", "rocket"].includes(m.pattern.type) ? 24 : 0) -
          m.pattern.high * 0.35 +
          (urgent && m.pattern.type === "single" ? m.pattern.high * 2 : 0)
        );
      };
      return score(b) - score(a);
    });
    return { cards: options[0].cards };
  }
  function practice() {
    const s = create(1);
    return {
      ...s,
      phase: "play",
      turn: 0,
      landlord: 0,
      bid: 1,
      hands: [
        [0, 1, 44],
        [4, 5, 12, 20],
        [8, 9, 16, 24],
      ],
      bottom: [],
      practice: true,
    };
  }
  function restore(packet) {
    if (
      !packet ||
      packet.version !== 1 ||
      !Number.isInteger(packet.seed) ||
      packet.seed < 0 ||
      packet.seed > 4294967295 ||
      !Array.isArray(packet.actions) ||
      packet.actions.length > 1000
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
  return {
    rank,
    label,
    names,
    classify,
    beats,
    moves,
    create,
    act,
    ai,
    practice,
    restore,
  };
});
