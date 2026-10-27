const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../games/breakout/engine');

test('larger courts add targets while keeping bricks, paddle, ball radius and ball speed unchanged', () => {
  const classic = E.createGame(1), wide = E.createGame(1, { width: 1100, height: 800 });
  assert.deepEqual([wide.width, wide.height, wide.columns], [1014, 780, 14]);
  assert.ok(wide.bricks.filter(b => b.alive).length > classic.bricks.length);
  assert.deepEqual([wide.bricks[0].width, wide.bricks[0].height], [62, 22]);
  assert.equal(E.paddleWidth(wide), E.paddleWidth(classic));
  assert.equal(E.RADIUS, 8);
  assert.equal(E.launch(wide).ball.vx, E.launch(classic).ball.vx);
  assert.equal(E.launch(wide).ball.vy, E.launch(classic).ball.vy);
});

test('all expanded campaign and endless layouts have unique targets inside the arena', () => {
  for (const width of [600, 738, 876, 1014, 1152, 1290, 1428])
    for (const height of [600, 720, 840])
      for (const mode of ['campaign', 'endless'])
        for (let level = 1; level <= (mode === 'campaign' ? 20 : 100); level++) {
          const s = E.createGame(level, { width, height, mode, seed: 37 });
          assert.equal(new Set(s.bricks.map(b => b.id)).size, s.bricks.length);
          const alive = s.bricks.filter(b => b.alive);
          assert.ok(alive.some(b => b.kind !== 'steel'));
          assert.ok(alive.filter(b => b.kind === 'steel').length <= 2);
          for (const b of alive) {
            const movement = b.kind === 'moving' ? 16 : 0;
            assert.ok(b.x - movement >= 0 && b.x + b.width + movement <= s.width);
            assert.ok(b.y + b.height < E.paddleY(s) - 150);
          }
        }
});

test('right wall, far-side paddle and bottom shield use expanded boundaries', () => {
  const s = E.launch(E.createGame(2, { width: 1152, height: 840 }));
  s.ball = { id: 0, x: 1142, y: 500, vx: 275, vy: -40 };
  assert.ok(E.step(s, 0.03).ball.vx < 0);
  const atRight = E.movePaddle(s, 2000);
  assert.equal(atRight.paddle, s.width - 100);
  atRight.ball = { id: 0, x: 1102, y: E.paddleY(s) - 10, vx: 0, vy: 285 };
  const caught = E.step(atRight, 0.03);
  assert.ok(caught.ball.vy < 0);
  assert.equal(caught.lives, 3);
  s.shields = 1;
  s.ball = { id: 0, x: 50, y: s.height - 30, vx: 0, vy: 285 };
  const saved = E.step(s, 0.06);
  assert.equal(saved.shields, 0);
  assert.equal(saved.lives, 3);
  assert.ok(saved.ball.vy < 0);
});

test('late pickups, lasers and lost-ball docking use the expanded paddle height', () => {
  let s = E.launch(E.createGame(2, { width: 1014, height: 780 }));
  s.drops = [{ x: s.paddle + 50, y: E.paddleY(s) - 5, type: 'laser' }];
  s = E.step(s, 0.02);
  assert.ok(s.effects.laser > 0);
  assert.ok(s.shots.length > 0);
  assert.ok(s.shots.every(shot => shot.y > 600));
  s.ball.y = 810;
  s = E.step(s, 0.02);
  assert.equal(s.status, 'ready');
  assert.equal(s.ball.y, E.paddleY(s) - E.RADIUS - 2);
});

test('arena settings survive advancement and reproduce seeded expanded waves', () => {
  const s = E.createGame(100, { width: 1428, height: 840, mode: 'endless', seed: 72 });
  const next = E.advanceLevel({ ...s, status: 'level' });
  assert.deepEqual([next.width, next.height, next.columns], [1428, 840, 20]);
  assert.deepEqual(next.bricks, E.createGame(101, next).bricks);
  for (const value of [null, NaN, Infinity, -20, '900', {}]) {
    const safe = E.createGame(1, { width: value, height: value });
    assert.equal(safe.width, 600);
    assert.equal(safe.height, 600);
  }
});
