const { test } = require("node:test");
const assert = require("node:assert/strict");
const E = require("../games/breakout/engine");
const brick = (kind, x = 100, row = 0, hp = 1) => ({
  id: x,
  x,
  baseX: x,
  y: 100,
  width: 30,
  height: 16,
  alive: true,
  kind,
  row,
  hp,
  maxHp: hp,
});
const hit = (state) =>
  E.step(
    {
      ...state,
      ball: { id: 0, x: 115, y: 127, vx: 0, vy: -275, contacts: [] },
    },
    0.03,
  );
const game = (bricks) => ({ ...E.launch(E.createGame()), bricks });
const spare = () => ({ ...brick("normal", 500, 4), y: 200 });

test("100 dense campaign layouts vary geometry, introduce mechanics and preserve return space", () => {
  const fingerprints = new Set();
  for (let level = 1; level <= 100; level++) {
    const s = E.createGame(level);
    const live = s.bricks.filter((b) => b.alive && b.kind !== "steel");
    assert.ok(
      live.length >= 90 && live.length <= 209,
      `level ${level}: ${live.length}`,
    );
    assert.equal(s.columns, 16);
    assert.equal(
      live.filter((b) => b.kind === "core").length,
      level % 10 === 0 ? 1 : 0,
    );
    fingerprints.add(JSON.stringify(live.map((b) => [b.x, b.y, b.kind])));
    for (const b of live) assert.ok(b.y + b.height <= E.paddleY(s) - 150);
  }
  assert.equal(fingerprints.size, 100);
  assert.equal(E.createGame(1).bricks.filter((b) => b.alive).length, 128);
});

test("prism bricks split at the impact point, never exceed sixteen balls and score once", () => {
  const source = game([brick("prism"), spare()]);
  const s = hit(source);
  assert.equal(E.balls(s).length, 3);
  assert.equal(s.bricks[0].alive, false);
  assert.equal(s.score, 10);
  assert.ok(s.extraBalls.every((b) => b.y < 100 && b.vy < 0));
  assert.equal(source.extraBalls.length, 0);
  let full = source;
  for (let i = 0; i < 4; i++) full = E.collectPower(full, "rain");
  const capped = hit(full);
  assert.equal(E.balls(capped).length, 16);
  assert.equal(new Set(E.balls(capped).map((b) => b.id)).size, 16);
});

test("row relays clear armored neighbors and chained relays once, preserving steel and other rows", () => {
  const s = hit(
    game([
      brick("relay"),
      brick("armor", 180, 0, 4),
      brick("relay", 220),
      brick("steel", 260),
      spare(),
    ]),
  );
  assert.deepEqual(
    s.bricks.map((b) => b.alive),
    [false, false, false, true, true],
  );
  assert.equal(s.destroyed, 3);
  assert.equal(s.score, 40);
  assert.equal(s.status, "playing");
});

test("supply bricks guarantee one chosen drop and ball rain adds six upward balls", () => {
  const s = hit({
    ...game([{ ...brick("supply"), supply: 6 }, spare()]),
    level: 40,
  });
  assert.equal(s.drops.length, 1);
  assert.equal(s.drops[0].type, "rain");
  const rain = E.collectPower(s, "rain");
  assert.equal(E.balls(rain).length, 7);
  assert.ok(rain.extraBalls.every((b) => b.vy < 0 && b.y < E.paddleY(rain)));
  assert.equal(new Set(rain.extraBalls.map((b) => b.vx.toFixed(3))).size, 6);
});

test("core moves, fortifies only surviving ordinary bricks, and resists piercing instant kills", () => {
  let s = E.launch(E.createGame(20));
  const index = s.bricks.findIndex((b) => b.kind === "core");
  const hp = s.bricks[index].hp;
  s.coreClock = 0.001;
  const before = s.bricks.filter((b) => b.alive && b.kind === "armor").length;
  s.ball = { id: 0, x: 20, y: 440, vx: 0, vy: -100 };
  s = E.step(s, 0.02);
  assert.notEqual(s.bricks[index].x, s.bricks[index].baseX);
  assert.equal(
    s.bricks.filter((b) => b.alive && b.kind === "armor").length,
    before + 2,
  );
  const core = { ...brick("core", 100, -1, hp), width: 96, height: 28, y: 64 };
  s = E.collectPower(game([core, spare()]), "pierce");
  s.level = 20;
  s.ball = { id: 0, x: 148, y: 102, vx: 0, vy: -275 };
  s = E.step(s, 0.03);
  assert.equal(s.bricks[0].hp, hp - 1);
  assert.ok(s.ball.vy > 0);
  s.energy = 100;
  s = E.activateOverdrive(s);
  s.ball = { id: 0, x: 148, y: 102, vx: 0, vy: -275, contacts: [] };
  s = E.step(s, 0.03);
  assert.equal(s.bricks[0].hp, hp - 3);
});

test("core destruction is required for completion and killed cores never fortify again", () => {
  let s = game([{ ...brick("core", 100, -1), width: 96, height: 28, y: 64 }]);
  s.ball = { id: 0, x: 148, y: 102, vx: 0, vy: -275 };
  s = E.step(s, 0.03);
  assert.equal(s.status, "level");
  assert.equal(s.score, 300);
  assert.equal(s.bricks[0].alive, false);
  assert.equal(E.step(s, 0.1), s);
});

test("idle assistance drops laser without resetting progress and cleanup aims the returning ball", () => {
  let s = game([spare()]);
  s.level = 22;
  s.idleTime = 17.99;
  s.ball = { id: 0, x: 50, y: 440, vx: 0, vy: -100 };
  s = E.step(s, 0.02);
  assert.equal(s.drops.length, 1);
  assert.equal(s.drops[0].type, "laser");
  assert.equal(s.score, 0);
  s.time = 16;
  s.ball = { id: 0, x: 300, y: 538, vx: 0, vy: 275 };
  s = E.step(s, 0.02);
  assert.ok(s.ball.vx > 0 && s.ball.vy < 0);
  assert.ok(Math.abs(Math.hypot(s.ball.vx, s.ball.vy) - E.speedFor(22)) < 1e-6);
});

test("cleanup banks around steel instead of locking onto an obstructed last brick", () => {
  let s = game([
    { ...brick("normal", 59.375, 1), y: 88 },
    { ...brick("steel", 59.375, 2), y: 110 },
  ]);
  s.time = 16;
  s.paddle = 24.375;
  s.ball = { id: 0, x: 74.375, y: 538, vx: 0, vy: 275 };
  for (let i = 0; i < 600 && s.status === "playing"; i++) s = E.step(s, 1 / 60);
  assert.equal(s.status, "level");
  assert.equal(s.bricks[1].alive, true);
});

test("all 100 levels and core encounters clear through real ball physics and player inputs", () => {
  for (let level = 1; level <= 100; level++) {
    let s = E.launch(E.createGame(level));
    for (
      let i = 0;
      i < 600 * 60 && !["lost", "won", "level"].includes(s.status);
      i++
    ) {
      if (s.status === "ready") s = E.launch(s);
      const ball =
        E.balls(s)
          .filter((b) => b.vy > 0)
          .sort(
            (a, b) => (E.paddleY(s) - a.y) / a.vy - (E.paddleY(s) - b.y) / b.vy,
          )[0] || s.ball;
      let x = ball.x;
      if (ball.vy > 0) {
        const dt = Math.max(0, (E.paddleY(s) - E.RADIUS - ball.y) / ball.vy);
        const span = s.width - 2 * E.RADIUS;
        const projected =
          (((ball.x - E.RADIUS + ball.vx * dt) % (2 * span)) + 2 * span) %
          (2 * span);
        x = E.RADIUS + (projected > span ? 2 * span - projected : projected);
      }
      const targets = s.bricks
        .filter((b) => b.alive && b.kind !== "steel")
        .sort((a, b) => b.y - a.y || Math.abs(a.x - x) - Math.abs(b.x - x));
      const target = targets[0];
      const aim = target
        ? Math.atan2(target.x + target.width / 2 - x, E.paddleY(s) - target.y)
        : 0;
      s = E.movePaddle(
        s,
        x -
          (Math.max(-0.9, Math.min(0.9, aim / (Math.PI / 3))) *
            E.paddleWidth(s)) /
            2,
      );
      if (s.energy >= 100) s = E.activateOverdrive(s);
      s = E.step(s, 1 / 60);
    }
    assert.equal(
      s.status,
      level === 100 ? "won" : "level",
      `level ${level} cannot clear`,
    );
    assert.equal(
      s.bricks.filter((b) => b.alive && b.kind !== "steel").length,
      0,
    );
  }
});
