(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  const other = (side) => (side === "r" ? "b" : "r");
  const inside = (x, y) => x >= 0 && x < 9 && y >= 0 && y < 10;
  const palace = (side, x, y) =>
    x >= 3 && x <= 5 && (side === "r" ? y >= 7 && y <= 9 : y >= 0 && y <= 2);
  const key = (s) => s.turn + ":" + s.board.map((p) => p || "--").join("");
  function create() {
    const board = Array(90).fill(null),
      back = ["R", "N", "B", "A", "K", "A", "B", "N", "R"];
    back.forEach((p, x) => {
      board[x] = "b" + p;
      board[81 + x] = "r" + p;
    });
    for (const x of [1, 7]) {
      board[18 + x] = "bC";
      board[63 + x] = "rC";
    }
    for (const x of [0, 2, 4, 6, 8]) {
      board[27 + x] = "bP";
      board[54 + x] = "rP";
    }
    const s = {
      board,
      turn: "r",
      moves: 0,
      quiet: 0,
      over: false,
      winner: null,
      reason: "",
      last: null,
      chain: -1,
      repetitions: {},
    };
    s.repetitions[key(s)] = 1;
    return s;
  }
  function pseudo(board, from) {
    const p = board[from];
    if (!p) return [];
    const side = p[0],
      type = p[1],
      x = from % 9,
      y = Math.floor(from / 9),
      result = [];
    function add(nx, ny) {
      if (inside(nx, ny) && board[ny * 9 + nx]?.[0] !== side)
        result.push({ from, to: ny * 9 + nx });
    }
    if (type === "R" || type === "C")
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        let screen = false;
        for (let nx = x + dx, ny = y + dy; inside(nx, ny); nx += dx, ny += dy) {
          const target = board[ny * 9 + nx];
          if (type === "R") {
            if (!target) add(nx, ny);
            else {
              add(nx, ny);
              break;
            }
          } else if (!screen) {
            if (!target) add(nx, ny);
            else screen = true;
          } else if (target) {
            add(nx, ny);
            break;
          }
        }
      }
    if (type === "N")
      for (const [dx, dy, lx, ly] of [
        [2, 1, 1, 0],
        [2, -1, 1, 0],
        [-2, 1, -1, 0],
        [-2, -1, -1, 0],
        [1, 2, 0, 1],
        [-1, 2, 0, 1],
        [1, -2, 0, -1],
        [-1, -2, 0, -1],
      ]) {
        if (inside(x + dx, y + dy) && !board[(y + ly) * 9 + x + lx])
          add(x + dx, y + dy);
      }
    if (type === "B")
      for (const dx of [-2, 2])
        for (const dy of [-2, 2]) {
          const ny = y + dy;
          if (
            inside(x + dx, ny) &&
            (side === "r" ? ny >= 5 : ny <= 4) &&
            !board[(y + dy / 2) * 9 + x + dx / 2]
          )
            add(x + dx, ny);
        }
    if (type === "A")
      for (const dx of [-1, 1])
        for (const dy of [-1, 1])
          if (palace(side, x + dx, y + dy)) add(x + dx, y + dy);
    if (type === "K") {
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        if (palace(side, x + dx, y + dy)) add(x + dx, y + dy);
      // The opposing general is also attacked along a clear file.
      for (const dy of [-1, 1])
        for (let ny = y + dy; inside(x, ny); ny += dy) {
          const target = board[ny * 9 + x];
          if (target) {
            if (target === other(side) + "K") add(x, ny);
            break;
          }
        }
    }
    if (type === "P") {
      add(x, y + (side === "r" ? -1 : 1));
      if (side === "r" ? y <= 4 : y >= 5) {
        add(x - 1, y);
        add(x + 1, y);
      }
    }
    return result;
  }
  function inCheck(board, side) {
    const king = board.indexOf(side + "K");
    if (king < 0) return true;
    return board.some(
      (p, i) =>
        p?.[0] === other(side) && pseudo(board, i).some((m) => m.to === king),
    );
  }
  function relocated(board, m) {
    const result = [...board];
    result[m.to] = result[m.from];
    result[m.from] = null;
    return result;
  }
  function legal(state) {
    if (state.over) return [];
    const result = [];
    state.board.forEach((p, i) => {
      if (p?.[0] === state.turn)
        for (const m of pseudo(state.board, i))
          if (
            state.board[m.to]?.[1] !== "K" &&
            !inCheck(relocated(state.board, m), state.turn)
          )
            result.push(m);
    });
    return result;
  }
  function after(state, m) {
    return {
      ...state,
      board: relocated(state.board, m),
      turn: other(state.turn),
      moves: state.moves + 1,
      quiet: state.board[m.to] ? 0 : state.quiet + 1,
      last: m,
    };
  }
  function move(state, from, to) {
    const m = legal(state).find((m) => m.from === from && m.to === to);
    if (!m) return state;
    const next = after(state, m),
      position = key(next);
    next.repetitions = {
      ...state.repetitions,
      [position]: (state.repetitions[position] || 0) + 1,
    };
    if (!legal(next).length) {
      next.over = true;
      next.winner = state.turn;
      next.reason = inCheck(next.board, next.turn) ? "checkmate" : "stalemate";
    } else if (next.repetitions[position] >= 3 || next.quiet >= 120) {
      next.over = true;
      next.reason = next.quiet >= 120 ? "quiet" : "repetition";
    }
    return next;
  }
  const values = { K: 10000, R: 900, C: 450, N: 400, B: 200, A: 200, P: 100 };
  function evaluate(board, side) {
    return board.reduce((sum, p, i) => {
      if (!p) return sum;
      const y = Math.floor(i / 9),
        progress = p[0] === "r" ? 9 - y : y;
      return (
        sum +
        (p[0] === side ? 1 : -1) *
          (values[p[1]] +
            (p[1] === "P" ? progress * 12 : 0) +
            (p[1] === "N" ? Math.max(0, 4 - Math.abs((i % 9) - 4)) * 4 : 0))
      );
    }, 0);
  }
  function ai(state) {
    const side = state.turn,
      options = legal(state).sort(
        (a, b) =>
          (values[state.board[b.to]?.[1]] || 0) -
          (values[state.board[a.to]?.[1]] || 0),
      );
    let chosen = null,
      best = -Infinity;
    // Two-ply search: choose a legal move after considering the opponent's reply.
    for (const m of options) {
      const next = after(state, m),
        replies = legal(next);
      let score = Infinity;
      if (!replies.length) score = 100000;
      for (const reply of replies) {
        const response = after(next, reply);
        score = Math.min(score, evaluate(response.board, side));
        if (score <= best) break;
      }
      if (score > best) {
        best = score;
        chosen = m;
      }
    }
    return chosen;
  }
  return { create, pseudo, legal, move, inCheck, ai, key };
});
