(function (root, factory) {
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  else root.Minesweeper = engine;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const levels = { easy: { rows: 9, cols: 9, mines: 10 }, normal: { rows: 12, cols: 12, mines: 24 }, hard: { rows: 16, cols: 16, mines: 40 } };
  function createGame(level = 'easy') {
    if (!Object.hasOwn(levels, level)) throw new Error('Invalid difficulty');
    const config = levels[level];
    return { ...config, level, status: 'ready', flags: 0, opened: 0, cells: Array.from({ length: config.rows * config.cols }, () => ({ mine: false, count: 0, open: false, flag: false })) };
  }
  function neighbors(state, index) {
    const x = index % state.cols, y = Math.floor(index / state.cols), result = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      if (x + dx >= 0 && x + dx < state.cols && y + dy >= 0 && y + dy < state.rows) result.push((y + dy) * state.cols + x + dx);
    }
    return result;
  }
  const editable = state => state.status === 'ready' || state.status === 'playing';
  const validIndex = (state, index) => Number.isInteger(index) && index >= 0 && index < state.cells.length;
  const clone = state => ({ ...state, cells: state.cells.map(cell => ({ ...cell })) });
  function placeMines(state, first, random) {
    const safe = new Set([first, ...neighbors(state, first)]);
    const candidates = state.cells.map((_, i) => i).filter(i => !safe.has(i));
    for (let i = 0; i < state.mines; i++) {
      const j = i + Math.floor(random() * (candidates.length - i));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      state.cells[candidates[i]].mine = true;
    }
    state.cells.forEach((cell, i) => { cell.count = neighbors(state, i).filter(n => state.cells[n].mine).length; });
    state.status = 'playing';
  }
  function openCells(state, indices) {
    const queue = [...indices], seen = new Set();
    for (let p = 0; p < queue.length; p++) {
      const i = queue[p], cell = state.cells[i];
      if (seen.has(i) || cell.open || cell.flag) continue;
      seen.add(i); cell.open = true;
      if (cell.mine) { state.status = 'lost'; return; }
      state.opened++;
      if (cell.count === 0) queue.push(...neighbors(state, i));
    }
    if (state.opened === state.cells.length - state.mines) state.status = 'won';
  }
  function reveal(state, index, random = Math.random) {
    if (!editable(state) || !validIndex(state, index) || state.cells[index].flag) return state;
    if (state.cells[index].open) return chord(state, index);
    const next = clone(state);
    if (next.status === 'ready') placeMines(next, index, random);
    openCells(next, [index]);
    return next;
  }
  function toggleFlag(state, index) {
    if (!editable(state) || !validIndex(state, index) || state.cells[index].open) return state;
    if (!state.cells[index].flag && state.flags >= state.mines) return state;
    const next = clone(state), cell = next.cells[index];
    cell.flag = !cell.flag; next.flags += cell.flag ? 1 : -1;
    return next;
  }
  function chord(state, index) {
    if (state.status !== 'playing' || !validIndex(state, index) || !state.cells[index].open) return state;
    const around = neighbors(state, index);
    if (around.filter(i => state.cells[i].flag).length !== state.cells[index].count) return state;
    const next = clone(state); openCells(next, around); return next;
  }
  return { levels, createGame, neighbors, reveal, toggleFlag, chord };
});
