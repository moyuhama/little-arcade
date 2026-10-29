const { test } = require("node:test");
const assert = require("node:assert/strict");
const E = require("../games/breakout/engine");
const brick = (id, x, y, kind = "normal", hp = 1, alive = true) => ({
  id,
  x,
  baseX: x,
  y,
  width: 30,
  height: 16,
  row: Math.round((y - 66) / 22),
  kind,
  hp,
  maxHp: hp,
  alive,
});
const impact = (s, index = 0) => {
  const b = s.bricks[index];
  return E.step(
    {
      ...s,
      ball: { id: 0, x: b.x + 15, y: b.y + 26, vx: 0, vy: -300, contacts: [] },
    },
    0.02,
  );
};
const growthGame = () => ({
  ...E.launch(E.createGame(8)),
  bricks: [
    brick(0, 100, 100, "grow", 5),
    ...Array.from({ length: 8 }, (_, i) =>
      brick(i + 1, 200 + i * 36, 66, "normal", 1, false),
    ),
  ],
});

test("powerups unlock one at a time, with no drops or early laser assistance before their stages", () => {
  const unlocks = [
    [3, "wide"],
    [6, "slow"],
    [10, "shield"],
    [15, "multi"],
    [22, "laser"],
    [30, "pierce"],
    [40, "rain"],
  ];
  for (let level = 1; level <= 100; level++) {
    const available = unlocks
      .filter(([at]) => level >= at)
      .map(([, type]) => type);
    assert.deepEqual(E.powersFor(level), available);
    for (const supply of [0, 1, 4, 6, 15]) {
      const s = impact({
        ...E.launch(E.createGame(level)),
        bricks: [
          { ...brick(0, 100, 100, "supply"), supply },
          brick(1, 500, 66),
        ],
      });
      assert.ok(
        s.drops.every((drop) => available.includes(drop.type)),
        `locked drop in level ${level}`,
      );
      assert.equal(s.drops.length, level < 3 ? 0 : 1);
    }
    const waiting = E.step(
      {
        ...E.launch(E.createGame(level)),
        idleTime: 30,
        ball: { id: 0, x: 50, y: 450, vx: 0, vy: -100 },
      },
      0.01,
    );
    assert.equal(waiting.drops.length, level < 22 ? 0 : 1);
    if (level >= 22) assert.equal(waiting.drops[0].type, "laser");
  }
});

test("ordinary drops are infrequent, cooldown blocks chain floods, and supply limits remain bounded", () => {
  let s = {
    ...E.launch(E.createGame(3)),
    bricks: [brick(0, 100, 100), brick(1, 500, 66)],
  };
  assert.equal(impact({ ...s, destroyed: 10 }).drops.length, 0);
  s = impact({ ...s, destroyed: 11 });
  assert.deepEqual(
    s.drops.map((d) => d.type),
    ["wide"],
  );
  s.bricks[0].alive = true;
  s.bricks[0].hp = 1;
  s.destroyed = 29;
  assert.equal(
    impact(s).drops.length,
    1,
    "a chain must not bypass the six-second interval",
  );
  s.dropClock = 0;
  assert.equal(impact(s).drops.length, 2);
  const full = {
    ...s,
    level: 40,
    drops: Array.from({ length: 3 }, () => ({ x: 500, y: 200, type: "wide" })),
  };
  full.bricks[0].kind = "supply";
  assert.equal(impact(full).drops.length, 3);
});

test("early stages exclude advanced brick effects and every growth brick has five reserved slots", () => {
  for (const mode of ["campaign", "endless"])
    for (const width of [600, 1428])
      for (let level = 1; level <= 100; level++) {
        const s = E.createGame(level, { mode, seed: 682, width });
        const live = s.bricks.filter((b) => b.alive);
        for (const [kind, at] of [
          ["armor", 3],
          ["bomb", 6],
          ["grow", 8],
          ["prism", 15],
          ["moving", 16],
          ["steel", 20],
          ["supply", 22],
          ["relay", 24],
        ])
          if (level < at)
            assert.ok(
              live.every((b) => b.kind !== kind),
              `${kind} appeared in ${level}`,
            );
        const growers = live.filter((b) => b.kind === "grow");
        assert.equal(growers.length, level < 8 ? 0 : level < 40 ? 1 : 2);
        const movingRows = new Set(
          s.bricks.filter((b) => b.kind === "moving").map((b) => b.row),
        );
        const empty = s.bricks.filter(
          (b) =>
            !b.alive &&
            !movingRows.has(b.row) &&
            !["steel", "grow", "core"].includes(b.kind),
        );
        assert.ok(empty.length >= growers.length * 5);
        assert.ok(
          live.filter((b) => b.kind === "supply").length <=
            (level < 40 ? 1 : 2),
        );
      }
});

test("growth takes five separate hits, creates exactly five random ordinary bricks, and remains immutable", () => {
  const original = growthGame(),
    copy = structuredClone(original);
  let s = original;
  for (let hit = 1; hit <= 5; hit++) {
    s = impact(s);
    assert.equal(s.bricks[0].hp, 5 - hit);
    assert.equal(s.bricks[0].alive, hit < 5);
    assert.equal(s.growthCount, hit);
    assert.equal(s.bricks.filter((b) => b.alive && b.grown).length, hit);
    assert.equal(s.score, hit < 5 ? 0 : 10);
    assert.equal(s.status, "playing", "new bricks must still be cleared");
    assert.ok(
      s.bricks
        .filter((b) => b.grown)
        .every(
          (b) => b.kind === "normal" && b.hp === 1 && b.y < E.paddleY(s) - 150,
        ),
    );
  }
  assert.deepEqual(original, copy);
  assert.deepEqual(impact(original), impact(copy));
  const locations = new Set(
    Array.from({ length: 20 }, (_, seed) =>
      impact({ ...growthGame(), seed }).bricks.findIndex((b) => b.grown),
    ),
  );
  assert.ok(locations.size >= 4, "growth must choose among empty slots");
});

test("growth resists piercing and overdrive, while a whole blast/relay chain counts as one hit", () => {
  for (const power of ["pierce", "overdrive"]) {
    let s = { ...growthGame(), level: 40, energy: 100 };
    s = power === "pierce" ? E.collectPower(s, power) : E.activateOverdrive(s);
    const hit = impact(s);
    assert.equal(hit.bricks[0].hp, 4);
    assert.equal(hit.growthCount, 1);
    assert.ok(hit.ball.vy > 0);
    const sameContact = E.step(hit, 0.02);
    assert.equal(sameContact.growthCount, 1);
  }
  const s = growthGame();
  s.bricks[0].x = 172;
  s.bricks[0].baseX = 172;
  s.bricks.push(brick(9, 100, 100, "relay"), brick(10, 136, 100, "bomb"));
  const chained = impact(s, 9);
  assert.equal(chained.growthCount, 1);
  assert.equal(chained.bricks[0].hp, 4);
  const laser = E.step(
    {
      ...growthGame(),
      shots: [{ x: 115, y: 121 }],
      ball: { id: 0, x: 50, y: 450, vx: 0, vy: -100 },
    },
    0.01,
  );
  assert.equal(laser.growthCount, 1);
  assert.equal(laser.bricks[0].hp, 4);
});

test("grown targets clear normally, never reproduce, and never occupy moving lanes", () => {
  let s = growthGame();
  s.bricks[1].kind = "moving";
  s.bricks[1].row = 0;
  for (const b of s.bricks.slice(2)) {
    b.y = 144;
    b.row = 3;
  }
  for (let i = 0; i < 5; i++) s = impact(s);
  assert.equal(s.bricks[1].alive, false);
  s = E.step({ ...s, ball: { id: 0, x: 50, y: 450, vx: 0, vy: -100 } }, 0.1);
  for (let i = 0; i < 3; i++) s = E.step(s, 0.1);
  for (let i = 0; i < s.bricks.length; i++)
    if (s.bricks[i].alive) s = impact(s, i);
  assert.equal(s.status, "level");
  assert.equal(s.growthCount, 5);
});

test("energy unlocks at level twenty and both modes keep increasing ball speed within their bounds", () => {
  const locked = { ...E.launch(E.createGame(19)), energy: 100 };
  assert.equal(E.activateOverdrive(locked), locked);
  assert.equal(E.activateOverdrive({ ...locked, level: 20 }).overdrive, 6);
  assert.equal(E.speedFor(1), 240);
  assert.equal(E.speedFor(100), 510);
  for (let level = 2; level <= 100; level++) {
    assert.ok(E.speedFor(level) > E.speedFor(level - 1));
    const launched = E.launch(E.createGame(level));
    assert.ok(
      Math.abs(
        Math.hypot(launched.ball.vx, launched.ball.vy) - E.speedFor(level),
      ) < 1e-6,
    );
  }
  assert.ok(E.speedFor(1000000, "endless") <= 540);
  assert.ok(E.speedFor(100, "endless") > E.speedFor(50, "endless"));
});
