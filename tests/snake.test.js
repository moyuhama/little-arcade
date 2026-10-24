const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGame, turn, step, foodFor } = require('../games/snake/engine.js');

test('a normal move preserves length and leaves the previous board untouched', () => {
  const state = createGame();
  const original = structuredClone(state);
  const next = step(state);
  assert.equal(next.snake[0], state.snake[0] + 1);
  assert.equal(next.snake.length, 3);
  assert.equal(next.score, 0);
  assert.deepEqual(state, original);
});

test('food grows the snake once, adds ten points, and respawns off the body', () => {
  let state = createGame();
  for (let i = 0; i < 4; i++) state = step(state, () => 0);
  assert.equal(state.score, 10);
  assert.equal(state.snake.length, 4);
  assert.equal(state.food, 0);
  assert.ok(!state.snake.includes(state.food));
});

test('opposite turns and repeated directions are ignored', () => {
  const state = createGame();
  assert.equal(turn(state, 'left'), state);
  assert.equal(turn(state, 'right'), state);
  assert.equal(turn(state, 'unknown'), state);
});

test('two fast turns are consumed on separate ticks; extra input cannot reverse into the neck', () => {
  let state = turn(turn(createGame(), 'up'), 'left');
  const head = state.snake[0];
  assert.deepEqual(state.turns, ['up', 'left']);
  assert.equal(turn(state, 'down'), state);
  state = step(state);
  assert.equal(state.snake[0], head - 18);
  assert.equal(state.direction, 'up');
  state = step(state);
  assert.equal(state.snake[0], head - 19);
  assert.equal(state.status, 'playing');
});

test('the next queued turn is validated against the last queued direction', () => {
  const state = turn(createGame(), 'up');
  assert.equal(turn(state, 'down'), state);
  assert.deepEqual(turn(state, 'left').turns, ['up', 'left']);
});

test('all four walls end the game without wrapping or moving the body', () => {
  for (const [direction, snake] of [
    ['left', [0, 1, 2]], ['right', [5, 4, 3]],
    ['up', [0, 6, 12]], ['down', [30, 24, 18]]
  ]) {
    const state = { ...createGame(6), direction, snake };
    const next = step(state);
    assert.equal(next.status, 'lost');
    assert.equal(next.reason, 'wall');
    assert.deepEqual(next.snake, snake);
    assert.equal(step(next), next);
  }
});

test('hitting the body loses, but moving into the vacating tail is legal', () => {
  const state = { ...createGame(6), snake: [14, 13, 7, 8, 9, 15], direction: 'up', food: 35 };
  assert.equal(step(state).reason, 'self');
  const tailMove = { ...state, snake: [14, 13, 7, 8] };
  const next = step(tailMove);
  assert.equal(next.status, 'playing');
  assert.deepEqual(next.snake, [8, 14, 13, 7]);
});

test('food selection handles a single empty cell and a full board', () => {
  const occupied = Array.from({ length: 36 }, (_, i) => i);
  assert.equal(foodFor(occupied.slice(1), 6, () => .99999), 0);
  assert.equal(foodFor(occupied, 6), null);
  for (const random of [0, .25, .5, .99999]) {
    assert.ok(![0, 1, 2].includes(foodFor([0, 1, 2], 6, () => random)));
  }
});

test('eating the last free cell wins instead of trying to spawn forever', () => {
  const snake = [];
  for (let y = 0; y < 6; y++) {
    const row = Array.from({ length: 6 }, (_, x) => y * 6 + x);
    snake.push(...(y % 2 ? row.reverse() : row));
  }
  snake.reverse();
  const food = snake.shift();
  const state = { ...createGame(6), snake, food, direction: 'left', score: 320 };
  const next = step(state);
  assert.equal(next.status, 'won');
  assert.equal(next.snake.length, 36);
  assert.equal(new Set(next.snake).size, 36);
  assert.equal(next.food, null);
  assert.equal(next.score, 330);
  assert.equal(turn(next, 'up'), next);
});

test('the registered game is searchable, filterable, and has valid local resources', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const { selectGames } = require('../lobby.js');
  const root = path.resolve(__dirname, '..');
  const sandbox = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'catalog.js'), 'utf8'), sandbox);
  const games = sandbox.ARCADE_GAMES;
  assert.equal(new Set(games.map(game => game.id)).size, games.length);
  assert.equal(selectGames(games, { query: 'snake' })[0].id, 'snake');
  assert.ok(selectGames(games, { category: '街机' }).some(game => game.id === 'snake'));
  assert.equal(selectGames(games, { view: 'favorites', favorites: ['snake'] })[0].id, 'snake');
  for (const game of games) {
    assert.ok(fs.existsSync(path.join(root, game.url)));
    if (game.cover) assert.ok(fs.existsSync(path.join(root, game.cover)));
  }
  const html = fs.readFileSync(path.join(root, 'games/snake/index.html'), 'utf8');
  assert.match(html, /data-game-id="snake"/);
  for (const [, url] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    assert.ok(fs.existsSync(path.resolve(root, 'games/snake', url)), url);
  }
});
