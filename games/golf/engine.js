(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  const R = 10;
  const courses = [
    {
      name: "第一片果岭",
      par: 2,
      start: [300, 570],
      hole: [300, 140],
      walls: [],
      sand: [],
      water: [],
    },
    {
      name: "绕过长廊",
      par: 3,
      start: [120, 560],
      hole: [475, 140],
      walls: [[280, 220, 28, 300]],
      sand: [],
      water: [],
    },
    {
      name: "右侧小径",
      par: 3,
      start: [120, 560],
      hole: [120, 140],
      walls: [[35, 330, 390, 25]],
      sand: [[430, 280, 130, 130]],
      water: [],
    },
    {
      name: "沙地漫步",
      par: 3,
      start: [100, 580],
      hole: [490, 130],
      walls: [
        [180, 115, 25, 290],
        [390, 365, 25, 240],
      ],
      sand: [[235, 270, 115, 180]],
      water: [],
    },
    {
      name: "池塘旁边",
      par: 4,
      start: [110, 580],
      hole: [480, 145],
      walls: [[285, 340, 25, 200]],
      sand: [[380, 480, 145, 90]],
      water: [[60, 255, 145, 135]],
    },
    {
      name: "转角果岭",
      par: 4,
      start: [120, 590],
      hole: [460, 115],
      walls: [
        [35, 435, 350, 25],
        [215, 250, 350, 25],
      ],
      sand: [[400, 455, 130, 100]],
      water: [[50, 75, 115, 100]],
    },
    {
      name: "湖心小桥",
      par: 4,
      start: [110, 590],
      hole: [490, 110],
      walls: [],
      sand: [[395, 150, 110, 60]],
      water: [
        [35, 280, 220, 130],
        [345, 280, 220, 130],
      ],
    },
    {
      name: "三道拱门",
      par: 4,
      start: [110, 600],
      hole: [460, 100],
      walls: [
        [35, 480, 170, 24],
        [310, 480, 255, 24],
        [35, 320, 300, 24],
        [440, 320, 125, 24],
        [35, 170, 170, 24],
        [310, 170, 255, 24],
      ],
      sand: [],
      water: [],
    },
    {
      name: "环绕庭院",
      par: 4,
      start: [290, 590],
      hole: [290, 115],
      walls: [[195, 240, 210, 230]],
      sand: [[425, 300, 95, 110]],
      water: [],
    },
    {
      name: "错落屏风",
      par: 5,
      start: [90, 590],
      hole: [500, 110],
      walls: [
        [170, 35, 24, 390],
        [300, 260, 24, 405],
        [430, 35, 24, 390],
      ],
      sand: [],
      water: [],
    },
    {
      name: "双沙丘",
      par: 4,
      start: [110, 600],
      hole: [480, 110],
      walls: [[260, 300, 24, 200]],
      sand: [
        [70, 330, 120, 140],
        [350, 165, 160, 80],
      ],
      water: [],
    },
    {
      name: "水岸折线",
      par: 5,
      start: [95, 600],
      hole: [480, 105],
      walls: [[35, 430, 325, 22]],
      sand: [],
      water: [
        [410, 260, 155, 115],
        [35, 180, 260, 115],
      ],
    },
    {
      name: "十字花园",
      par: 5,
      start: [120, 580],
      hole: [480, 130],
      walls: [
        [285, 200, 25, 360],
        [150, 350, 300, 25],
      ],
      sand: [[370, 470, 130, 90]],
      water: [],
    },
    {
      name: "外环小路",
      par: 5,
      start: [105, 595],
      hole: [300, 320],
      walls: [
        [185, 180, 24, 360],
        [185, 180, 250, 24],
        [410, 180, 24, 250],
      ],
      sand: [],
      water: [[35, 35, 105, 110]],
    },
    {
      name: "窄桥上的风",
      par: 5,
      start: [110, 600],
      hole: [490, 110],
      walls: [
        [220, 420, 24, 150],
        [355, 120, 24, 130],
      ],
      sand: [],
      water: [
        [35, 280, 240, 110],
        [325, 280, 240, 110],
      ],
    },
    {
      name: "半岛回旋",
      par: 5,
      start: [110, 600],
      hole: [110, 120],
      walls: [
        [220, 480, 24, 100],
        [350, 120, 24, 130],
      ],
      sand: [[410, 440, 110, 100]],
      water: [[35, 250, 345, 150]],
    },
    {
      name: "四折长廊",
      par: 6,
      start: [100, 610],
      hole: [490, 90],
      walls: [
        [35, 515, 370, 20],
        [195, 385, 370, 20],
        [35, 255, 370, 20],
        [195, 125, 370, 20],
      ],
      sand: [],
      water: [],
    },
    {
      name: "果岭大师",
      par: 6,
      start: [90, 610],
      hole: [490, 105],
      walls: [
        [195, 420, 24, 180],
        [340, 230, 24, 260],
        [100, 180, 250, 24],
      ],
      sand: [
        [70, 290, 150, 80],
        [405, 445, 125, 95],
      ],
      water: [
        [270, 535, 120, 100],
        [400, 180, 165, 110],
      ],
    },
  ];
  function create(level = 0) {
    level = Number.isInteger(level)
      ? Math.min(courses.length - 1, Math.max(0, level))
      : 0;
    const course = courses[level];
    return {
      level: Math.min(courses.length - 1, Math.max(0, level)),
      ball: { x: course.start[0], y: course.start[1], vx: 0, vy: 0 },
      angle: 90,
      power: 440,
      strokes: 0,
      totalStrokes: 0,
      score: 0,
      rest: true,
      cleared: false,
      over: false,
      won: false,
      last: "把球送进旗杆下的小洞。停稳后才能再次击球。",
      origin: [...course.start],
    };
  }
  function aim(s, angle, power) {
    if (!s.rest || s.cleared || s.over) return;
    if (Number.isFinite(angle)) s.angle = ((angle % 360) + 360) % 360;
    if (Number.isFinite(power)) s.power = Math.max(80, Math.min(650, power));
  }
  function shoot(s) {
    if (!s.rest || s.cleared || s.over) return false;
    const a = (s.angle * Math.PI) / 180;
    s.ball.vx = Math.cos(a) * s.power;
    s.ball.vy = -Math.sin(a) * s.power;
    s.origin = [s.ball.x, s.ball.y];
    s.strokes++;
    s.totalStrokes++;
    s.score = s.totalStrokes;
    s.rest = false;
    s.last = "小球正在滚动…";
    return true;
  }
  const inRect = (b, r) =>
    b.x > r[0] && b.x < r[0] + r[2] && b.y > r[1] && b.y < r[1] + r[3];
  function bounce(b, rect) {
    const [x, y, w, h] = rect,
      qx = Math.max(x, Math.min(x + w, b.x)),
      qy = Math.max(y, Math.min(y + h, b.y)),
      dx = b.x - qx,
      dy = b.y - qy,
      d = Math.hypot(dx, dy);
    if (d >= R) return;
    let nx, ny;
    if (d > 0) {
      nx = dx / d;
      ny = dy / d;
      b.x = qx + nx * R;
      b.y = qy + ny * R;
    } else {
      const sides = [
        { d: b.x - x, nx: -1, ny: 0 },
        { d: x + w - b.x, nx: 1, ny: 0 },
        { d: b.y - y, nx: 0, ny: -1 },
        { d: y + h - b.y, nx: 0, ny: 1 },
      ].sort((a, b) => a.d - b.d);
      ({ nx, ny } = sides[0]);
      b.x += nx * (sides[0].d + R);
      b.y += ny * (sides[0].d + R);
    }
    const speed = b.vx * nx + b.vy * ny;
    if (speed < 0) {
      b.vx -= 1.78 * speed * nx;
      b.vy -= 1.78 * speed * ny;
    }
  }
  function step(s, dt) {
    if (s.over || s.cleared || s.rest || !Number.isFinite(dt) || dt <= 0)
      return;
    dt = Math.min(dt, 0.02);
    const b = s.ball,
      c = courses[s.level];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    for (const wall of c.walls) bounce(b, wall);
    if (b.x < 35) {
      b.x = 35;
      b.vx = Math.abs(b.vx) * 0.78;
    }
    if (b.x > 565) {
      b.x = 565;
      b.vx = -Math.abs(b.vx) * 0.78;
    }
    if (b.y < 35) {
      b.y = 35;
      b.vy = Math.abs(b.vy) * 0.78;
    }
    if (b.y > 665) {
      b.y = 665;
      b.vy = -Math.abs(b.vy) * 0.78;
    }
    if (c.water.some((r) => inRect(b, r))) {
      [b.x, b.y] = s.origin;
      b.vx = b.vy = 0;
      s.rest = true;
      s.totalStrokes++;
      s.strokes++;
      s.score = s.totalStrokes;
      s.last = "小球落水，罚 1 杆，回到本杆起点。";
      return;
    }
    const speed = Math.hypot(b.vx, b.vy),
      next = Math.max(
        0,
        speed - (c.sand.some((r) => inRect(b, r)) ? 620 : 220) * dt,
      );
    if (speed) {
      b.vx *= next / speed;
      b.vy *= next / speed;
    }
    if (Math.hypot(b.x - c.hole[0], b.y - c.hole[1]) < 15 && next < 180) {
      [b.x, b.y] = c.hole;
      b.vx = b.vy = 0;
      s.rest = true;
      s.cleared = true;
      s.last = `第 ${s.level + 1} 洞完成，用了 ${s.strokes} 杆。`;
      if (s.level === courses.length - 1) {
        s.over = true;
        s.won = true;
      }
      return;
    }
    if (next < 8) {
      b.vx = b.vy = 0;
      s.rest = true;
      s.last = "球已停稳，调整方向，再击一杆。";
    }
  }
  function next(s) {
    if (!s.cleared || s.over) return false;
    const total = s.totalStrokes;
    Object.assign(s, create(s.level + 1), {
      totalStrokes: total,
      score: total,
    });
    return true;
  }
  return { create, aim, shoot, step, next, courses, bounce, inRect, R };
});
