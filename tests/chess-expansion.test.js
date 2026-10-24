const { test } = require("node:test");
const assert = require("node:assert/strict");
const X = require("../games/xiangqi/engine.js"),
  D = require("../games/checkers/engine.js");
const at = (x, y) => y * 9 + x;
function xState(pieces, turn = "r") {
  const s = X.create();
  s.board = Array(90).fill(null);
  s.turn = turn;
  for (const [index, piece] of pieces) s.board[index] = piece;
  s.repetitions = { [X.key(s)]: 1 };
  return s;
}
function dState(pieces, turn = "r") {
  const s = D.create();
  s.board = Array(64).fill(null);
  s.turn = turn;
  for (const [index, piece] of pieces) s.board[index] = piece;
  s.repetitions = { [D.key(s)]: 1 };
  return s;
}
test("xiangqi starts with 32 pieces and 44 legal red moves, without check", () => {
  const s = X.create();
  assert.equal(s.board.filter(Boolean).length, 32);
  assert.equal(X.legal(s).length, 44);
  assert.equal(X.inCheck(s.board, "r"), false);
  assert.equal(X.inCheck(s.board, "b"), false);
});
test("xiangqi horse legs block only the appropriate two jumps", () => {
  const s = xState([
    [at(4, 6), "rN"],
    [at(4, 5), "rP"],
  ]);
  const targets = X.pseudo(s.board, at(4, 6)).map((m) => m.to);
  assert.equal(targets.length, 6);
  assert.ok(!targets.includes(at(3, 4)));
  assert.ok(!targets.includes(at(5, 4)));
  assert.ok(targets.includes(at(6, 5)));
});
test("xiangqi elephants cannot cross the river or a blocked eye; advisors and kings stay in palace", () => {
  let s = xState([[at(4, 5), "rB"]]);
  assert.deepEqual(
    X.pseudo(s.board, at(4, 5))
      .map((m) => m.to)
      .sort((a, b) => a - b),
    [at(2, 7), at(6, 7)],
  );
  s = xState([
    [at(2, 7), "rB"],
    [at(3, 8), "bP"],
  ]);
  assert.ok(!X.pseudo(s.board, at(2, 7)).some((m) => m.to === at(4, 9)));
  s = xState([
    [at(3, 9), "rA"],
    [at(4, 9), "rK"],
  ]);
  assert.deepEqual(
    X.pseudo(s.board, at(3, 9)).map((m) => m.to),
    [at(4, 8)],
  );
  assert.ok(
    X.pseudo(s.board, at(4, 9)).every(
      (m) => m.to % 9 >= 3 && m.to % 9 <= 5 && Math.floor(m.to / 9) >= 7,
    ),
  );
});
test("xiangqi cannons need exactly one screen to capture, while rooks cannot jump", () => {
  const from = at(0, 4),
    target = at(8, 4);
  let s = xState([
    [from, "rC"],
    [target, "bR"],
  ]);
  assert.ok(!X.pseudo(s.board, from).some((m) => m.to === target));
  s.board[at(4, 4)] = "rP";
  assert.ok(X.pseudo(s.board, from).some((m) => m.to === target));
  assert.ok(!X.pseudo(s.board, from).some((m) => m.to === at(6, 4)));
  s.board[at(6, 4)] = "bP";
  assert.ok(!X.pseudo(s.board, from).some((m) => m.to === target));
  s.board[from] = "rR";
  assert.ok(
    !X.pseudo(s.board, from).some((m) => m.to >= at(4, 4) && m.to <= target),
  );
});
test("xiangqi pawns gain sideways moves only after crossing and never move backward", () => {
  let s = xState([[at(4, 5), "rP"]]);
  assert.deepEqual(
    X.pseudo(s.board, at(4, 5)).map((m) => m.to),
    [at(4, 4)],
  );
  s = xState([[at(4, 4), "rP"]]);
  assert.equal(X.pseudo(s.board, at(4, 4)).length, 3);
  assert.ok(!X.pseudo(s.board, at(4, 4)).some((m) => m.to === at(4, 5)));
  s = xState([[at(4, 4), "bP"]]);
  assert.deepEqual(
    X.pseudo(s.board, at(4, 4)).map((m) => m.to),
    [at(4, 5)],
  );
});
test("xiangqi rejects exposing the king and the facing-generals file", () => {
  let s = xState([
    [85, "rK"],
    [4, "bK"],
    [49, "rR"],
  ]);
  assert.equal(X.move(s, 49, 48), s);
  assert.notEqual(X.move(s, 49, 40), s);
  s = xState([
    [85, "rK"],
    [3, "bK"],
    [4, "bR"],
    [67, "rR"],
  ]);
  assert.equal(X.move(s, 67, 66), s);
  s.board[67] = null;
  assert.ok(X.inCheck(s.board, "r"));
});
test("xiangqi adjudicates checkmate and stalemate as losses and ignores moves afterwards", () => {
  let s = xState([
    [85, "rK"],
    [4, "bK"],
    [12, "rP"],
    [14, "rP"],
    [13, "bP"],
    [31, "rR"],
  ]);
  s = X.move(s, 31, 13);
  assert.equal(s.over, true);
  assert.equal(s.winner, "r");
  assert.equal(s.reason, "checkmate");
  assert.equal(X.move(s, 4, 3), s);
  s = xState([
    [85, "rK"],
    [4, "bK"],
    [12, "rP"],
    [14, "rP"],
    [49, "rP"],
    [18, "rR"],
  ]);
  s = X.move(s, 18, 9);
  assert.equal(s.over, true);
  assert.equal(s.reason, "stalemate");
  assert.equal(s.winner, "r");
});
test("xiangqi casual repetition and quiet limits are deterministic, and capture resets the clock", () => {
  let s = xState([
    [85, "rK"],
    [4, "bK"],
    [49, "rP"],
    [81, "rR"],
    [0, "bR"],
  ]);
  for (const [from, to] of [
    [81, 82],
    [0, 1],
    [82, 81],
    [1, 0],
    [81, 82],
    [0, 1],
    [82, 81],
    [1, 0],
  ])
    s = X.move(s, from, to);
  assert.equal(s.over, true);
  assert.equal(s.reason, "repetition");
  s = xState([
    [85, "rK"],
    [4, "bK"],
    [49, "rP"],
    [81, "rR"],
  ]);
  s.quiet = 119;
  s = X.move(s, 81, 82);
  assert.equal(s.reason, "quiet");
  s = xState([
    [85, "rK"],
    [4, "bK"],
    [49, "rP"],
    [81, "rR"],
    [72, "bP"],
  ]);
  s.quiet = 119;
  s = X.move(s, 81, 72);
  assert.equal(s.quiet, 0);
  assert.equal(s.over, false);
});
test("xiangqi AI returns a legal move, takes mate, and leaves its own king safe", () => {
  let s = X.create(),
    m = X.ai(s);
  assert.ok(X.legal(s).some((x) => x.from === m.from && x.to === m.to));
  assert.equal(X.inCheck(X.move(s, m.from, m.to).board, s.turn), false);
  s = xState([
    [85, "rK"],
    [4, "bK"],
    [12, "rP"],
    [14, "rP"],
    [13, "bP"],
    [31, "rR"],
  ]);
  m = X.ai(s);
  assert.equal(X.move(s, m.from, m.to).winner, "r");
});
test("checkers starts on dark squares, moves forward, and globally requires captures", () => {
  let s = D.create();
  assert.equal(s.board.filter(Boolean).length, 24);
  assert.equal(D.legal(s).length, 7);
  s.board.forEach((p, i) => {
    if (p) assert.equal(((i % 8) + Math.floor(i / 8)) % 2, 1);
  });
  s = dState([
    [42, "rM"],
    [35, "bM"],
    [46, "rM"],
    [1, "bM"],
  ]);
  assert.deepEqual(D.legal(s), [{ from: 42, to: 28, capture: 35 }]);
  assert.equal(D.move(s, 46, 37), s);
  assert.equal(D.move(s, 42, 51), s);
});
test("checkers chained capture locks the same piece and finishes one complete turn", () => {
  let s = dState([
    [42, "rM"],
    [35, "bM"],
    [21, "bM"],
    [1, "bM"],
    [46, "rM"],
  ]);
  const original = JSON.stringify(s);
  s = D.move(s, 42, 28);
  assert.equal(s.turn, "r");
  assert.equal(s.chain, 28);
  assert.equal(s.moves, 0);
  assert.deepEqual(D.legal(s), [{ from: 28, to: 14, capture: 21 }]);
  assert.equal(D.move(s, 46, 37), s);
  s = D.move(s, 28, 14);
  assert.equal(s.turn, "b");
  assert.equal(s.chain, -1);
  assert.equal(s.moves, 1);
  assert.equal(s.board[35], null);
  assert.equal(s.board[21], null);
  assert.equal(JSON.parse(original).board[35], "bM");
});
test("checkers promotion ends a capture immediately; kings step in both directions but do not fly", () => {
  let s = dState([
    [17, "rM"],
    [10, "bM"],
    [12, "bM"],
    [55, "bM"],
  ]);
  s = D.move(s, 17, 3);
  assert.equal(s.board[3], "rK");
  assert.equal(s.chain, -1);
  assert.equal(s.turn, "b");
  assert.equal(s.board[12], "bM");
  s = dState([
    [28, "rK"],
    [1, "bK"],
  ]);
  const targets = D.legal(s).map((m) => m.to);
  assert.deepEqual(
    targets.sort((a, b) => a - b),
    [19, 21, 35, 37],
  );
  assert.equal(D.move(s, 28, 10), s);
});
test("checkers permits any capture route rather than enforcing the longest", () => {
  const s = dState([
    [42, "rM"],
    [33, "bM"],
    [35, "bM"],
    [21, "bM"],
  ]);
  assert.deepEqual(
    D.legal(s)
      .map((m) => m.to)
      .sort((a, b) => a - b),
    [24, 28],
  );
});
test("checkers wins on capture or blockade and draws after repetition or no progress", () => {
  let s = dState([
    [42, "rM"],
    [35, "bM"],
  ]);
  s = D.move(s, 42, 28);
  assert.equal(s.winner, "r");
  assert.equal(D.move(s, 28, 19), s);
  s = dState([
    [40, "bM"],
    [49, "rM"],
    [58, "rM"],
    [53, "rM"],
  ]);
  s = D.move(s, 53, 44);
  assert.equal(s.winner, "r");
  s = dState([
    [56, "rK"],
    [7, "bK"],
  ]);
  for (const [a, b] of [
    [56, 49],
    [7, 14],
    [49, 56],
    [14, 7],
    [56, 49],
    [7, 14],
    [49, 56],
    [14, 7],
  ])
    s = D.move(s, a, b);
  assert.equal(s.reason, "repetition");
  s = dState([
    [56, "rK"],
    [7, "bK"],
  ]);
  s.quiet = 79;
  s = D.move(s, 56, 49);
  assert.equal(s.reason, "quiet");
});
test("checkers AI follows forced chains and never chooses an illegal move", () => {
  let s = D.create();
  for (let i = 0; i < 14 && !s.over; i++) {
    const m = D.ai(s);
    assert.ok(D.legal(s).some((x) => x.from === m.from && x.to === m.to));
    s = D.move(s, m.from, m.to);
  }
  s = dState([
    [42, "rM"],
    [35, "bM"],
    [21, "bM"],
    [1, "bM"],
  ]);
  s = D.move(s, 42, 28);
  assert.deepEqual(D.ai(s), { from: 28, to: 14, capture: 21 });
});
