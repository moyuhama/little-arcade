const { test } = require("node:test");
const assert = require("node:assert/strict");
const E = require("../games/bomber/engine");
function run(s, seconds) {
  for (let i = 0; i < Math.ceil(seconds * 20); i++) E.step(s, 0.05);
}
function reachable(s, from, allowCrates = false) {
  const seen = new Set([from]),
    queue = [from];
  while (queue.length) {
    const i = queue.shift(),
      x = i % s.n,
      y = Math.floor(i / s.n);
    for (const [dx, dy] of E.DIRS) {
      const nx = x + dx,
        ny = y + dy,
        j = ny * s.n + nx;
      if (
        E.inside(s, nx, ny) &&
        s.tiles[j] !== -1 &&
        (allowCrates || s.tiles[j] === 0) &&
        !seen.has(j)
      ) {
        seen.add(j);
        queue.push(j);
      }
    }
  }
  return seen;
}
test("bomber: 80 deterministic distinct maps keep keys and exit reachable after clearing boxes", () => {
  const seen = new Set();
  for (let level = 0; level < 80; level++) {
    const s = E.create(level);
    assert.deepEqual(s, E.create(level));
    assert.ok(E.restore(s));
    seen.add(
      s.tiles.join(",") + ";" + s.enemies.map((e) => e.x + "," + e.y).join(";"),
    );
    const keys = [
      ...Object.entries(s.loot)
        .filter(([, v]) => v === "key")
        .map(([i]) => Number(i)),
      ...s.items.filter((i) => i.type === "key").map((i) => i.y * s.n + i.x),
    ];
    assert.equal(keys.length, 3);
    const reach = reachable(s, s.n + 1, true);
    assert.ok(reach.has(s.exit.y * s.n + s.exit.x));
    for (const i of keys) assert.ok(reach.has(i));
    assert.ok(s.enemies.length >= 1 && s.enemies.length <= 10);
    const safe = reachable(s, s.n + 1),
      blast = new Set(E.blast(s, { x: 1, y: 1, range: 4 }));
    assert.ok(
      [...safe].some((i) => !blast.has(i)),
      "escape route " + level,
    );
  }
  assert.equal(seen.size, 80);
});
test("bomber first bomb can be escaped within its fuse using the real movement rules", () => {
  for (let level = 0; level < 80; level++) {
    const s = E.create(level, { range: 2 });
    assert.ok(E.bomb(s));
    for (const dir of [1, 1, 2]) {
      assert.ok(E.move(s, dir));
      run(s, 0.2);
    }
    run(s, 2.4);
    assert.equal(s.player.lives, s.maxLives, "stage " + level);
    assert.equal(s.status, "play");
  }
});
test("bomber walls stop blasts, reinforced crates need two hits, and chained bombs detonate", () => {
  const s = E.create(0);
  s.tiles.fill(0);
  s.enemies = [];
  s.tiles[2 * s.n + 4] = -1;
  s.tiles[4 * s.n + 4] = 2;
  s.bombs = [
    { id: 1, x: 3, y: 4, range: 4, fuse: 1 },
    { id: 2, x: 2, y: 4, range: 3, fuse: 2 },
  ];
  E.detonate(s, 1);
  assert.equal(s.bombs.length, 0);
  assert.equal(s.tiles[4 * s.n + 4], 0);
  assert.ok(s.flames.length === 2);
  const ray = E.blast(s, { x: 4, y: 4, range: 5 });
  assert.ok(!ray.includes(2 * s.n + 4));
  assert.ok(!ray.includes(s.n + 4));
});
test("bomber damage respects shields and invulnerability and freezes after loss", () => {
  const s = E.create();
  s.player.shield = 1;
  E.hurt(s);
  assert.equal(s.player.shield, 0);
  assert.equal(s.player.lives, 3);
  E.hurt(s);
  assert.equal(s.player.lives, 3);
  s.player.invincible = 0;
  s.player.lives = 1;
  E.hurt(s);
  assert.equal(s.status, "lost");
  const before = JSON.stringify(s);
  run(s, 10);
  assert.equal(JSON.stringify(s), before);
  assert.equal(E.bomb(s), false);
  assert.equal(E.move(s, 1), false);
  s.player.x = s.exit.x;
  s.player.y = s.exit.y;
  s.keys = 3;
  s.enemies = [];
  E.collect(s);
  assert.equal(
    s.status,
    "lost",
    "a lethal hit cannot be converted into an exit win",
  );
});
test("bomber terrain, portals, loot and exit objectives follow the chapter rules", () => {
  let s = E.create(35);
  assert.ok(s.terrain.includes(1));
  s.player.x = 1;
  s.player.y = 1;
  s.terrain[1 * s.n + 2] = 1;
  assert.ok(E.move(s, 1));
  assert.equal(s.cooldown, 0.28);
  s = E.create(55);
  assert.equal(s.portals.length, 2);
  const from = s.portals[0];
  s.player.x = from.x;
  s.player.y = from.y - 1;
  s.tiles[s.player.y * s.n + s.player.x] = 0;
  s.enemies = [];
  assert.ok(E.move(s, 2));
  assert.deepEqual([s.player.x, s.player.y], [s.portals[1].x, s.portals[1].y]);
  s = E.create(45);
  s.time = 3.8;
  assert.ok(E.ventActive(s));
  s.time = 5.1;
  assert.equal(E.ventActive(s), false);
  s.player.x = s.exit.x;
  s.player.y = s.exit.y;
  s.keys = 3;
  E.collect(s);
  assert.equal(s.status, "play");
  s.enemies = [];
  E.collect(s);
  assert.equal(s.status, "won");
  assert.equal(s.stars, 3);
});
test("bomber powerups have caps and campaign upgrades change starting equipment", () => {
  const s = E.create(0, { capacity: 2, range: 2, vitality: 2 });
  assert.equal(s.player.capacity, 3);
  assert.equal(s.player.range, 4);
  assert.equal(s.player.lives, 5);
  for (let k = 0; k < 20; k++) {
    s.items = ["range", "capacity", "shield", "heart"].map((type) => ({
      x: 1,
      y: 1,
      type,
    }));
    E.collect(s);
  }
  assert.equal(s.player.range, 6);
  assert.equal(s.player.capacity, 5);
  assert.equal(s.player.shield, 2);
  assert.equal(s.player.lives, 5);
  assert.equal(E.talentCost(2), Infinity);
});
test("bomber endless stages keep producing maps and snapshots resume timers without redealing", () => {
  for (const level of [80, 120, 300, 1000]) {
    const s = E.create(level, {}, "endless", 999);
    assert.equal(s.level, level);
    assert.ok(E.restore(s));
  }
  const s = E.create(2);
  E.bomb(s);
  E.move(s, 1);
  run(s, 0.3);
  assert.deepEqual(E.restore(s), s);
  assert.equal(E.restore({ ...s, time: NaN }), null);
  assert.equal(E.restore({ ...s, player: { ...s.player, x: -1 } }), null);
  const before = JSON.stringify(s);
  for (const dt of [-1, 0, Infinity, NaN, 1]) E.step(s, dt);
  assert.equal(JSON.stringify(s), before);
});
