const { test } = require("node:test");
const assert = require("node:assert/strict");
const E = require("../games/breakout/engine");
const endless = (level = 1, seed = 123) =>
  E.createGame(level, { mode: "endless", seed });

test("endless waves are reproducible per seed and wave, with fresh layouts beyond the campaign", () => {
  const fingerprints = new Set();
  for (let wave = 1; wave <= 250; wave++) {
    const a = endless(wave, 9),
      b = endless(wave, 9);
    assert.deepEqual(a.bricks, b.bricks);
    assert.equal(a.level, wave);
    assert.equal(a.mode, "endless");
    fingerprints.add(JSON.stringify(a.bricks));
  }
  assert.equal(fingerprints.size, 250);
  assert.notDeepEqual(endless(80, 9).bricks, endless(80, 10).bricks);
});
test("generated waves bound density, hitpoints, moving lanes and steel so the court stays playable", () => {
  for (let seed = 0; seed < 10; seed++)
    for (let wave = 1; wave <= 150; wave++) {
      const s = endless(wave, seed),
        live = s.bricks.filter((b) => b.alive);
      assert.ok(s.bricks.length <= 209);
      assert.ok(live.filter((b) => b.kind !== "steel").length >= 80);
      assert.ok(live.filter((b) => b.kind === "steel").length <= 2);
      for (const b of live) {
        assert.ok(b.x >= 0 && b.x + b.width <= E.WIDTH && b.y + b.height < 400);
        assert.ok(b.hp >= 1 && b.hp <= (b.kind === "core" ? 26 : 4));
        if (b.kind === "moving")
          assert.ok(b.x - 16 >= 0 && b.x + b.width + 16 <= E.WIDTH);
        if (b.kind === "steel") assert.equal(b.row, 2);
      }
    }
});
test("wave twenty and much later waves clear to another wave rather than ending the run", () => {
  for (const wave of [20, 21, 100, 1000, 1000000]) {
    const source = {
      ...E.launch(endless(wave)),
      bricks: [{ x: 100, y: 100, width: 62, height: 22, alive: true, row: 0 }],
      ball: { id: 0, x: 130, y: 133, vx: 0, vy: -275 },
    };
    const clear = E.step(source, 0.03);
    assert.equal(clear.status, "level");
    const next = E.advanceLevel(clear);
    assert.equal(next.level, wave + 1);
    assert.equal(next.mode, "endless");
    assert.equal(next.seed, 123);
  }
  assert.equal(E.createGame(200).level, 100);
});
test("endless replenishes one life after each fifth cleared wave and preserves score and energy", () => {
  for (const wave of [1, 4, 5, 6, 10, 20, 21, 100])
    for (const lives of [1, 3, 5]) {
      const clear = {
        ...endless(wave),
        status: "level",
        lives,
        score: 1000,
        energy: 70,
      };
      const next = E.advanceLevel(clear);
      assert.equal(next.lives, Math.min(5, lives + (wave % 5 === 0 ? 1 : 0)));
      assert.equal(next.score, 1000);
      assert.equal(next.energy, 70);
      assert.equal(E.advanceLevel(next), next);
    }
});
test("difficulty grows smoothly with a finite speed ceiling and slow effects restore the endless speed", () => {
  let previous = 0;
  for (const wave of [1, 2, 10, 20, 50, 100, 1000, 1000000]) {
    const s = E.launch(endless(wave)),
      speed = Math.hypot(s.ball.vx, s.ball.vy);
    assert.ok(speed >= previous && speed <= 480);
    previous = speed;
    let slow = E.collectPower(s, "slow");
    assert.ok(
      Math.abs(Math.hypot(slow.ball.vx, slow.ball.vy) - speed * 0.72) < 1e-6,
    );
    slow.effects.slow = 0.001;
    slow = E.step(slow, 0.01);
    assert.ok(Math.abs(Math.hypot(slow.ball.vx, slow.ball.vy) - speed) < 1e-6);
  }
});
test("later waves retain all powerups and can be cleared without destroying steel", () => {
  let s = E.launch(endless(99));
  for (const type of E.POWERUPS) s = E.collectPower(s, type);
  assert.equal(E.balls(s).length, 9);
  assert.equal(E.paddleWidth(s), 160);
  assert.equal(s.shields, 1);
  s = {
    ...s,
    extraBalls: [],
    bricks: [
      {
        x: 100,
        y: 100,
        width: 62,
        height: 22,
        alive: true,
        row: 0,
        kind: "armor",
        hp: 4,
      },
      {
        x: 300,
        y: 100,
        width: 62,
        height: 22,
        alive: true,
        row: 0,
        kind: "steel",
      },
    ],
    ball: { id: 0, x: 130, y: 133, vx: 0, vy: -275 },
  };
  const result = E.step(s, 0.03);
  assert.equal(result.status, "level");
  assert.equal(result.bricks[1].alive, true);
});
test("invalid wave arguments recover safely without changing the requested mode", () => {
  for (const wave of [
    0,
    -1,
    NaN,
    Infinity,
    1.5,
    "12",
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    const s = endless(wave);
    assert.equal(s.level, 1);
    assert.equal(s.mode, "endless");
  }
});
