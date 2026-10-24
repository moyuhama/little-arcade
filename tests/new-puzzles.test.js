const { test } = require("node:test");
const assert = require("node:assert/strict");
const Sliding = require("../games/sliding/engine.js");
const Lights = require("../games/lights/engine.js");
const Maze = require("../games/maze/engine.js");
const Sudoku = require("../games/sudoku/engine.js");
const Link = require("../games/link/engine.js");
const Flood = require("../games/flood/engine.js");
function rng(seed) {
  return () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
}
function inversions(board) {
  let n = 0;
  const a = board.filter(Boolean);
  for (let i = 0; i < a.length; i++)
    for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) n++;
  return n;
}
test("sliding puzzles always obey solvable parity, have every tile, and do not start solved", () => {
  for (const size of [3, 4])
    for (let seed = 1; seed <= 40; seed++) {
      const state = Sliding.create(size, rng(seed));
      assert.equal(new Set(state.board).size, size * size);
      assert.equal(Sliding.solved(state.board), false);
      const parity = inversions(state.board),
        fromBottom = size - Math.floor(state.board.indexOf(0) / size);
      assert.equal(
        size % 2 ? parity % 2 : (parity + fromBottom) % 2,
        size % 2 ? 0 : 1,
      );
    }
});
test("sliding only swaps adjacent cells, rejects row wrap, and recognizes a finish", () => {
  const state = { size: 3, board: [1, 2, 3, 4, 5, 6, 7, 0, 8], moves: 0 };
  assert.equal(Sliding.move(state, 0), state);
  const end = Sliding.move(state, 8);
  assert.ok(Sliding.solved(end.board));
  assert.equal(end.moves, 1);
  assert.deepEqual(state.board, [1, 2, 3, 4, 5, 6, 7, 0, 8]);
  assert.equal(
    Sliding.move({ size: 3, board: [1, 2, 0, 3, 4, 5, 6, 7, 8], moves: 0 }, 3)
      .moves,
    0,
  );
});
test("lights hints solve every generated 4 × 4 and 5 × 5 board", () => {
  for (const size of [4, 5])
    for (let seed = 1; seed <= 40; seed++) {
      let board = Lights.create(size, rng(seed));
      assert.ok(board.some(Boolean));
      const solution = Lights.solve(board, size);
      assert.ok(solution);
      for (const i of solution) board = Lights.press(board, i, size);
      assert.ok(board.every((v) => !v));
    }
});
test("pressing a corner flips only the corner and its two neighbors; twice restores", () => {
  const board = Array(16).fill(0),
    once = Lights.press(board, 0, 4);
  assert.deepEqual(
    once.flatMap((v, i) => (v ? [i] : [])),
    [0, 1, 4],
  );
  assert.deepEqual(Lights.press(once, 0, 4), board);
});
test("all maze sizes are connected trees with reciprocal walls and reachable exits", () => {
  for (const size of [7, 11, 15])
    for (let seed = 1; seed <= 15; seed++) {
      const state = Maze.create(size, rng(seed)),
        seen = new Set([0]),
        queue = [0];
      let edges = 0;
      for (let at = 0; at < queue.length; at++)
        for (const d of Object.keys(Maze.directions)) {
          const s = { ...state, position: queue[at] },
            next = Maze.move(s, d);
          if (next === s) continue;
          edges++;
          const opposite = {
            up: "down",
            down: "up",
            left: "right",
            right: "left",
          }[d];
          assert.equal(Maze.move(next, opposite).position, s.position);
          if (!seen.has(next.position)) {
            seen.add(next.position);
            queue.push(next.position);
          }
        }
      assert.equal(seen.size, size * size);
      assert.equal(edges / 2, size * size - 1);
      const path = Maze.path(state);
      assert.equal(path[0], 0);
      assert.equal(path.at(-1), size * size - 1);
      assert.equal(Maze.move(state, "up"), state);
      assert.equal(Maze.move(state, "left"), state);
    }
});
test("sudoku puzzles have one solution at each difficulty and preserve their givens", () => {
  for (const difficulty of ["easy", "medium", "hard"])
    for (let seed = 1; seed <= 6; seed++) {
      const { puzzle, solution } = Sudoku.create(difficulty, rng(seed));
      assert.equal(Sudoku.countSolutions(puzzle), 1);
      assert.ok(Sudoku.solved(solution));
      assert.equal(Sudoku.solved(puzzle), false);
      assert.ok(puzzle.filter(Boolean).length >= 17);
      puzzle.forEach((v, i) => {
        if (v) assert.equal(v, solution[i]);
      });
    }
});
test("sudoku catches row, column and box conflicts and rejects invalid completed grids", () => {
  for (const index of [1, 9, 10]) {
    const board = Array(81).fill(0);
    board[0] = board[index] = 5;
    const bad = Sudoku.conflicts(board);
    assert.equal(bad[0], true);
    assert.equal(bad[index], true);
    assert.equal(Sudoku.countSolutions(board), 0);
  }
  assert.equal(Sudoku.solved(Array(81).fill(1)), false);
  assert.equal(Sudoku.countSolutions(Array(81).fill(0)), 2);
});
function turns(path) {
  let previous = null,
    total = 0;
  for (let i = 1; i < path.length; i++) {
    const d = [
      path[i].row - path[i - 1].row,
      path[i].col - path[i - 1].col,
    ].join(",");
    if (previous && d !== previous) total++;
    previous = d;
  }
  return total;
}
test("link routes allow two turns through the border, but never cross an occupied tile", () => {
  const board = [1, 2, 1, 3, 4, 3];
  const path = Link.route(board, 0, 2, 2, 3);
  assert.ok(path);
  assert.ok(path.some((p) => p.row === 0));
  assert.ok(turns(path) <= 2);
  assert.equal(Link.route(board, 0, 1, 2, 3), null);
  assert.equal(Link.route(board, 0, 0, 2, 3), null);
  const blocked = Array(25).fill(2);
  blocked[6] = blocked[18] = 1;
  assert.equal(Link.route(blocked, 6, 18, 5, 5), null);
});
test("link shuffles preserve symbol counts and holes, and guarantee a playable pair until empty", () => {
  for (const [rows, cols] of [
    [4, 6],
    [6, 8],
  ])
    for (let seed = 1; seed <= 10; seed++) {
      const random = rng(seed);
      let board = Link.create(rows, cols, random),
        steps = 0;
      while (board.some(Boolean)) {
        let pair = Link.pair(board, rows, cols);
        if (!pair) {
          const before = [...board];
          board = Link.shuffle(board, rows, cols, random);
          assert.deepEqual([...board].sort(), [...before].sort());
          before.forEach((v, i) => {
            if (!v) assert.equal(board[i], 0);
          });
          pair = Link.pair(board, rows, cols);
        }
        assert.ok(pair);
        const path = Link.route(board, ...pair, rows, cols);
        assert.ok(turns(path) <= 2);
        board = Link.remove(board, ...pair, rows, cols);
        steps++;
      }
      assert.equal(steps, (rows * cols) / 2);
    }
});
test("flood changes only the connected starting region, expands through new neighbors, and can finish", () => {
  let state = { size: 3, board: [0, 0, 2, 1, 2, 2, 1, 1, 0], moves: 0 };
  assert.deepEqual(Flood.region(state.board, 3), [0, 1]);
  assert.equal(Flood.move(state, 0), state);
  state = Flood.move(state, 2);
  assert.equal(state.board[8], 0);
  assert.equal(Flood.region(state.board, 3).length, 5);
  state = Flood.move(state, 1);
  assert.equal(Flood.region(state.board, 3).length, 8);
  state = Flood.move(state, 0);
  assert.ok(Flood.solved(state));
  assert.equal(state.moves, 3);
});
test("link fallback resolves a completely stuck arrangement without losing a tile", () => {
  const board = [1, 2, 2, 1];
  assert.equal(Link.pair(board, 2, 2), null);
  const shuffled = Link.shuffle(board, 2, 2, () => 0.999);
  assert.deepEqual([...shuffled].sort(), [1, 1, 2, 2]);
  assert.ok(Link.pair(shuffled, 2, 2));
  assert.deepEqual(Link.shuffle([0, 0, 0, 0], 2, 2), [0, 0, 0, 0]);
});
