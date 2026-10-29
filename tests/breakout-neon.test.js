const { test } = require("node:test");
const assert = require("node:assert/strict");
const E = require("../games/breakout/engine");
const brick = (x, y, kind = "normal", hp = 1) => ({
  x,
  y,
  width: 62,
  height: 22,
  alive: true,
  row: 0,
  kind,
  hp,
});
const play = () => E.launch(E.createGame());
const hit = (s, x = 130, y = 133) =>
  E.step({ ...s, ball: { id: 0, x, y, vx: 0, vy: -275, contacts: [] } }, 0.03);
const spare = () => brick(500, 66);

test("multi-ball splits upward at different angles, caps at sixteen, and never mutates its source", () => {
  const source = play(),
    original = structuredClone(source);
  const three = E.collectPower(source, "multi");
  assert.equal(E.balls(three).length, 3);
  assert.equal(new Set(E.balls(three).map((b) => b.vx.toFixed(3))).size, 3);
  assert.ok(E.balls(three).every((b) => b.vy < 0));
  let full = three;
  for (let i = 0; i < 12; i++) full = E.collectPower(full, "multi");
  assert.equal(E.balls(full).length, 16);
  assert.equal(new Set(E.balls(full).map((b) => b.id)).size, 16);
  assert.deepEqual(source, original);
});
test("losing one of several balls promotes a survivor; losing them all costs one life", () => {
  let s = E.collectPower(play(), "multi");
  s.ball.y = 610;
  s.ball.vy = 275;
  s.extraBalls[0].y = 610;
  s.extraBalls[0].vy = 275;
  s.extraBalls[1].x = 300;
  s.extraBalls[1].y = 400;
  const alive = E.step(s, 0.01);
  assert.equal(alive.lives, 3);
  assert.equal(alive.status, "playing");
  assert.equal(E.balls(alive).length, 1);
  assert.equal(alive.ball.id, s.extraBalls[1].id);
  const lost = E.step(
    { ...s, extraBalls: s.extraBalls.map((b) => ({ ...b, y: 610, vy: 275 })) },
    0.01,
  );
  assert.equal(lost.lives, 2);
  assert.equal(lost.status, "ready");
  assert.equal(lost.extraBalls.length, 0);
  assert.equal(lost.ball.y, 538);
});
test("armored bricks take multiple distinct hits, score once, and refresh an existing combo", () => {
  let s = {
    ...play(),
    level: 20,
    bricks: [brick(100, 100, "armor", 2), spare()],
    combo: 2,
    comboTime: 0.1,
  };
  s = hit(s);
  assert.equal(s.bricks[0].hp, 1);
  assert.equal(s.score, 0);
  assert.equal(s.combo, 2);
  assert.ok(s.comboTime > 3.9);
  assert.equal(s.energy, 1);
  s = hit(s);
  assert.equal(s.bricks[0].alive, false);
  assert.equal(s.score, 20);
  assert.equal(s.combo, 3);
});
test("bombs chain through neighbors exactly once while steel survives and distant bricks remain", () => {
  const source = {
    ...play(),
    bricks: [
      brick(100, 100, "bomb"),
      brick(169, 100, "bomb"),
      brick(238, 100, "armor", 2),
      brick(169, 130, "steel"),
      spare(),
    ],
  };
  const s = hit(source);
  assert.deepEqual(
    s.bricks.map((b) => b.alive),
    [false, false, false, true, true],
  );
  assert.equal(s.destroyed, 3);
  assert.equal(s.score, 40);
  assert.equal(s.drops.length, 0);
  assert.ok(source.bricks.every((b) => b.alive));
});
test("steel reflects both ordinary and piercing balls, blocks laser shots, and is excluded from clear goals", () => {
  let s = E.collectPower(play(), "pierce");
  s.bricks = [brick(100, 100, "steel"), spare()];
  const reflected = hit(s);
  assert.ok(reflected.ball.vy > 0);
  assert.equal(reflected.score, 0);
  s = {
    ...play(),
    bricks: [brick(100, 100, "steel"), spare()],
    shots: [{ x: 130, y: 126 }],
  };
  const blocked = E.step(s, 0.02);
  assert.equal(blocked.shots.length, 0);
  assert.equal(blocked.bricks[0].alive, true);
  const clear = hit({
    ...play(),
    bricks: [brick(100, 100), brick(300, 100, "steel")],
  });
  assert.equal(clear.status, "level");
});
test("piercing destroys armor without reflecting; laser chips armor and fires from both paddle ends", () => {
  const piercing = hit({
    ...E.collectPower(play(), "pierce"),
    bricks: [brick(100, 100, "armor", 3), spare()],
  });
  assert.equal(piercing.bricks[0].alive, false);
  assert.ok(piercing.ball.vy < 0);
  const chipped = E.step(
    {
      ...play(),
      bricks: [brick(100, 100, "armor", 3), spare()],
      shots: [{ x: 130, y: 126 }],
    },
    0.02,
  );
  assert.equal(chipped.bricks[0].hp, 2);
  assert.equal(chipped.score, 0);
  const laser = E.step(E.collectPower(play(), "laser"), 0.01);
  assert.equal(laser.shots.length, 2);
  assert.ok(laser.shots[0].x < laser.shots[1].x);
});
test("falling capsules need a paddle catch and refresh rather than stack timed effects", () => {
  const source = {
    ...play(),
    drops: [
      { type: "wide", x: 300, y: 537 },
      { type: "multi", x: 10, y: 625 },
    ],
  };
  const s = E.step(source, 0.02);
  assert.equal(E.paddleWidth(s), 160);
  assert.equal(s.drops.length, 0);
  assert.equal(E.balls(s).length, 1);
  const refreshed = E.collectPower(s, "wide");
  assert.equal(refreshed.effects.wide, 14);
  assert.equal(source.effects.wide, 0);
  assert.equal(source.drops.length, 2);
});
test("width and slow expiration preserve paddle center and restore every ball speed", () => {
  let s = E.collectPower(E.collectPower(play(), "wide"), "slow");
  s = E.collectPower(s, "multi");
  assert.equal(s.paddle + E.paddleWidth(s) / 2, 300);
  assert.ok(
    E.balls(s).every(
      (b) => Math.abs(Math.hypot(b.vx, b.vy) - E.speedFor(1) * 0.72) < 1e-6,
    ),
  );
  s = E.movePaddle(s, 900);
  assert.equal(s.paddle + E.paddleWidth(s), 600);
  s.effects.wide = 0.01;
  s.effects.slow = 0.01;
  const next = E.step(s, 0.02);
  assert.equal(E.paddleWidth(next), 100);
  assert.equal(next.paddle + 50, 520);
  assert.ok(
    E.balls(next).every(
      (b) => Math.abs(Math.hypot(b.vx, b.vy) - E.speedFor(1)) < 1e-6,
    ),
  );
});
test("shields are capped and spend one charge per saved ball", () => {
  let s = play();
  for (let i = 0; i < 6; i++) s = E.collectPower(s, "shield");
  assert.equal(s.shields, 3);
  s.ball = { id: 0, x: 20, y: 575, vx: 0, vy: 275 };
  const saved = E.step(s, 0.02);
  assert.equal(saved.shields, 2);
  assert.ok(saved.ball.vy < 0);
  assert.equal(saved.lives, 3);
});
test("combo multiplier grows at six breaks, expires, and is capped at five", () => {
  const base = { ...play(), bricks: [brick(100, 100), spare()] };
  assert.equal(hit({ ...base, combo: 5, comboTime: 2 }).score, 20);
  assert.equal(hit({ ...base, combo: 99, comboTime: 2 }).score, 50);
  const expired = E.step({ ...base, combo: 12, comboTime: 0.01 }, 0.02);
  assert.equal(expired.combo, 0);
  assert.equal(hit(expired).score, 10);
});
test("energy skill requires full charge, lasts six seconds, doubles score and cannot recharge while active", () => {
  const base = E.launch(E.createGame(20));
  assert.equal(E.activateOverdrive(base), base);
  const s = E.activateOverdrive({
    ...base,
    energy: 100,
    bricks: [brick(100, 100, "armor", 3), spare()],
  });
  assert.equal(s.energy, 0);
  assert.equal(s.overdrive, 6);
  assert.equal(E.activateOverdrive(s), s);
  const result = hit(s);
  assert.equal(result.score, 40);
  assert.equal(result.energy, 0);
  assert.ok(result.ball.vy < 0);
  const expired = E.step({ ...base, overdrive: 0.01 }, 0.02);
  assert.equal(expired.overdrive, 0);
});
test("non-playing states and invalid dt freeze all timers, balls, drops and scores", () => {
  const s = E.collectPower(play(), "laser");
  for (const status of ["ready", "level", "won", "lost"]) {
    const frozen = { ...s, status };
    assert.equal(E.step(frozen, 0.1), frozen);
    assert.equal(E.collectPower(frozen, "multi"), frozen);
    assert.equal(E.activateOverdrive(frozen), frozen);
  }
  for (const dt of [0, -1, Infinity, NaN]) assert.equal(E.step(s, dt), s);
});
test("last-ball loss clears transient effects and retains energy, score and brick progress", () => {
  const s = E.collectPower(E.collectPower(play(), "wide"), "laser");
  s.ball = { id: 0, x: 10, y: 610, vx: 0, vy: 275 };
  s.energy = 80;
  s.score = 500;
  s.combo = 10;
  s.bricks[0].alive = false;
  const lost = E.step(s, 0.01);
  assert.equal(lost.energy, 80);
  assert.equal(lost.score, 500);
  assert.equal(lost.combo, 0);
  assert.equal(E.paddleWidth(lost), 100);
  assert.equal(lost.effects.laser, 0);
  assert.equal(lost.shots.length, 0);
  assert.equal(lost.bricks[0].alive, false);
  const next = E.advanceLevel({ ...s, status: "level" });
  assert.equal(next.level, 2);
  assert.equal(next.energy, 80);
  assert.equal(next.effects.wide, 0);
  assert.equal(next.combo, 0);
});
test("all moving formations remain in bounds and do not overlap neighboring bricks over a full cycle", () => {
  for (const level of [4, 8, 12, 16, 20]) {
    let s = E.launch(E.createGame(level));
    for (let i = 0; i < 70; i++) {
      s.ball = { id: 0, x: 300, y: 450, vx: 0, vy: -275 };
      s = E.step(s, 0.1);
      const live = s.bricks.filter((b) => b.alive);
      for (const b of live) {
        assert.ok(b.x >= 0 && b.x + b.width <= 600);
        for (const c of live)
          if (c !== b && c.y === b.y)
            assert.ok(c.x + c.width <= b.x || b.x + b.width <= c.x);
      }
    }
  }
});
test("a sustained sixteen-ball, laser and piercing session maintains finite state and bounded objects", () => {
  let s = E.launch(E.createGame(20));
  s = E.collectPower(E.collectPower(E.collectPower(s, "rain"), "rain"), "rain");
  for (const type of ["laser", "wide", "pierce", "slow", "shield"])
    s = E.collectPower(s, type);
  for (let i = 0; i < 12000; i++) {
    if (s.status !== "playing") break;
    const threat =
      E.balls(s)
        .filter((b) => b.vy > 0)
        .sort((a, b) => b.y - a.y)[0] || s.ball;
    s = E.movePaddle(s, threat.x);
    s = E.step(s, 1 / 120);
    assert.ok(
      E.balls(s).length <= E.MAX_BALLS &&
        s.drops.length <= 8 &&
        s.shots.length < 30,
    );
    for (const b of E.balls(s))
      assert.ok([b.x, b.y, b.vx, b.vy].every(Number.isFinite));
    assert.ok(s.energy >= 0 && s.energy <= 100);
    assert.ok(Number.isSafeInteger(s.score));
  }
  assert.ok(s.score > 0);
});
