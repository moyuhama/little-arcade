const { test } = require("node:test");
const assert = require("node:assert/strict");
const S = require("../games/solitaire/engine.js"),
  T = require("../games/twentyfour/engine.js");
const rng = (seed) => () =>
  (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const empty = () => ({
  tableau: Array.from({ length: 7 }, () => ({ cards: [], up: 0 })),
  stock: [],
  waste: [],
  foundations: [[], [], [], []],
  moves: 0,
  won: false,
});
const allCards = (s) => [
  ...s.stock,
  ...s.waste,
  ...s.foundations.flat(),
  ...s.tableau.flatMap((p) => p.cards),
];
test("solitaire deals all 52 cards exactly once, exposes one per column and keeps 24 in stock", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const s = S.create(rng(seed));
    assert.equal(new Set(allCards(s)).size, 52);
    assert.equal(s.stock.length, 24);
    s.tableau.forEach((p, i) => {
      assert.equal(p.cards.length, i + 1);
      assert.equal(p.up, i);
    });
    assert.equal(s.waste.length, 0);
  }
});
test("solitaire draw-one recycles in the original order, preserves prior state and counts moves", () => {
  let s = empty();
  s.stock = [0, 14, 28];
  const original = JSON.stringify(s);
  s = S.draw(s);
  assert.deepEqual(s.waste, [28]);
  s = S.draw(S.draw(s));
  assert.deepEqual(s.waste, [28, 14, 0]);
  s = S.draw(s);
  assert.deepEqual(s.stock, [0, 14, 28]);
  assert.deepEqual(s.waste, []);
  s = S.draw(s);
  assert.equal(s.waste.at(-1), 28);
  assert.equal(s.moves, 5);
  assert.deepEqual(JSON.parse(original).stock, [0, 14, 28]);
  assert.equal(S.draw(empty()).moves, 0);
});
test("solitaire tableau requires descending alternating colors and only kings in empty columns", () => {
  const s = empty();
  s.waste = [18];
  s.tableau[0] = { cards: [6], up: 0 };
  assert.ok(S.canMove(s, { type: "waste" }, { type: "tableau", pile: 0 }));
  assert.ok(!S.canMove(s, { type: "waste" }, { type: "tableau", pile: 1 }));
  s.waste = [5];
  assert.ok(!S.canMove(s, { type: "waste" }, { type: "tableau", pile: 0 }));
  s.waste = [25];
  assert.ok(S.canMove(s, { type: "waste" }, { type: "tableau", pile: 1 }));
});
test("solitaire moves a valid exposed run, rejects buried/broken runs, and flips the newly exposed card", () => {
  const s = empty();
  s.tableau[0] = { cards: [44, 12, 24, 10], up: 1 };
  assert.deepEqual(S.cards(s, { type: "tableau", pile: 0, index: 0 }), []);
  assert.ok(
    S.canMove(
      s,
      { type: "tableau", pile: 0, index: 1 },
      { type: "tableau", pile: 1 },
    ),
  );
  const next = S.move(
    s,
    { type: "tableau", pile: 0, index: 1 },
    { type: "tableau", pile: 1 },
  );
  assert.deepEqual(next.tableau[1].cards, [12, 24, 10]);
  assert.deepEqual(next.tableau[0], { cards: [44], up: 0 });
  assert.deepEqual(s.tableau[0], { cards: [44, 12, 24, 10], up: 1 });
  s.tableau[0] = { cards: [12, 11], up: 0 };
  assert.deepEqual(S.cards(s, { type: "tableau", pile: 0, index: 0 }), []);
});
test("solitaire foundations enforce suit and rank, and allow moving the top card back out", () => {
  let s = empty();
  s.waste = [13];
  assert.ok(!S.canMove(s, { type: "waste" }, { type: "foundation", pile: 0 }));
  s = S.move(s, { type: "waste" }, { type: "foundation", pile: 1 });
  assert.deepEqual(s.foundations[1], [13]);
  s.waste = [15];
  assert.equal(
    S.move(s, { type: "waste" }, { type: "foundation", pile: 1 }),
    s,
  );
  s.waste = [14];
  s = S.move(s, { type: "waste" }, { type: "foundation", pile: 1 });
  s.tableau[0] = { cards: [2], up: 0 };
  s = S.move(s, { type: "foundation", pile: 1 }, { type: "tableau", pile: 0 });
  assert.deepEqual(s.tableau[0].cards, [2, 14]);
  assert.deepEqual(s.foundations[1], [13]);
});
test("solitaire detects the final foundation card and freezes further actions", () => {
  const s = empty();
  s.foundations = Array.from({ length: 4 }, (_, suit) =>
    Array.from({ length: suit === 3 ? 12 : 13 }, (_, i) => suit * 13 + i),
  );
  s.waste = [51];
  const next = S.move(s, { type: "waste" }, { type: "foundation", pile: 3 });
  assert.equal(next.won, true);
  assert.equal(allCards(next).length, 52);
  assert.equal(S.draw(next), next);
  assert.equal(
    S.move(next, { type: "foundation", pile: 3 }, { type: "tableau", pile: 0 }),
    next,
  );
});
test("solitaire random play conserves cards and every hint is a legal move", () => {
  for (let seed = 1; seed <= 8; seed++) {
    let s = S.create(rng(seed));
    for (let i = 0; i < 150 && !s.won; i++) {
      const hint = S.hint(s);
      if (hint && i % 3 !== 0) {
        assert.ok(S.canMove(s, hint.source, hint.target));
        s = S.move(s, hint.source, hint.target);
      } else s = S.draw(s);
      assert.equal(allCards(s).length, 52);
      assert.equal(new Set(allCards(s)).size, 52);
      s.tableau.forEach((p) =>
        assert.ok(p.up >= 0 && p.up < Math.max(1, p.cards.length)),
      );
    }
  }
});
function tokensFromSolution(expression, values) {
  const used = new Set();
  return expression.match(/\d+|[()+\-*/]/g).map((t) => {
    if (!/^\d+$/.test(t)) return t;
    const i = values.findIndex((v, i) => v === Number(t) && !used.has(i));
    assert.ok(i >= 0);
    used.add(i);
    return i;
  });
}
test("24 point generator always provides four distinct physical cards and a valid exact solution", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const q = T.create(rng(seed));
    assert.equal(new Set(q.cards).size, 4);
    assert.deepEqual(
      q.cards.map((id) => (id % 13) + 1),
      q.values,
    );
    const result = T.evaluate(
      tokensFromSolution(q.solution, q.values),
      q.values,
    );
    assert.equal(result.correct, true);
  }
});
test("24 point checks fractional solutions exactly, with operator precedence and parentheses", () => {
  assert.equal(
    T.evaluate([2, "/", "(", 0, "-", 3, "/", 1, ")"], [3, 3, 8, 8]).correct,
    true,
  );
  assert.equal(
    T.evaluate([0, "+", 1, "+", 2, "*", 3], [1, 3, 4, 5]).correct,
    true,
  );
  assert.equal(
    T.evaluate(["(", 0, "+", 1, ")", "*", "(", 2, "+", 3, ")"], [1, 2, 3, 5])
      .correct,
    true,
  );
});
test("24 point rejects card reuse, omitted cards, adjacent cards, zero division and malformed input", () => {
  for (const tokens of [
    [0, "+", 0, "+", 2, "+", 3],
    [0, "+", 1, "+", 2],
    [0, 1, "+", 2, "+", 3],
    ["(", 0, "+", 1, "+", 2, "+", 3],
    [0, "+", 1, "+", 2, "+", 3, ")"],
    ["process.exit()", 0, 1, 2, 3],
  ])
    assert.equal(T.evaluate(tokens, [1, 2, 3, 4]).valid, false);
  const result = T.evaluate(
    [0, "/", "(", 1, "-", 2, ")", "+", 3],
    [8, 3, 3, 2],
  );
  assert.equal(result.valid, false);
  assert.match(result.error, /0/);
});
test("24 point solver returns null for impossible hands and generation has a bounded fallback", () => {
  assert.equal(T.solve([1, 1, 1, 1]), null);
  const q = T.create(() => 0.9999);
  assert.equal(
    T.evaluate(tokensFromSolution(q.solution, q.values), q.values).correct,
    true,
  );
});
