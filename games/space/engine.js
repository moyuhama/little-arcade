(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function create() {
    return {
      x: 300,
      time: 0,
      score: 0,
      lives: 3,
      invulnerable: 0,
      rapid: 0,
      shield: 0,
      bullets: [],
      enemies: [],
      shots: [],
      drops: [],
      fire: 0,
      spawn: 0.8,
      boss: null,
      bossSpawned: false,
      over: false,
      won: false,
      kills: 0,
      last: "自动射击已开启，移动飞船躲开敌机。",
    };
  }
  function hurt(s) {
    if (s.invulnerable > 0) return;
    if (s.shield) {
      s.shield = 0;
      s.last = "护盾挡住了一次撞击。";
    } else {
      s.lives--;
      s.last = "受到撞击，暂时进入保护状态。";
    }
    s.invulnerable = 1.5;
    if (s.lives <= 0) s.over = true;
  }
  function step(s, dt, input = {}, rng = Math.random) {
    if (s.over || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.05);
    s.time += dt;
    s.invulnerable = Math.max(0, s.invulnerable - dt);
    s.rapid = Math.max(0, s.rapid - dt);
    const target = Number.isFinite(input.targetX) ? input.targetX : s.x;
    s.x = clamp(
      s.x +
        (input.axis
          ? input.axis * 360 * dt
          : clamp(target - s.x, -420 * dt, 420 * dt)),
      30,
      570,
    );
    s.fire -= dt;
    if (s.fire <= 0) {
      s.fire += s.rapid > 0 ? 0.1 : 0.22;
      s.bullets.push({ x: s.x, y: 585 });
      if (s.rapid > 0)
        s.bullets.push({ x: s.x - 16, y: 600 }, { x: s.x + 16, y: 600 });
    }
    const wave = Math.min(3, 1 + Math.floor(s.time / 15));
    s.spawn -= dt;
    if (!s.bossSpawned && s.time >= 45) {
      s.bossSpawned = true;
      s.boss = { x: 300, y: 95, hp: 45, fire: 1 };
      s.last = "旗舰出现！躲开弹幕，击破它。";
    }
    if (s.spawn <= 0 && !s.bossSpawned) {
      s.spawn += Math.max(0.45, 1.05 - wave * 0.15);
      s.enemies.push({
        x: 45 + rng() * 510,
        y: -35,
        hp: wave === 3 ? 2 : 1,
        speed: 75 + wave * 25,
        fire: 1.3 + rng() * 1.5,
      });
    }
    for (const b of s.bullets) b.y -= 620 * dt;
    for (const e of s.enemies) {
      e.y += e.speed * dt;
      e.fire -= dt;
      if (e.fire <= 0 && e.y > 30) {
        e.fire = 2.3;
        s.shots.push({ x: e.x, y: e.y + 15, vx: 0, vy: 220 });
      }
      if (Math.abs(e.x - s.x) < 31 && Math.abs(e.y - 620) < 36) {
        e.dead = true;
        hurt(s);
      }
      if (e.y > 730) {
        e.dead = true;
        hurt(s);
      }
      for (const b of s.bullets)
        if (
          !b.dead &&
          !e.dead &&
          Math.abs(b.x - e.x) < 23 &&
          Math.abs(b.y - e.y) < 23
        ) {
          b.dead = true;
          if (--e.hp <= 0) {
            e.dead = true;
            s.score += 20;
            s.kills++;
            if (s.kills % 5 === 0)
              s.drops.push({
                x: e.x,
                y: e.y,
                type: s.kills % 10 === 0 ? "shield" : "rapid",
              });
          }
        }
    }
    if (s.boss) {
      const boss = s.boss;
      boss.x = 300 + 180 * Math.sin(s.time * 0.8);
      boss.fire -= dt;
      if (boss.fire <= 0) {
        boss.fire = 1;
        for (const vx of [-110, 0, 110])
          s.shots.push({ x: boss.x, y: boss.y + 32, vx, vy: 210 });
      }
      for (const b of s.bullets)
        if (
          !b.dead &&
          Math.abs(b.x - boss.x) < 55 &&
          Math.abs(b.y - boss.y) < 32
        ) {
          b.dead = true;
          boss.hp--;
          s.score += 2;
        }
      if (boss.hp <= 0) {
        s.boss = null;
        s.score += 500;
        s.won = true;
        s.over = true;
        s.last = "旗舰击破，星空航线已畅通！";
      }
    }
    for (const b of s.shots) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (Math.hypot(b.x - s.x, b.y - 620) < 22) {
        b.dead = true;
        hurt(s);
      }
    }
    for (const d of s.drops) {
      d.y += 100 * dt;
      if (Math.hypot(d.x - s.x, d.y - 620) < 32) {
        d.dead = true;
        if (d.type === "shield") s.shield = 1;
        else s.rapid = 7;
        s.last = d.type === "shield" ? "获得一次护盾。" : "获得 7 秒三路速射！";
      }
    }
    s.bullets = s.bullets.filter((b) => !b.dead && b.y > -30);
    s.enemies = s.enemies.filter((e) => !e.dead);
    s.shots = s.shots.filter(
      (b) => !b.dead && b.y < 730 && b.x > -20 && b.x < 620,
    );
    s.drops = s.drops.filter((d) => !d.dead && d.y < 730);
    // Losing the final life takes priority over a simultaneous flagship hit.
    if (s.lives <= 0) s.won = false;
  }
  return { create, step, hurt };
});
