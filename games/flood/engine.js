(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  const create = (size, random = Math.random) => ({
    size,
    board: Array.from({ length: size * size }, () => Math.floor(random() * 6)),
    moves: 0,
  });
  function region(board, size) {
    const color = board[0],
      seen = new Set([0]),
      queue = [0];
    for (let at = 0; at < queue.length; at++) {
      const i = queue[at];
      for (const j of [
        i % size ? i - 1 : -1,
        i % size < size - 1 ? i + 1 : -1,
        i - size,
        i + size,
      ])
        if (j >= 0 && j < board.length && !seen.has(j) && board[j] === color) {
          seen.add(j);
          queue.push(j);
        }
    }
    return [...seen];
  }
  function move(state, color) {
    if (
      !Number.isInteger(color) ||
      color < 0 ||
      color > 5 ||
      color === state.board[0]
    )
      return state;
    const board = [...state.board];
    region(board, state.size).forEach((i) => {
      board[i] = color;
    });
    return { ...state, board, moves: state.moves + 1 };
  }
  const solved = (state) => state.board.every((v) => v === state.board[0]);
  return { create, region, move, solved };
});
