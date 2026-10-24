const { test } = require("node:test");
const assert = require("node:assert/strict");
const N = require("../games/nonogram/engine.js"),
  puzzles = require("../games/nonogram/puzzles.js");
const L = require("../games/landlord/engine.js"),
  T = require("../games/tower/engine.js"),
  D = require("../games/dungeon/engine.js");
const clone = (s) => JSON.parse(JSON.stringify(s));
function cards(...ranks) {
  const used = {};
  return ranks.map((r) =>
    r >= 16 ? r + 36 : (r - 3) * 4 + (used[r] = (used[r] || 0) + 1) - 1,
  );
}
test("all 60 nonograms have a unique solution reachable without guessing", () => {
  assert.equal(puzzles.length, 60);
  for (const size of [5, 10, 15])
    assert.equal(puzzles.filter((p) => p.size === size).length, 20);
  assert.equal(new Set(puzzles.map((p) => p.cells.join(""))).size, 60);
  for (const p of puzzles) {
    const solved = N.solve(p.cells, p.size);
    assert.ok(solved, p.name);
    assert.deepEqual(
      solved.map((v) => (v === 1 ? 1 : 0)),
      p.cells,
    );
  }
});
test("nonogram line clues, mandatory overlap and contradictions", () => {
  assert.deepEqual(N.clues([1, 1, 0, 1, 0]), [2, 1]);
  assert.deepEqual(N.clues([0, 0, 0]), [0]);
  assert.deepEqual(N.patterns(3, [0]), [[-1, -1, -1]]);
  assert.equal(N.candidates([1, -1, 1], [3]).length, 0);
  const board = Array(25).fill(0),
    info = N.describe(puzzles[0].cells, 5),
    h = N.deduction(board, 5, info);
  assert.deepEqual(h.changes, [{ index: 7, value: 1 }]);
});
test("nonogram saves reject malformed grids and recompute completion", () => {
  const p = puzzles[0],
    s = N.create(p);
  assert.ok(N.restore(s, p));
  assert.equal(N.restore({ ...s, board: [1] }, p), null);
  assert.equal(N.restore({ ...s, board: s.board.map(() => 2) }, p), null);
  assert.equal(N.restore({ ...s, id: 99 }, p), null);
  assert.equal(N.restore({ ...s, board: p.cells, won: false }, p).won, true);
  assert.equal(
    N.won(
      p.cells.map((v) => (v ? 1 : 0)),
      p.cells,
    ),
    true,
  );
});
const patterns = [
  ["single", [3]],
  ["pair", [4, 4]],
  ["triple", [7, 7, 7]],
  ["triple1", [8, 8, 8, 3]],
  ["triple2", [9, 9, 9, 5, 5]],
  ["straight", [10, 11, 12, 13, 14]],
  ["pairs", [3, 3, 4, 4, 5, 5]],
  ["plane", [3, 3, 3, 4, 4, 4]],
  ["plane1", [3, 3, 3, 4, 4, 4, 8, 8]],
  ["plane2", [3, 3, 3, 4, 4, 4, 8, 8, 9, 9]],
  ["four1", [5, 5, 5, 5, 3, 4]],
  ["four2", [5, 5, 5, 5, 3, 3, 4, 4]],
  ["bomb", [3, 3, 3, 3]],
  ["rocket", [16, 17]],
];
for (const [type, ranks] of patterns)
  test("landlord recognises " + type, () =>
    assert.equal(L.classify(cards(...ranks)).type, type),
  );
test("landlord rejects illegal wings, 2 in sequences, and duplicate physical cards", () => {
  for (const ranks of [
    [11, 12, 13, 14, 15],
    [3, 3, 4, 4],
    [3, 3, 3, 3, 4, 4],
    [3, 3, 3, 4, 4, 4, 16, 17],
    [5, 5, 5, 5, 16, 17],
    [3, 3, 3, 4, 4, 4, 8, 9, 9],
  ])
    assert.equal(L.classify(cards(...ranks)), null, JSON.stringify(ranks));
  assert.equal(L.classify([0, 0]), null);
  assert.equal(L.classify([-1]), null);
});
test("landlord comparisons preserve type and length, with bomb and rocket exceptions", () => {
  const p = (r) => L.classify(cards(...r));
  assert.equal(L.beats(p([4, 4]), p([3, 3])), true);
  assert.equal(L.beats(p([17]), p([3, 3])), false);
  assert.equal(L.beats(p([4, 5, 6, 7, 8, 9]), p([3, 4, 5, 6, 7])), false);
  assert.equal(L.beats(p([3, 3, 3, 3]), p([15, 15, 15, 14, 14])), true);
  assert.equal(L.beats(p([16, 17]), p([15, 15, 15, 15])), true);
  assert.equal(L.beats(p([15, 15, 15, 15]), p([16, 17])), false);
  assert.equal(L.beats(p([5, 5, 5, 5, 3, 4]), p([3, 3, 3, 3])), false);
});
test("landlord auctions: all pass, higher bids, and three-point instant landlord", () => {
  let s = L.create(0);
  for (let i = 0; i < 3; i++) s = L.act(s, { bid: 0 });
  assert.equal(s.phase, "redeal");
  s = L.create(0);
  s = L.act(s, { bid: 1 });
  assert.equal(L.act(s, { bid: 1 }), s);
  s = L.act(s, { bid: 0 });
  s = L.act(s, { bid: 0 });
  assert.equal(s.landlord, 0);
  assert.equal(s.turn, 0);
  assert.equal(s.hands[0].length, 20);
  s = L.act(L.create(2), { bid: 3 });
  assert.equal(s.landlord, 2);
  assert.equal(s.phase, "play");
});
test("landlord two passes restore the lead, teammates share a win and spring is counted", () => {
  let s = L.practice();
  s = L.act(s, { cards: [0, 1] });
  s = L.act(s, { cards: [] });
  s = L.act(s, { cards: [] });
  assert.equal(s.turn, 0);
  assert.equal(s.last, null);
  assert.equal(L.act(s, { cards: [] }), s);
  s = L.act(s, { cards: [44] });
  assert.equal(s.phase, "over");
  assert.equal(s.winner, 0);
  assert.equal(s.multiplier, 2);
  assert.equal(L.act(s, { cards: [4] }), s);
});
test("landlord generated moves include complex wings and never include invalid responses", () => {
  const hand = cards(3, 3, 3, 4, 4, 4, 8, 8, 9, 9, 10, 10, 10, 10, 16, 17);
  const list = L.moves(hand);
  for (const m of list) {
    assert.ok(L.classify(m.cards));
    assert.ok(m.cards.every((c) => hand.includes(c)));
  }
  for (const type of [
    "plane",
    "plane1",
    "plane2",
    "four1",
    "four2",
    "bomb",
    "rocket",
  ])
    assert.ok(
      list.some((m) => m.pattern.type === type),
      type,
    );
  const target = L.classify(cards(3, 3));
  for (const m of L.moves(hand, target)) assert.ok(L.beats(m.pattern, target));
});
test("200 complete landlord simulations conserve 54 cards and replay their saves", () => {
  for (let seed = 0; seed < 200; seed++) {
    let s = L.create(seed),
      packet = { version: 1, seed, actions: [] };
    for (let n = 0; n < 500 && ["play", "bid"].includes(s.phase); n++) {
      const a = L.ai(s),
        next = L.act(s, a);
      assert.notEqual(next, s, `${seed}/${n}`);
      s = next;
      packet.actions.push(a);
      const all = [
        ...s.hands.flat(),
        ...s.played,
        ...(s.phase === "bid" ? s.bottom : []),
      ];
      if (s.phase !== "redeal") {
        assert.equal(all.length, 54);
        assert.equal(new Set(all).size, 54);
      }
    }
    assert.ok(["over", "redeal"].includes(s.phase));
    assert.deepEqual(L.restore(packet), s);
  }
  assert.equal(
    L.restore({ version: 1, seed: 1, actions: [{ cards: [-1] }] }),
    null,
  );
});
test("landlord AI does not inspect opponents hidden card identities", () => {
  let s = L.act(L.create(5), { bid: 3 });
  const a = L.ai(s),
    other = clone(s);
  for (let p = 0; p < 3; p++)
    if (p !== s.turn) other.hands[p] = other.hands[p].map((_, i) => i);
  assert.deepEqual(L.ai(other), a);
});
test("tower purchases and upgrades enforce funds, slots, branch and refund", () => {
  const s = T.create();
  assert.equal(T.build(s, 0, "arrow"), true);
  assert.equal(s.gold, 120);
  assert.equal(T.build(s, 0, "cannon"), false);
  assert.equal(T.upgrade(s, 0, "range"), true);
  assert.equal(T.stats(s.towers[0]).range, 175);
  assert.equal(T.upgrade(s, 0, "power"), false);
  assert.equal(T.build(s, 20, "arrow"), false);
  assert.equal(T.sell(s, 0), true);
  assert.equal(s.gold, 139);
});
test("tower slow, armor, area damage and pulse cooldown affect combat", () => {
  const s = T.create();
  T.build(s, 0, "cannon");
  T.start(s);
  s.spawned = s.total;
  s.enemies = [
    { d: 90, hp: 100, max: 100, kind: "armor", speed: 0, slow: 0 },
    { d: 95, hp: 100, max: 100, kind: "normal", speed: 0, slow: 0 },
  ];
  T.step(s, 1 / 60);
  assert.equal(s.enemies[0].hp, 70);
  assert.equal(s.enemies[1].hp, 70);
  assert.equal(T.pulse(s), true);
  assert.equal(T.pulse(s), false);
  assert.ok(s.enemies.every((e) => e.slow === 2));
  assert.ok(s.enemies.every((e) => e.hp === 21));
});
test("tower waves are finite, have bosses, and only leak damage ends an endless run", () => {
  const s = T.create();
  T.build(s, 0, "arrow");
  s.wave = 4;
  T.start(s);
  let bossSeen = false;
  for (let i = 0; i < 10000 && s.phase === "wave"; i++) {
    T.step(s, 1 / 60);
    bossSeen ||= s.enemies.some((e) => e.kind === "boss");
  }
  assert.ok(bossSeen);
  assert.notEqual(s.phase, "wave");
  const dead = T.create();
  T.build(dead, 0, "arrow");
  T.start(dead);
  dead.lives = 1;
  dead.enemies = [
    {
      d: T.length(T.maps[0].path) + 1,
      hp: 100,
      max: 100,
      speed: 1,
      kind: "normal",
      slow: 0,
    },
  ];
  T.step(dead, 1 / 60);
  assert.equal(dead.phase, "over");
  const before = clone(dead);
  T.step(dead, 1);
  assert.deepEqual(dead, before);
});
test("tower checkpoints only restore preparation, reject invalid saves, preserve investment", () => {
  const s = T.create(2);
  T.build(s, 1, "frost");
  const save = T.checkpoint(s),
    restored = T.restore(save);
  assert.deepEqual(T.checkpoint(restored), save);
  assert.equal(T.restore({ ...save, lives: 0 }), null);
  assert.equal(
    T.restore({ ...save, towers: [{ ...save.towers[0], spent: 9000 }] }),
    null,
  );
  assert.equal(
    T.restore({ ...save, towers: [...save.towers, ...save.towers] }),
    null,
  );
  T.start(s);
  assert.equal(T.checkpoint(s), null);
});
test("all three tower maps can survive 25 waves including five bosses using legal purchases", () => {
  for (let map = 0; map < 3; map++) {
    const s = T.create(map),
      types = [
        "arrow",
        "arrow",
        "cannon",
        "frost",
        "cannon",
        "arrow",
        "cannon",
        "arrow",
      ];
    for (let wave = 0; wave < 25; wave++) {
      for (let i = 0; i < 8; i++)
        if (!s.towers.some((t) => t.pad === i)) T.build(s, i, types[i]);
      for (let lv = 1; lv <= 2; lv++)
        for (const t of s.towers)
          if (t.level === lv) T.upgrade(s, t.pad, "power");
      assert.equal(T.start(s), true);
      for (let i = 0; i < 20000 && s.phase === "wave"; i++) {
        if (s.enemies.length > 5 && !s.pulse) T.pulse(s);
        T.step(s, 1 / 60);
      }
      assert.equal(s.phase, "build", `${map}/${wave + 1}`);
      assert.ok(s.gold >= 0);
      assert.ok(s.enemies.length === 0);
    }
    assert.equal(s.wave, 25);
  }
});
test("dungeon energy costs, blocking, end-turn reset, card ownership and rejected actions", () => {
  let s = D.act(D.create(1), { route: "fight" });
  const all = [...s.hand, ...s.draw, ...s.discard, ...s.exhaust];
  assert.deepEqual(all.sort(), s.deck.slice().sort());
  s = { ...s, hand: ["guard", "heavy"], draw: [], discard: [], energy: 3 };
  s = D.act(s, { card: 0 });
  assert.equal(s.block, 5);
  assert.equal(s.energy, 2);
  s = D.act(s, { card: 0 });
  assert.equal(s.energy, 0);
  assert.equal(D.act(s, { card: 0 }), s);
  const hp = s.hp,
    intent = D.enemyIntent(s);
  s = D.act(s, { end: true });
  assert.equal(s.hp, hp - Math.max(0, intent.value - 5));
  assert.equal(s.energy, 3);
  assert.equal(s.block, 0);
  assert.equal(s.turn, 2);
});
test("dungeon poison bypasses armor and lethal poison prevents enemy attacks", () => {
  let s = D.act(D.create(2), { route: "fight" });
  s.enemy.hp = 3;
  s.enemy.block = 99;
  s.enemy.poison = 4;
  const hp = s.hp;
  s = D.act(s, { end: true });
  assert.equal(s.phase, "reward");
  assert.equal(s.hp, hp);
});
test("dungeon multi-hit strength, exhaustion and healing respect limits", () => {
  let s = D.act(D.create(2), { route: "fight" });
  s.hand = ["fury", "flurry", "mend"];
  s.enemy.hp = 100;
  s.enemy.maxHp = 100;
  s = D.act(s, { card: 0 });
  assert.equal(s.strength, 2);
  assert.deepEqual(s.exhaust, ["fury"]);
  s = D.act(s, { card: 0 });
  assert.equal(s.enemy.hp, 85);
  s = D.act(s, { card: 0 });
  assert.equal(s.hp, s.maxHp);
  assert.ok(s.exhaust.includes("mend"));
});
test("dungeon routes, shop purchase and removal cannot duplicate rewards", () => {
  let s = D.create(2);
  assert.equal(D.act(s, { route: "boss" }), s);
  s.floor = 4;
  s = D.act(s, { route: "shop" });
  const original = s.deck.length;
  s = D.act(s, { buy: 0 });
  assert.equal(s.deck.length, original + 1);
  assert.equal(s.gold, 25);
  assert.equal(D.act(s, { buy: 0 }), s);
  s.gold = 100;
  s = D.act(s, { remove: 0 });
  assert.equal(s.deck.length, original);
  assert.equal(s.gold, 45);
  assert.equal(D.act(s, { remove: 0 }), s);
  s = D.act(s, { leave: true });
  assert.equal(s.floor, 5);
});
function expeditionAction(s) {
  if (s.phase === "route") {
    const r = D.routes(s);
    return {
      route: r.includes("rest")
        ? "rest"
        : r.includes("elite")
          ? "elite"
          : r.includes("event")
            ? "event"
            : r[0],
    };
  }
  if (s.phase === "rest")
    return { rest: s.hp < s.maxHp * 0.75 ? "heal" : "train" };
  if (s.phase === "event") return { event: "safe" };
  if (s.phase === "shop") return { leave: true };
  if (s.phase === "reward") {
    const priority = [
      "fury",
      "flurry",
      "toxin",
      "brace",
      "mend",
      "siphon",
      "venom",
      "burst",
      "sweep",
      "counter",
      "heavy",
      "spark",
      "focus",
    ];
    return {
      reward: s.rewards
        .map((id, i) => ({ id, i }))
        .sort((a, b) => priority.indexOf(a.id) - priority.indexOf(b.id))[0].i,
    };
  }
  const intent = D.enemyIntent(s),
    threat = intent.type === "attack" ? Math.max(0, intent.value - s.block) : 0;
  const choices = s.hand
    .map((id, i) => ({ id, i, c: D.cards[id] }))
    .filter((x) => x.c.cost <= s.energy);
  const score = ({ c }) =>
    (c.heal || 0) * (s.hp < s.maxHp - 5 ? 2 : 0) +
    (c.energy || 0) * 10 +
    (c.strength || 0) * 10 +
    (c.draw || 0) * 3 +
    Math.min(c.block || 0, threat) * 1.6 +
    ((c.damage || 0) + s.strength) * (c.hits || 1) +
    (c.poison || 0) * 3 +
    (c.weak || 0) * 3;
  choices.sort((a, b) => score(b) - score(a));
  return choices.length ? { card: choices[0].i } : { end: true };
}
test("twenty seeded dungeon expeditions complete all three chapters and resume exactly", () => {
  for (let seed = 1; seed <= 20; seed++) {
    let s = D.create(seed),
      packet = { version: 1, seed, role: "knight", difficulty: 0, actions: [] };
    for (let i = 0; i < 4000 && !["won", "lost"].includes(s.phase); i++) {
      const a = expeditionAction(s),
        next = D.act(s, a);
      assert.notEqual(next, s);
      s = next;
      packet.actions.push(a);
      assert.ok(s.hp >= 0 && s.hp <= s.maxHp);
      assert.ok(s.gold >= 0);
    }
    assert.equal(s.phase, "won", String(seed));
    assert.equal(s.floor, 19);
    assert.ok(s.relics.length >= 3);
    assert.deepEqual(D.restore(packet), s);
    assert.equal(D.act(s, { end: true }), s);
  }
});
test("dungeon corrupt saves and out-of-phase actions cannot fabricate progress", () => {
  assert.equal(
    D.restore({
      version: 1,
      seed: 1,
      role: "knight",
      difficulty: 0,
      actions: [{ reward: 0 }],
    }),
    null,
  );
  assert.equal(
    D.restore({
      version: 1,
      seed: 1,
      role: "knight",
      difficulty: 100,
      actions: [],
    }),
    null,
  );
  let s = D.act(D.create(1), { route: "fight" });
  s.hp = 1;
  s.hand = [];
  s.block = 0;
  s = D.act(s, { end: true });
  assert.equal(s.phase, "lost");
  assert.equal(D.act(s, { end: true }), s);
});
test("landlord ambiguous consecutive triples can follow a plane with single wings", () => {
  const hand = cards(4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7),
    target = L.classify(cards(3, 3, 3, 4, 4, 4, 5, 5, 5, 8, 8, 9));
  assert.equal(target.type, "plane1");
  assert.equal(L.classify(hand).type, "plane");
  assert.equal(L.classify(hand, target).type, "plane1");
  assert.ok(L.moves(hand, target).some((m) => m.cards.length === 12));
});
test("tower late-wave research and repairs consume resources only during preparation", () => {
  const s = T.create();
  assert.equal(T.repair(s), false);
  assert.equal(T.research(s), false);
  T.build(s, 0, "arrow");
  s.wave = 3;
  s.gold = 175;
  assert.equal(T.research(s), true);
  assert.equal(s.research, 1);
  assert.equal(s.gold, 15);
  assert.equal(T.research(s), false);
  s.gold = 1000;
  s.lives = 18;
  assert.equal(T.repair(s), true);
  assert.equal(s.lives, 20);
  assert.equal(s.gold, 880);
  T.build(s, 0, "arrow");
  T.start(s);
  assert.equal(T.research(s), false);
  assert.equal(T.repair(s), false);
});
test("landlord tutorial can be won by following its exact guided sequence against the real AI", () => {
  let s = L.practice();
  s = L.act(s, { cards: [0, 1] });
  s = L.act(s, L.ai(s));
  s = L.act(s, L.ai(s));
  assert.equal(s.turn, 0);
  assert.equal(s.last.pattern.type, "pair");
  s = L.act(s, { cards: [] });
  s = L.act(s, L.ai(s));
  assert.equal(s.phase, "play");
  s = L.act(s, L.ai(s));
  assert.equal(s.turn, 0);
  assert.equal(s.last.pattern.type, "single");
  s = L.act(s, { cards: [44] });
  assert.equal(s.phase, "over");
  assert.equal(s.winner, 0);
});
