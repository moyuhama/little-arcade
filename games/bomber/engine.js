(function (r, f) {
  if (typeof module === "object" && module.exports) module.exports = f();
  else r.GameEngine = f();
})(globalThis, () => {
  "use strict";
  const DIRS = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ],
    CHAPTERS = [
      "绿荫庭院",
      "货箱长街",
      "坚岩矿场",
      "苔藓湿地",
      "熔炉回廊",
      "传送遗迹",
      "追猎之夜",
      "终极试炼",
    ];
  function rng(seed) {
    let x = seed >>> 0;
    return () => {
      x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
      return x / 4294967296;
    };
  }
  const key = (x, y) => x + "," + y;
  function create(level = 0, talents = {}, mode = "campaign", seed = 38171) {
    level = Math.max(0, Math.floor(level));
    const chapter = Math.min(7, Math.floor(level / 10)),
      n = level < 10 ? 11 : 13,
      random = rng((seed + Math.imul(level + 1, 104729)) >>> 0);
    const s = {
      version: 1,
      level,
      mode,
      seed,
      n,
      chapter,
      tiles: Array(n * n).fill(0),
      terrain: Array(n * n).fill(0),
      loot: {},
      items: [],
      enemies: [],
      bombs: [],
      flames: [],
      player: {
        x: 1,
        y: 1,
        lives: 3 + Math.min(2, talents.vitality || 0),
        range: 2 + Math.min(2, talents.range || 0),
        capacity: 1 + Math.min(2, talents.capacity || 0),
        shield: 0,
        invincible: 0,
        teleport: 0,
      },
      exit: { x: n - 2, y: n - 2 },
      portals: [],
      keys: 0,
      required: 3,
      time: 0,
      cooldown: 0,
      enemyClock: 0,
      status: "play",
      moves: 0,
      serial: 0,
      kills: 0,
      stars: 0,
    };
    s.maxLives = s.player.lives;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        if (
          x === 0 ||
          y === 0 ||
          x === n - 1 ||
          y === n - 1 ||
          (x % 2 === 0 && y % 2 === 0)
        )
          s.tiles[i] = -1;
        else if (
          x + y > 5 &&
          !(x === n - 2 && y === n - 2) &&
          random() < 0.32 + chapter * 0.025
        )
          s.tiles[i] = chapter >= 2 && random() < 0.22 ? 2 : 1;
      }
    const crates = s.tiles.flatMap((v, i) => (v > 0 ? [i] : [])),
      far = crates.slice().sort((a, b) => b - a);
    for (let i = 0; i < 3; i++) {
      const index = far[Math.floor((i * far.length) / 3)];
      s.loot[index] = "key";
    }
    for (const i of crates)
      if (!s.loot[i] && random() < 0.25)
        s.loot[i] = ["range", "capacity", "shield", "heart"][
          Math.floor(random() * 4)
        ];
    const open = s.tiles.flatMap((v, i) =>
      v === 0 && (i % n) + Math.floor(i / n) > n ? [i] : [],
    );
    for (let i = open.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [open[i], open[j]] = [open[j], open[i]];
    }
    const count = Math.min(10, 1 + Math.floor(level / 5));
    for (let k = 0; k < count && open.length; k++) {
      const i = open.pop(),
        boss = level % 10 === 9 && k === 0,
        type = boss
          ? "warden"
          : chapter >= 6
            ? "hunter"
            : chapter >= 3 && k % 2
              ? "hunter"
              : "walker";
      s.enemies.push({
        id: k,
        x: i % n,
        y: Math.floor(i / n),
        hp: boss ? 3 : chapter >= 2 && k % 3 === 0 ? 2 : 1,
        type,
        dir: k % 4,
        hit: 0,
      });
    }
    if (chapter >= 3)
      for (const i of open.slice(0, Math.min(18, open.length)))
        if (s.tiles[i] === 0)
          s.terrain[i] = chapter === 3 ? 1 : chapter >= 4 ? 2 : 0;
    if (chapter >= 5) {
      const candidates = [
        { x: 1, y: n - 2 },
        { x: n - 2, y: 1 },
      ];
      for (const p of candidates) {
        const index = p.y * n + p.x;
        if (s.loot[index]) {
          s.items.push({ x: p.x, y: p.y, type: s.loot[index] });
          delete s.loot[index];
        }
        s.tiles[index] = 0;
        s.terrain[index] = 0;
      }
      s.portals = candidates;
    }
    return s;
  }
  function index(s, x, y) {
    return y * s.n + x;
  }
  function inside(s, x, y) {
    return x >= 0 && y >= 0 && x < s.n && y < s.n;
  }
  function walkable(s, x, y) {
    return (
      inside(s, x, y) &&
      s.tiles[index(s, x, y)] === 0 &&
      !s.bombs.some((b) => b.x === x && b.y === y)
    );
  }
  function blast(s, b) {
    const cells = [index(s, b.x, b.y)];
    for (const [dx, dy] of DIRS)
      for (let k = 1; k <= b.range; k++) {
        const x = b.x + dx * k,
          y = b.y + dy * k;
        if (!inside(s, x, y) || s.tiles[index(s, x, y)] === -1) break;
        cells.push(index(s, x, y));
        if (s.tiles[index(s, x, y)] > 0) break;
      }
    return cells;
  }
  function bomb(s) {
    if (
      s.status !== "play" ||
      s.bombs.length >= s.player.capacity ||
      s.bombs.some((b) => b.x === s.player.x && b.y === s.player.y)
    )
      return false;
    s.bombs.push({
      id: ++s.serial,
      x: s.player.x,
      y: s.player.y,
      range: s.player.range,
      fuse: 2.4,
    });
    return true;
  }
  function hurt(s) {
    const p = s.player;
    if (p.invincible > 0 || s.status !== "play") return;
    if (p.shield > 0) p.shield--;
    else p.lives--;
    p.invincible = 1.5;
    if (p.lives <= 0) s.status = "lost";
  }
  function collect(s) {
    if (s.status !== "play") return;
    const p = s.player;
    for (let i = s.items.length - 1; i >= 0; i--) {
      const item = s.items[i];
      if (item.x !== p.x || item.y !== p.y) continue;
      s.items.splice(i, 1);
      if (item.type === "key") s.keys++;
      if (item.type === "range") p.range = Math.min(6, p.range + 1);
      if (item.type === "capacity") p.capacity = Math.min(5, p.capacity + 1);
      if (item.type === "shield") p.shield = Math.min(2, p.shield + 1);
      if (item.type === "heart") p.lives = Math.min(s.maxLives, p.lives + 1);
    }
    if (
      p.x === s.exit.x &&
      p.y === s.exit.y &&
      s.keys >= s.required &&
      !s.enemies.length
    ) {
      s.status = "won";
      s.stars =
        1 +
        Number(p.lives >= s.maxLives - 1) +
        Number(s.time <= 120 + s.level * 2);
    }
  }
  function move(s, dir) {
    if (
      s.status !== "play" ||
      s.cooldown > 0 ||
      !Number.isInteger(dir) ||
      !DIRS[dir]
    )
      return false;
    const [dx, dy] = DIRS[dir],
      p = s.player,
      x = p.x + dx,
      y = p.y + dy;
    if (!walkable(s, x, y)) return false;
    p.x = x;
    p.y = y;
    s.moves++;
    s.cooldown = s.terrain[index(s, x, y)] === 1 ? 0.28 : 0.15;
    if (p.teleport <= 0) {
      const from = s.portals.findIndex((q) => q.x === x && q.y === y);
      if (from >= 0) {
        const to = s.portals[1 - from];
        if (walkable(s, to.x, to.y)) {
          p.x = to.x;
          p.y = to.y;
          p.teleport = 0.7;
        }
      }
    }
    if (
      s.flames.some((f) => f.cells.includes(index(s, p.x, p.y))) ||
      s.enemies.some((e) => e.x === p.x && e.y === p.y)
    )
      hurt(s);
    collect(s);
    return true;
  }
  function detonate(s, id) {
    const queue = [id],
      done = new Set();
    while (queue.length) {
      const bid = queue.shift();
      if (done.has(bid)) continue;
      const b = s.bombs.find((b) => b.id === bid);
      if (!b) continue;
      done.add(bid);
      const cells = blast(s, b);
      s.flames.push({ cells, life: 0.48 });
      for (const j of cells) {
        for (const other of s.bombs)
          if (index(s, other.x, other.y) === j && !done.has(other.id))
            queue.push(other.id);
        if (s.tiles[j] > 0) {
          s.tiles[j]--;
          if (s.tiles[j] === 0 && s.loot[j]) {
            s.items.push({
              x: j % s.n,
              y: Math.floor(j / s.n),
              type: s.loot[j],
            });
            delete s.loot[j];
          }
        }
      }
      s.bombs = s.bombs.filter((b) => b.id !== bid);
    }
  }
  function ventActive(s) {
    return s.chapter >= 4 && s.time % 5 >= 3.7;
  }
  function step(s, dt) {
    if (s.status !== "play" || !Number.isFinite(dt) || dt <= 0 || dt > 0.25)
      return;
    s.time += dt;
    s.cooldown = Math.max(0, s.cooldown - dt);
    s.player.invincible = Math.max(0, s.player.invincible - dt);
    s.player.teleport = Math.max(0, s.player.teleport - dt);
    s.flames = s.flames
      .map((f) => ({ ...f, life: f.life - dt }))
      .filter((f) => f.life > 0);
    s.bombs.forEach((b) => (b.fuse -= dt));
    for (const b of s.bombs.filter((b) => b.fuse <= 0)) detonate(s, b.id);
    const hot = new Set(s.flames.flatMap((f) => f.cells));
    for (const e of s.enemies) {
      e.hit = Math.max(0, e.hit - dt);
      if (hot.has(index(s, e.x, e.y)) && e.hit <= 0) {
        e.hp--;
        e.hit = 0.7;
      }
    }
    const before = s.enemies.length;
    s.enemies = s.enemies.filter((e) => e.hp > 0);
    s.kills += before - s.enemies.length;
    s.enemyClock += dt;
    const period = Math.max(0.35, 0.85 - s.level * 0.004);
    if (s.enemyClock >= period) {
      s.enemyClock %= period;
      for (const e of s.enemies) {
        let dirs = [e.dir, (e.dir + 1) % 4, (e.dir + 3) % 4, (e.dir + 2) % 4];
        if (e.type !== "walker")
          dirs = dirs.sort((a, b) => {
            const distance = (d) =>
              Math.abs(e.x + DIRS[d][0] - s.player.x) +
              Math.abs(e.y + DIRS[d][1] - s.player.y);
            return distance(a) - distance(b);
          });
        for (const d of dirs) {
          const [dx, dy] = DIRS[d],
            x = e.x + dx,
            y = e.y + dy;
          if (
            walkable(s, x, y) &&
            !hot.has(index(s, x, y)) &&
            !s.enemies.some(
              (other) => other !== e && other.x === x && other.y === y,
            )
          ) {
            e.x = x;
            e.y = y;
            e.dir = d;
            break;
          }
        }
      }
    }
    if (
      hot.has(index(s, s.player.x, s.player.y)) ||
      s.enemies.some((e) => e.x === s.player.x && e.y === s.player.y) ||
      (ventActive(s) && s.terrain[index(s, s.player.x, s.player.y)] === 2)
    )
      hurt(s);
    if (s.status === "play") collect(s);
  }
  function talentCost(level) {
    return [3, 7][level] ?? Infinity;
  }
  function restore(raw) {
    if (
      !raw ||
      raw.version !== 1 ||
      !["campaign", "endless"].includes(raw.mode) ||
      !Number.isInteger(raw.level) ||
      raw.level < 0 ||
      raw.level > 100000 ||
      !Number.isInteger(raw.seed) ||
      raw.seed < 0 ||
      raw.seed > 4294967295 ||
      ![11, 13].includes(raw.n) ||
      !Array.isArray(raw.tiles) ||
      raw.tiles.length !== raw.n ** 2 ||
      !raw.tiles.every((t) => [-1, 0, 1, 2].includes(t)) ||
      !Array.isArray(raw.terrain) ||
      raw.terrain.length !== raw.tiles.length ||
      !raw.terrain.every((t) => [0, 1, 2].includes(t))
    )
      return null;
    const finite = (x, min, max) => Number.isFinite(x) && x >= min && x <= max,
      point = (p) =>
        p &&
        Number.isInteger(p.x) &&
        Number.isInteger(p.y) &&
        p.x >= 1 &&
        p.y >= 1 &&
        p.x < raw.n - 1 &&
        p.y < raw.n - 1;
    if (
      !point(raw.player) ||
      !point(raw.exit) ||
      !finite(raw.player.lives, 0, 5) ||
      !finite(raw.maxLives, 3, 5) ||
      !finite(raw.player.capacity, 1, 5) ||
      !finite(raw.player.range, 2, 6) ||
      !finite(raw.player.shield, 0, 2) ||
      !finite(raw.player.invincible, 0, 1.5) ||
      !finite(raw.player.teleport, 0, 0.7) ||
      !finite(raw.time, 0, 1e8) ||
      !finite(raw.cooldown, 0, 0.3) ||
      !finite(raw.enemyClock, 0, 1) ||
      !finite(raw.keys, 0, 3) ||
      raw.required !== 3 ||
      !["play", "won", "lost"].includes(raw.status)
    )
      return null;
    if (
      !Array.isArray(raw.enemies) ||
      raw.enemies.length > 10 ||
      !raw.enemies.every(
        (e) =>
          point(e) &&
          Number.isInteger(e.id) &&
          finite(e.hp, 1, 3) &&
          ["walker", "hunter", "warden"].includes(e.type) &&
          Number.isInteger(e.dir) &&
          e.dir >= 0 &&
          e.dir < 4 &&
          finite(e.hit, 0, 0.7),
      )
    )
      return null;
    if (
      !Array.isArray(raw.bombs) ||
      raw.bombs.length > 5 ||
      !raw.bombs.every(
        (b) =>
          point(b) &&
          Number.isInteger(b.id) &&
          finite(b.fuse, 0, 2.4) &&
          finite(b.range, 2, 6),
      ) ||
      !Array.isArray(raw.flames) ||
      raw.flames.length > 10 ||
      !raw.flames.every(
        (f) =>
          finite(f.life, 0, 0.48) &&
          Array.isArray(f.cells) &&
          f.cells.length <= 25 &&
          f.cells.every(
            (i) => Number.isInteger(i) && i >= 0 && i < raw.tiles.length,
          ),
      )
    )
      return null;
    if (
      !Array.isArray(raw.items) ||
      raw.items.length > raw.tiles.length ||
      !raw.items.every(
        (i) =>
          point(i) &&
          ["key", "range", "capacity", "shield", "heart"].includes(i.type),
      ) ||
      !Array.isArray(raw.portals) ||
      ![0, 2].includes(raw.portals.length) ||
      !raw.portals.every(point) ||
      !raw.loot ||
      typeof raw.loot !== "object" ||
      Array.isArray(raw.loot) ||
      !Object.entries(raw.loot).every(
        ([i, t]) =>
          /^\d+$/.test(i) &&
          raw.tiles[Number(i)] > 0 &&
          ["key", "range", "capacity", "shield", "heart"].includes(t),
      )
    )
      return null;
    for (const k of ["chapter", "moves", "serial", "kills", "stars"])
      if (!Number.isInteger(raw[k]) || raw[k] < 0 || raw[k] > 1e8) return null;
    if (
      raw.chapter > 7 ||
      raw.stars > 3 ||
      raw.tiles[index(raw, raw.player.x, raw.player.y)] !== 0
    )
      return null;
    return JSON.parse(JSON.stringify(raw));
  }
  return {
    DIRS,
    CHAPTERS,
    create,
    index,
    inside,
    walkable,
    blast,
    bomb,
    hurt,
    collect,
    move,
    detonate,
    ventActive,
    step,
    talentCost,
    restore,
  };
});
