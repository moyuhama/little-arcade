const { test } = require("node:test");
const assert = require("node:assert/strict");
const E = require("../games/mahjong/engine");
const ids = (types) => {
  const seen = Array(34).fill(0);
  return types.map((t) => t * 4 + seen[t]++);
};
function rig(hands, melds = [[], [], [], []]) {
  const s = E.create(0),
    used = Array(34).fill(0),
    take = (types) =>
      types.map((t) => {
        assert.ok(used[t] < 4, "fixture has only four copies");
        return t * 4 + used[t]++;
      });
  s.hands = hands.map(take);
  s.melds = melds.map((ms) => ms.map((m) => ({ ...m, cards: take(m.types) })));
  const occupied = new Set([
    ...s.hands.flat(),
    ...s.melds.flatMap((ms) => ms.flatMap((m) => m.cards)),
  ]);
  s.wall = Array.from({ length: 136 }, (_, i) => i).filter(
    (i) => !occupied.has(i),
  );
  s.rivers = [[], [], [], []];
  s.log = [];
  s.turn = 0;
  s.hasDrawn = true;
  s.drawn = s.hands[0].at(-1);
  return s;
}
function conserved(s) {
  const cards = [
    ...s.hands.flat(),
    ...s.rivers.flat(),
    ...s.wall,
    ...s.melds.flatMap((ms) => ms.flatMap((m) => m.cards)),
  ];
  assert.equal(cards.length, 136);
  assert.equal(new Set(cards).size, 136);
}
const ready = [0, 1, 2, 9, 10, 11, 18, 19, 20, 6, 7, 8, 4];
test("mahjong deterministic deal uses all 136 physical tiles and randomizes dealer", () => {
  for (let seed = 0; seed < 20; seed++) {
    const s = E.create(seed);
    assert.deepEqual(s, E.create(seed));
    conserved(s);
    assert.equal(s.wall.length, 83);
    assert.equal(s.hands[s.dealer].length, 14);
    assert.equal(s.dealer, seed % 4);
  }
});
test("mahjong recognizes standard open and closed hands, seven pairs and thirteen orphans", () => {
  assert.ok(E.winning(ids([...ready, 4])));
  assert.ok(E.winning(ids([0, 1, 2, 9, 10, 11, 6, 7, 8, 4, 4]), 1));
  assert.equal(
    E.winning(ids([0, 0, 1, 1, 2, 2, 9, 9, 10, 10, 27, 27, 33, 33])),
    "七对",
  );
  assert.equal(
    E.winning(ids([0, 0, 0, 0, 2, 2, 9, 9, 10, 10, 27, 27, 33, 33])),
    "七对",
  );
  assert.equal(
    E.winning(ids([0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33, 33])),
    "十三幺",
  );
  assert.equal(E.winning(ids([...ready, 27])), null);
  assert.equal(
    E.winning(ids([7, 8, 9, 10, 11, 12, 18, 19, 20, 27, 27, 27, 4, 4])),
    null,
  );
});
test("mahjong waits and shanten support multiple special shapes without impossible fifth copies", () => {
  assert.deepEqual(E.waits(ids(ready)), [4]);
  assert.equal(E.shanten(ids(ready)), 0);
  assert.equal(E.shanten(ids([...ready, 4])), -1);
  const orphan = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
  assert.equal(E.waits(ids(orphan)).length, 13);
  assert.equal(E.shanten(ids(orphan)), 0);
  const h = ids([0, 1, 2, 3]);
  const m = [
    { cards: ids([0, 0, 0]) },
    { cards: ids([9, 10, 11]) },
    { cards: ids([18, 19, 20]) },
  ];
  assert.ok(!E.waits(h, m).includes(0));
});
test("mahjong only offers chows to the next player, with win before pung before chow", () => {
  const s = rig([[4], ready, [4, 4], [3, 5]]);
  const q = E.claims(s, 0, s.hands[0][0]);
  assert.equal(q[0].options[0].kind, "hu");
  assert.equal(q[0].player, 1);
  assert.equal(q[1].player, 2);
  assert.equal(q[1].options[0].kind, "pung");
  assert.ok(
    !q.some((r) => r.player === 3 && r.options.some((o) => o.kind === "chow")),
  );
  assert.equal(E.chows(ids([7, 8]), 9).length, 0);
  assert.equal(E.chows(ids([27, 28]), 29).length, 0);
  assert.equal(E.chows(ids([0, 1, 3, 4]), 2).length, 3);
});
test("mahjong pung and chow consume the discard and do not draw an extra tile", () => {
  for (const claim of ["pung", "chow"]) {
    const s = rig([[4], claim === "pung" ? [4, 4, 0] : [3, 5, 0], [27], [28]]);
    let n = E.act(s, { discard: s.hands[0][0] });
    assert.equal(n.phase, "claim");
    const wall = n.wall.length;
    n = E.act(n, claim === "pung" ? { claim } : { claim, base: 3 });
    assert.equal(n.turn, 1);
    assert.equal(n.melds[1].length, 1);
    assert.equal(n.wall.length, wall);
    assert.equal(n.hasDrawn, false);
    assert.equal(n.rivers[0].length, 0);
    assert.deepEqual(E.selfOptions(n), []);
    conserved(n);
  }
});
test("mahjong exposed and concealed kong use all four tiles and draw from wall tail", () => {
  let s = rig([[4], [4, 4, 4, 0], [27], [28]]),
    tail = s.wall.at(-1);
  s = E.act(s, { discard: s.hands[0][0] });
  s = E.act(s, { claim: "kong" });
  assert.equal(s.melds[1][0].cards.length, 4);
  assert.equal(s.drawn, tail);
  assert.equal(s.hasDrawn, true);
  conserved(s);
  s = rig([[4, 4, 4, 4, 0], [1], [2], [3]]);
  tail = s.wall.at(-1);
  s = E.act(s, { self: "concealed", tile: 4 });
  assert.equal(s.melds[0][0].kind, "concealed");
  assert.equal(s.drawn, tail);
  conserved(s);
});
const sequenceWait = [0, 1, 2, 9, 10, 11, 18, 19, 20, 3, 5, 27, 27];
test("mahjong added kong can be robbed and keeps the original pung if robbed", () => {
  let s = rig(
    [[4], sequenceWait, [28], [29]],
    [[{ kind: "pung", types: [4, 4, 4], from: 2 }], [], [], []],
  );
  s = E.act(s, { self: "added", index: 0 });
  assert.equal(s.phase, "claim");
  assert.equal(s.pending.kind, "rob");
  conserved(s);
  s = E.act(s, { claim: "hu" });
  assert.equal(s.result.winner, 1);
  assert.equal(s.result.source, 0);
  assert.equal(s.melds[0][0].kind, "pung");
  assert.equal(s.melds[0][0].cards.length, 3);
  conserved(s);
});
test("mahjong passing a rob-kong offer completes the kong and replacement draw", () => {
  let s = rig(
      [[4], sequenceWait, [28], [29]],
      [[{ kind: "pung", types: [4, 4, 4], from: 2 }], [], [], []],
    ),
    tail = s.wall.at(-1);
  s = E.act(s, { self: "added", index: 0 });
  s = E.act(s, { pass: true });
  assert.equal(s.melds[0][0].kind, "added");
  assert.equal(s.melds[0][0].cards.length, 4);
  assert.equal(s.drawn, tail);
  assert.equal(s.turn, 0);
  conserved(s);
});
test("mahjong first eligible winner wins and invalid commands or terminal commands do nothing", () => {
  let s = rig([[4], sequenceWait, sequenceWait, [28]]);
  s = E.act(s, { discard: s.hands[0][0] });
  assert.equal(s.queue[0].player, 1);
  assert.equal(E.act(s, { claim: "chow", base: 1 }), s);
  assert.equal(E.act(s, { discard: 100 }), s);
  s = E.act(s, { claim: "hu" });
  assert.equal(s.result.winner, 1);
  assert.equal(E.act(s, { pass: true }), s);
  conserved(s);
});
test("mahjong wall exhaustion is a draw and no kong is offered without replacement tiles", () => {
  let s = rig([[27], [0], [2], [4]]);
  s.wall = [];
  s = E.act(s, { discard: s.hands[0][0] });
  assert.equal(s.phase, "over");
  assert.equal(s.result.winner, -1);
  const k = rig([[4, 4, 4, 4], [0], [2], [3]]);
  k.wall = [];
  assert.deepEqual(E.selfOptions(k), []);
});
test("mahjong practice teaches discarding, waiting and self draw without a random redeal", () => {
  let s = E.practice();
  conserved(s);
  assert.equal(E.act(s, { discard: s.hands[0][0] }), s);
  s = E.act(s, { discard: 108 });
  assert.equal(s.guideStep, 1);
  assert.equal(s.drawn, 17);
  assert.ok(E.selfOptions(s).some((o) => o.kind === "hu"));
  s = E.act(s, { self: "hu" });
  assert.equal(s.result.winner, 0);
  assert.equal(s.result.selfDraw, true);
  conserved(s);
});
test("mahjong discard AI does not inspect hidden opponent hands or the future wall", () => {
  const s = E.create(0),
    n = JSON.parse(JSON.stringify(s));
  n.hands[1] = [];
  n.hands[2] = ids([0, 0, 0, 0]);
  n.hands[3] = [];
  n.wall.reverse();
  assert.deepEqual(E.bestDiscard(n), E.bestDiscard(s));
  assert.deepEqual(E.ai(n), E.ai(s));
});
test("mahjong 250 complete AI games conserve physical tiles and restore every legal action", () => {
  const kinds = new Set();
  for (let seed = 0; seed < 250; seed++) {
    let s = E.create(seed);
    const packet = { version: 1, seed, actions: [] };
    for (let i = 0; i < 600 && s.phase !== "over"; i++) {
      conserved(s);
      const a = E.ai(s);
      kinds.add(a.claim || a.self || (a.pass ? "pass" : "discard"));
      const n = E.act(s, a);
      assert.notEqual(n, s, `seed ${seed}, action ${JSON.stringify(a)}`);
      packet.actions.push(a);
      s = n;
    }
    assert.equal(s.phase, "over", `seed ${seed}`);
    conserved(s);
    if (s.result.winner >= 0)
      assert.ok(
        E.winning(s.hands[s.result.winner], s.melds[s.result.winner].length),
      );
    assert.deepEqual(E.restore(packet), s);
    packet.actions.push({ discard: 136 });
    assert.equal(E.restore(packet), null);
  }
  for (const kind of [
    "discard",
    "pass",
    "hu",
    "pung",
    "chow",
    "kong",
    "concealed",
    "added",
  ])
    assert.ok(kinds.has(kind), kind);
});
