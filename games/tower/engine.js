(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  const maps = [
    {
      name: "草地回廊",
      path: [
        [-20, 225],
        [125, 225],
        [125, 75],
        [375, 75],
        [375, 325],
        [620, 325],
      ],
      pads: [
        [75, 150],
        [175, 150],
        [275, 125],
        [325, 225],
        [425, 150],
        [425, 275],
        [525, 275],
        [225, 25],
      ],
    },
    {
      name: "峡谷折返",
      path: [
        [-20, 75],
        [475, 75],
        [475, 225],
        [125, 225],
        [125, 350],
        [620, 350],
      ],
      pads: [
        [75, 125],
        [175, 125],
        [325, 125],
        [425, 150],
        [525, 175],
        [225, 275],
        [375, 300],
        [75, 300],
      ],
    },
    {
      name: "湖心长桥",
      path: [
        [75, -20],
        [75, 325],
        [275, 325],
        [275, 125],
        [525, 125],
        [525, 420],
      ],
      pads: [
        [125, 75],
        [125, 225],
        [225, 275],
        [325, 225],
        [375, 75],
        [475, 225],
        [475, 325],
        [225, 375],
      ],
    },
  ];
  const types = {
    arrow: {
      name: "连弩",
      icon: "➶",
      cost: 55,
      range: 140,
      damage: 12,
      delay: 0.55,
      color: "#7d63bf",
      note: "射速快，优先拦截前排",
    },
    cannon: {
      name: "火炮",
      icon: "✹",
      cost: 90,
      range: 125,
      damage: 30,
      delay: 1.65,
      color: "#d49454",
      note: "范围爆炸，擅长密集与重甲",
    },
    frost: {
      name: "霜塔",
      icon: "❄",
      cost: 70,
      range: 125,
      damage: 5,
      delay: 0.9,
      color: "#59a6b0",
      note: "减速 2 秒，与火炮配合",
    },
  };
  const length = (path) =>
    path
      .slice(1)
      .reduce(
        (n, p, i) => n + Math.hypot(p[0] - path[i][0], p[1] - path[i][1]),
        0,
      );
  function point(path, d) {
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1],
        b = path[i],
        l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d <= l)
        return [a[0] + ((b[0] - a[0]) * d) / l, a[1] + ((b[1] - a[1]) * d) / l];
      d -= l;
    }
    return path.at(-1);
  }
  function create(map = 0) {
    return {
      map: maps[map] ? map : 0,
      wave: 0,
      gold: 175,
      lives: 20,
      phase: "build",
      towers: [],
      enemies: [],
      shots: [],
      spawned: 0,
      total: 0,
      timer: 0,
      pulse: 0,
      kills: 0,
      research: 0,
    };
  }
  function stats(t) {
    const base = types[t.type],
      lv = t.level - 1;
    return {
      ...base,
      range: base.range + (t.branch === "range" ? lv * 35 : lv * 10),
      damage: base.damage * (1 + lv * (t.branch === "power" ? 0.85 : 0.4)),
      delay: base.delay / (1 + lv * 0.12),
    };
  }
  function build(s, pad, type) {
    if (
      s.phase === "over" ||
      !Object.hasOwn(types, type) ||
      !Number.isInteger(pad) ||
      !maps[s.map].pads[pad] ||
      s.towers.some((t) => t.pad === pad) ||
      s.gold < types[type].cost
    )
      return false;
    s.gold -= types[type].cost;
    s.towers.push({
      pad,
      type,
      level: 1,
      branch: null,
      cooldown: 0,
      spent: types[type].cost,
    });
    return true;
  }
  const upgradeCost = (t) => (t?.level === 1 ? 65 : 110);
  function upgrade(s, pad, branch) {
    const t = s.towers.find((t) => t.pad === pad);
    if (
      !t ||
      s.phase === "over" ||
      t.level >= 3 ||
      !["power", "range"].includes(branch) ||
      s.gold < upgradeCost(t)
    )
      return false;
    const cost = upgradeCost(t);
    s.gold -= cost;
    t.spent += cost;
    if (t.level === 1) t.branch = branch;
    t.level++;
    return true;
  }
  function sell(s, pad) {
    if (s.phase === "over") return false;
    const t = s.towers.find((t) => t.pad === pad);
    if (!t) return false;
    s.gold += Math.floor(t.spent * 0.7);
    s.towers = s.towers.filter((x) => x !== t);
    return true;
  }
  function start(s) {
    if (s.phase !== "build" || !s.towers.length) return false;
    s.wave++;
    s.phase = "wave";
    s.total = Math.min(36, 7 + s.wave * 2);
    s.spawned = 0;
    s.timer = 0;
    return true;
  }
  function spawn(s) {
    const boss = s.wave % 5 === 0 && s.spawned === s.total - 1,
      kind = boss
        ? "boss"
        : s.wave >= 3 && s.spawned % 5 === 2
          ? "armor"
          : s.wave >= 2 && s.spawned % 4 === 1
            ? "fast"
            : "normal";
    const hp =
      25 *
      Math.pow(1.12, Math.min(s.wave - 1, 80)) *
      (boss ? 8 : kind === "armor" ? 1.8 : kind === "fast" ? 0.7 : 1);
    s.enemies.push({
      d: 0,
      hp,
      max: hp,
      kind,
      speed: kind === "fast" ? 80 : boss ? 29 : 42,
      slow: 0,
    });
    s.spawned++;
  }
  function hit(e, damage, type) {
    e.hp -= damage * (e.kind === "armor" && type === "arrow" ? 0.55 : 1);
    if (type === "frost") e.slow = 2;
  }
  function cleanup(s) {
    const dead = s.enemies.filter((e) => e.hp <= 0);
    for (const e of dead) {
      s.gold += e.kind === "boss" ? 45 : 5 + Math.floor(s.wave / 5);
      s.kills++;
    }
    s.enemies = s.enemies.filter((e) => e.hp > 0);
  }
  function pulse(s) {
    if (s.phase !== "wave" || s.pulse > 0) return false;
    for (const e of s.enemies) {
      e.hp -= 45 + s.wave * 4;
      e.slow = 2;
    }
    s.pulse = 25;
    cleanup(s);
    return true;
  }
  function researchCost(s) {
    return 160 + s.research * 100;
  }
  function research(s) {
    if (
      s.phase !== "build" ||
      s.wave < 3 ||
      !s.towers.length ||
      s.research >= 50 ||
      s.gold < researchCost(s)
    )
      return false;
    s.gold -= researchCost(s);
    s.research++;
    return true;
  }
  function repair(s) {
    if (s.phase !== "build" || s.lives >= 20 || s.gold < 120) return false;
    s.gold -= 120;
    s.lives = Math.min(20, s.lives + 5);
    return true;
  }
  function step(s, dt) {
    if (s.phase !== "wave" || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.05);
    const map = maps[s.map];
    s.pulse = Math.max(0, s.pulse - dt);
    s.timer -= dt;
    if (s.spawned < s.total && s.timer <= 0) {
      spawn(s);
      s.timer = Math.max(0.4, 1.2 - s.wave * 0.025);
    }
    for (const e of s.enemies) {
      e.d += e.speed * (e.slow > 0 ? 0.48 : 1) * dt;
      e.slow = Math.max(0, e.slow - dt);
    }
    for (const t of s.towers) {
      t.cooldown = Math.max(0, t.cooldown - dt);
      if (t.cooldown > 0) continue;
      const stat = stats(t),
        origin = map.pads[t.pad];
      const target = s.enemies
        .filter(
          (e) =>
            e.hp > 0 &&
            Math.hypot(...point(map.path, e.d).map((v, i) => v - origin[i])) <=
              stat.range,
        )
        .sort((a, b) => b.d - a.d)[0];
      if (!target) continue;
      const to = point(map.path, target.d);
      t.cooldown = stat.delay;
      s.shots.push({ from: origin, to, color: stat.color, ttl: 0.15 });
      if (t.type === "cannon") {
        for (const e of s.enemies) {
          const p = point(map.path, e.d);
          if (Math.hypot(p[0] - to[0], p[1] - to[1]) < 55)
            hit(e, stat.damage * (1 + s.research * 0.08), t.type);
        }
      } else hit(target, stat.damage * (1 + s.research * 0.08), t.type);
    }
    cleanup(s);
    const end = length(map.path);
    for (const e of s.enemies)
      if (e.d >= end) s.lives -= e.kind === "boss" ? 4 : 1;
    s.enemies = s.enemies.filter((e) => e.d < end);
    s.shots = s.shots
      .map((v) => ({ ...v, ttl: v.ttl - dt }))
      .filter((v) => v.ttl > 0);
    if (s.lives <= 0) {
      s.lives = 0;
      s.phase = "over";
      return;
    }
    if (s.spawned === s.total && !s.enemies.length) {
      s.phase = "build";
      s.gold += 25 + s.wave * 3;
      s.pulse = 0;
      s.shots = [];
    }
  }
  // Saves are deliberately limited to safe preparation points. A reload restarts the wave.
  function checkpoint(s) {
    if (s.phase !== "build") return null;
    return {
      version: 1,
      map: s.map,
      wave: s.wave,
      gold: s.gold,
      lives: s.lives,
      kills: s.kills,
      research: s.research,
      towers: s.towers.map((t) => ({ ...t, cooldown: 0 })),
    };
  }
  function restore(raw) {
    if (
      !raw ||
      !Number.isInteger(raw.research) ||
      raw.research < 0 ||
      raw.research > 50 ||
      raw.version !== 1 ||
      !Number.isInteger(raw.map) ||
      !maps[raw.map] ||
      !Number.isInteger(raw.wave) ||
      raw.wave < 0 ||
      raw.wave > 10000 ||
      !Number.isFinite(raw.gold) ||
      raw.gold < 0 ||
      raw.gold > 1e9 ||
      !Number.isInteger(raw.lives) ||
      raw.lives < 1 ||
      raw.lives > 20 ||
      !Number.isInteger(raw.kills) ||
      raw.kills < 0 ||
      !Array.isArray(raw.towers) ||
      raw.towers.length > 8
    )
      return null;
    const pads = new Set();
    for (const t of raw.towers) {
      if (
        !t ||
        !Number.isInteger(t.pad) ||
        !maps[raw.map].pads[t.pad] ||
        pads.has(t.pad) ||
        !Object.hasOwn(types, t.type) ||
        ![1, 2, 3].includes(t.level) ||
        (t.level === 1
          ? t.branch !== null
          : !["power", "range"].includes(t.branch)) ||
        t.spent !==
          types[t.type].cost +
            (t.level >= 2 ? 65 : 0) +
            (t.level === 3 ? 110 : 0)
      )
        return null;
      pads.add(t.pad);
    }
    return {
      ...create(raw.map),
      ...raw,
      phase: "build",
      towers: raw.towers.map((t) => ({ ...t, cooldown: 0 })),
    };
  }
  return {
    maps,
    types,
    create,
    point,
    length,
    stats,
    build,
    upgrade,
    upgradeCost,
    sell,
    start,
    step,
    pulse,
    research,
    researchCost,
    repair,
    checkpoint,
    restore,
  };
});
