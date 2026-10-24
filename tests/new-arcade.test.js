const { test } = require("node:test");
const assert = require("node:assert/strict");
const Mole = require("../games/mole/engine.js"),
  Flappy = require("../games/flappy/engine.js"),
  Simon = require("../games/simon/engine.js");
test("mole scores one hit only, penalizes misses without negatives, and ends at 30 seconds", () => {
  let s = Mole.advance(Mole.create(), 0.01, () => 0.2),
    at = s.active;
  s = Mole.hit(s, at);
  assert.equal(s.score, 10);
  assert.equal(s.hits, 1);
  s = Mole.hit(s, at);
  assert.equal(s.score, 8);
  assert.equal(s.hits, 1);
  for (let i = 0; i < 8; i++) s = Mole.hit(s, at);
  assert.equal(s.score, 0);
  s = Mole.advance(s, 30);
  assert.equal(s.over, true);
  assert.equal(s.time, 30);
  assert.equal(Mole.hit(s, at), s);
});
test("mole expires, changes holes, and never spawns outside the nine holes", () => {
  let s = Mole.advance(Mole.create(), 0.01, () => 0.999),
    at = s.active;
  assert.ok(at >= 0 && at <= 8);
  s = Mole.advance(s, 1, () => 0.999);
  assert.equal(s.active, -1);
  s = Mole.advance(s, 0.2, () => 0.999);
  assert.notEqual(s.active, at);
  assert.ok(s.active >= 0 && s.active <= 8);
});
test("flappy flap changes vertical velocity and gravity pulls down over time", () => {
  let s = Flappy.create(() => 0.5);
  s = Flappy.flap(s);
  assert.equal(s.velocity, -330);
  const next = Flappy.step(s, 0.1, () => 0.5);
  assert.ok(next.y < s.y);
  assert.ok(next.velocity > s.velocity);
  assert.equal(s.y, 280);
});
test("flappy detects boundaries and obstacles, scores once per fully passed pipe", () => {
  let s = Flappy.create(() => 0.5);
  s.y = 590;
  s.velocity = 100;
  assert.equal(Flappy.step(s, 0.1).over, true);
  s = Flappy.create(() => 0.5);
  s.y = 5;
  s.velocity = -100;
  assert.equal(Flappy.step(s, 0.1).over, true);
  s = Flappy.create(() => 0.5);
  s.pipes = [{ x: 150, center: 100, passed: false }];
  assert.equal(Flappy.step(s, 0.01).over, true);
  s = Flappy.create(() => 0.5);
  s.y = 300;
  s.pipes = [{ x: 64, center: 300, passed: false }];
  s = Flappy.step(s, 0.01);
  assert.equal(s.over, false);
  assert.equal(s.score, 1);
  s = Flappy.step(s, 0.01);
  assert.equal(s.score, 1);
});
test("flappy can cross a pipe through the gap and does not mutate after game over", () => {
  let s = Flappy.create(() => 0.5);
  s.y = 300;
  s.pipes = [{ x: 145, center: 300, passed: false }];
  s = Flappy.step(s, 0.01);
  assert.equal(s.over, false);
  s.over = true;
  assert.equal(Flappy.step(s, 0.2), s);
  assert.equal(Flappy.flap(s), s);
});
test("simon locks input during playback, counts completed rounds, grows one entry and rejects errors", () => {
  let s = Simon.nextRound(Simon.create(), () => 0.6);
  assert.deepEqual(s.sequence, [2]);
  assert.equal(Simon.press(s, 2), s);
  s = Simon.listen(s);
  s = Simon.press(s, 2);
  assert.equal(s.rounds, 1);
  assert.equal(s.phase, "round-won");
  s = Simon.nextRound(s, () => 0.3);
  assert.deepEqual(s.sequence, [2, 1]);
  s = Simon.listen(s);
  s = Simon.press(s, 2);
  assert.equal(s.rounds, 1);
  s = Simon.press(s, 0);
  assert.equal(s.phase, "over");
  assert.equal(s.rounds, 1);
  assert.equal(Simon.press(s, 1), s);
});
