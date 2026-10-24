(function (r, f) {
  if (typeof module === "object" && module.exports) module.exports = f();
  else r.GameEngine = f();
})(globalThis, () => {
  "use strict";
  const W = 18,
    H = 12,
    DIRS = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ];
  const ITEMS = {
    ironOre: ["铁矿", 1, "#a5a1b5"],
    copperOre: ["铜矿", 1, "#ca9c7a"],
    coal: ["煤", 1, "#737485"],
    stone: ["石料", 1, "#b4bba9"],
    iron: ["铁板", 3, "#8a9bb4"],
    copper: ["铜板", 3, "#d6a480"],
    brick: ["砖块", 3, "#bc8b8d"],
    gear: ["齿轮", 7, "#9687b9"],
    wire: ["铜线", 5, "#c4a16c"],
    circuit: ["电路", 14, "#7fae9b"],
    battery: ["电池", 10, "#aba36f"],
    motor: ["电机", 22, "#869dc0"],
    robot: ["机器人", 100, "#b291c0"],
  };
  const RECIPES = {
    iron: {
      name: "冶炼铁板",
      machine: "furnace",
      input: { ironOre: 1 },
      output: "iron",
      count: 1,
      time: 2.4,
      unlock: 0,
    },
    copper: {
      name: "冶炼铜板",
      machine: "furnace",
      input: { copperOre: 1 },
      output: "copper",
      count: 1,
      time: 2.4,
      unlock: 1,
    },
    gear: {
      name: "加工齿轮",
      machine: "assembler",
      input: { iron: 2 },
      output: "gear",
      count: 1,
      time: 3,
      unlock: 3,
    },
    wire: {
      name: "拉制铜线",
      machine: "assembler",
      input: { copper: 1 },
      output: "wire",
      count: 2,
      time: 2.5,
      unlock: 5,
    },
    brick: {
      name: "烧制砖块",
      machine: "furnace",
      input: { stone: 2 },
      output: "brick",
      count: 1,
      time: 3,
      unlock: 8,
    },
    circuit: {
      name: "组装电路",
      machine: "assembler",
      input: { iron: 1, wire: 2 },
      output: "circuit",
      count: 1,
      time: 4,
      unlock: 10,
    },
    battery: {
      name: "组装电池",
      machine: "assembler",
      input: { copper: 1, coal: 2 },
      output: "battery",
      count: 1,
      time: 4,
      unlock: 20,
    },
    motor: {
      name: "组装电机",
      machine: "assembler",
      input: { gear: 2, wire: 2 },
      output: "motor",
      count: 1,
      time: 5,
      unlock: 30,
    },
    robot: {
      name: "组装机器人",
      machine: "assembler",
      input: { motor: 2, circuit: 2, battery: 1 },
      output: "robot",
      count: 1,
      time: 7,
      unlock: 40,
    },
  };
  const BUILDINGS = {
    miner: { name: "采矿机", cost: 45, power: 1, glyph: "采" },
    belt: { name: "输送带", cost: 5, power: 0, glyph: "带" },
    furnace: { name: "熔炉", cost: 60, power: 2, glyph: "炉" },
    assembler: { name: "组装机", cost: 90, power: 3, glyph: "装" },
    splitter: { name: "分流器", cost: 20, power: 0, glyph: "分" },
    solar: { name: "太阳能板", cost: 70, power: 0, glyph: "光" },
    warehouse: { name: "入库口", cost: 80, power: 0, glyph: "库" },
  };
  function make(type, dir = 1, recipe = null) {
    return {
      type,
      dir,
      recipe,
      buffer: {},
      out: [],
      progress: 0,
      split: 0,
      powered: false,
    };
  }
  function create() {
    const resource = Array(W * H).fill(null);
    for (const [type, x, y] of [
      ["ironOre", 1, 3],
      ["copperOre", 1, 7],
      ["coal", 10, 2],
      ["stone", 13, 8],
    ])
      for (const [dx, dy] of [
        [0, 0],
        [0, 1],
        [1, 1],
      ])
        resource[(y + dy) * W + x + dx] = type;
    const cells = Array(W * H).fill(null);
    cells[3 * W + 1] = make("miner");
    cells[3 * W + 2] = make("belt");
    cells[3 * W + 3] = make("furnace", 1, "iron");
    cells[3 * W + 4] = make("belt");
    cells[3 * W + 5] = make("warehouse");
    return {
      version: 1,
      resource,
      cells,
      stock: Object.fromEntries(Object.keys(ITEMS).map((k) => [k, 0])),
      money: 600,
      order: 0,
      upgrades: { speed: 0, belts: 0, power: 0 },
      time: 0,
      clock: 0,
      rotation: 0,
      powerUsed: 0,
      delivered: 0,
      crafted: 0,
    };
  }
  function order(index) {
    const tier = Math.min(5, Math.floor(index / 10)),
      slot = index % 10,
      amount = 6 + Math.floor(index / 10) * 4 + slot * 2;
    let need;
    if (index === 0) need = { iron: 8 };
    else if (index === 1) need = { copper: 8 };
    else if (index === 2) need = { iron: 12, copper: 8 };
    else if (index === 3) need = { gear: 6 };
    else if (index === 4) need = { gear: 8, iron: 10 };
    else if (index === 5) need = { wire: 12 };
    else if (index === 6) need = { gear: 10, wire: 12 };
    else if (index === 7) need = { gear: 12, copper: 10 };
    else if (index === 8) need = { brick: 10 };
    else if (index === 9) need = { gear: 12, wire: 16, brick: 10 };
    else {
      const primary = ["iron", "circuit", "battery", "motor", "robot", "robot"][
          tier
        ],
        second = ["copper", "gear", "circuit", "battery", "motor", "circuit"][
          tier
        ];
      need = {
        [primary]: Math.ceil(amount / (primary === "robot" ? 3 : 1)),
        [second]: Math.ceil(amount * 0.7),
      };
      if (slot >= 5) need[slot % 2 ? "wire" : "brick"] = amount;
    }
    return {
      index,
      name:
        index < 60
          ? [
              "基础冶炼",
              "精密电路",
              "能源储备",
              "动力车间",
              "机器人工坊",
              "工业联运",
            ][tier] +
            " · " +
            (slot + 1)
          : "持续订单 · " + (index - 59),
      need,
      reward: 120 + index * 28,
    };
  }
  function available(s, key) {
    return !!RECIPES[key] && s.order >= RECIPES[key].unlock;
  }
  function energy(s) {
    return (
      8 +
      s.upgrades.power * 4 +
      s.cells.filter((m) => m?.type === "solar").length * 4
    );
  }
  function refundContents(s, m) {
    for (const [k, n] of Object.entries(m.buffer)) s.stock[k] += n;
    for (const k of m.out) s.stock[k]++;
  }
  function build(s, i, type, dir = 1, recipe = null) {
    if (
      !Number.isInteger(i) ||
      i < 0 ||
      i >= W * H ||
      s.cells[i] ||
      !BUILDINGS[type] ||
      !Number.isInteger(dir) ||
      dir < 0 ||
      dir > 3 ||
      s.money < BUILDINGS[type].cost ||
      (type === "miner" && !s.resource[i])
    )
      return false;
    if (
      ["furnace", "assembler"].includes(type) &&
      (!available(s, recipe) || RECIPES[recipe].machine !== type)
    )
      return false;
    s.money -= BUILDINGS[type].cost;
    s.cells[i] = make(
      type,
      dir,
      ["furnace", "assembler"].includes(type) ? recipe : null,
    );
    return true;
  }
  function remove(s, i) {
    const m = s.cells[i];
    if (!m || i === 3 * W + 5) return false;
    refundContents(s, m);
    s.money += BUILDINGS[m.type].cost;
    s.cells[i] = null;
    return true;
  }
  function rotate(s, i) {
    const m = s.cells[i];
    if (!m) return false;
    m.dir = (m.dir + 1) % 4;
    return true;
  }
  function configure(s, i, recipe) {
    const m = s.cells[i];
    if (!m || !available(s, recipe) || RECIPES[recipe].machine !== m.type)
      return false;
    refundContents(s, m);
    m.buffer = {};
    m.out = [];
    m.progress = 0;
    m.recipe = recipe;
    return true;
  }
  function accepts(m, item) {
    if (!m) return false;
    if (m.type === "warehouse") return true;
    if (m.type === "belt" || m.type === "splitter") return m.out.length === 0;
    const recipe = RECIPES[m.recipe];
    return !!recipe?.input[item] && (m.buffer[item] || 0) < 24;
  }
  function neighbor(i, dir) {
    const [dx, dy] = DIRS[dir],
      x = (i % W) + dx,
      y = Math.floor(i / W) + dy;
    return x < 0 || x >= W || y < 0 || y >= H ? -1 : y * W + x;
  }
  function transport(s) {
    const moves = [],
      reserved = new Set(),
      start = s.rotation % s.cells.length;
    for (let k = 0; k < s.cells.length; k++) {
      const i = (start + k) % s.cells.length,
        m = s.cells[i];
      if (!m?.out.length) continue;
      const item = m.out[0],
        dirs =
          m.type === "splitter"
            ? [m.dir, (m.dir + 3) % 4, (m.dir + 1) % 4]
            : [m.dir];
      for (let d = 0; d < dirs.length; d++) {
        const offset = m.type === "splitter" ? (d + m.split) % dirs.length : 0,
          to = neighbor(i, dirs[offset]);
        if (to < 0 || reserved.has(to) || !accepts(s.cells[to], item)) continue;
        moves.push({ i, to, item, offset });
        reserved.add(to);
        break;
      }
    }
    for (const { i, to, item, offset } of moves) {
      const from = s.cells[i],
        dest = s.cells[to];
      from.out.shift();
      if (from.type === "splitter") from.split = (offset + 1) % 3;
      if (dest.type === "warehouse") {
        s.stock[item] = Math.min(1e7, s.stock[item] + 1);
        s.delivered++;
      } else if (dest.type === "belt" || dest.type === "splitter")
        dest.out.push(item);
      else dest.buffer[item] = (dest.buffer[item] || 0) + 1;
    }
    s.rotation = (s.rotation + 1) % s.cells.length;
  }
  function step(s, dt) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.25) return;
    s.time += dt;
    let power = energy(s);
    s.powerUsed = 0;
    for (const m of s.cells) if (m) m.powered = false;
    const start = Math.floor(s.time) % s.cells.length;
    for (let k = 0; k < s.cells.length; k++) {
      const i = (start + k) % s.cells.length,
        m = s.cells[i];
      if (
        !m ||
        m.out.length ||
        !["miner", "furnace", "assembler"].includes(m.type)
      )
        continue;
      const recipe =
        m.type === "miner"
          ? { input: {}, output: s.resource[i], count: 1, time: 1.5 }
          : RECIPES[m.recipe];
      if (
        !recipe ||
        !recipe.output ||
        !Object.entries(recipe.input).every(
          ([item, n]) => (m.buffer[item] || 0) >= n,
        )
      )
        continue;
      const cost = BUILDINGS[m.type].power;
      if (power < cost) continue;
      power -= cost;
      s.powerUsed += cost;
      m.powered = true;
      m.progress += dt * (1 + s.upgrades.speed * 0.15);
      if (m.progress >= recipe.time) {
        m.progress = 0;
        for (const [item, n] of Object.entries(recipe.input))
          m.buffer[item] -= n;
        for (let j = 0; j < recipe.count; j++) m.out.push(recipe.output);
        s.crafted++;
      }
    }
    s.clock += dt;
    const interval = 0.4 / (1 + s.upgrades.belts * 0.18);
    while (s.clock >= interval) {
      s.clock -= interval;
      transport(s);
    }
  }
  function claim(s) {
    const task = order(s.order);
    if (!Object.entries(task.need).every(([k, n]) => s.stock[k] >= n))
      return false;
    for (const [k, n] of Object.entries(task.need)) s.stock[k] -= n;
    s.money += task.reward;
    s.order++;
    return true;
  }
  function upgradeCost(s, key) {
    return ["speed", "belts", "power"].includes(key) && s.upgrades[key] < 10
      ? 150 + 100 * s.upgrades[key]
      : Infinity;
  }
  function upgrade(s, key) {
    const cost = upgradeCost(s, key);
    if (s.money < cost) return false;
    s.money -= cost;
    s.upgrades[key]++;
    return true;
  }
  function sell(s) {
    const need = order(s.order).need;
    let total = 0;
    for (const k of Object.keys(ITEMS)) {
      const excess = Math.max(0, s.stock[k] - (need[k] || 0));
      s.stock[k] -= excess;
      total += excess * ITEMS[k][1];
    }
    s.money += total;
    return total;
  }
  function gather(s, i) {
    const item = s.resource[i];
    if (!item) return false;
    s.stock[item]++;
    return true;
  }
  function craft(s, recipe) {
    if (!available(s, recipe)) return false;
    const r = RECIPES[recipe];
    if (!Object.entries(r.input).every(([k, n]) => s.stock[k] >= n))
      return false;
    for (const [k, n] of Object.entries(r.input)) s.stock[k] -= n;
    s.stock[r.output] += r.count;
    return true;
  }
  function load(s, i) {
    const m = s.cells[i],
      r = RECIPES[m?.recipe];
    if (!r) return false;
    let changed = false;
    for (const [k, n] of Object.entries(r.input)) {
      const amount = Math.min(
        s.stock[k],
        Math.max(0, n * 3 - (m.buffer[k] || 0)),
      );
      if (amount > 0) {
        s.stock[k] -= amount;
        m.buffer[k] = (m.buffer[k] || 0) + amount;
        changed = true;
      }
    }
    return changed;
  }
  function plan(kind) {
    if (kind === "copper")
      return [
        [1, 7, "miner", null],
        [2, 7, "belt", null],
        [3, 7, "furnace", "copper"],
        [4, 7, "belt", null],
        [5, 7, "warehouse", null],
      ];
    if (!["gear", "wire"].includes(kind)) return [];
    const y = kind === "gear" ? 4 : 8;
    return [
      [2, y, "miner", null],
      [3, y, "belt", null],
      [4, y, "furnace", kind === "gear" ? "iron" : "copper"],
      [5, y, "belt", null],
      [6, y, "assembler", kind],
      [7, y, "belt", null],
      [8, y, "warehouse", null],
    ];
  }
  function blueprint(s, kind) {
    const parts = plan(kind);
    if (
      !parts.length ||
      parts.some(
        ([x, y, type, recipe]) =>
          s.cells[y * W + x] || (recipe && !available(s, recipe)),
      ) ||
      s.money < parts.reduce((sum, p) => sum + BUILDINGS[p[2]].cost, 0)
    )
      return false;
    for (const [x, y, type, recipe] of parts)
      build(s, y * W + x, type, 1, recipe);
    return true;
  }
  function restore(raw) {
    const finite = (v, max) => Number.isFinite(v) && v >= 0 && v <= max;
    if (
      !raw ||
      raw.version !== 1 ||
      !Array.isArray(raw.cells) ||
      raw.cells.length !== W * H ||
      !Array.isArray(raw.resource) ||
      raw.resource.length !== W * H ||
      !raw.stock ||
      typeof raw.stock !== "object" ||
      Array.isArray(raw.stock) ||
      !Object.keys(ITEMS).every(
        (k) => Number.isInteger(raw.stock[k]) && finite(raw.stock[k], 1e7),
      ) ||
      !finite(raw.money, 1e12) ||
      !Number.isInteger(raw.order) ||
      !finite(raw.order, 1e6) ||
      !raw.upgrades ||
      !["speed", "belts", "power"].every(
        (k) => Number.isInteger(raw.upgrades[k]) && finite(raw.upgrades[k], 10),
      )
    )
      return null;
    const expected = create().resource;
    if (!expected.every((v, i) => raw.resource[i] === v)) return null;
    for (let i = 0; i < raw.cells.length; i++) {
      const m = raw.cells[i];
      if (m === null) continue;
      if (
        !m ||
        !BUILDINGS[m.type] ||
        !Number.isInteger(m.dir) ||
        m.dir < 0 ||
        m.dir > 3 ||
        !finite(m.progress, 7) ||
        !Number.isInteger(m.split) ||
        m.split < 0 ||
        m.split > 2 ||
        !Array.isArray(m.out) ||
        m.out.length > 2 ||
        !m.out.every((k) => ITEMS[k]) ||
        !m.buffer ||
        typeof m.buffer !== "object" ||
        Array.isArray(m.buffer) ||
        !Object.entries(m.buffer).every(
          ([k, v]) => ITEMS[k] && Number.isInteger(v) && finite(v, 24),
        )
      )
        return null;
      if (m.type === "miner" && !raw.resource[i]) return null;
      if (
        ["furnace", "assembler"].includes(m.type) &&
        (!available(raw, m.recipe) || RECIPES[m.recipe].machine !== m.type)
      )
        return null;
    }
    if (raw.cells[3 * W + 5]?.type !== "warehouse") return null;
    for (const [k, max] of Object.entries({
      time: 1e10,
      clock: 0.4,
      rotation: W * H - 1,
      powerUsed: 1e5,
      delivered: 1e10,
      crafted: 1e10,
    }))
      if (!finite(raw[k], max)) return null;
    return JSON.parse(JSON.stringify(raw));
  }
  return {
    W,
    H,
    DIRS,
    ITEMS,
    RECIPES,
    BUILDINGS,
    create,
    order,
    available,
    energy,
    build,
    remove,
    rotate,
    configure,
    accepts,
    neighbor,
    transport,
    step,
    claim,
    upgradeCost,
    upgrade,
    sell,
    gather,
    craft,
    load,
    plan,
    blueprint,
    restore,
  };
});
