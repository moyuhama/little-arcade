const { test } = require("node:test");
const assert = require("node:assert/strict");
const E = require("../games/factory/engine");
function run(s, seconds) {
  for (let i = 0; i < Math.ceil(seconds * 10); i++) E.step(s, 0.1);
}
function supply(s, item, n) {
  while (s.stock[item] < n) {
    const recipe = Object.keys(E.RECIPES).find(
      (k) => E.RECIPES[k].output === item,
    );
    if (!recipe) {
      assert.ok(E.gather(s, s.resource.indexOf(item)));
      continue;
    }
    assert.ok(E.available(s, recipe), "recipe unlocked: " + recipe);
    for (const [k, qty] of Object.entries(E.RECIPES[recipe].input))
      supply(s, k, qty);
    assert.ok(E.craft(s, recipe));
  }
}
test("factory starter line mines, smelts, conveys and delivers without manual supplies", () => {
  const s = E.create();
  run(s, 30);
  assert.ok(s.stock.iron >= 8);
  assert.ok(E.claim(s));
  assert.equal(s.order, 1);
  assert.ok(E.available(s, "copper"));
  assert.ok(E.blueprint(s, "copper"));
  run(s, 35);
  assert.ok(s.stock.copper >= 8);
  assert.ok(E.claim(s));
  assert.equal(s.order, 2);
  assert.ok(s.delivered > 16);
});
test("factory all 60 campaign tasks and subsequent orders can be fulfilled using unlocked production recipes", () => {
  const s = E.create();
  for (let i = 0; i < 65; i++) {
    const order = E.order(s.order);
    assert.equal(order.index, i);
    for (const [k, n] of Object.entries(order.need)) supply(s, k, n);
    const money = s.money;
    assert.ok(E.claim(s));
    assert.equal(s.money, money + order.reward);
    assert.equal(s.order, i + 1);
  }
  assert.match(E.order(60).name, /持续订单/);
});
test("factory every automated recipe consumes required inputs and outputs the specified number", () => {
  for (const [key, r] of Object.entries(E.RECIPES)) {
    const s = E.create();
    s.order = 40;
    const i = 8 * E.W + 10;
    assert.ok(E.build(s, i, r.machine, 1, key));
    const m = s.cells[i];
    for (const [k, n] of Object.entries(r.input)) m.buffer[k] = n;
    run(s, r.time + 0.2);
    assert.deepEqual(m.out, Array(r.count).fill(r.output));
    for (const k of Object.keys(r.input)) assert.equal(m.buffer[k], 0);
  }
});
test("factory atomic conveyor updates prevent teleportation, duplication and output swapping", () => {
  const s = E.create(),
    i = 2 * E.W + 4;
  E.build(s, i, "belt", 1, "iron");
  assert.equal(s.cells[i].recipe, null);
  E.build(s, i + 1, "belt");
  E.build(s, i + 2, "warehouse");
  s.cells[i].out = ["iron"];
  E.transport(s);
  assert.deepEqual(s.cells[i + 1].out, ["iron"]);
  assert.equal(s.stock.iron, 0);
  E.transport(s);
  assert.equal(s.stock.iron, 1);
  assert.deepEqual(s.cells[i + 1].out, []);
  assert.equal(E.neighbor(E.W - 1, 1), -1);
});
test("factory splitter distributes across available exits and rejects incompatible machine inputs", () => {
  const s = E.create(),
    i = 5 * E.W + 10;
  E.build(s, i, "splitter", 1);
  for (const j of [i + 1, i - E.W, i + E.W]) E.build(s, j, "belt");
  for (let k = 0; k < 3; k++) {
    s.cells[i].out = ["iron"];
    E.transport(s);
  }
  for (const j of [i + 1, i - E.W, i + E.W])
    assert.deepEqual(s.cells[j].out, ["iron"]);
  assert.equal(E.accepts(s.cells[3 * E.W + 3], "copperOre"), false);
});
test("factory power caps active machinery; solar and research increase capacity", () => {
  const s = E.create();
  s.money = 10000;
  for (let i = 0; i < 15; i++) E.build(s, 7 * E.W + i, "assembler", 1, "gear"); // gear is locked, rejected
  s.order = 3;
  for (let i = 0; i < 15; i++) {
    if (!s.cells[7 * E.W + i]) E.build(s, 7 * E.W + i, "assembler", 1, "gear");
    if (s.cells[7 * E.W + i]?.recipe === "gear")
      s.cells[7 * E.W + i].buffer = { iron: 24 };
  }
  for (let k = 0; k < 100; k++) {
    E.step(s, 0.1);
    assert.ok(s.powerUsed <= E.energy(s));
  }
  const energy = E.energy(s);
  assert.ok(E.build(s, 0, "solar"));
  assert.equal(E.energy(s), energy + 4);
  assert.ok(E.upgrade(s, "power"));
  assert.equal(E.energy(s), energy + 8);
});
test("factory dismantling returns materials and selling reserves the current task", () => {
  const s = E.create(),
    i = 3 * E.W + 3;
  run(s, 10);
  const m = s.cells[i],
    cost = E.BUILDINGS[m.type].cost,
    money = s.money,
    totalIronOre = m.buffer.ironOre || 0;
  assert.ok(E.remove(s, i));
  assert.equal(s.money, money + cost);
  assert.ok(s.stock.ironOre >= totalIronOre);
  assert.equal(E.remove(s, 3 * E.W + 5), false);
  const fresh = E.create();
  fresh.stock.iron = 20;
  fresh.stock.coal = 7;
  assert.equal(E.sell(fresh), 12 * 3 + 7);
  assert.equal(fresh.stock.iron, 8);
  assert.equal(fresh.stock.coal, 0);
});
test("factory snapshot roundtrip preserves running machines and rejects invalid data", () => {
  const s = E.create();
  run(s, 13.4);
  assert.deepEqual(E.restore(s), s);
  assert.equal(E.restore({ ...s, money: -1 }), null);
  const bad = JSON.parse(JSON.stringify(s));
  bad.cells[0] = { type: "teleporter" };
  assert.equal(E.restore(bad), null);
  const before = JSON.stringify(s);
  for (const dt of [-1, 0, NaN, Infinity, 1]) E.step(s, dt);
  assert.equal(JSON.stringify(s), before);
});
