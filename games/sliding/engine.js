(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  const solved = (board) => board.every((v, i) => v === (i + 1) % board.length);
  function move(state, index) {
    const empty = state.board.indexOf(0),
      n = state.size;
    if (
      index < 0 ||
      index >= n * n ||
      Math.abs((index % n) - (empty % n)) +
        Math.abs(Math.floor(index / n) - Math.floor(empty / n)) !==
        1
    )
      return state;
    const board = [...state.board];
    [board[empty], board[index]] = [board[index], board[empty]];
    return { ...state, board, moves: state.moves + 1 };
  }
  function create(size = 3, random = Math.random) {
    let state = {
        size,
        board: Array.from(
          { length: size * size },
          (_, i) => (i + 1) % (size * size),
        ),
        moves: 0,
      },
      previous = -1;
    for (let i = 0; i < size * size * 30; i++) {
      const empty = state.board.indexOf(0),
        candidates = [];
      for (let j = 0; j < state.board.length; j++)
        if (j !== previous && move(state, j) !== state) candidates.push(j);
      state = move(state, candidates[Math.floor(random() * candidates.length)]);
      previous = empty;
    }
    if (solved(state.board)) state = move(state, state.board.length - 2);
    return { ...state, moves: 0 };
  }
  return { create, move, solved };
});
