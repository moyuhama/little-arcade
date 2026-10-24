(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  function route(board, a, b, rows, cols, ignoreSymbols = false) {
    if (
      a === b ||
      !board[a] ||
      !board[b] ||
      (!ignoreSymbols && board[a] !== board[b])
    )
      return null;
    const w = cols + 2,
      h = rows + 2,
      point = (i) => (Math.floor(i / cols) + 1) * w + (i % cols) + 1,
      start = point(a),
      end = point(b),
      directions = [-w, 1, w, -1];
    const occupied = (p) => {
      const r = Math.floor(p / w) - 1,
        c = (p % w) - 1;
      return r >= 0 && r < rows && c >= 0 && c < cols && board[r * cols + c];
    };
    const queue = [],
      seen = new Map();
    for (let d = 0; d < 4; d++) {
      queue.push({ p: start, d, t: 0, path: [start] });
      seen.set(start * 4 + d, 0);
    }
    for (let head = 0; head < queue.length; head++) {
      const s = queue[head];
      for (let d = 0; d < 4; d++) {
        const turns = s.t + Number(d !== s.d);
        if (turns > 2) continue;
        const next = s.p + directions[d];
        if (
          next < 0 ||
          next >= w * h ||
          (d === 1 && s.p % w === w - 1) ||
          (d === 3 && s.p % w === 0)
        )
          continue;
        if (next === end)
          return [...s.path, next].map((p) => ({
            row: Math.floor(p / w),
            col: p % w,
          }));
        if (occupied(next)) continue;
        const key = next * 4 + d;
        if (seen.has(key) && seen.get(key) <= turns) continue;
        seen.set(key, turns);
        queue.push({ p: next, d, t: turns, path: [...s.path, next] });
      }
    }
    return null;
  }
  function pair(board, rows, cols) {
    for (let a = 0; a < board.length; a++)
      if (board[a])
        for (let b = a + 1; b < board.length; b++)
          if (board[a] === board[b] && route(board, a, b, rows, cols))
            return [a, b];
    return null;
  }
  function shuffle(board, rows, cols, random = Math.random) {
    const positions = board.flatMap((v, i) => (v ? [i] : []));
    if (!positions.length) return [...board];
    const values = positions.map((i) => board[i]);
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    const result = [...board];
    positions.forEach((p, i) => {
      result[p] = values[i];
    });
    if (pair(result, rows, cols)) return result;
    // Preserve every remaining symbol and empty location, but guarantee a legal pair.
    for (let i = 0; i < positions.length; i++)
      for (let j = i + 1; j < positions.length; j++)
        if (route(result, positions[i], positions[j], rows, cols, true)) {
          const a = positions[i],
            b = positions[j],
            match = positions.find((k) => k !== a && result[k] === result[a]);
          if (match !== undefined) {
            [result[b], result[match]] = [result[match], result[b]];
            return result;
          }
        }
    return result;
  }
  function create(rows, cols, random = Math.random) {
    return shuffle(
      Array.from(
        { length: rows * cols },
        (_, i) => (Math.floor(i / 2) % 12) + 1,
      ),
      rows,
      cols,
      random,
    );
  }
  function remove(board, a, b, rows, cols) {
    if (!route(board, a, b, rows, cols)) return board;
    const next = [...board];
    next[a] = next[b] = 0;
    return next;
  }
  return { route, pair, shuffle, create, remove };
});
