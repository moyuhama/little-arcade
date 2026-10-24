(function (root, factory) {
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  else root.MemoryPairs = engine;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const levels = { easy: { pairs: 6, cols: 4 }, normal: { pairs: 8, cols: 4 }, hard: { pairs: 12, cols: 6 } };
  function createGame(level = 'normal', random = Math.random) {
    if (!Object.hasOwn(levels, level)) throw new Error('Invalid difficulty');
    const { pairs, cols } = levels[level], cards = Array.from({ length: pairs * 2 }, (_, i) => Math.floor(i / 2));
    for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
    return { level, cards, cols, pairCount: pairs, matched: Array(cards.length).fill(false), selected: [], pairs: 0, moves: 0, status: 'ready' };
  }
  function flip(state, index) {
    if (!['ready', 'playing'].includes(state.status) || !Number.isInteger(index) || index < 0 || index >= state.cards.length || state.matched[index] || state.selected.includes(index)) return state;
    const selected = [...state.selected, index];
    if (selected.length === 1) return { ...state, selected, status: 'playing' };
    const next = { ...state, selected, moves: state.moves + 1, status: 'settling' };
    if (state.cards[selected[0]] === state.cards[selected[1]]) {
      next.matched = state.matched.slice(); selected.forEach(i => { next.matched[i] = true; });
      next.selected = []; next.pairs++; next.status = next.pairs === state.pairCount ? 'won' : 'playing';
    }
    return next;
  }
  function settle(state) { return state.status === 'settling' ? { ...state, selected: [], status: 'playing' } : state; }
  return { levels, createGame, flip, settle };
});
