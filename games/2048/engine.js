(function (root, factory) {
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  else root.Game2048 = engine;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function slide(line) {
    const numbers = line.filter(Boolean), result = [], merged = [];
    let score = 0;
    for (let i = 0; i < numbers.length; i++) {
      if (numbers[i] === numbers[i + 1]) {
        const value = numbers[i] * 2;
        merged.push(result.length); result.push(value); score += value; i++;
      } else result.push(numbers[i]);
    }
    while (result.length < 4) result.push(0);
    return { line: result, score, merged };
  }
  function move(board, direction) {
    if (!['left', 'right', 'up', 'down'].includes(direction)) throw new Error('Invalid direction');
    const next = board.slice(), merged = [];
    let score = 0;
    for (let line = 0; line < 4; line++) {
      const indices = Array.from({ length: 4 }, (_, position) => {
        const p = direction === 'right' || direction === 'down' ? 3 - position : position;
        return direction === 'left' || direction === 'right' ? line * 4 + p : p * 4 + line;
      });
      const result = slide(indices.map(index => board[index]));
      indices.forEach((index, i) => { next[index] = result.line[i]; });
      score += result.score;
      merged.push(...result.merged.map(i => indices[i]));
    }
    return { board: next, score, merged, changed: next.some((value, i) => value !== board[i]) };
  }
  function spawn(board, random = Math.random) {
    const empty = board.map((value, index) => value === 0 ? index : -1).filter(i => i >= 0);
    if (!empty.length) return -1;
    const index = empty[Math.floor(random() * empty.length)];
    board[index] = random() < 0.9 ? 2 : 4;
    return index;
  }
  function canMove(board) {
    return board.some((value, i) => value === 0 || (i % 4 < 3 && value === board[i + 1]) || (i < 12 && value === board[i + 4]));
  }
  function validState(state) {
    return !!state && Array.isArray(state.board) && state.board.length === 16 && state.board.every(value => Number.isSafeInteger(value) && value >= 0 && (value === 0 || (value >= 2 && Number.isInteger(Math.log2(value))))) && Number.isSafeInteger(state.score) && state.score >= 0 && typeof state.continued === 'boolean';
  }
  return { slide, move, spawn, canMove, validState };
});
