(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  const other = (side) => (side === "r" ? "b" : "r"),
    inside = (x, y) => x >= 0 && x < 8 && y >= 0 && y < 8;
  const key = (s) => s.turn + ":" + s.board.map((p) => p || "--").join("");
  function create() {
    const board = Array(64).fill(null);
    for (let i = 0; i < 64; i++)
      if (((i % 8) + Math.floor(i / 8)) % 2 === 1) {
        if (i < 24) board[i] = "bM";
        if (i >= 40) board[i] = "rM";
      }
    const s = {
      board,
      turn: "r",
      chain: -1,
      moves: 0,
      quiet: 0,
      over: false,
      winner: null,
      reason: "",
      last: null,
      repetitions: {},
    };
    s.repetitions[key(s)] = 1;
    return s;
  }
  function options(board, from, capture) {
    const p = board[from];
    if (!p) return [];
    const x = from % 8,
      y = Math.floor(from / 8),
      result = [],
      dys = p[1] === "K" ? [-1, 1] : [p[0] === "r" ? -1 : 1];
    for (const dy of dys)
      for (const dx of [-1, 1]) {
        const nx = x + dx * (capture ? 2 : 1),
          ny = y + dy * (capture ? 2 : 1);
        if (!inside(nx, ny) || board[ny * 8 + nx]) continue;
        const jumped = (y + dy) * 8 + x + dx;
        if (!capture || board[jumped]?.[0] === other(p[0]))
          result.push({
            from,
            to: ny * 8 + nx,
            capture: capture ? jumped : -1,
          });
      }
    return result;
  }
  function legal(s) {
    if (s.over) return [];
    if (s.chain >= 0) return options(s.board, s.chain, true);
    const owned = s.board.flatMap((p, i) => (p?.[0] === s.turn ? [i] : [])),
      captures = owned.flatMap((i) => options(s.board, i, true));
    return captures.length
      ? captures
      : owned.flatMap((i) => options(s.board, i, false));
  }
  function move(s, from, to) {
    const m = legal(s).find((m) => m.from === from && m.to === to);
    if (!m) return s;
    const board = [...s.board],
      piece = board[from];
    board[from] = null;
    board[to] = piece;
    if (m.capture >= 0) board[m.capture] = null;
    const crowned = piece[1] === "M" && (piece[0] === "r" ? to < 8 : to >= 56);
    if (crowned) board[to] = piece[0] + "K";
    const chain =
      m.capture >= 0 && !crowned && options(board, to, true).length ? to : -1;
    const next = {
      ...s,
      board,
      chain,
      last: m,
      quiet: m.capture >= 0 || piece[1] === "M" ? 0 : s.quiet + 1,
    };
    if (chain >= 0) return next;
    next.turn = other(s.turn);
    next.moves = s.moves + 1;
    const position = key(next);
    next.repetitions = {
      ...s.repetitions,
      [position]: (s.repetitions[position] || 0) + 1,
    };
    if (!legal(next).length) {
      next.over = true;
      next.winner = s.turn;
      next.reason = "blocked";
    } else if (next.repetitions[position] >= 3 || next.quiet >= 80) {
      next.over = true;
      next.reason = next.quiet >= 80 ? "quiet" : "repetition";
    }
    return next;
  }
  function ai(s) {
    const side = s.turn;
    const evaluate = (s) =>
      s.board.reduce(
        (sum, p, i) =>
          sum +
          (p
            ? (p[0] === side ? 1 : -1) *
              (p[1] === "K"
                ? 180
                : 100 +
                  (p[0] === "r" ? 7 - Math.floor(i / 8) : Math.floor(i / 8)) *
                    4)
            : 0),
        0,
      );
    function search(state, depth, alpha, beta) {
      if (state.over)
        return state.winner === side
          ? 10000 + depth
          : state.winner
            ? -10000 - depth
            : 0;
      if (depth <= 0 && state.chain < 0) return evaluate(state);
      const max = state.turn === side;
      let value = max ? -Infinity : Infinity;
      for (const m of legal(state)) {
        const next = move(state, m.from, m.to),
          score = search(
            next,
            depth - Number(next.turn !== state.turn),
            alpha,
            beta,
          );
        value = max ? Math.max(value, score) : Math.min(value, score);
        if (max) alpha = Math.max(alpha, value);
        else beta = Math.min(beta, value);
        if (beta <= alpha) break;
      }
      return value;
    }
    let chosen = null,
      best = -Infinity;
    for (const m of legal(s)) {
      const next = move(s, m.from, m.to),
        score = search(next, 4 - Number(next.turn !== s.turn), best, Infinity);
      if (score > best) {
        best = score;
        chosen = m;
      }
    }
    return chosen;
  }
  return { create, options, legal, move, ai, key };
});
