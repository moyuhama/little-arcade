(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function create() {
    return {
      time: 0,
      score: 0,
      streak: 0,
      made: 0,
      shots: 0,
      angle: 80,
      power: 660,
      hoop: { x: 450, y: 340 },
      ball: null,
      over: false,
      won: false,
      last: "拖动篮球向后蓄力，松手投出；也可调节角度、力度后点投篮。",
    };
  }
  function aim(s, angle, power) {
    if (s.over || s.ball) return;
    if (Number.isFinite(angle)) s.angle = clamp(angle, 35, 145);
    if (Number.isFinite(power)) s.power = clamp(power, 460, 900);
  }
  function shoot(s) {
    if (s.over || s.ball) return false;
    const a = (s.angle * Math.PI) / 180;
    s.ball = {
      x: 300,
      y: 610,
      vx: Math.cos(a) * s.power,
      vy: -Math.sin(a) * s.power,
      age: 0,
      scored: false,
    };
    s.shots++;
    return true;
  }
  function rim(b, x, y) {
    const dx = b.x - x,
      dy = b.y - y,
      d = Math.hypot(dx, dy),
      radius = 19;
    if (d >= radius) return;
    const nx = d ? dx / d : 0,
      ny = d ? dy / d : -1;
    b.x = x + nx * radius;
    b.y = y + ny * radius;
    const v = b.vx * nx + b.vy * ny;
    if (v < 0) {
      b.vx -= 1.65 * v * nx;
      b.vy -= 1.65 * v * ny;
    }
  }
  function step(s, dt) {
    if (s.over || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.03);
    s.time = Math.min(60, s.time + dt);
    if (s.time >= 60) {
      s.over = true;
      s.last = `时间到，投中 ${s.made} 球！`;
      return;
    }
    const b = s.ball;
    if (!b) return;
    const previousY = b.y;
    b.age += dt;
    b.vy += 680 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    const h = s.hoop;
    if (
      !b.scored &&
      b.vy > 0 &&
      previousY < h.y &&
      b.y >= h.y &&
      Math.abs(b.x - h.x) < 29
    ) {
      b.scored = true;
      b.finish = b.age + 0.65;
      s.streak++;
      s.made++;
      const points = 2 + Math.min(3, s.streak - 1);
      s.score += points;
      s.last = `空心入网！连续 ${s.streak} 球，本球 +${points} 分。`;
    }
    if (!b.scored) {
      rim(b, h.x - 42, h.y);
      rim(b, h.x + 42, h.y);
      const side = h.x > 300 ? 1 : -1,
        boardX = h.x + side * 59;
      if (b.y > h.y - 110 && b.y < h.y + 8 && Math.abs(b.x - boardX) < 17) {
        b.x = boardX - side * 17;
        b.vx = -side * Math.abs(b.vx) * 0.72;
      }
    }
    if (
      b.y > 740 ||
      b.x < -100 ||
      b.x > 700 ||
      b.age > 4 ||
      (b.scored && b.age > b.finish)
    ) {
      if (!b.scored) {
        s.streak = 0;
        s.last = "差一点点，调整角度和力度再来。";
      } else {
        s.hoop.x =
          s.made % 2 ? 125 + ((s.made * 17) % 80) : 395 + ((s.made * 23) % 80);
        s.hoop.y = 300 + (s.made % 3) * 35;
        s.angle = s.hoop.x > 300 ? 80 : 100;
      }
      s.ball = null;
    }
  }
  return { create, aim, shoot, step, rim };
});
