(function (root, factory) {
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  else root.TicTacToe = engine;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const order = [4,0,2,6,8,1,3,5,7];
  function createGame() { return { board: Array(9).fill(''), turn: 'X', status: 'playing', winner: '', line: [] }; }
  function play(state, index) {
    if (state.status !== 'playing' || !Number.isInteger(index) || index < 0 || index > 8 || state.board[index]) return state;
    const board = state.board.slice(); board[index] = state.turn;
    const line = lines.find(cells => cells.every(i => board[i] === state.turn));
    return { board, turn: state.turn === 'X' ? 'O' : 'X', status: line ? 'won' : board.every(Boolean) ? 'draw' : 'playing', winner: line ? state.turn : '', line: line || [] };
  }
  function chooseMove(state, difficulty = 'hard', random = Math.random) {
    if (state.status !== 'playing') return null;
    const choices = order.filter(i => !state.board[i]);
    if (difficulty === 'easy') return choices[Math.floor(random() * choices.length)];
    const side = state.turn, memo = new Map();
    function score(position, depth) {
      if (position.status === 'won') return position.winner === side ? 10 - depth : depth - 10;
      if (position.status === 'draw') return 0;
      const key = position.board.map(c => c || '-').join('') + position.turn;
      if (memo.has(key)) return memo.get(key);
      const scores = order.filter(i => !position.board[i]).map(i => score(play(position, i), depth + 1));
      const result = position.turn === side ? Math.max(...scores) : Math.min(...scores);
      memo.set(key, result); return result;
    }
    let selected = choices[0], best = -Infinity;
    for (const index of choices) { const value = score(play(state, index), 0); if (value > best) { best = value; selected = index; } }
    return selected;
  }
  return { lines, createGame, play, chooseMove };
});
