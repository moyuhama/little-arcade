(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  const centers = [180, 300, 420];
  function create() {
    return {
      lane: 1,
      x: 300,
      time: 0,
      distance: 0,
      score: 0,
      bonus: 0,
      coins: 0,
      lives: 3,
      invulnerable: 0,
      spawn: 1,
      traffic: [],
      pickups: [],
      over: false,
      won: false,
      last: "每排都有通路，左右换道，跑完 60 秒。",
    };
  }
  function steer(s, d) {
    if (!s.over && [-1, 1].includes(d))
      s.lane = Math.max(0, Math.min(2, s.lane + d));
  }
  function step(s, dt, input = {}, rng = Math.random) {
    if (s.over || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.05);
    s.time = Math.min(60, s.time + dt);
    s.invulnerable = Math.max(0, s.invulnerable - dt);
    const speed = 250 + s.time * 3;
    s.distance += speed * dt;
    s.x += Math.max(-900 * dt, Math.min(900 * dt, centers[s.lane] - s.x));
    s.spawn -= dt;
    if (s.spawn <= 0 && s.time < 55) {
      s.spawn += Math.max(0.85, 1.3 - s.time * 0.006);
      const safe = Math.min(2, Math.floor(rng() * 3)),
        blocked = [0, 1, 2].filter((v) => v !== safe);
      if (s.time < 18) blocked.splice(Math.floor(rng() * 2), 1);
      blocked.forEach((lane) =>
        s.traffic.push({
          lane,
          x: centers[lane],
          y: -100,
          color: Math.floor(rng() * 3),
        }),
      );
      s.pickups.push({ x: centers[safe], y: -100 });
    }
    for (const car of s.traffic) {
      car.y += speed * dt;
      if (Math.abs(car.x - s.x) < 48 && Math.abs(car.y - 590) < 77) {
        if (s.invulnerable <= 0) {
          s.lives--;
          s.invulnerable = 1.5;
          s.last = "碰到车辆，暂时获得保护。";
          if (!s.lives) s.over = true;
        }
        car.dead = true;
      }
      if (car.y > 780) {
        car.dead = true;
        s.bonus += 10;
      }
    }
    for (const coin of s.pickups) {
      coin.y += speed * dt;
      if (Math.abs(coin.x - s.x) < 36 && Math.abs(coin.y - 590) < 52) {
        coin.dead = true;
        s.coins++;
        s.bonus += 50;
      }
    }
    s.traffic = s.traffic.filter((c) => !c.dead);
    s.pickups = s.pickups.filter((c) => !c.dead && c.y < 740);
    s.score = Math.floor(s.distance / 30) + s.bonus;
    if (s.time >= 60 && !s.over) {
      s.over = true;
      s.won = true;
      s.last = "平安冲线！这一段旅途跑完啦。";
    }
  }
  return { create, steer, step, centers };
});
