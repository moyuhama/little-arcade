(function (root, factory) {
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  else root.Tetris = engine;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const COLS = 10, ROWS = 20;
  const SHAPES = {
    I: ['0000', '1111', '0000', '0000'], O: ['11', '11'],
    T: ['010', '111', '000'], J: ['100', '111', '000'],
    L: ['001', '111', '000'], S: ['011', '110', '000'], Z: ['110', '011', '000']
  };
  function bag(random) {
    const types = Object.keys(SHAPES);
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }
    return types;
  }
  function piece(type) {
    const cells = SHAPES[type].map(row => [...row].map(Number));
    return { type, cells, x: Math.floor((COLS - cells.length) / 2), y: 0 };
  }
  function blocks(active) {
    return active.cells.flatMap((row, y) => row.flatMap((filled, x) => filled ? [{ x: active.x + x, y: active.y + y }] : []));
  }
  function fits(board, active) {
    return blocks(active).every(({ x, y }) => x >= 0 && x < COLS && y >= -4 && y < ROWS && (y < 0 || !board[y * COLS + x]));
  }
  function spawn(state, random) {
    let queue = state.queue.slice();
    if (queue.length < 7) queue.push(...bag(random));
    const active = piece(queue.shift());
    return { ...state, queue, active, status: fits(state.board, active) ? 'playing' : 'lost' };
  }
  function createGame(random = Math.random) {
    return spawn({ board: Array(COLS * ROWS).fill(''), queue: [], score: 0, lines: 0, level: 1, lastClear: 0 }, random);
  }
  function move(state, dx, dy) {
    if (state.status !== 'playing') return state;
    const active = { ...state.active, x: state.active.x + dx, y: state.active.y + dy };
    return fits(state.board, active) ? { ...state, active } : state;
  }
  function rotate(state) {
    if (state.status !== 'playing' || state.active.type === 'O') return state;
    const cells = state.active.cells[0].map((_, x) => state.active.cells.map(row => row[x]).reverse());
    // A small, predictable set of wall/floor adjustments; not a full SRS implementation.
    for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [-1, -1], [1, -1], [0, -2]]) {
      const active = { ...state.active, cells, x: state.active.x + dx, y: state.active.y + dy };
      if (fits(state.board, active)) return { ...state, active };
    }
    return state;
  }
  function ghost(state) {
    let active = state.active;
    while (fits(state.board, { ...active, y: active.y + 1 })) active = { ...active, y: active.y + 1 };
    return active;
  }
  function lock(state, random = Math.random) {
    if (state.status !== 'playing') return state;
    const occupied = blocks(state.active);
    if (occupied.some(block => block.y < 0)) return { ...state, status: 'lost' };
    const board = state.board.slice();
    occupied.forEach(({ x, y }) => { board[y * COLS + x] = state.active.type; });
    const rows = Array.from({ length: ROWS }, (_, y) => board.slice(y * COLS, (y + 1) * COLS));
    const kept = rows.filter(row => row.some(cell => !cell)), cleared = ROWS - kept.length;
    const lines = state.lines + cleared;
    return spawn({ ...state, board: [...Array.from({ length: cleared }, () => Array(COLS).fill('')), ...kept].flat(), lines,
      level: Math.floor(lines / 10) + 1, score: state.score + [0, 100, 300, 500, 800][cleared] * state.level, lastClear: cleared }, random);
  }
  function softDrop(state) {
    const next = move(state, 0, 1);
    return next === state ? state : { ...next, score: state.score + 1 };
  }
  function hardDrop(state, random = Math.random) {
    if (state.status !== 'playing') return state;
    const active = ghost(state);
    return lock({ ...state, active, score: state.score + (active.y - state.active.y) * 2 }, random);
  }
  return { COLS, ROWS, SHAPES, piece, blocks, fits, createGame, move, rotate, ghost, lock, softDrop, hardDrop };
});
