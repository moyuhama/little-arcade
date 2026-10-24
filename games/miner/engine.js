(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  const targets = [600, 1400, 2400];
  function create(level = 0) {
    const positions = [
        [120, 250],
        [440, 260],
        [280, 330],
        [80, 445],
        [500, 455],
        [190, 510],
        [350, 550],
        [450, 600],
      ],
      types = [
        "gold",
        "gold",
        "rock",
        "diamond",
        "rock",
        "gold",
        "gold",
        "diamond",
      ];
    const items = positions.map(([x, y], i) => {
      const type = types[(i + level * 2) % types.length],
        large = i % 3 === 0;
      return {
        x,
        y,
        type,
        r: type === "rock" ? 32 : type === "diamond" ? 18 : large ? 36 : 23,
        value:
          type === "rock" ? 30 : type === "diamond" ? 400 : large ? 300 : 150,
        weight:
          type === "rock" ? 4.5 : type === "diamond" ? 0.8 : large ? 3 : 1.5,
      };
    });
    return {
      level,
      time: 0,
      swingTime: 0,
      angle: 0,
      length: 48,
      phase: "swing",
      items,
      caught: null,
      score: 0,
      bombs: 2,
      cleared: false,
      over: false,
      won: false,
      last: "看准金块，按空格或“放钩”。石头又重又不值钱。",
    };
  }
  function hook(s) {
    return {
      x: 300 + Math.sin(s.angle) * s.length,
      y: 80 + Math.cos(s.angle) * s.length,
    };
  }
  function grab(s) {
    if (s.over || s.cleared || s.phase !== "swing") return false;
    s.phase = "out";
    s.last = "钩子已经伸出，等待收回。";
    return true;
  }
  function bomb(s) {
    if (s.over || s.cleared || s.phase !== "back" || !s.caught || s.bombs <= 0)
      return false;
    s.bombs--;
    s.caught = null;
    s.last = "重物已丢弃，这次没有得分。";
    return true;
  }
  function step(s, dt) {
    if (s.over || s.cleared || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.03);
    s.time = Math.min(45, s.time + dt);
    if (s.time >= 45) {
      s.over = true;
      s.last = "时间到了，差一点就能达标。";
      return;
    }
    if (s.phase === "swing") {
      s.swingTime += dt;
      s.angle = Math.sin(s.swingTime * 1.35) * 1.08;
    } else if (s.phase === "out") {
      s.length += 320 * dt;
      const p = hook(s),
        index = s.items.findIndex(
          (o) => Math.hypot(o.x - p.x, o.y - p.y) < o.r + 8,
        );
      if (index >= 0) {
        s.caught = s.items.splice(index, 1)[0];
        s.phase = "back";
        s.last = `抓到${s.caught.type === "rock" ? "石头" : s.caught.type === "diamond" ? "宝石" : "金块"}，正在收绳。`;
      } else if (p.x < 25 || p.x > 575 || p.y > 670 || s.length > 610)
        s.phase = "back";
    } else {
      s.length -= (350 * dt) / (s.caught?.weight || 1);
      if (s.length <= 48) {
        s.length = 48;
        if (s.caught) {
          s.score += s.caught.value;
          s.last = `成功收回，+${s.caught.value} 分。`;
          s.caught = null;
        } else s.last = "这次没有带回宝藏，等钩子摆到合适的方向再试。";
        s.phase = "swing";
        if (s.score >= targets[s.level]) {
          s.cleared = true;
          if (s.level === 2) {
            s.over = true;
            s.won = true;
          }
          s.last = "本关目标达成！";
        }
      }
    }
  }
  function next(s) {
    if (!s.cleared || s.over) return false;
    const score = s.score;
    Object.assign(s, create(s.level + 1), { score });
    return true;
  }
  return { create, hook, grab, bomb, step, next, targets };
});
