const { test } = require("node:test");
const assert = require("node:assert/strict");
const E = require("../games/racer/engine");
const seeded = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
function idle(s) {
  s.spawn = 1e9;
  s.traffic = [];
  s.pickups = [];
}

test("endless pacing starts slowly, rises smoothly with distance and preserves maneuvering space", () => {
  assert.equal(E.pace(0).speed, 180);
  let previous = 0;
  for (const distance of [0, 500, 2000, 10000, 30000, 100000, 1000000]) {
    const p = E.pace(distance);
    assert.ok(p.speed >= previous && p.speed <= 520);
    previous = p.speed;
    assert.ok(p.gap >= 460);
    // At maximum boost, a full two-lane change fits between consecutive collision zones.
    assert.ok((p.gap - 154) / (p.speed * 1.4) > 240 / 720);
  }
});
test("an ordinary lane-following driver survives ten minutes of max-speed traffic and changing pace", () => {
  const s = E.create(),
    rng = seeded(91831);
  s.distance = 1000000;
  let maxTraffic = 0,
    maxPickups = 0;
  for (let i = 0; i < 600 * 120 && !s.over; i++) {
    const first = s.traffic
      .filter((c) => c.y < 667 && c.y > 100)
      .sort((a, b) => b.y - a.y)[0];
    if (first) {
      const blocked = new Set(
        s.traffic.filter((c) => Math.abs(c.y - first.y) < 5).map((c) => c.lane),
      );
      const safe = [0, 1, 2].filter((lane) => !blocked.has(lane));
      const lane = safe.includes(s.lane) ? s.lane : safe[0];
      if (lane !== undefined && lane !== s.lane)
        E.steer(s, Math.sign(lane - s.lane));
    }
    if (i % 2280 === 0) E.brake(s);
    else E.boost(s);
    E.step(s, 1 / 120, {}, rng);
    maxTraffic = Math.max(maxTraffic, s.traffic.length);
    maxPickups = Math.max(maxPickups, s.pickups.length);
  }
  assert.ok(s.time > 599.99);
  assert.equal(s.over, false);
  assert.equal(s.lives, 3);
  assert.ok(s.rows > 500);
  assert.ok(maxTraffic <= 8 && maxPickups <= 10);
});
test("nitro spends energy once, improves speed and doubles coin points without duplicating coins", () => {
  const s = E.create();
  idle(s);
  assert.ok(E.boost(s));
  assert.equal(s.energy, 20);
  assert.equal(E.boost(s), false);
  s.pickups = [{ type: "coin", x: 300, y: 590 }];
  E.step(s, 1 / 120);
  assert.ok(s.speed > 250);
  assert.equal(s.bonus, 100);
  assert.equal(s.coins, 1);
  assert.equal(s.wallet, 1);
  E.step(s, 1 / 120);
  assert.equal(s.coins, 1);
  assert.equal(s.bonus, 100);
});
test("braking cancels a boost and cannot be spammed during its cooldown", () => {
  const s = E.create();
  idle(s);
  E.boost(s);
  assert.ok(E.brake(s));
  assert.equal(s.boosting, 0);
  E.step(s, 1 / 120);
  assert.ok(s.speed < 100);
  assert.equal(E.brake(s), false);
  assert.equal(E.boost(s), false);
  for (let i = 0; i < 601; i++) E.step(s, 1 / 120);
  assert.ok(E.brake(s));
  assert.ok(s.energy <= 100);
});
test("safe passes build multipliers, near misses pay once, and a collision breaks the chain", () => {
  const s = E.create();
  idle(s);
  for (let i = 0; i < 3; i++) {
    s.traffic = [{ x: 180, y: 781, near: i === 2 }];
    E.step(s, 1 / 120);
  }
  assert.equal(s.combo, 3);
  assert.equal(E.multiplier(s), 2);
  assert.equal(s.bonus, 100);
  assert.equal(s.nearMisses, 1);
  E.step(s, 1 / 120);
  assert.equal(s.bonus, 100);
  s.traffic = [{ x: 300, y: 590 }];
  E.step(s, 1 / 120);
  assert.equal(s.combo, 0);
  assert.equal(s.bestCombo, 3);
  assert.equal(s.lives, 2);
});
test("close passes are marked by geometry and do not pay if the player collides later", () => {
  const s = E.create();
  idle(s);
  s.x = 240;
  s.traffic = [{ x: 180, y: 580 }];
  E.step(s, 1 / 120);
  assert.ok(s.traffic[0].near);
  assert.equal(s.nearMisses, 0);
  s.x = 180;
  s.lane = 0;
  E.step(s, 1 / 120);
  assert.equal(s.lives, 2);
  assert.equal(s.nearMisses, 0);
  assert.equal(s.bonus, 0);
});
test("combos expire, have a four-times cap, and shield protection retains an existing combo", () => {
  const s = E.create();
  idle(s);
  s.combo = 30;
  s.comboTime = 3;
  s.shield = 1;
  assert.equal(E.multiplier(s), 4);
  s.traffic = [{ x: 300, y: 590 }];
  E.step(s, 1 / 120);
  assert.equal(s.combo, 30);
  assert.equal(s.shield, 0);
  assert.equal(s.lives, 3);
  for (let i = 0; i < 361; i++) E.step(s, 1 / 120);
  assert.equal(s.combo, 0);
});
test("road items replenish bounded energy and shields without incrementing coin currency", () => {
  const s = E.create();
  idle(s);
  s.energy = 90;
  s.pickups = [
    { type: "energy", x: 300, y: 590 },
    { type: "shield", x: 300, y: 590 },
    { type: "shield", x: 300, y: 590 },
  ];
  E.step(s, 1 / 120);
  assert.equal(s.energy, 100);
  assert.equal(s.shield, 1);
  assert.equal(s.coins, 0);
  assert.equal(s.wallet, 0);
});
test("upgrade purchases spend only available coins and have independent capped branches", () => {
  const s = E.create();
  assert.equal(E.upgrade(s, "handling"), false);
  s.wallet = 30;
  assert.ok(E.upgrade(s, "handling"));
  assert.equal(s.wallet, 26);
  assert.equal(s.upgrades.handling, 1);
  assert.ok(E.upgrade(s, "handling"));
  assert.ok(E.upgrade(s, "handling"));
  assert.equal(s.wallet, 9);
  assert.equal(E.upgrade(s, "handling"), false);
  assert.equal(E.upgrade(s, "unknown"), false);
  assert.equal(s.wallet, 9);
  assert.ok(E.upgrade(s, "nitro"));
  assert.equal(E.boostCost(s), 35);
  assert.ok(E.boost(s));
  assert.equal(s.boosting, 2.5);
  const fresh = E.create();
  assert.equal(fresh.wallet, 0);
  assert.deepEqual(fresh.upgrades, { handling: 0, nitro: 0, armor: 0 });
});
test("handling really shortens lane changes and upgraded armor recovers on its stated cooldown", () => {
  const stock = E.create(),
    tuned = E.create();
  idle(stock);
  idle(tuned);
  tuned.wallet = 30;
  E.upgrade(tuned, "handling");
  E.steer(stock, 1);
  E.steer(tuned, 1);
  E.step(stock, 0.05);
  E.step(tuned, 0.05);
  assert.ok(tuned.x > stock.x);
  E.upgrade(tuned, "armor");
  E.upgrade(tuned, "armor");
  assert.equal(tuned.shield, 2);
  tuned.shield = 0;
  tuned.shieldClock = 44.99;
  E.step(tuned, 0.02);
  assert.equal(tuned.shield, 1);
  assert.equal(tuned.shieldClock, 0);
});
test("looping objectives reward completed tasks once and start the next task from current progress", () => {
  const s = E.create();
  idle(s);
  s.coins = 4;
  s.wallet = 4;
  s.overtakes = 3;
  s.pickups = [{ type: "coin", x: 300, y: 590 }];
  E.step(s, 1 / 120);
  assert.equal(s.missions, 1);
  assert.equal(s.bonus, 250);
  assert.equal(s.wallet, 5);
  assert.equal(E.mission(s).progress, 0);
  assert.equal(E.mission(s).target, 8);
  E.step(s, 1 / 120);
  assert.equal(s.bonus, 250);
  s.overtakes = 11;
  E.step(s, 1 / 120);
  assert.equal(s.missions, 2);
  assert.equal(s.bonus, 450);
});
test("death prevents simultaneous pickup rewards, rejects upgrades and freezes the entire run", () => {
  const s = E.create();
  idle(s);
  s.lives = 1;
  s.wallet = 50;
  s.traffic = [{ x: 300, y: 590 }];
  s.pickups = [{ type: "shield", x: 300, y: 590 }];
  E.step(s, 1 / 120);
  assert.ok(s.over && !s.won);
  assert.equal(s.shield, 0);
  const before = structuredClone(s);
  E.step(s, 10);
  E.boost(s);
  E.brake(s);
  E.upgrade(s, "armor");
  E.steer(s, 1);
  assert.deepEqual(s, before);
});
