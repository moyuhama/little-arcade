const { test } = require("node:test");
const assert = require("node:assert/strict");
const S = require("../games/slither/engine"),
  P = require("../games/slither/puzzles"),
  F = require("../games/freecell/engine");
test("slither: all 240 puzzles have exactly one complete loop and increasing board groups", () => {
  assert.equal(P.length, 240);
  assert.equal(
    new Set(P.map((p) => p.size + ":" + p.solution.join(""))).size,
    240,
  );
  for (const p of P) {
    assert.ok(S.solved(p, p.solution), p.id);
    const r = S.solutions(p);
    assert.equal(r.exhausted, false);
    assert.equal(r.answers.length, 1, p.id);
    assert.deepEqual(r.answers[0], p.solution);
  }
  for (const [size, count] of [
    [2, 1],
    [4, 59],
    [6, 60],
    [8, 60],
    [10, 60],
  ])
    assert.equal(P.filter((p) => p.size === size).length, count);
});
test("slither solver agrees with exhaustive edge enumeration for small partial clue puzzles", () => {
  const solutions = [];
  for (let mask = 0; mask < 4096; mask++) {
    const values = Array.from({ length: 12 }, (_, i) => (mask >> i) & 1);
    if (S.solved({ size: 2, clues: [-1, -1, -1, -1] }, values))
      solutions.push(values);
  }
  const g = S.geometry(2);
  for (let i = 0; i < 60; i++) {
    const base = solutions[i % solutions.length],
      clues = g.cells.map((es, j) =>
        (i >> j % 4) & 1 ? -1 : es.reduce((s, e) => s + base[e], 0),
      ),
      p = { size: 2, clues },
      expected = solutions.filter((v) => S.solved(p, v));
    const actual = S.solutions(p, 10000, 100000);
    assert.equal(actual.exhausted, false);
    assert.equal(actual.answers.length, expected.length);
  }
});
test("slither rejects disconnected loops, branches and digit mismatches", () => {
  const p = { size: 3, clues: Array(9).fill(-1) },
    g = S.geometry(3),
    values = Array(g.edges.length).fill(0);
  for (const cell of [0, 8]) for (const e of g.cells[cell]) values[e] = 1;
  assert.equal(S.solved(p, values), false);
  values[g.cells[8][0]] = 0;
  assert.equal(S.solved(p, values), false);
  assert.equal(
    S.solutions({ ...p, clues: Array(9).fill(4) }).answers.length,
    0,
  );
});
test("slither hints progress through every puzzle, explain logical deductions, and restore states", () => {
  for (const p of P) {
    let s = S.create(p),
      steps = 0;
    while (!s.won && steps++ <= s.values.length) {
      const h = S.hint(s, p);
      assert.ok(h);
      assert.ok(h.text.length > 10);
      s = S.act(s, p, h);
    }
    assert.ok(s.won, p.id);
    assert.deepEqual(S.restore(s, p), s);
    assert.equal(S.act(s, p, { index: 0, value: 1 }), s);
  }
  assert.equal(
    S.restore({ id: 0, values: [], moves: 0, hints: 0 }, P[0]),
    null,
  );
});
const all = (s) => [
  ...s.tableau.flat(),
  ...s.cells.filter((n) => n !== null),
  ...s.foundations.flat(),
];
test("freecell numbered deals are reproducible, distinct and contain 52 unique visible cards", () => {
  const seen = new Set();
  for (let deal = 1; deal <= 1000; deal++) {
    const s = F.create(deal);
    assert.deepEqual(s, F.create(deal));
    assert.equal(new Set(all(s)).size, 52);
    assert.deepEqual(
      s.tableau.map((p) => p.length),
      [7, 7, 7, 7, 6, 6, 6, 6],
    );
    seen.add(s.tableau.flat().join(","));
  }
  assert.equal(seen.size, 1000);
  assert.equal(F.create(1000000).deal, 1000000);
});
test("freecell uses alternating descending runs and subtracts an empty destination from capacity", () => {
  const s = F.create(1);
  s.cells = [0, 13, 26, null];
  s.tableau = [[4, 16, 28, 40], [5], [], [1], [2], [3], [6], [7]];
  assert.ok(F.sequence(s.tableau[0]));
  assert.equal(F.capacity(s, { zone: "tableau", col: 1 }), 4);
  assert.equal(F.capacity(s, { zone: "tableau", col: 2 }), 2);
  assert.equal(
    F.canMove(
      s,
      { zone: "tableau", col: 0, index: 0 },
      { zone: "tableau", col: 2 },
    ),
    false,
  );
  s.cells[0] = null;
  assert.equal(F.capacity(s, { zone: "tableau", col: 2 }), 3);
  s.cells[1] = null;
  assert.equal(
    F.canMove(
      s,
      { zone: "tableau", col: 0, index: 0 },
      { zone: "tableau", col: 2 },
    ),
    true,
  );
  assert.equal(F.sequence([4, 3]), false);
});
test("freecell practice demonstrates temporary storage, suit order and terminal freeze", () => {
  let s = F.practice();
  assert.equal(new Set(all(s)).size, 52);
  assert.equal(
    F.act(s, {
      from: { zone: "tableau", col: 0, index: 1 },
      to: { zone: "foundation", col: 0 },
    }),
    s,
  );
  s = F.act(s, {
    from: { zone: "tableau", col: 0, index: 1 },
    to: { zone: "cell", col: 0 },
  });
  s = F.act(s, {
    from: { zone: "tableau", col: 0, index: 0 },
    to: { zone: "foundation", col: 0 },
  });
  s = F.act(s, {
    from: { zone: "cell", col: 0 },
    to: { zone: "foundation", col: 0 },
  });
  assert.ok(s.won);
  assert.equal(new Set(all(s)).size, 52);
  assert.equal(
    F.act(s, { from: { zone: "cell", col: 0 }, to: { zone: "cell", col: 1 } }),
    s,
  );
});
test("freecell random moves conserve all cards and action replay restores undo history", () => {
  for (let deal = 1; deal < 20; deal++) {
    let s = F.create(deal),
      packet = { version: 1, deal, actions: [] };
    for (let k = 0; k < 80 && !s.won; k++) {
      const options = F.options(s);
      if (!options.length) break;
      const a = options[(k * 31 + deal) % options.length],
        n = F.act(s, a);
      assert.notEqual(n, s);
      s = n;
      packet.actions.push(a);
      assert.equal(new Set(all(s)).size, 52);
      assert.equal(all(s).length, 52);
    }
    assert.deepEqual(F.restore(packet), s);
    packet.actions.push({
      from: { zone: "tableau", col: -1, index: 0 },
      to: { zone: "cell", col: 0 },
    });
    assert.equal(F.restore(packet), null);
  }
});
