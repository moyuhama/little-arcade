(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  const size = 7,
    rows = 6,
    directions = [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, -1],
    ];
  const create = () => ({
    board: Array(42).fill(0),
    size,
    rows,
    turn: 1,
    over: false,
    winner: 0,
    moves: 0,
    last: -1,
    winning: [],
  });
  function legal(state) {
    return state.over
      ? []
      : [3, 2, 4, 1, 5, 0, 6].filter((c) => !state.board[c]);
  }
  function move(state, index) {
    if (state.over || !Number.isInteger(index) || index < 0 || index >= 42)
      return state;
    const col = index % size;
    if (state.board[col]) return state;
    let at = col;
    while (at + size < 42 && !state.board[at + size]) at += size;
    const board = [...state.board];
    board[at] = state.turn;
    let winning = [];
    for (const [dx, dy] of directions) {
      const cells = [at],
        x = at % size,
        y = Math.floor(at / size);
      for (const sign of [-1, 1])
        for (let k = 1; k < 4; k++) {
          const nx = x + dx * k * sign,
            ny = y + dy * k * sign;
          if (
            nx < 0 ||
            ny < 0 ||
            nx >= size ||
            ny >= rows ||
            board[ny * size + nx] !== state.turn
          )
            break;
          cells.push(ny * size + nx);
        }
      if (cells.length >= 4) {
        winning = cells;
        break;
      }
    }
    const moves = state.moves + 1;
    return {
      ...state,
      board,
      last: at,
      moves,
      winning,
      over: !!winning.length || moves === 42,
      winner: winning.length ? state.turn : 0,
      turn: 3 - state.turn,
    };
  }
  function evaluate(state, side) {
    let score = 0;
    for (let r = 0; r < rows; r++)
      if (state.board[r * 7 + 3])
        score += state.board[r * 7 + 3] === side ? 5 : -5;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < size; x++)
        for (const [dx, dy] of directions) {
          let own = 0,
            other = 0,
            valid = true;
          for (let k = 0; k < 4; k++) {
            const nx = x + dx * k,
              ny = y + dy * k;
            if (nx < 0 || ny < 0 || nx >= size || ny >= rows) {
              valid = false;
              break;
            }
            const v = state.board[ny * size + nx];
            if (v === side) own++;
            else if (v) other++;
          }
          if (valid) {
            if (!other) score += [0, 1, 8, 60, 10000][own];
            if (!own) score -= [0, 1, 10, 90, 10000][other];
          }
        }
    return score;
  }
  function ai(state) {
    if (state.over) return null;
    const side = state.turn;
    function search(s, depth, alpha, beta) {
      if (s.over)
        return s.winner === side
          ? 100000 + depth
          : s.winner
            ? -100000 - depth
            : 0;
      if (!depth) return evaluate(s, side);
      const max = s.turn === side;
      let value = max ? -Infinity : Infinity;
      for (const col of legal(s)) {
        const score = search(move(s, col), depth - 1, alpha, beta);
        value = max ? Math.max(value, score) : Math.min(value, score);
        if (max) alpha = Math.max(alpha, value);
        else beta = Math.min(beta, value);
        if (beta <= alpha) break;
      }
      return value;
    }
    let chosen = null,
      best = -Infinity;
    for (const col of legal(state)) {
      const score = search(move(state, col), 3, -Infinity, Infinity);
      if (score > best) {
        best = score;
        chosen = col;
      }
    }
    return chosen;
  }
  return { create, legal, move, ai };
});
