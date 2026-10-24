const { test } = require('node:test');
const assert = require('node:assert/strict');
const { lines, createGame, play, chooseMove } = require('../games/tictactoe/engine.js');
const position = (board, turn='O') => ({...createGame(),board,turn});
test('legal moves alternate turns without mutating the previous board', () => {
  const state=createGame(), next=play(state,4), next2=play(next,0);
  assert.equal(next.board[4],'X'); assert.equal(next.turn,'O'); assert.equal(next2.board[0],'O'); assert.equal(next2.turn,'X'); assert.ok(state.board.every(c=>!c)); assert.equal(next.board[0],'');
});
test('all eight horizontal, vertical and diagonal lines win for either side', () => {
  for(const side of ['X','O']) for(const line of lines) {
    const state=createGame();state.turn=side;state.board[line[0]]=side;state.board[line[1]]=side;
    const won=play(state,line[2]);assert.equal(won.status,'won');assert.equal(won.winner,side);assert.deepEqual(won.line,line);
  }
});
test('a full board without a line is a draw, while a winning ninth move is a win', () => {
  const draw=play(position(['X','O','X','X','O','O','O','X',''],'X'),8);assert.equal(draw.status,'draw');assert.equal(draw.winner,'');
  const win=play(position(['X','O','O','O','X','X','X','O',''],'X'),8);assert.equal(win.status,'won');
});
test('occupied, invalid and terminal moves are ignored', () => {
  const state=play(createGame(),4);for(const i of [4,-1,9,1.1,'0',NaN])assert.equal(play(state,i),state);
  const won=play(position(['O','O','','','','','','','']),2);assert.equal(play(won,3),won);assert.equal(chooseMove(won),null);
});
test('the serious computer takes a win before blocking and blocks a direct threat', () => {
  const winning=position(['O','O','','X','X','','','','']);assert.equal(chooseMove(winning),2);
  const threat=position(['X','X','','','O','','','','']);assert.equal(chooseMove(threat),2);
});
test('the casual computer selects only legal spaces using its random source', () => {
  const state=play(createGame(),4);for(const n of [0,.2,.5,.999]){const i=chooseMove(state,'easy',()=>n);assert.ok(Number.isInteger(i));assert.equal(state.board[i],'');}
});
for(const human of ['X','O']) test(`serious computer never loses against any reachable human path when human is ${human}`, () => {
  const visited=new Set();let terminals=0;
  function explore(state) {
    const key=state.board.map(c=>c||'-').join('');if(visited.has(key))return;visited.add(key);
    if(state.status!=='playing'){assert.notEqual(state.winner,human);terminals++;return;}
    if(state.turn===human)state.board.forEach((cell,i)=>{if(!cell)explore(play(state,i));});
    else {const i=chooseMove(state);assert.ok(Number.isInteger(i));assert.equal(state.board[i],'');explore(play(state,i));}
  }
  explore(createGame());assert.ok(terminals>0);
});
