(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  const centers = [180, 300, 420];
  const themes = ["林间公路", "海岸长路", "落日荒野", "城市夜行"];
  const upgradeNames = { handling: "操控", nitro: "氮气", armor: "护盾" };
  function pace(distance) {
    const progress = 1 - Math.exp(-Math.max(0, distance) / 18000);
    return {
      speed: 180 + 340 * progress,
      gap: 620 - 160 * progress,
      doubleChance:
        distance < 2400 ? 0 : Math.min(0.8, (distance - 2400) / 12000),
    };
  }
  function create() {
    return {
      lane: 1,
      x: 300,
      time: 0,
      distance: 0,
      speed: 180,
      score: 0,
      bonus: 0,
      coins: 0,
      wallet: 0,
      lives: 3,
      invulnerable: 0,
      spawn: 180,
      rows: 0,
      traffic: [],
      pickups: [],
      over: false,
      won: false,
      energy: 60,
      boosting: 0,
      braking: 0,
      brakeCooldown: 0,
      shield: 0,
      shieldClock: 0,
      combo: 0,
      comboTime: 0,
      bestCombo: 0,
      overtakes: 0,
      nearMisses: 0,
      boosts: 0,
      missions: 0,
      missionStart: 0,
      upgrades: { handling: 0, nitro: 0, armor: 0 },
      last: "没有终点，先熟悉换道。金币可以用来改装这辆车。",
    };
  }
  const boostCost = (s) => 40 - s.upgrades.nitro * 5;
  const shieldCapacity = (s) => 1 + Math.ceil(s.upgrades.armor / 2);
  const multiplier = (s) => Math.min(4, 1 + Math.floor(s.combo / 3));
  const upgradeCost = (s, type) =>
    type in upgradeNames && s.upgrades[type] < 3
      ? 4 + s.upgrades[type] * 3
      : Infinity;
  function upgrade(s, type) {
    const cost = upgradeCost(s, type);
    if (s.over || s.wallet < cost || !Number.isFinite(cost)) return false;
    s.wallet -= cost;
    s.upgrades[type]++;
    if (type === "nitro") s.energy = Math.min(100, s.energy + 15);
    if (type === "armor") s.shield = Math.min(shieldCapacity(s), s.shield + 1);
    s.last = `${upgradeNames[type]}升至 ${s.upgrades[type]} 级，花费 ${cost} 枚金币。`;
    return true;
  }
  function boost(s) {
    if (s.over || s.boosting > 0 || s.braking > 0 || s.energy < boostCost(s))
      return false;
    s.energy -= boostCost(s);
    s.boosting = 2 + s.upgrades.nitro * 0.5;
    s.boosts++;
    s.last = "氮气开启！车速提高，金币得分翻倍。";
    return true;
  }
  function brake(s) {
    if (s.over || s.brakeCooldown > 0) return false;
    s.boosting = 0;
    s.braking = 1.8;
    s.brakeCooldown = 5;
    s.last = "紧急减速，重新找好路线。刹车每 5 秒可用一次。";
    return true;
  }
  function steer(s, d) {
    if (!s.over && [-1, 1].includes(d))
      s.lane = Math.max(0, Math.min(2, s.lane + d));
  }
  function mission(s) {
    const cycle = Math.floor(s.missions / 4),
      kind = s.missions % 4;
    const target = [
      Math.min(12, 5 + cycle),
      Math.min(20, 8 + cycle * 2),
      2,
      600,
    ][kind];
    const current = [
      s.coins,
      s.overtakes,
      s.boosts,
      Math.floor(s.distance / 10),
    ][kind];
    return {
      current,
      progress: Math.min(target, Math.max(0, current - s.missionStart)),
      target,
      label: ["收集金币", "安全超车", "使用氮气", "行驶米数"][kind],
      reward: Math.min(500, 200 + cycle * 50),
    };
  }
  function hurt(s) {
    if (s.invulnerable > 0) return;
    if (s.shield > 0) {
      s.shield--;
      s.last = "护盾挡住撞击，连击保留！";
    } else {
      s.lives--;
      s.combo = 0;
      s.comboTime = 0;
      s.energy = Math.max(0, s.energy - 10);
      s.boosting = 0;
      s.last = s.lives
        ? "发生碰撞，连击中断；利用保护时间调整车道。"
        : "生命耗尽，这一程到这里。";
    }
    s.invulnerable = 1.5;
    if (s.lives <= 0) s.over = true;
  }
  function step(s, dt, input = {}, rng = Math.random) {
    if (s.over || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.05);
    s.time += dt;
    for (const key of [
      "invulnerable",
      "boosting",
      "braking",
      "brakeCooldown",
      "comboTime",
    ])
      s[key] = Math.max(0, s[key] - dt);
    if (!s.comboTime) s.combo = 0;
    s.energy = Math.min(
      100,
      s.energy + (s.boosting ? 0 : 5 + s.upgrades.nitro) * dt,
    );
    if (s.upgrades.armor >= 2 && s.shield < shieldCapacity(s)) {
      s.shieldClock += dt;
      const interval = s.upgrades.armor === 3 ? 30 : 45;
      if (s.shieldClock >= interval) {
        s.shield++;
        s.shieldClock = 0;
        s.last = "改装护盾恢复了一层保护。";
      }
    } else s.shieldClock = 0;
    const difficulty = pace(s.distance);
    s.speed = difficulty.speed * (s.braking ? 0.55 : s.boosting ? 1.4 : 1);
    const travel = s.speed * dt;
    s.distance += travel;
    const turnSpeed = 720 + s.upgrades.handling * 180;
    s.x += Math.max(
      -turnSpeed * dt,
      Math.min(turnSpeed * dt, centers[s.lane] - s.x),
    );
    // Space rows by distance, so braking and boosting cannot compress them into an impassable wall.
    s.spawn -= travel;
    if (s.spawn <= 0) {
      s.spawn += difficulty.gap;
      s.rows++;
      const safe = Math.min(2, Math.floor(rng() * 3)),
        blocked = [0, 1, 2].filter((v) => v !== safe);
      if (rng() >= difficulty.doubleChance)
        blocked.splice(Math.min(1, Math.floor(rng() * 2)), 1);
      for (const lane of blocked)
        s.traffic.push({
          lane,
          x: centers[lane],
          y: -100,
          color: Math.min(2, Math.floor(rng() * 3)),
        });
      const type =
        s.rows % 7 === 0 ? "shield" : s.rows % 4 === 0 ? "energy" : "coin";
      s.pickups.push({ x: centers[safe], y: -100, type });
      // A trailing coin rewards changing back after a vehicle passes, instead of following one lane forever.
      if (s.rows % 3 === 0)
        s.pickups.push({ x: centers[blocked[0]], y: -310, type: "coin" });
    }
    for (const car of s.traffic) {
      car.y += travel;
      const dx = Math.abs(car.x - s.x),
        dy = Math.abs(car.y - 590);
      if (dy < 77 && dx >= 48 && dx < 96 && s.invulnerable === 0)
        car.near = true;
      if (dx < 48 && dy < 77) {
        hurt(s);
        car.dead = true;
      }
      if (!car.dead && car.y > 780 && !s.over) {
        car.dead = true;
        s.overtakes++;
        s.combo++;
        s.comboTime = 4;
        s.bestCombo = Math.max(s.bestCombo, s.combo);
        s.bonus += 10 * multiplier(s);
        if (car.near) {
          s.nearMisses++;
          s.bonus += 30 * multiplier(s);
          s.energy = Math.min(100, s.energy + 12);
          s.last = "贴身超车！额外加分并恢复氮气。";
        }
      }
    }
    if (!s.over)
      for (const pickup of s.pickups) {
        pickup.y += travel;
        if (Math.abs(pickup.x - s.x) < 36 && Math.abs(pickup.y - 590) < 52) {
          pickup.dead = true;
          if (pickup.type === "shield") {
            s.shield = Math.min(shieldCapacity(s), s.shield + 1);
            s.last = "获得护盾，可抵挡一次碰撞。";
          } else if (pickup.type === "energy") {
            s.energy = Math.min(100, s.energy + 35);
            s.last = "补充 35 点氮气，找机会冲刺。";
          } else {
            s.coins++;
            s.wallet++;
            s.bonus += 50 * multiplier(s) * (s.boosting > 0 ? 2 : 1);
            s.energy = Math.min(100, s.energy + 8);
          }
        }
      }
    s.traffic = s.traffic.filter((c) => !c.dead);
    s.pickups = s.pickups.filter((c) => !c.dead && c.y < 740);
    if (!s.over) {
      const goal = mission(s);
      if (goal.progress >= goal.target) {
        s.bonus += goal.reward;
        s.energy = Math.min(100, s.energy + 20);
        s.missions++;
        s.missionStart = mission(s).current;
        s.last = `目标完成！+${goal.reward} 分、+20 氮气，新目标已开启。`;
      }
    }
    s.score = Math.floor(s.distance / 30) + s.bonus;
  }
  return {
    create,
    steer,
    step,
    pace,
    boost,
    brake,
    upgrade,
    upgradeCost,
    boostCost,
    shieldCapacity,
    multiplier,
    mission,
    centers,
    themes,
    upgradeNames,
  };
});
