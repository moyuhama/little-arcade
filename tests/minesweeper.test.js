const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGame, neighbors, reveal, toggleFlag, chord } = require('../games/minesweeper/engine.js');

test('first reveal and all eight neighbors are safe at every difficulty', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    for (const first of [0, 40]) {
      const initial = createGame(level), next = reveal(initial, first, () => .37);
      assert.equal(initial.status, 'ready');
      assert.ok(initial.cells.every(cell => !cell.mine && !cell.open));
      assert.equal(next.cells.filter(cell => cell.mine).length, next.mines);
      assert.equal(next.cells[first].count, 0);
      assert.ok([first, ...neighbors(next, first)].every(i => !next.cells[i].mine));
      assert.ok(next.opened > 1);
    }
  }
});

test('corner neighbors never wrap across rows', () => {
  assert.deepEqual(neighbors(createGame(), 0), [1, 9, 10]);
  assert.deepEqual(neighbors(createGame(), 8), [7, 16, 17]);
});

test('flags can be placed before the first move without starting or placing mines', () => {
  const initial = createGame(), flagged = toggleFlag(initial, 0);
  assert.equal(flagged.status, 'ready'); assert.equal(flagged.flags, 1);
  assert.equal(reveal(flagged, 0), flagged);
  assert.equal(initial.cells[0].flag, false);
  assert.equal(toggleFlag(flagged, 0).flags, 0);
});

test('flags are capped and revealed cells cannot be flagged', () => {
  let state = createGame();
  for (let i = 0; i < 11; i++) state = toggleFlag(state, i);
  assert.equal(state.flags, 10); assert.equal(state.cells[10].flag, false);
  const playing = reveal(createGame(), 40, () => .5);
  assert.equal(toggleFlag(playing, 40), playing);
});

test('opening a mine loses and terminal games reject further actions', () => {
  let seed = 123;
  const state = reveal(createGame(), 40, () => ((seed = seed * 16807 % 2147483647) / 2147483647));
  assert.equal(state.status, 'playing');
  const mine = state.cells.findIndex(cell => cell.mine);
  const lost = reveal(state, mine);
  assert.equal(lost.status, 'lost');
  assert.equal(lost.cells[mine].open, true);
  assert.equal(state.cells[mine].open, false);
  assert.equal(reveal(lost, 80), lost); assert.equal(toggleFlag(lost, 80), lost);
});

test('revealing every safe cell wins without requiring flags on every mine', () => {
  let state = reveal(createGame(), 40, () => .8);
  for (let i = 0; i < state.cells.length; i++) if (!state.cells[i].mine) state = reveal(state, i);
  assert.equal(state.status, 'won'); assert.equal(state.opened, 71); assert.equal(state.flags, 0);
});

function smallBoard(flagIndex) {
  const counts = [0, 1, 0, 1, 1, 0, 0, 0, 0];
  return { ...createGame(), rows: 3, cols: 3, mines: 1, status: 'playing', opened: 1, flags: 1,
    cells: counts.map((count, i) => ({ mine: i === 0, count, open: i === 4, flag: i === flagIndex })) };
}
test('chording a correctly flagged number reveals the remaining neighbors', () => {
  const state = smallBoard(0), result = chord(state, 4);
  assert.equal(result.status, 'won'); assert.equal(result.opened, 8);
  assert.equal(state.opened, 1);
});
test('incorrectly flagged chording can detonate a mine', () => {
  assert.equal(chord(smallBoard(2), 4).status, 'lost');
});
test('invalid indices do not change a game', () => {
  const state = createGame();
  for (const i of [-1, 81, .5, NaN]) { assert.equal(reveal(state, i), state); assert.equal(toggleFlag(state, i), state); }
});
