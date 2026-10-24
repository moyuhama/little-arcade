(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  const clues = (line) => {
    const out = [];
    let count = 0;
    for (const v of [...line, 0]) {
      if (v === 1) count++;
      else if (count) {
        out.push(count);
        count = 0;
      }
    }
    return out.length ? out : [0];
  };
  function describe(solution, size) {
    return {
      rows: Array.from({ length: size }, (_, r) =>
        clues(solution.slice(r * size, (r + 1) * size)),
      ),
      cols: Array.from({ length: size }, (_, c) =>
        clues(Array.from({ length: size }, (_, r) => solution[r * size + c])),
      ),
    };
  }
  function patterns(size, groups) {
    if (groups.length === 1 && groups[0] === 0) return [Array(size).fill(-1)];
    const out = [];
    function walk(g, start, line) {
      if (g === groups.length) {
        out.push(line);
        return;
      }
      const rest =
        groups.slice(g).reduce((a, b) => a + b, 0) + groups.length - g - 1;
      for (let p = start; p <= size - rest; p++) {
        const next = [...line];
        for (let j = p; j < p + groups[g]; j++) next[j] = 1;
        walk(g + 1, p + groups[g] + 1, next);
      }
    }
    walk(0, 0, Array(size).fill(-1));
    return out;
  }
  function candidates(line, groups) {
    return patterns(line.length, groups).filter((p) =>
      line.every((v, i) => !v || v === p[i]),
    );
  }
  function deduction(board, size, info) {
    for (const axis of ["rows", "cols"])
      for (let line = 0; line < size; line++) {
        const indices = Array.from({ length: size }, (_, p) =>
          axis === "rows" ? line * size + p : p * size + line,
        );
        const possible = candidates(
          indices.map((i) => board[i]),
          info[axis][line],
        );
        if (!possible.length) return { conflict: true, axis, line };
        const changes = indices.flatMap((index, p) =>
          !board[index] && possible.every((v) => v[p] === possible[0][p])
            ? [{ index, value: possible[0][p] }]
            : [],
        );
        if (changes.length)
          return { axis, line, changes, count: possible.length };
      }
    return null;
  }
  function solve(solution, size) {
    const info = describe(solution, size),
      board = Array(size * size).fill(0);
    let rounds = 0;
    while (rounds++ < size * size) {
      const h = deduction(board, size, info);
      if (!h || h.conflict) break;
      for (const x of h.changes) board[x.index] = x.value;
    }
    return board.every(Boolean) ? board : null;
  }
  function create(puzzle) {
    return {
      id: puzzle.id,
      size: puzzle.size,
      board: Array(puzzle.size ** 2).fill(0),
      hints: 0,
      won: false,
    };
  }
  function won(board, solution) {
    return board.every((v, i) => (v === 1) === (solution[i] === 1));
  }
  function restore(raw, puzzle) {
    if (
      !raw ||
      raw.id !== puzzle.id ||
      !Array.isArray(raw.board) ||
      raw.board.length !== puzzle.size ** 2 ||
      !raw.board.every((v) => [0, 1, -1].includes(v)) ||
      !Number.isInteger(raw.hints) ||
      raw.hints < 0
    )
      return null;
    return {
      ...create(puzzle),
      board: [...raw.board],
      hints: raw.hints,
      won: won(raw.board, puzzle.cells),
    };
  }
  return {
    clues,
    describe,
    patterns,
    candidates,
    deduction,
    solve,
    create,
    won,
    restore,
  };
});
