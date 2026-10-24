(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  const size = 8,
    directions = [
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
    ];
  function create() {
    const board = Array(64).fill(0);
    board[27] = board[36] = 2;
    board[28] = board[35] = 1;
    return {
      board,
      size,
      rows: size,
      turn: 1,
      over: false,
      winner: 0,
      moves: 0,
      last: -1,
      passed: 0,
      winning: [],
    };
  }
  function flips(board, index, side) {
    if (index < 0 || index >= 64 || board[index]) return [];
    const result = [];
    for (const [dx, dy] of directions) {
      const line = [];
      let x = (index % 8) + dx,
        y = Math.floor(index / 8) + dy;
      while (
        x >= 0 &&
        x < 8 &&
        y >= 0 &&
        y < 8 &&
        board[y * 8 + x] === 3 - side
      ) {
        line.push(y * 8 + x);
        x += dx;
        y += dy;
      }
      if (
        line.length &&
        x >= 0 &&
        x < 8 &&
        y >= 0 &&
        y < 8 &&
        board[y * 8 + x] === side
      )
        result.push(...line);
    }
    return result;
  }
  const legal = (state) =>
    state.over
      ? []
      : state.board.flatMap((v, i) =>
          !v && flips(state.board, i, state.turn).length ? [i] : [],
        );
  function move(state, index) {
    if (state.over || !Number.isInteger(index)) return state;
    const changes = flips(state.board, index, state.turn);
    if (!changes.length) return state;
    const board = [...state.board];
    board[index] = state.turn;
    changes.forEach((i) => {
      board[i] = state.turn;
    });
    let next = {
      ...state,
      board,
      turn: 3 - state.turn,
      moves: state.moves + 1,
      last: index,
      passed: 0,
    };
    if (!legal(next).length) {
      next.passed = next.turn;
      next.turn = state.turn;
      if (!legal(next).length) {
        next.over = true;
        const a = board.filter((v) => v === 1).length,
          b = board.filter((v) => v === 2).length;
        next.winner = a === b ? 0 : a > b ? 1 : 2;
      }
    }
    return next;
  }
  function ai(state) {
    const corners = [0, 7, 56, 63];
    let best = -Infinity,
      chosen = null;
    for (const i of legal(state)) {
      const next = move(state, i),
        own = next.board.filter((v) => v === state.turn).length,
        other = next.board.filter((v) => v === 3 - state.turn).length;
      let score = own - other - legal(next).length * 5;
      if (corners.includes(i)) score += 500;
      for (const c of corners)
        if (
          !state.board[c] &&
          Math.abs((i % 8) - (c % 8)) <= 1 &&
          Math.abs(Math.floor(i / 8) - Math.floor(c / 8)) <= 1
        )
          score -= 150;
      if (next.over)
        score += next.winner === state.turn ? 10000 : next.winner ? -10000 : 0;
      if (score > best) {
        best = score;
        chosen = i;
      }
    }
    return chosen;
  }
  return { create, flips, legal, move, ai };
});
