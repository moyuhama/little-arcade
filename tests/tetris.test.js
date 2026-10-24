const { test } = require('node:test');
const assert = require('node:assert/strict');
const { COLS, ROWS, SHAPES, piece, blocks, fits, createGame, move, rotate, ghost, lock, softDrop, hardDrop } = require('../games/tetris/engine.js');
const empty = () => Array(COLS * ROWS).fill('');
const withPiece = (type, x = 3, y = 5) => ({ ...createGame(), active: { ...piece(type), x, y } });
test('every shape has four cells, spawns legally, and each bag contains all seven shapes', () => {
  for (const type of Object.keys(SHAPES)) { assert.equal(blocks(piece(type)).length, 4); assert.ok(fits(empty(), piece(type))); }
  let seed = 13; const random = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  let state = createGame(random); const drawn = [];
  for (let i = 0; i < 28; i++) { drawn.push(state.active.type); state = hardDrop({ ...state, board: empty() }, random); }
  for (let i = 0; i < drawn.length; i += 7) assert.equal(new Set(drawn.slice(i, i + 7)).size, 7);
});
test('moving respects walls and settled blocks without mutating the original', () => {
  const state = withPiece('O', 0, 18), snapshot = structuredClone(state);
  assert.equal(move(state, -1, 0), state); assert.equal(move(state, 0, 1), state);
  assert.equal(move(state, 1, 0).active.x, 1);
  state.board[18 * COLS + 2] = 'T'; assert.equal(move(state, 1, 0), state);
  state.board[18 * COLS + 2] = ''; assert.deepEqual(state, snapshot);
});
test('four clockwise turns restore a piece, and the square does not rotate', () => {
  for (const type of Object.keys(SHAPES)) {
    const state = withPiece(type); let next = state;
    for (let i = 0; i < 4; i++) next = rotate(next);
    assert.deepEqual(next.active, state.active);
  }
  const square = withPiece('O'); assert.equal(rotate(square), square);
});
test('rotation can adjust away from a wall or floor but never enter settled cells', () => {
  const vertical = rotate(withPiece('I')).active;
  const wall = { ...withPiece('I'), active: { ...vertical, x: -2, y: 4 } };
  assert.ok(fits(wall.board, wall.active)); assert.notEqual(rotate(wall), wall); assert.ok(fits(wall.board, rotate(wall).active));
  const floor = withPiece('I', 3, 18), kicked = rotate(floor);
  assert.notEqual(kicked, floor); assert.ok(fits(kicked.board, kicked.active));
  const blocked = withPiece('T'); blocked.board.fill('J'); blocks(blocked.active).forEach(({x,y})=>blocked.board[y*COLS+x]='');
  assert.equal(rotate(blocked), blocked);
});
test('ghost and hard drop land above obstacles and award the correct drop points', () => {
  const state = withPiece('O', 4, 0); state.board[10 * COLS + 4] = 'T';
  const snapshot = structuredClone(state), landing = ghost(state);
  assert.equal(landing.y, 8); const next = hardDrop(state, () => .5);
  assert.equal(next.score, 16); assert.equal(next.board[8 * COLS + 4], 'O'); assert.equal(next.board[9 * COLS + 5], 'O');
  assert.deepEqual(state, snapshot);
});
test('soft drop scores only when the piece actually descends', () => {
  const state = withPiece('O', 3, 17), next = softDrop(state);
  assert.equal(next.score, 1); assert.equal(next.active.y, 18); assert.equal(softDrop(next), next);
});
test('clearing four rows scores 800 and shifts surviving cells down', () => {
  const state = withPiece('I');
  for (let y = 16; y < ROWS; y++) for (let x = 0; x < 9; x++) state.board[y * COLS + x] = 'T';
  state.board[15 * COLS] = 'J'; state.active = { type: 'I', cells: [[1],[1],[1],[1]], x: 9, y: 16 };
  const snapshot = structuredClone(state), next = lock(state, () => .5);
  assert.equal(next.score, 800); assert.equal(next.lines, 4); assert.equal(next.lastClear, 4);
  assert.equal(next.board[19 * COLS], 'J'); assert.equal(next.board.filter(Boolean).length, 1); assert.deepEqual(state, snapshot);
});
test('ten cleared rows increase the level and score uses the level before the clear', () => {
  const state = withPiece('I'); state.lines = 9;
  state.board.fill('T', 19 * COLS, 19 * COLS + 6); state.active = {type:'I', cells:[[1,1,1,1]], x:6, y:19};
  const next = lock(state, () => .5); assert.equal(next.lines, 10); assert.equal(next.level, 2); assert.equal(next.score, 100);
  const nextClear = { ...state, level: 2, lines: 10 }; assert.equal(lock(nextClear).score, 200);
});
test('blocked spawn or locking above the ceiling ends the game and rejects moves', () => {
  const state = withPiece('O', 0, 18); state.board[4] = 'T'; state.queue = ['O','I','T','S','Z','J','L'];
  const lost = lock(state); assert.equal(lost.status, 'lost'); assert.equal(move(lost,1,0),lost); assert.equal(hardDrop(lost),lost); assert.equal(rotate(lost),lost);
  const above = withPiece('T', 3, -1); assert.equal(lock(above).status, 'lost');
});
