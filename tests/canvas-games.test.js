const { test } = require("node:test");
const assert = require("node:assert/strict");
const Bubble = require("../games/bubbles/engine");
const Space = require("../games/space/engine");
const Racer = require("../games/racer/engine");
const Basket = require("../games/basketball/engine");
const Golf = require("../games/golf/engine");
const Miner = require("../games/miner/engine");
const seeded = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const tick = (E, s, seconds, input = {}) => {
  for (let i = 0; i < seconds * 120 && !s.over; i++)
    E.step(s, 1 / 120, input, () => 0.5);
};
function emptyBubbles() {
  const s = Bubble.create(() => 0);
  s.grid.forEach((r) => r.fill(null));
  return s;
}
test("bubble geometry has symmetric neighbors and initial ammunition is present on the board", () => {
  const s = Bubble.create(seeded(5));
  assert.equal(s.grid.flat().filter((v) => v !== null).length, 43);
  for (let r = 0; r < s.grid.length; r++)
    for (let c = 0; c < s.grid[r].length; c++)
      for (const [y, x] of Bubble.neighbors(r, c))
        assert.ok(Bubble.neighbors(y, x).some(([a, b]) => a === r && b === c));
  assert.ok(s.grid.flat().includes(s.current));
  assert.ok(s.grid.flat().includes(s.next));
});
test("bubble aim clamps safely, one shot is active, and side-wall rebounds preserve upward travel", () => {
  const s = Bubble.create();
  Bubble.aim(s, 200);
  assert.equal(s.angle, 165);
  assert.equal(Bubble.shoot(s), true);
  assert.equal(Bubble.shoot(s), false);
  Bubble.aim(s, 60);
  assert.equal(s.angle, 165);
  s.shot = { x: 45, y: 500, vx: -300, vy: -300, color: 0 };
  Bubble.step(s, 1 / 120);
  assert.ok(s.shot.vx > 0);
  assert.ok(s.shot.vy < 0);
  assert.ok(s.shot.x >= 44);
  assert.equal(s.shots, 1);
});
test("bubble match removes a connected group, drops unsupported colors and counts them once", () => {
  const s = emptyBubbles();
  s.grid[0][3] = 0;
  s.grid[0][4] = 0;
  s.grid[1][3] = 1;
  s.shot = { ...Bubble.point(0, 2), color: 0 };
  Bubble.settle(s, [0, 3], () => 0);
  assert.equal(s.score, 50);
  assert.equal(s.grid.flat().filter((v) => v !== null).length, 0);
  assert.ok(s.won && s.over);
});
test("bubble misses move the ceiling only at five, a match resets misses, and boundary contact loses", () => {
  const s = emptyBubbles();
  s.grid[0][4] = 0;
  s.misses = 4;
  s.shot = { ...Bubble.point(0, 3), color: 1 };
  Bubble.settle(s, [0, 4], () => 0);
  assert.equal(s.ceiling, 28);
  assert.equal(s.misses, 0);
  assert.equal(s.score, 0);
  s.grid[0][2] = 1;
  s.misses = 3;
  s.shot = { ...Bubble.point(0, 1, s.ceiling), color: 1 };
  Bubble.settle(s, [0, 2], () => 0);
  assert.equal(s.misses, 0);
  assert.ok(s.score >= 30);
  const lost = emptyBubbles();
  lost.grid[0][4] = 0;
  lost.ceiling = 520;
  lost.shot = { ...Bubble.point(0, 3, 520), color: 1 };
  Bubble.settle(lost, [0, 4]);
  assert.ok(lost.over && !lost.won);
});
test("bubble blocked attachment loses without overwriting occupied slots and preview is read-only", () => {
  const s = Bubble.create(() => 0),
    before = JSON.stringify(s);
  assert.ok(Bubble.trajectory(s).length);
  assert.equal(JSON.stringify(s), before);
  s.shot = { x: 300, y: 55, color: 1 };
  Bubble.settle(s, null);
  assert.ok(s.over);
  assert.equal(s.grid[0].filter((v) => v === 0).length, 9);
});
test("space movement stays inside the screen and automatic firing and rapid shots work", () => {
  const s = Space.create();
  tick(Space, s, 0.5, { axis: 1 });
  assert.ok(s.x > 300);
  assert.ok(s.bullets.length >= 2);
  tick(Space, s, 2, { targetX: 999 });
  assert.equal(s.x, 570);
  s.rapid = 3;
  s.fire = 0;
  s.bullets = [];
  Space.step(s, 1 / 120);
  assert.equal(s.bullets.length, 3);
});
test("space enemy hits count once and the fifth kill drops a powerup", () => {
  const s = Space.create();
  s.spawn = 100;
  s.fire = 100;
  s.kills = 4;
  s.enemies = [{ x: 300, y: 200, hp: 1, speed: 0, fire: 100 }];
  s.bullets = [
    { x: 300, y: 205 },
    { x: 300, y: 206 },
  ];
  Space.step(s, 1 / 120);
  assert.equal(s.kills, 5);
  assert.equal(s.score, 20);
  assert.equal(s.enemies.length, 0);
  assert.equal(s.drops.length, 1);
  assert.equal(s.drops[0].type, "rapid");
});
test("space damage respects protection and shields, and all threats can end the game", () => {
  const s = Space.create();
  s.shield = 1;
  Space.hurt(s);
  assert.equal(s.lives, 3);
  assert.equal(s.shield, 0);
  Space.hurt(s);
  assert.equal(s.lives, 3);
  s.invulnerable = 0;
  Space.hurt(s);
  assert.equal(s.lives, 2);
  s.invulnerable = 0;
  s.lives = 1;
  s.shots = [{ x: s.x, y: 620, vx: 0, vy: 0 }];
  Space.step(s, 1 / 120);
  assert.ok(s.over);
  assert.equal(s.lives, 0);
});
test("space flagship appears after three waves and a lethal hit completes the mission", () => {
  const s = Space.create();
  s.time = 44.999;
  s.spawn = 100;
  Space.step(s, 1 / 120);
  assert.ok(s.bossSpawned && s.boss);
  s.boss.hp = 1;
  s.fire = 100;
  s.bullets = [{ x: s.boss.x, y: s.boss.y + 2 }];
  Space.step(s, 1 / 120);
  assert.ok(s.over && s.won);
  assert.equal(s.score, 502);
});
test("racer lane inputs cannot leave the road and generated traffic always leaves a gap", () => {
  const s = Racer.create();
  for (let i = 0; i < 8; i++) Racer.steer(s, -1);
  assert.equal(s.lane, 0);
  Racer.steer(s, 99);
  assert.equal(s.lane, 0);
  for (let i = 0; i < 30; i++) {
    s.time = 25;
    s.spawn = 0;
    s.traffic = [];
    s.pickups = [];
    Racer.step(s, 1 / 120, {}, seeded(i));
    assert.equal(new Set(s.traffic.map((c) => c.lane)).size, 2);
    assert.equal(s.pickups.length, 1);
    assert.ok(!s.traffic.some((c) => c.x === s.pickups[0].x));
  }
});
test("racer collision removes one life, protection prevents repeats, and coins count once", () => {
  const s = Racer.create();
  s.spawn = 100;
  s.traffic = [
    { x: 300, y: 590 },
    { x: 300, y: 590 },
  ];
  s.pickups = [{ x: 300, y: 590 }];
  Racer.step(s, 1 / 120);
  assert.equal(s.lives, 2);
  assert.equal(s.coins, 1);
  assert.equal(s.bonus, 50);
  Racer.step(s, 1 / 120);
  assert.equal(s.coins, 1);
  assert.equal(s.traffic.length, 0);
});
test("racer passing cars scores, surviving 60 seconds wins, and lethal collision takes priority", () => {
  const s = Racer.create();
  s.spawn = 100;
  s.traffic = [{ x: 180, y: 781 }];
  Racer.step(s, 1 / 120);
  assert.equal(s.bonus, 10);
  s.time = 59.999;
  Racer.step(s, 1 / 120);
  assert.ok(s.over && s.won);
  const lost = Racer.create();
  lost.lives = 1;
  lost.time = 59.999;
  lost.traffic = [{ x: 300, y: 590 }];
  Racer.step(lost, 1 / 120);
  assert.ok(lost.over && !lost.won);
});
test("basketball default tutorial shot is makeable, scores once and moves the next basket", () => {
  const s = Basket.create();
  assert.ok(Basket.shoot(s));
  assert.equal(Basket.shoot(s), false);
  tick(Basket, s, 3);
  assert.equal(s.made, 1);
  assert.equal(s.score, 2);
  assert.equal(s.ball, null);
  assert.ok(s.hoop.x < 300);
  assert.equal(s.angle, 100);
});
test("basketball only downward passage through the opening scores, with a bounded streak bonus", () => {
  const s = Basket.create();
  s.ball = { x: 450, y: 342, vx: 0, vy: -100, age: 0, scored: false };
  Basket.step(s, 1 / 120);
  assert.equal(s.score, 0);
  s.streak = 20;
  s.ball = { x: 450, y: 339, vx: 0, vy: 200, age: 0, scored: false };
  Basket.step(s, 1 / 120);
  assert.equal(s.score, 5);
  Basket.step(s, 1 / 120);
  assert.equal(s.score, 5);
});
test("basketball rims reflect a shot and misses reset streak; the clock terminates at 60 seconds", () => {
  const b = { x: 448, y: 323, vx: 0, vy: 120 };
  Basket.rim(b, 450, 340);
  assert.ok(b.vy < 0);
  const s = Basket.create();
  s.streak = 3;
  s.ball = { x: -101, y: 500, vx: -10, vy: 100, age: 0, scored: false };
  Basket.step(s, 1 / 120);
  assert.equal(s.streak, 0);
  assert.equal(s.ball, null);
  s.time = 59.999;
  Basket.step(s, 1 / 120);
  assert.ok(s.over);
  assert.equal(s.time, 60);
});
const routes = [
  [[300, 140]],
  [
    [120, 170],
    [475, 170],
    [475, 140],
  ],
  [
    [480, 560],
    [480, 140],
    [120, 140],
  ],
  [
    [100, 80],
    [490, 80],
    [490, 130],
  ],
  [
    [340, 580],
    [340, 145],
    [480, 145],
  ],
  [
    [450, 590],
    [450, 330],
    [185, 330],
    [185, 190],
    [460, 190],
    [460, 115],
  ],
];
function playHole(s) {
  for (const [x, y] of routes[s.level])
    for (
      let tries = 0;
      tries < 6 && !s.cleared && Math.hypot(x - s.ball.x, y - s.ball.y) > 8;
      tries++
    ) {
      const dx = x - s.ball.x,
        dy = s.ball.y - y;
      Golf.aim(
        s,
        (Math.atan2(dy, dx) * 180) / Math.PI,
        Math.sqrt(440 * Math.hypot(dx, dy)),
      );
      Golf.shoot(s);
      for (let i = 0; i < 1000 && !s.rest; i++) Golf.step(s, 1 / 120);
    }
  return s;
}
test("all six golf holes have playable routes through the real collision, friction and cup rules", () => {
  for (let level = 0; level < 6; level++) {
    const s = playHole(Golf.create(level));
    assert.ok(s.cleared, `hole ${level + 1}`);
    assert.ok(s.strokes <= 8);
    assert.deepEqual([s.ball.x, s.ball.y], Golf.courses[level].hole);
  }
});
test("golf progresses through all six holes and retains the exact total stroke count", () => {
  const s = Golf.create();
  let total = 0;
  for (let level = 0; level < 6; level++) {
    playHole(s);
    total += s.strokes;
    assert.equal(s.totalStrokes, total);
    if (level < 5) {
      assert.ok(Golf.next(s));
      assert.equal(s.strokes, 0);
      assert.equal(s.totalStrokes, total);
    }
  }
  assert.ok(s.over && s.won);
  assert.equal(s.score, total);
  assert.equal(Golf.next(s), false);
});
test("golf blocks extra strokes in motion and water adds exactly one penalty and restores the shot origin", () => {
  const s = Golf.create(4);
  Golf.shoot(s);
  assert.equal(Golf.shoot(s), false);
  assert.equal(s.strokes, 1);
  s.ball = { x: 100, y: 300, vx: 10, vy: 0 };
  Golf.step(s, 1 / 120);
  assert.equal(s.totalStrokes, 2);
  assert.deepEqual([s.ball.x, s.ball.y], s.origin);
  assert.ok(s.rest);
  Golf.step(s, 1 / 120);
  assert.equal(s.totalStrokes, 2);
});
test("golf walls reflect approaching velocity and sand slows more than grass", () => {
  const b = { x: 95, y: 150, vx: 200, vy: 0 };
  Golf.bounce(b, [100, 100, 30, 100]);
  assert.ok(b.vx < 0);
  assert.equal(b.x, 90);
  const sand = Golf.create(3),
    grass = Golf.create(3);
  for (const s of [sand, grass]) {
    s.rest = false;
    s.ball = { x: s === sand ? 270 : 100, y: 300, vx: 100, vy: 0 };
    Golf.step(s, 1 / 120);
  }
  assert.ok(sand.ball.vx < grass.ball.vx);
});
test("miner catches the first item along the hook, locks the launch and scores only on return", () => {
  const s = Miner.create();
  s.angle = 0;
  s.items = [
    { x: 300, y: 200, r: 20, type: "gold", value: 150, weight: 1.5 },
    { x: 300, y: 350, r: 20, type: "gold", value: 300, weight: 3 },
  ];
  assert.ok(Miner.grab(s));
  assert.equal(Miner.grab(s), false);
  while (s.phase === "out") Miner.step(s, 1 / 120);
  assert.equal(s.score, 0);
  assert.equal(s.caught.value, 150);
  assert.equal(s.items.length, 1);
  while (s.phase === "back") Miner.step(s, 1 / 120);
  assert.equal(s.score, 150);
  assert.equal(s.length, 48);
});
test("miner heavy objects retract slower and bombs discard a held object without granting points", () => {
  const heavy = Miner.create(),
    light = Miner.create();
  for (const [s, weight] of [
    [heavy, 4.5],
    [light, 0.8],
  ]) {
    s.phase = "back";
    s.length = 400;
    s.caught = { weight, value: 400 };
    Miner.step(s, 1 / 120);
  }
  assert.ok(heavy.length > light.length);
  assert.ok(Miner.bomb(heavy));
  assert.equal(heavy.bombs, 1);
  assert.equal(heavy.caught, null);
  assert.equal(heavy.score, 0);
  assert.equal(Miner.bomb(heavy), false);
});
test("miner three timed targets are reachable with ordinary swinging and grabbing", () => {
  const s = Miner.create();
  let levels = 1;
  for (let i = 0; i < 20000 && !s.over; i++) {
    if (s.cleared) {
      const score = s.score;
      assert.ok(Miner.next(s));
      levels++;
      assert.equal(s.score, score);
      assert.equal(s.time, 0);
      assert.equal(s.bombs, 2);
    }
    if (s.phase === "swing") {
      const hits = s.items
        .filter(
          (o) => Math.abs(Math.atan2(o.x - 300, o.y - 80) - s.angle) < 0.025,
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - 300, a.y - 80) - Math.hypot(b.x - 300, b.y - 80),
        );
      if (hits[0]?.value >= 150) Miner.grab(s);
    }
    Miner.step(s, 1 / 120);
  }
  assert.equal(levels, 3);
  assert.ok(s.won && s.over);
  assert.ok(s.score >= 2400);
});
test("miner time runs during a return and expiration cannot award undelivered treasure", () => {
  const s = Miner.create();
  s.time = 44.999;
  s.phase = "back";
  s.length = 200;
  s.caught = { value: 400, weight: 1 };
  Miner.step(s, 1 / 120);
  assert.ok(s.over && !s.won);
  assert.equal(s.score, 0);
  assert.equal(s.time, 45);
});
test("all six engines freeze at game over and ignore invalid or non-positive elapsed time", () => {
  for (const E of [Bubble, Space, Racer, Basket, Golf, Miner]) {
    const s = E.create();
    if (E.shoot) E.shoot(s);
    if (E.grab) E.grab(s);
    let before = JSON.stringify(s);
    for (const dt of [0, -1, NaN, Infinity]) E.step(s, dt);
    assert.equal(JSON.stringify(s), before);
    s.over = true;
    before = JSON.stringify(s);
    E.step(s, 1);
    assert.equal(JSON.stringify(s), before);
  }
});

test("space losing the final life takes priority over a simultaneous flagship kill", () => {
  const s = Space.create();
  s.time = 45;
  s.bossSpawned = true;
  s.boss = { x: 300 + 180 * Math.sin(45 * 0.8), y: 95, hp: 1, fire: 100 };
  s.lives = 1;
  s.fire = 100;
  s.spawn = 100;
  s.bullets = [{ x: s.boss.x, y: 97 }];
  s.shots = [{ x: 300, y: 620, vx: 0, vy: 0 }];
  Space.step(s, 1 / 120);
  assert.ok(s.over);
  assert.equal(s.won, false);
  assert.equal(s.lives, 0);
});
