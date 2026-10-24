const { test } = require('node:test');
const assert = require('node:assert/strict');
const { levels, createGame, flip, settle } = require('../games/memory/engine.js');
const pair = (state, value) => state.cards.map((card, i) => card === value ? i : -1).filter(i => i >= 0);
test('every difficulty contains exactly two of each card and a complete rectangular grid', () => {
  for (const name of Object.keys(levels)) {
    const state = createGame(name, () => .37);
    assert.equal(state.cards.length, levels[name].pairs * 2); assert.equal(state.cards.length % state.cols, 0);
    for (let value = 0; value < state.pairCount; value++) assert.equal(pair(state, value).length, 2);
    assert.equal(state.status, 'ready'); assert.equal(state.moves, 0);
  }
  assert.throws(() => createGame('bad'));
});
test('the first reveal starts a game without counting a pair and rejects duplicate clicks', () => {
  const state = createGame(), snapshot = structuredClone(state), next = flip(state, 0);
  assert.equal(next.status, 'playing'); assert.equal(next.moves, 0); assert.deepEqual(next.selected, [0]);
  assert.equal(flip(next, 0), next); assert.deepEqual(state, snapshot);
});
test('mismatches count once and block a third reveal until explicitly settled', () => {
  const state = createGame(), other = state.cards.findIndex(value => value !== state.cards[0]);
  const next = flip(flip(state, 0), other), third = state.cards.findIndex((_, i) => i !== 0 && i !== other);
  assert.equal(next.status, 'settling'); assert.equal(next.moves, 1); assert.equal(flip(next, third), next);
  const ready = settle(next); assert.equal(ready.status, 'playing'); assert.deepEqual(ready.selected, []); assert.equal(ready.moves, 1);
  assert.equal(flip(ready, third).selected[0], third); assert.equal(next.selected.length, 2);
});
test('matching cards stay matched, cannot be reused, and permit the next pair immediately', () => {
  const state = createGame(), [a,b] = pair(state,0), [c] = pair(state,1);
  const next = flip(flip(state,a),b);
  assert.equal(next.pairs,1); assert.equal(next.moves,1); assert.equal(next.matched[a],true); assert.equal(next.matched[b],true);
  assert.deepEqual(next.selected,[]); assert.equal(flip(next,a),next); assert.equal(flip(next,c).selected[0],c); assert.ok(state.matched.every(value=>!value));
});
test('matching the final pair wins and all subsequent actions are ignored', () => {
  let state = createGame('easy');
  for (let value=0; value<state.pairCount; value++) {const [a,b]=pair(state,value);state=flip(flip(state,a),b);}
  assert.equal(state.status,'won'); assert.equal(state.moves,6); assert.ok(state.matched.every(Boolean)); assert.equal(flip(state,0),state); assert.equal(settle(state),state);
});
test('invalid indices and settling outside a mismatch leave the state unchanged', () => {
  const state=createGame(); for(const i of [-1,99,1.5,NaN,'2']) assert.equal(flip(state,i),state); assert.equal(settle(state),state);
});
