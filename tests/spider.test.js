const { test } = require("node:test");
const assert = require("node:assert/strict");
const E = require("../games/spider/engine");
const all = (s) => [
  ...s.stock,
  ...s.tableau.flatMap((p) => p.cards),
  ...s.finished.flat(),
];
test("spider deals 54 plus 50 unique cards in all three suit modes", () => {
  for (const suits of [1, 2, 4]) {
    const s = E.create(42, suits);
    assert.deepEqual(s, E.create(42, suits));
    assert.equal(s.stock.length, 50);
    assert.deepEqual(
      s.tableau.map((p) => p.cards.length),
      [6, 6, 6, 6, 5, 5, 5, 5, 5, 5],
    );
    assert.equal(new Set(all(s)).size, 104);
    for (const p of s.tableau) assert.equal(p.cards.length - p.up, 1);
    assert.equal(new Set(all(s).map((c) => E.suit(c, suits))).size, suits);
  }
});
test("spider permits mixed-suit placement but only same-suit sequences move together", () => {
  const s = E.create(1, 4);
  s.tableau = [
    { cards: [4, 16], up: 0 },
    { cards: [5], up: 0 },
    ...Array.from({ length: 8 }, () => ({ cards: [], up: 0 })),
  ];
  assert.equal(E.movable(s, 0, 0), false);
  assert.equal(E.movable(s, 0, 1), true);
  s.tableau[0].cards = [4, 3];
  assert.equal(E.canMove(s, 0, 0, 1), true);
  const n = E.act(s, { from: 0, index: 0, to: 1 });
  assert.deepEqual(n.tableau[1].cards, [5, 4, 3]);
  assert.equal(s.tableau[1].cards.length, 1);
});
test("spider exposes hidden cards, collects K to A, and blocks deals with empty columns", () => {
  let s = E.practice();
  assert.equal(E.act(s, { deal: true }), s);
  s = E.act(s, { from: 1, index: 0, to: 0 });
  assert.equal(s.finished.length, 1);
  assert.equal(s.tableau[0].cards.length, 0);
  assert.equal(all(s).length, 104);
  let t = E.create(1);
  t.tableau[0] = { cards: [1, 0], up: 1 };
  t.tableau[1] = { cards: [1], up: 0 };
  t = E.act(t, { from: 0, index: 1, to: 1 });
  assert.equal(t.tableau[0].up, 0);
});
test("spider final complete suit ends the game and freezes all moves", () => {
  const s = E.practice();
  s.finished = Array.from({ length: 7 }, () =>
    Array.from({ length: 13 }, (_, i) => 12 - i),
  );
  const win = E.act(s, { from: 1, index: 0, to: 0 });
  assert.ok(win.won);
  assert.equal(E.act(win, { deal: true }), win);
});
test("spider random moves conserve all cards and action replay restores undo history", () => {
  for (const suits of [1, 2, 4]) {
    const packet = { version: 1, seed: 91, suits, actions: [] };
    let s = E.restore(packet);
    for (let i = 0; i < 120; i++) {
      const moves = E.options(s),
        a =
          i % 13 === 0 &&
          s.stock.length >= 10 &&
          s.tableau.every((p) => p.cards.length)
            ? { deal: true }
            : moves[(i * 17) % moves.length];
      if (!a) break;
      const n = E.act(s, a);
      assert.notEqual(n, s);
      packet.actions.push(a);
      s = n;
      assert.equal(new Set(all(s)).size, 104);
      assert.equal(all(s).length, 104);
      for (const p of s.tableau)
        assert.ok(p.up >= 0 && p.up <= Math.max(0, p.cards.length - 1));
    }
    assert.deepEqual(E.restore(packet), s);
    packet.actions.push({ from: 0, index: -1, to: 2 });
    assert.equal(E.restore(packet), null);
  }
});
