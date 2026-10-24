(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  const size = 13,
    directions = [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, -1],
    ];
  const create = () => ({
    board: Array(size * size).fill(0),
    size,
    rows: size,
    turn: 1,
    over: false,
    winner: 0,
    moves: 0,
    last: -1,
    winning: [],
  });
  function line(board, index, side) {
    for (const [dx, dy] of directions) {
      const cells = [index],
        x = index % size,
        y = Math.floor(index / size);
      for (const sign of [-1, 1])
        for (let k = 1; k < size; k++) {
          const nx = x + dx * k * sign,
            ny = y + dy * k * sign;
          if (
            nx < 0 ||
            ny < 0 ||
            nx >= size ||
            ny >= size ||
            board[ny * size + nx] !== side
          )
            break;
          cells.push(ny * size + nx);
        }
      if (cells.length >= 5) return cells;
    }
    return [];
  }
  const legal = (state) =>
    state.over ? [] : state.board.flatMap((v, i) => (v ? [] : [i]));
  function move(state, index) {
    if (
      state.over ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= size * size ||
      state.board[index]
    )
      return state;
    const board = [...state.board];
    board[index] = state.turn;
    const winning = line(board, index, state.turn),
      moves = state.moves + 1;
    return {
      ...state,
      board,
      moves,
      last: index,
      winning,
      over: !!winning.length || moves === size * size,
      winner: winning.length ? state.turn : 0,
      turn: 3 - state.turn,
    };
  }
  function value(board, index, side) {
    const x = index % size,
      y = Math.floor(index / size);
    let result = 0;
    for (const [dx, dy] of directions) {
      let count = 1,
        open = 0;
      for (const sign of [-1, 1]) {
        let k = 1;
        for (; k < 5; k++) {
          const nx = x + dx * k * sign,
            ny = y + dy * k * sign;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) break;
          if (board[ny * size + nx] !== side) {
            if (!board[ny * size + nx]) open++;
            break;
          }
          count++;
        }
      }
      result +=
        count >= 5
          ? 1000000
          : ([0, 2, 18, 180, 9000][count] || 0) *
            (open === 2 ? 3 : open === 1 ? 1 : 0);
    }
    return result;
  }
  function ai(state) {
    const available = legal(state);
    if (!available.length) return null;
    for (const i of available)
      if (move(state, i).winner === state.turn) return i;
    for (const i of available)
      if (move({ ...state, turn: 3 - state.turn }, i).winner === 3 - state.turn)
        return i;
    let chosen = available[0],
      best = -Infinity;
    for (const i of available) {
      const score =
        value(state.board, i, state.turn) +
        value(state.board, i, 3 - state.turn) * 1.1 -
        Math.abs((i % size) - 6) -
        Math.abs(Math.floor(i / size) - 6);
      if (score > best) {
        best = score;
        chosen = i;
      }
    }
    return chosen;
  }
  return { create, legal, move, ai, line };
});
