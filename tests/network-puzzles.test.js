const { test } = require("node:test");
const assert = require("node:assert/strict");
const B = require("../games/bridges/engine"),
  BP = require("../games/bridges/puzzles"),
  E = require("../games/pipes/engine"),
  P = require("../games/pipes/puzzles");
test("all 60 bridge puzzles have their nearest-neighbor geometry and exactly one connected solution", () => {
  assert.equal(BP.length, 60);
  for (const p of BP) {
    assert.deepEqual(B.edges(p.islands), p.edges);
    assert.ok(B.solved(p, p.solution), p.name);
    const r = B.solutions(p);
    assert.equal(r.exhausted, false, p.name);
    assert.equal(r.answers.length, 1, p.name);
    assert.deepEqual(r.answers[0], p.solution);
  }
});
test("bridge counts alone do not allow isolated networks or crossings", () => {
  const p = {
    islands: [
      { x: 0, y: 0, n: 1 },
      { x: 2, y: 0, n: 1 },
      { x: 0, y: 2, n: 1 },
      { x: 2, y: 2, n: 1 },
    ],
    edges: [
      [0, 1],
      [0, 2],
      [1, 3],
      [2, 3],
    ],
  };
  assert.equal(B.solved(p, [1, 0, 0, 1]), false);
  const cross = {
    islands: [
      { x: 0, y: 1, n: 1 },
      { x: 2, y: 1, n: 1 },
      { x: 1, y: 0, n: 1 },
      { x: 1, y: 2, n: 1 },
    ],
    edges: [
      [0, 1],
      [2, 3],
    ],
  };
  let s = B.act(B.create(cross), cross, 0);
  assert.equal(B.act(s, cross, 1), s);
  assert.equal(B.restore({ ...s, values: [1, 1] }, cross), null);
});
test("bridges cycle single, double, remove, with legal saved-state restoration", () => {
  const p = BP[0];
  let s = B.create(p);
  for (const n of [1, 2, 0]) {
    s = B.act(s, p, 0);
    assert.equal(s.values[0], n);
  }
  assert.equal(s.moves, 3);
  assert.deepEqual(B.restore(s, p), s);
  assert.equal(B.restore({ ...s, values: [] }, p), null);
  assert.equal(B.restore({ ...s, hints: -1 }, p), null);
  const win = B.restore({ ...s, values: p.solution }, p);
  assert.ok(win.won);
  assert.equal(B.act(win, p, 0), win);
});
test("all 60 pipe puzzles are scrambled connected trees with exactly one orientation solution", () => {
  assert.equal(P.length, 60);
  for (const p of P) {
    assert.ok(E.inspect(p.solution, p.size).won, p.name);
    assert.equal(E.inspect(p.initial, p.size).won, false, p.name);
    assert.equal(
      p.solution.reduce(
        (sum, mask) => sum + E.bits.filter((b) => b & mask).length,
        0,
      ),
      2 * (p.size * p.size - 1),
    );
    const r = E.solutions(p);
    assert.equal(r.exhausted, false, p.name);
    assert.equal(r.answers.length, 1, p.name);
    assert.deepEqual(r.answers[0], p.solution);
  }
});
test("pipes rotate clockwise, reverse, lock and unlock without moving the board", () => {
  const p = P[1];
  let s = E.create(p);
  const before = s.board[0];
  s = E.act(s, p, { index: 0 });
  assert.equal(s.board[0], E.rotate(before));
  s = E.act(s, p, { index: 0, reverse: true });
  assert.equal(s.board[0], before);
  s = E.act(s, p, { index: 0, lock: true });
  assert.equal(E.act(s, p, { index: 0 }), s);
  assert.equal(s.moves, 2);
  assert.ok(E.restore(s, p).locked[0]);
  s = E.act(s, p, { index: 0, lock: true });
  assert.equal(s.locked[0], false);
  assert.equal(E.restore({ ...s, board: [15] }, p), null);
});
test("pipes detect matching ports, boundary leaks and disconnected closed loops", () => {
  assert.equal(E.neighbor(2, 1, 3), -1);
  assert.equal(E.neighbor(3, 3, 3), -1);
  const p = P[0],
    s = E.act(E.create(p), p, { index: 4 });
  assert.ok(s.won);
  assert.equal(E.act(s, p, { index: 0 }), s);
  const broken = [...p.solution];
  broken[0] = 15;
  assert.equal(E.inspect(broken, 3).won, false);
  const loops = [6, 12, 6, 12, 3, 9, 3, 9, 6, 12, 6, 12, 3, 9, 3, 9];
  const info = E.inspect(loops, 4);
  assert.equal(info.leaks.length, 0);
  assert.equal(info.reached.length, 4);
  assert.equal(info.won, false);
});
