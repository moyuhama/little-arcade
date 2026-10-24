(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  function neighbors(index, n) {
    const r = Math.floor(index / n),
      c = index % n;
    return [
      index,
      r > 0 ? index - n : -1,
      r < n - 1 ? index + n : -1,
      c > 0 ? index - 1 : -1,
      c < n - 1 ? index + 1 : -1,
    ].filter((i) => i >= 0);
  }
  function press(board, index, n) {
    const next = [...board];
    neighbors(index, n).forEach((i) => {
      next[i] = 1 - next[i];
    });
    return next;
  }
  function create(n = 4, random = Math.random) {
    let board = Array(n * n).fill(0);
    for (let i = 0; i < n * n; i++)
      if (random() < 0.5) board = press(board, i, n);
    if (!board.some(Boolean))
      board = press(board, Math.floor(random() * n * n), n);
    return board;
  }
  // Solve the toggle system over GF(2); free variables are set to zero.
  function solve(board, n) {
    const count = n * n,
      rows = Array.from({ length: count }, (_, r) =>
        Array.from({ length: count + 1 }, (_, c) =>
          c === count ? board[r] : Number(neighbors(c, n).includes(r)),
        ),
      );
    let pivot = 0;
    const columns = [];
    for (let c = 0; c < count && pivot < count; c++) {
      const found = rows.findIndex((row, r) => r >= pivot && row[c]);
      if (found < 0) continue;
      [rows[pivot], rows[found]] = [rows[found], rows[pivot]];
      for (let r = 0; r < count; r++)
        if (r !== pivot && rows[r][c])
          for (let k = c; k <= count; k++) rows[r][k] ^= rows[pivot][k];
      columns.push(c);
      pivot++;
    }
    for (let r = pivot; r < count; r++) if (rows[r][count]) return null;
    return columns.filter((_, r) => rows[r][count]);
  }
  return { neighbors, press, create, solve };
});
