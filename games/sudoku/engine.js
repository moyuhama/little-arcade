(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  const peers = Array.from({ length: 81 }, (_, i) =>
    Array.from({ length: 81 }, (_, j) => j).filter(
      (j) =>
        i !== j &&
        (Math.floor(i / 9) === Math.floor(j / 9) ||
          i % 9 === j % 9 ||
          (Math.floor(i / 27) === Math.floor(j / 27) &&
            Math.floor((i % 9) / 3) === Math.floor((j % 9) / 3))),
    ),
  );
  function conflicts(board) {
    return board.map(
      (value, i) => !!value && peers[i].some((j) => board[j] === value),
    );
  }
  function countSolutions(input, limit = 2) {
    const board = [...input];
    if (conflicts(board).some(Boolean)) return 0;
    let total = 0;
    function visit() {
      let at = -1,
        choices = [];
      for (let i = 0; i < 81; i++)
        if (!board[i]) {
          const used = new Set(peers[i].map((j) => board[j])),
            options = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((v) => !used.has(v));
          if (!options.length) return;
          if (at < 0 || options.length < choices.length) {
            at = i;
            choices = options;
            if (options.length === 1) break;
          }
        }
      if (at < 0) {
        total++;
        return;
      }
      for (const n of choices) {
        board[at] = n;
        visit();
        if (total >= limit) break;
      }
      board[at] = 0;
    }
    visit();
    return total;
  }
  function shuffle(list, random) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function create(difficulty = "easy", random = Math.random) {
    const groups = () =>
      shuffle([0, 1, 2], random).flatMap((g) =>
        shuffle([0, 1, 2], random).map((i) => g * 3 + i),
      );
    const rows = groups(),
      cols = groups(),
      digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random);
    const solution = rows.flatMap((r) =>
      cols.map((c) => digits[(r * 3 + Math.floor(r / 3) + c) % 9]),
    );
    const puzzle = [...solution],
      target = { easy: 36, medium: 45, hard: 52 }[difficulty] || 36;
    let removed = 0;
    for (const i of shuffle(
      Array.from({ length: 81 }, (_, j) => j),
      random,
    )) {
      const old = puzzle[i];
      puzzle[i] = 0;
      if (countSolutions(puzzle) === 1) removed++;
      else puzzle[i] = old;
      if (removed >= target) break;
    }
    return { puzzle, solution };
  }
  const solved = (board) =>
    board.every((v) => Number.isInteger(v) && v >= 1 && v <= 9) &&
    !conflicts(board).some(Boolean);
  return { peers, conflicts, countSolutions, create, solved };
});
