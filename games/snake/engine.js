(function (root, factory) {
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  else root.SnakeGame = engine;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const vectors = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };

  function foodFor(snake, size, random = Math.random) {
    const occupied = new Set(snake);
    const empty = Array.from({ length: size * size }, (_, i) => i).filter(i => !occupied.has(i));
    return empty.length ? empty[Math.floor(random() * empty.length)] : null;
  }

  function createGame(size = 18) {
    if (!Number.isInteger(size) || size < 6 || size > 40) throw new Error('Invalid board size');
    const middle = Math.floor(size / 2);
    const head = middle * size + middle;
    return {
      size, snake: [head, head - 1, head - 2], direction: 'right', turns: [],
      food: middle * size + Math.min(size - 1, middle + 4),
      score: 0, status: 'playing', reason: ''
    };
  }

  function turn(state, direction) {
    if (!vectors[direction] || state.status !== 'playing' || state.turns.length >= 2) return state;
    const previous = state.turns[state.turns.length - 1] || state.direction;
    if (direction === previous || direction === opposite[previous]) return state;
    // Consume at most one turn per tick, so two fast keypresses cannot reverse into the neck.
    return { ...state, turns: [...state.turns, direction] };
  }

  function step(state, random = Math.random) {
    if (state.status !== 'playing') return state;
    const direction = state.turns[0] || state.direction;
    const [dx, dy] = vectors[direction];
    const x = state.snake[0] % state.size + dx;
    const y = Math.floor(state.snake[0] / state.size) + dy;
    const base = { ...state, direction, turns: state.turns.slice(1) };
    if (x < 0 || y < 0 || x >= state.size || y >= state.size) {
      return { ...base, status: 'lost', reason: 'wall' };
    }
    const head = y * state.size + x;
    const ate = head === state.food;
    // The tail vacates its cell on a non-growing move; entering that cell is legal.
    const occupied = ate ? state.snake : state.snake.slice(0, -1);
    if (occupied.includes(head)) return { ...base, status: 'lost', reason: 'self' };
    const snake = [head, ...state.snake];
    if (!ate) snake.pop();
    const food = ate ? foodFor(snake, state.size, random) : state.food;
    return {
      ...base, snake, food, score: state.score + (ate ? 10 : 0),
      status: food === null ? 'won' : 'playing'
    };
  }

  return { createGame, turn, step, foodFor };
});
