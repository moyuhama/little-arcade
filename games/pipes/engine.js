(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  const bits = [1, 2, 4, 8],
    opposite = [4, 8, 1, 2];
  const rotate = (mask, times = 1) => {
    for (let i = 0; i < ((times % 4) + 4) % 4; i++)
      mask = ((mask << 1) & 15) | (mask >> 3);
    return mask;
  };
  function neighbor(i, d, n) {
    const r = Math.floor(i / n),
      c = i % n;
    return d === 0
      ? r
        ? i - n
        : -1
      : d === 1
        ? c < n - 1
          ? i + 1
          : -1
        : d === 2
          ? r < n - 1
            ? i + n
            : -1
          : c
            ? i - 1
            : -1;
  }
  function inspect(board, n) {
    const reached = new Set([Math.floor((n * n) / 2)]),
      queue = [...reached],
      leaks = [];
    while (queue.length) {
      const i = queue.pop();
      for (let d = 0; d < 4; d++) {
        const j = neighbor(i, d, n);
        if (
          board[i] & bits[d] &&
          j >= 0 &&
          board[j] & opposite[d] &&
          !reached.has(j)
        ) {
          reached.add(j);
          queue.push(j);
        }
      }
    }
    for (let i = 0; i < board.length; i++)
      for (let d = 0; d < 4; d++)
        if (board[i] & bits[d]) {
          const j = neighbor(i, d, n);
          if (j < 0 || !(board[j] & opposite[d])) leaks.push(i);
        }
    return {
      reached: [...reached],
      leaks: [...new Set(leaks)],
      won: reached.size === n * n && !leaks.length,
    };
  }
  function solutions(puzzle, limit = 2, budget = 30000) {
    const n = puzzle.size,
      base = puzzle.solution || puzzle.board;
    let nodes = 0,
      exhausted = false;
    const answers = [];
    const domains = base.map((m, i) =>
      [...new Set([0, 1, 2, 3].map((r) => rotate(m, r)))].filter((v) =>
        bits.every((bit, d) => !(v & bit) || neighbor(i, d, n) >= 0),
      ),
    );
    function search(ds) {
      if (++nodes > budget) {
        exhausted = true;
        return;
      }
      let change = true;
      while (change) {
        change = false;
        for (let i = 0; i < ds.length; i++) {
          const filtered = ds[i].filter((m) =>
            bits.every((bit, d) => {
              const j = neighbor(i, d, n);
              return j < 0
                ? !(m & bit)
                : ds[j].some(
                    (v) => Boolean(m & bit) === Boolean(v & opposite[d]),
                  );
            }),
          );
          if (!filtered.length) return;
          if (filtered.length !== ds[i].length) {
            ds[i] = filtered;
            change = true;
          }
        }
      }
      let chosen = -1;
      for (let i = 0; i < ds.length; i++)
        if (
          ds[i].length > 1 &&
          (chosen < 0 || ds[i].length < ds[chosen].length)
        )
          chosen = i;
      if (chosen < 0) {
        const b = ds.map((d) => d[0]);
        if (inspect(b, n).won) answers.push(b);
        return;
      }
      for (const m of ds[chosen]) {
        const next = ds.map((d) => [...d]);
        next[chosen] = [m];
        search(next);
        if (answers.length >= limit || exhausted) return;
      }
    }
    search(domains);
    return { answers, exhausted, nodes };
  }
  function create(p) {
    return {
      id: p.id,
      board: [...p.initial],
      locked: Array(p.size * p.size).fill(false),
      moves: 0,
      hints: 0,
      won: false,
    };
  }
  function act(s, p, a) {
    if (
      !a ||
      s.won ||
      !Number.isInteger(a.index) ||
      a.index < 0 ||
      a.index >= s.board.length
    )
      return s;
    const next = { ...s, board: [...s.board], locked: [...s.locked] };
    if (a.lock === true) next.locked[a.index] = !next.locked[a.index];
    else {
      if (next.locked[a.index]) return s;
      next.board[a.index] = rotate(next.board[a.index], a.reverse ? -1 : 1);
      next.moves++;
    }
    next.won = inspect(next.board, p.size).won;
    return next;
  }
  function restore(raw, p) {
    if (
      !raw ||
      raw.id !== p.id ||
      !Array.isArray(raw.board) ||
      raw.board.length !== p.size * p.size ||
      !Array.isArray(raw.locked) ||
      raw.locked.length !== raw.board.length ||
      !raw.locked.every((v) => typeof v === "boolean") ||
      !Number.isInteger(raw.moves) ||
      raw.moves < 0 ||
      !Number.isInteger(raw.hints) ||
      raw.hints < 0
    )
      return null;
    for (let i = 0; i < raw.board.length; i++)
      if (![0, 1, 2, 3].some((r) => rotate(p.solution[i], r) === raw.board[i]))
        return null;
    return {
      ...create(p),
      board: [...raw.board],
      locked: [...raw.locked],
      moves: raw.moves,
      hints: raw.hints,
      won: inspect(raw.board, p.size).won,
    };
  }
  return { bits, rotate, neighbor, inspect, solutions, create, act, restore };
});
