const { test } = require("node:test");
const assert = require("node:assert/strict");
const Gomoku = require("../games/gomoku/engine.js"),
  Connect = require("../games/connect4/engine.js"),
  Reversi = require("../games/reversi/engine.js");
test("gomoku recognizes horizontal, vertical, both diagonals, and longer than five", () => {
  for (const [start, delta] of [
    [30, 1],
    [2, 13],
    [0, 14],
    [12, 12],
  ]) {
    let s = Gomoku.create();
    for (let i = 0; i < 4; i++) s.board[start + i * delta] = 1;
    s = Gomoku.move(s, start + 4 * delta);
    assert.equal(s.winner, 1);
    assert.equal(s.winning.length, 5);
    assert.equal(Gomoku.move(s, 100), s);
  }
  let s = Gomoku.create();
  [0, 1, 2, 4, 5].forEach((i) => {
    s.board[i] = 1;
  });
  s = Gomoku.move(s, 3);
  assert.equal(s.winning.length, 6);
});
test("gomoku AI takes a winning move and blocks an immediate loss", () => {
  let s = Gomoku.create();
  s.turn = 2;
  [40, 41, 42, 43].forEach((i) => (s.board[i] = 2));
  assert.equal(Gomoku.move(s, Gomoku.ai(s)).winner, 2);
  s = Gomoku.create();
  s.turn = 2;
  [0, 1, 2, 3].forEach((i) => (s.board[i] = 1));
  assert.equal(Gomoku.ai(s), 4);
  assert.equal(Gomoku.move(s, 0), s);
  assert.equal(Gomoku.move(s, -1), s);
});
test("connect four gravity fills columns from bottom, rejects a seventh piece and freezes on finish", () => {
  let s = Connect.create();
  s = Connect.move(s, 0);
  assert.equal(s.board[35], 1);
  s = Connect.move(s, 0);
  assert.equal(s.board[28], 2);
  for (let i = 0; i < 4; i++) s = Connect.move(s, 0);
  assert.equal(Connect.move(s, 0), s);
  assert.equal(Connect.legal(s).includes(0), false);
  s = Connect.create();
  for (const c of [0, 6, 1, 6, 2, 5, 3]) s = Connect.move(s, c);
  assert.equal(s.winner, 1);
  assert.equal(Connect.move(s, 4), s);
});
test("connect four detects vertical and diagonal wins and AI blocks immediate threats", () => {
  let s = Connect.create();
  for (const c of [0, 1, 0, 1, 0, 2, 0]) s = Connect.move(s, c);
  assert.equal(s.winner, 1);
  s = Connect.create();
  s.board[35] = s.board[29] = s.board[23] = 1;
  s.board[31] = s.board[38] = s.board[24] = 2;
  s.turn = 1;
  s = Connect.move(s, 3);
  assert.equal(s.winner, 1);
  assert.equal(s.last, 17);
  s = Connect.create();
  s.turn = 2;
  s.board[35] = s.board[36] = s.board[37] = 1;
  assert.equal(Connect.ai(s), 3);
  s.board[39] = s.board[40] = s.board[41] = 2;
  assert.equal(Connect.move(s, Connect.ai(s)).winner, 2);
});
test("reversi opening has four legal choices and flips bracketed pieces only", () => {
  const s = Reversi.create();
  assert.deepEqual(Reversi.legal(s), [19, 26, 37, 44]);
  assert.equal(Reversi.move(s, 0), s);
  const next = Reversi.move(s, 19);
  assert.equal(next.board[27], 1);
  assert.equal(next.board.filter((v) => v === 1).length, 4);
  assert.equal(next.board.filter((v) => v === 2).length, 1);
  assert.equal(next.turn, 2);
  assert.equal(s.board[27], 2);
});
test("reversi flips multiple directions, automatically passes and finishes even before a full board", () => {
  let s = Reversi.create();
  s.board = Array(64).fill(0);
  [25, 27, 19, 35].forEach((i) => (s.board[i] = 2));
  [24, 28, 11, 43].forEach((i) => (s.board[i] = 1));
  assert.deepEqual(
    Reversi.flips(s.board, 26, 1).sort((a, b) => a - b),
    [25, 27],
  );
  s = { ...Reversi.create(), board: Array(64).fill(1), turn: 1 };
  s.board[0] = 0;
  s.board[1] = 2;
  s.board[6] = 0;
  s.board[7] = 2;
  const next = Reversi.move(s, 0);
  assert.equal(next.over, true);
  assert.equal(next.winner, 1);
  assert.equal(next.board[6], 0);
});
test("reversi full legal playout preserves piece counts, handles forced passes, and terminates", () => {
  let sawPass = false;
  for (let seed = 1; seed <= 20; seed++) {
    let s = Reversi.create(),
      n = seed,
      moves = 0;
    while (!s.over) {
      const legal = Reversi.legal(s);
      assert.ok(legal.length);
      n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
      const before = s.board.filter(Boolean).length;
      s = Reversi.move(s, legal[n % legal.length]);
      moves++;
      assert.equal(s.board.filter(Boolean).length, before + 1);
      if (s.passed && !s.over) {
        sawPass = true;
        assert.equal(Reversi.legal({ ...s, turn: s.passed }).length, 0);
      }
      assert.ok(moves <= 60);
    }
    assert.equal(Reversi.legal(s).length, 0);
    const black = s.board.filter((v) => v === 1).length,
      white = s.board.filter((v) => v === 2).length;
    assert.equal(s.winner, black === white ? 0 : black > white ? 1 : 2);
  }
  assert.ok(sawPass);
});
test("reversi AI always returns a legal move and prioritizes an available corner", () => {
  const s = Reversi.create();
  assert.ok(Reversi.legal(s).includes(Reversi.ai(s)));
  s.board = Array(64).fill(0);
  s.board[1] = 2;
  s.board[2] = 1;
  s.board[27] = 2;
  s.board[28] = 1;
  assert.equal(Reversi.ai(s), 0);
});
