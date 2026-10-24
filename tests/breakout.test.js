const { test } = require("node:test");
const assert = require("node:assert/strict");
const E = require("../games/breakout/engine.js");

test("launch and paddle movement preserve the source state and stay inside the court", () => {
  const ready = E.createGame(),
    state = E.launch(ready);
  assert.equal(ready.status, "ready");
  assert.equal(state.status, "playing");
  assert.ok(state.ball.vy < 0);
  assert.equal(E.movePaddle(ready, -200).paddle, 0);
  assert.equal(E.movePaddle(ready, 900).paddle, 500);
  assert.equal(E.movePaddle(ready, 900).ball.x, 550);
  assert.equal(E.launch(state), state);
});
test("side walls and ceiling reflect the ball", () => {
  const original = E.launch(E.createGame());
  const left = E.step(
    { ...original, ball: { x: 9, y: 300, vx: -250, vy: 0 } },
    0.02,
  );
  const top = E.step(
    { ...original, ball: { x: 300, y: 9, vx: 0, vy: -250 } },
    0.02,
  );
  assert.ok(left.ball.vx > 0);
  assert.ok(top.ball.vy > 0);
  assert.equal(original.ball.y, 538);
});
test("paddle catches a falling ball and steers its rebound", () => {
  const original = E.launch(E.createGame());
  const center = E.step(
    { ...original, ball: { x: 300, y: 538, vx: 0, vy: 275 } },
    0.02,
  );
  const edge = E.step(
    { ...original, ball: { x: 342, y: 538, vx: 0, vy: 275 } },
    0.02,
  );
  assert.ok(center.ball.vy < 0);
  assert.ok(Math.abs(center.ball.vx) < 0.01);
  assert.ok(edge.ball.vy < 0);
  assert.ok(edge.ball.vx > 100);
});
test("a missed ball costs exactly one life and preserves destroyed bricks and score", () => {
  const initial = E.launch(E.createGame());
  initial.bricks[0].alive = false;
  const next = E.step(
    { ...initial, score: 10, ball: { x: 10, y: 607, vx: 0, vy: 275 } },
    0.05,
  );
  assert.equal(next.lives, 2);
  assert.equal(next.status, "ready");
  assert.equal(next.score, 10);
  assert.equal(next.bricks[0].alive, false);
  assert.equal(next.ball.y, 538);
  assert.equal(E.step(next, 0.1), next);
  assert.equal(
    E.step(
      { ...initial, lives: 1, ball: { x: 10, y: 607, vx: 0, vy: 275 } },
      0.05,
    ).status,
    "lost",
  );
});
test("brick collision scores once and reflects vertically", () => {
  const state = {
    ...E.launch(E.createGame()),
    bricks: [
      { x: 100, y: 100, width: 62, height: 22, alive: true, row: 0 },
      { x: 300, y: 100, width: 62, height: 22, alive: true, row: 0 },
    ],
    ball: { x: 130, y: 133, vx: 0, vy: -275 },
  };
  const next = E.step(state, 0.03);
  assert.equal(next.score, 10);
  assert.equal(next.bricks[0].alive, false);
  assert.ok(next.ball.vy > 0);
  assert.equal(E.step(next, 0.02).score, 10);
  assert.equal(state.bricks[0].alive, true);
});
test("a side hit reflects horizontally", () => {
  const state = {
    ...E.launch(E.createGame()),
    bricks: [{ x: 100, y: 100, width: 62, height: 22, alive: true, row: 0 }],
    ball: { x: 90, y: 111, vx: 275, vy: 0 },
  };
  assert.ok(E.step(state, 0.02).ball.vx < 0);
});
test("clearing a level preserves lives and score; clearing level twenty wins", () => {
  const state = {
    ...E.launch(E.createGame()),
    lives: 2,
    score: 80,
    bricks: [{ x: 100, y: 100, width: 62, height: 22, alive: true, row: 0 }],
    ball: { x: 130, y: 133, vx: 0, vy: -275 },
  };
  const cleared = E.step(state, 0.03),
    next = E.advanceLevel(cleared);
  assert.equal(cleared.status, "level");
  assert.equal(next.status, "ready");
  assert.equal(next.level, 2);
  assert.equal(next.lives, 3);
  assert.equal(next.score, 90);
  assert.ok(next.bricks.some((brick) => brick.alive));
  const won = E.step({ ...state, level: E.LEVELS.length }, 0.03);
  assert.equal(won.status, "won");
  assert.equal(E.advanceLevel(won), won);
});
test("large frame delays are bounded and invalid time steps are ignored", () => {
  const state = E.launch(E.createGame());
  const next = E.step(state, 100);
  assert.ok(
    Math.hypot(next.ball.x - state.ball.x, next.ball.y - state.ball.y) <= 28,
  );
  for (const dt of [0, -1, NaN, Infinity])
    assert.equal(E.step(state, dt), state);
});
