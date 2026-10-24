const { test } = require("node:test");
const assert = require("node:assert/strict");
const C = require("../campaign-kit");
const Golf = require("../games/golf/engine");
const Miner = require("../games/miner/engine");
const Breakout = require("../games/breakout/engine");
const levels = require("../games/sokoban/levels");

test("expanded campaigns contain the advertised number of distinct layouts", () => {
  assert.equal(levels.length, 30);
  assert.equal(Golf.courses.length, 18);
  assert.equal(Miner.targets.length, 15);
  assert.equal(Breakout.LEVELS.length, 20);
  assert.equal(new Set(levels.map((l) => JSON.stringify(l.map))).size, 30);
  assert.equal(
    new Set(
      Golf.courses.map((c) =>
        JSON.stringify([c.start, c.hole, c.walls, c.sand, c.water]),
      ),
    ).size,
    18,
  );
  assert.equal(
    new Set(Miner.targets.map((_, i) => JSON.stringify(Miner.create(i).items)))
      .size,
    15,
  );
  assert.equal(
    new Set(
      Breakout.LEVELS.map((_, i) => JSON.stringify(Breakout.bricksFor(i + 1))),
    ).size,
    20,
  );
});
test("all twenty brick formations stay well above the paddle with bounded increasing speed", () => {
  let previous = 0;
  for (let level = 1; level <= 20; level++) {
    const s = Breakout.createGame(level),
      live = s.bricks.filter((b) => b.alive);
    assert.ok(live.length >= 12);
    for (const b of live) {
      assert.ok(b.x >= 0 && b.x + b.width <= 600);
      assert.ok(b.y + b.height < 350);
    }
    const launched = Breakout.launch(s),
      speed = Math.hypot(launched.ball.vx, launched.ball.vy);
    assert.ok(speed >= previous && speed <= 450);
    previous = speed;
  }
});
test("level completion adds one life with a cap of five and cannot repeat the reward", () => {
  for (let lives = 1; lives <= 5; lives++) {
    const s = {
      ...Breakout.createGame(19),
      lives,
      score: 100,
      status: "level",
    };
    const n = Breakout.advanceLevel(s);
    assert.equal(n.lives, Math.min(5, lives + 1));
    assert.equal(n.score, 100);
    assert.equal(n.level, 20);
    assert.equal(Breakout.advanceLevel(n), n);
  }
});
test("golf tees and cups have clear space and level arguments cannot produce mismatched geometry", () => {
  for (const c of Golf.courses)
    for (const [x, y] of [c.start, c.hole]) {
      assert.ok(x >= 35 && x <= 565 && y >= 35 && y <= 665);
      for (const r of [...c.walls, ...c.water])
        assert.equal(
          Golf.inRect({ x, y }, [r[0] - 10, r[1] - 10, r[2] + 20, r[3] + 20]),
          false,
          c.name,
        );
    }
  for (const value of [-5, 99, NaN, 1.5]) {
    const s = Golf.create(value);
    assert.deepEqual([s.ball.x, s.ball.y], Golf.courses[s.level].start);
  }
});
test("mining fields provide enough separate reachable treasure for each increasing target", () => {
  for (let level = 0; level < Miner.targets.length; level++) {
    const s = Miner.create(level);
    assert.ok(
      s.items
        .filter((o) => o.type !== "rock")
        .reduce((sum, o) => sum + o.value, 0) >= Miner.targets[level],
    );
    for (const o of s.items) {
      assert.ok(o.x - o.r >= 25 && o.x + o.r <= 575 && o.y + o.r <= 670);
      assert.ok(Math.abs(Math.atan2(o.x - 300, o.y - 80)) < 1.08);
    }
    for (let i = 0; i < s.items.length; i++)
      for (let j = i + 1; j < s.items.length; j++) {
        const a = s.items[i],
          b = s.items[j];
        assert.ok(
          Math.hypot(a.x - b.x, a.y - b.y) > a.r + b.r,
          `level ${level + 1}: overlapping treasure`,
        );
      }
  }
});
test("mining stage targets cannot be bypassed with score carried from earlier stages", () => {
  const s = Miner.create(12);
  s.score = 50000;
  s.phase = "back";
  s.length = 49;
  s.caught = { type: "diamond", weight: 0.8, value: 400 };
  Miner.step(s, 0.02);
  assert.equal(s.score, 50400);
  assert.equal(s.stageScore, 400);
  assert.equal(s.cleared, false);
  s.cleared = true;
  Miner.next(s);
  assert.equal(s.stageScore, 0);
  assert.equal(s.score, 50400);
});
test("checkpoint recovery rejects corrupt, out-of-range and incompatible saved data", () => {
  for (const value of [
    null,
    [],
    {},
    { level: 18, score: 5, full: true },
    { level: -1, score: 0, full: true },
    { level: 1.5, score: 0, full: true },
    { level: 3, score: -1, full: true },
    { level: 3, score: Infinity, full: true },
    { level: 3, score: "5", full: true },
    { level: 3, score: 5 },
    { level: 0, score: 12, full: true },
  ])
    assert.deepEqual(C.restore(value, 18), C.begin());
});
test("checkpoints retain cumulative scores and practice eligibility across refresh and retry", () => {
  let checkpoint = C.begin();
  checkpoint = C.advance(checkpoint, 3, 18);
  const restored = C.restore(JSON.parse(JSON.stringify(checkpoint)), 18);
  assert.deepEqual(restored, { level: 1, score: 3, full: true });
  const state = Golf.create(restored.level);
  state.score = state.totalStrokes = restored.score;
  Golf.shoot(state);
  assert.equal(state.score, 4);
  assert.equal(restored.score, 3);
  assert.deepEqual(C.advance(C.begin(12), 8, 18), {
    level: 13,
    score: 8,
    full: false,
  });
  assert.deepEqual(
    C.advance({ level: 17, score: 50, full: true }, 55, 18),
    C.begin(),
  );
});
