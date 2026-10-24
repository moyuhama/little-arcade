(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  const R = 28,
    DY = Math.sqrt(3) * R,
    DX = R * 2,
    ROWS = 11;
  const columns = (r) => (r % 2 ? 8 : 9);
  const point = (r, c, ceiling = 0) => ({
    x: 76 + c * DX + (r % 2 ? R : 0),
    y: 55 + r * DY + ceiling,
  });
  const valid = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < columns(r);
  function neighbors(r, c) {
    const p = point(r, c),
      out = [];
    for (let y = Math.max(0, r - 1); y <= Math.min(ROWS - 1, r + 1); y++)
      for (let x = 0; x < columns(y); x++) {
        const q = point(y, x);
        if ((x !== c || y !== r) && Math.hypot(p.x - q.x, p.y - q.y) < DX + 1)
          out.push([y, x]);
      }
    return out;
  }
  const colors = (s) => [...new Set(s.grid.flat().filter((v) => v !== null))];
  const pick = (s, rng) => {
    const options = colors(s);
    return options[Math.floor(rng() * options.length)] ?? 0;
  };
  function create(rng = Math.random) {
    const s = {
      grid: Array.from({ length: ROWS }, (_, r) =>
        Array(columns(r)).fill(null),
      ),
      ceiling: 0,
      angle: 90,
      shot: null,
      score: 0,
      shots: 0,
      misses: 0,
      over: false,
      won: false,
      last: "瞄准同色泡泡，三个相连就能消除。",
    };
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < columns(r); c++) s.grid[r][c] = Math.floor(rng() * 4);
    s.current = pick(s, rng);
    s.next = pick(s, rng);
    return s;
  }
  function aim(s, degrees) {
    if (!s.over && !s.shot && Number.isFinite(degrees))
      s.angle = Math.max(15, Math.min(165, degrees));
  }
  function shoot(s) {
    if (s.over || s.shot) return false;
    const a = (s.angle * Math.PI) / 180;
    s.shot = {
      x: 300,
      y: 640,
      vx: Math.cos(a) * 640,
      vy: -Math.sin(a) * 640,
      color: s.current,
    };
    s.shots++;
    return true;
  }
  function connected(s, r, c, color) {
    const found = new Set(),
      queue = [[r, c]];
    while (queue.length) {
      const [y, x] = queue.pop(),
        key = y + "," + x;
      if (found.has(key) || s.grid[y][x] !== color) continue;
      found.add(key);
      queue.push(...neighbors(y, x));
    }
    return [...found].map((k) => k.split(",").map(Number));
  }
  function settle(s, hit, rng = Math.random) {
    const shot = s.shot;
    if (!shot) return;
    let slots = hit
      ? neighbors(hit[0], hit[1])
      : Array.from({ length: columns(0) }, (_, c) => [0, c]);
    slots = slots
      .filter(([r, c]) => s.grid[r][c] === null)
      .sort((a, b) => {
        const p = point(...a, s.ceiling),
          q = point(...b, s.ceiling);
        return (
          Math.hypot(p.x - shot.x, p.y - shot.y) -
          Math.hypot(q.x - shot.x, q.y - shot.y)
        );
      });
    s.shot = null;
    if (!slots.length) {
      s.over = true;
      s.last = "没有空位可以接住泡泡了。";
      return;
    }
    const [r, c] = slots[0];
    s.grid[r][c] = shot.color;
    const group = connected(s, r, c, shot.color);
    if (group.length >= 3) {
      group.forEach(([y, x]) => (s.grid[y][x] = null));
      const anchored = new Set(),
        queue = s.grid[0].flatMap((v, x) => (v !== null ? [[0, x]] : []));
      while (queue.length) {
        const [y, x] = queue.pop(),
          key = y + "," + x;
        if (anchored.has(key) || s.grid[y][x] === null) continue;
        anchored.add(key);
        queue.push(...neighbors(y, x));
      }
      let fallen = 0;
      s.grid.forEach((row, y) =>
        row.forEach((v, x) => {
          if (v !== null && !anchored.has(y + "," + x)) {
            s.grid[y][x] = null;
            fallen++;
          }
        }),
      );
      s.score += group.length * 10 + fallen * 20;
      s.misses = 0;
      s.last = `消除 ${group.length} 个，掉落 ${fallen} 个！`;
    } else {
      if (++s.misses === 5) {
        s.ceiling += 28;
        s.misses = 0;
        s.last = "连续五次未消除，顶部下降了一格。";
      } else
        s.last = `还差同色伙伴。再有 ${5 - s.misses} 次未消除，顶部会下降。`;
    }
    if (!colors(s).length) {
      s.over = true;
      s.won = true;
      s.last = "泡泡全部清空！";
    } else if (
      s.grid.some((row, y) =>
        row.some((v, x) => v !== null && point(y, x, s.ceiling).y + R >= 590),
      )
    ) {
      s.over = true;
      s.last = "泡泡碰到警戒线了。";
    }
    s.current = colors(s).includes(s.next) ? s.next : pick(s, rng);
    s.next = pick(s, rng);
  }
  function step(s, dt, input = {}, rng = Math.random) {
    if (s.over || !s.shot || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.05);
    const p = s.shot;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x < 44) {
      p.x = 88 - p.x;
      p.vx = Math.abs(p.vx);
    }
    if (p.x > 556) {
      p.x = 1112 - p.x;
      p.vx = -Math.abs(p.vx);
    }
    if (p.y <= 55 + s.ceiling) {
      settle(s, null, rng);
      return;
    }
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < columns(r); c++)
        if (s.grid[r][c] !== null) {
          const q = point(r, c, s.ceiling);
          if (Math.hypot(q.x - p.x, q.y - p.y) <= R * 2 - 1) {
            settle(s, [r, c], rng);
            return;
          }
        }
  }
  function trajectory(s) {
    const a = (s.angle * Math.PI) / 180,
      p = { x: 300, y: 640 },
      v = { x: Math.cos(a), y: -Math.sin(a) },
      out = [];
    for (let i = 0; i < 120; i++) {
      p.x += v.x * 8;
      p.y += v.y * 8;
      if (p.x < 44 || p.x > 556) {
        p.x = p.x < 44 ? 88 - p.x : 1112 - p.x;
        v.x = -v.x;
      }
      out.push({ ...p });
      if (
        p.y <= 55 + s.ceiling ||
        s.grid.some((row, r) =>
          row.some((c, x) => {
            const q = point(r, x, s.ceiling);
            return c !== null && Math.hypot(q.x - p.x, q.y - p.y) < R * 2;
          }),
        )
      )
        break;
    }
    return out;
  }
  return {
    create,
    aim,
    shoot,
    step,
    point,
    neighbors,
    settle,
    trajectory,
    R,
    ROWS,
  };
});
