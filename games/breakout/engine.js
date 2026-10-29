(function (root, factory) {
  const engine = factory();
  if (typeof module === "object" && module.exports) module.exports = engine;
  else root.Breakout = engine;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const WIDTH = 600,
    HEIGHT = 600,
    PADDLE_Y = 548,
    PADDLE_WIDTH = 100,
    RADIUS = 8;
  const CHAPTERS = [
    ["霓虹港湾", "#56d7ff", "打通砖墙，接住第一轮补给"],
    ["棱镜花园", "#77efbd", "留意增生砖上的次数，逐个打开突破口"],
    ["雷光工坊", "#ffe081", "击碎横排连锁砖，整排一起清空"],
    ["流动星河", "#a99aff", "移动砖列改变突破口"],
    ["补给航站", "#ffb775", "补给砖必掉胶囊，球雨追加六球"],
    ["装甲都市", "#8bb9ff", "寻找爆炸砖，瓦解多层装甲"],
    ["回声迷阵", "#ed99e4", "从侧面切入，让球在砖阵内部反弹"],
    ["炽焰熔炉", "#ff987f", "连续引爆，用能量强化贯穿密集砖墙"],
    ["极光回廊", "#7ce4e2", "移动、分裂与横排连锁交错出现"],
    ["星核要塞", "#f6cc83", "突破最后防线，击破移动核心"],
  ];
  const PATTERNS = [
    "满屏方阵",
    "双翼长廊",
    "斜纹阶梯",
    "砖海波浪",
    "钻石回廊",
    "双塔夹道",
    "拱门矩阵",
    "棋盘城墙",
    "环形堡垒",
    "交错织网",
    "星芒花窗",
    "横向断层",
    "回旋通道",
    "三重城门",
    "阶梯山谷",
    "交叉火线",
    "密集蜂巢",
    "倒悬阶梯",
    "棱镜拼图",
    "回声长城",
  ];
  const LEVELS = Array.from({ length: 100 }, (_, i) => {
    const chapter = Math.floor(i / 10),
      stage = i % 10;
    return `${CHAPTERS[chapter][0]} · ${stage === 9 ? "核心守关" : PATTERNS[(chapter * 7 + stage) % PATTERNS.length]}`;
  });
  const speedFor = (level, mode = "campaign") =>
    mode === "endless"
      ? 260 + 280 * (1 - Math.exp(-(Math.max(1, level) - 1) / 55))
      : 240 + (270 * (Math.min(100, Math.max(1, level)) - 1)) / 99;
  const POWER_UNLOCKS = [
    [3, "wide"],
    [6, "slow"],
    [10, "shield"],
    [15, "multi"],
    [22, "laser"],
    [30, "pierce"],
    [40, "rain"],
  ];
  const OVERDRIVE_LEVEL = 20;
  const powersFor = (level) =>
    POWER_UNLOCKS.filter(([at]) => level >= at).map(([, type]) => type);
  const dropPolicy = (level) => ({
    first: level < 20 ? 12 : 10,
    every: level < 20 ? 18 : 16,
    limit: level < 15 ? 2 : 3,
  });
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  function arenaFor(width = WIDTH, height = HEIGHT) {
    const units =
      8 +
      2 *
        Math.floor(
          (clamp(Number.isFinite(width) ? width : WIDTH, WIDTH, 1428) - WIDTH) /
            138,
        );
    return {
      width: WIDTH + (units - 8) * 69,
      height: clamp(
        Math.floor((Number.isFinite(height) ? height : HEIGHT) / 30) * 30,
        HEIGHT,
        840,
      ),
      columns: units * 2,
    };
  }
  const paddleY = (s) => (s.height || HEIGHT) - 52;
  function stageInfo(level, mode = "campaign") {
    const chapter = Math.floor((level - 1) / 10) % CHAPTERS.length;
    const [name, color, hint] = CHAPTERS[chapter];
    return {
      chapter: chapter + 1,
      name,
      color,
      boss: level % 10 === 0,
      hint:
        level % 10 === 0
          ? "核心会移动并加固残存砖块；清掉外围，再击破核心"
          : hint,
      title:
        mode === "endless" ? `第 ${level} 波 · ${name}` : LEVELS[level - 1],
    };
  }
  function randomFor(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6d2b79f5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function layoutFor(level, seed, arena, endless) {
    const columns = arena.columns,
      chapter = Math.floor((level - 1) / 10) % 10;
    const boss = level % 10 === 0;
    const random = randomFor(
      seed ^ Math.imul(level, 0x9e3779b1) ^ Math.floor(level / 4294967296),
    );
    const family = endless
      ? Math.floor(random() * 20)
      : (chapter * 7 + ((level - 1) % 10)) % 20;
    const shift = endless ? Math.floor(random() * columns) : chapter;
    const rows = Math.min(
      13,
      8 +
        Math.floor(chapter / 2) +
        ((level - 1) % 3) +
        Math.floor((arena.height - HEIGHT) / 180),
    );
    const pitch = (arena.width - 50) / columns;
    const result = [];
    const movingRow =
      level >= 16 && level % 4 === 0 ? Math.floor(rows / 2) : -1;
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < columns; col++) {
        const x = (col + 0.5) / columns,
          y = (row + 0.5) / rows,
          c = col + shift;
        const masks = [
          true,
          Math.abs(x - 0.5) > 0.08 || row % 4 === 0,
          (c + row) % 6 !== 0,
          (c + Math.floor(Math.sin(row) * 2)) % 7 !== 0,
          Math.abs(x - 0.5) + Math.abs(y - 0.5) > 0.2,
          Math.abs(x - 0.5) > 0.1 || row % 3 === 0,
          row < 3 || x < 0.38 || x > 0.62,
          Math.floor(c / 2) % 2 === 0 || row % 3 !== 1,
          y < 0.25 || y > 0.75 || x < 0.3 || x > 0.7,
          (c + row * 2) % 5 !== 0,
          Math.abs(x - 0.5) < 0.36 || row % 3 !== 0,
          row % 4 !== 2 || c % 3 !== 1,
          (c + row) % 7 !== 2 && (c - row + columns) % 9 !== 0,
          c % 6 !== 3 || row < 3,
          y > Math.abs(x - 0.5) * 0.8 || row === 0,
          Math.abs(x - y) > 0.09 || row % 3 === 0,
          (c * 3 + row * 5) % 11 > 1,
          y < 0.8 - Math.abs(x - 0.5) || row % 2 === 0,
          (Math.floor(c / 3) + Math.floor(row / 2)) % 4 !== 0,
          row % 3 !== 1 || c % 4 !== 0,
        ];
        let alive = masks[family];
        if (endless && random() < 0.06) alive = !alive;
        const code =
          (row * 17 +
            col * 7 +
            level * 11 +
            (endless ? Math.floor(random() * 79) : 0)) %
          97;
        let kind = row === movingRow ? "moving" : "normal";
        if (row !== movingRow) {
          if (level >= 20 && row === 2 && (col === 1 || col === columns - 2))
            kind = "steel";
          else if (level >= 6 && code % 37 === 0) kind = "bomb";
          else if (level >= 15 && code < 2) kind = "prism";
          else if (level >= 24 && code >= 5 && code < 8) kind = "relay";
          else if (
            level >= 3 &&
            code >= 12 &&
            code < Math.min(40, 20 + chapter * 2)
          )
            kind = "armor";
        }
        const hp =
          kind === "armor" ? Math.min(4, 2 + Math.floor((level - 1) / 30)) : 1;
        result.push({
          id: row * columns + col,
          x: 25 + col * pitch,
          baseX: 25 + col * pitch,
          y: (boss ? 112 : 66) + row * 22,
          width: 30,
          height: 16,
          alive,
          row,
          kind,
          hp,
          maxHp: hp,
          supply: (row + col + level) % 7,
        });
      }
    const minimum = Math.ceil(rows * columns * 0.65);
    let count = result.filter((b) => b.alive && b.kind !== "steel").length;
    for (const b of result)
      if (count < minimum && !b.alive && b.kind !== "steel") {
        b.alive = true;
        count++;
      }
    // Keep special bricks sparse; reserve enough empty slots for all five growth hits.
    const candidates = result
      .filter((b) => b.alive && b.kind === "normal")
      .reverse();
    const growCount = level >= 40 ? 2 : level >= 8 ? 1 : 0;
    for (let i = 0; i < growCount; i++) {
      const b = candidates.splice(
        Math.floor(random() * Math.min(candidates.length, columns * 2)),
        1,
      )[0];
      if (b) Object.assign(b, { kind: "grow", hp: 5, maxHp: 5 });
    }
    const supplyCount = level >= 40 ? 2 : level >= 22 ? 1 : 0;
    for (let i = 0; i < supplyCount; i++) {
      const b = candidates.splice(
        Math.floor(random() * candidates.length),
        1,
      )[0];
      if (b) b.kind = "supply";
    }
    const canGrowAt = (b) =>
      b.row !== movingRow && !["steel", "grow", "core"].includes(b.kind);
    let spaces = result.filter((b) => !b.alive && canGrowAt(b)).length;
    for (const b of candidates) {
      if (spaces >= growCount * 5) break;
      if (canGrowAt(b)) {
        b.alive = false;
        spaces++;
      }
    }
    if (boss) {
      const hp = 8 + Math.min(18, Math.floor(level / 10) * 2);
      result.push({
        id: result.length,
        x: arena.width / 2 - 48,
        baseX: arena.width / 2 - 48,
        y: 64,
        width: 96,
        height: 28,
        row: -1,
        alive: true,
        kind: "core",
        hp,
        maxHp: hp,
      });
    }
    return result;
  }
  const bricksFor = (level, arena = arenaFor()) =>
    layoutFor(level, 5719, arena, false);
  const endlessBricks = (wave, seed, arena = arenaFor()) =>
    layoutFor(wave, seed, arena, true);
  const lifeBonus = (s) =>
    s.mode === "endless" ? (s.level % 5 === 0 ? 1 : 0) : 1;
  const POWERUPS = [
    "multi",
    "wide",
    "laser",
    "pierce",
    "slow",
    "shield",
    "rain",
  ];
  const MAX_BALLS = 16;
  const durations = { wide: 14, laser: 10, pierce: 8, slow: 10 };
  const emptyEffects = () => ({ wide: 0, laser: 0, pierce: 0, slow: 0 });
  const paddleWidth = (s) => (s.effects?.wide > 0 ? 160 : PADDLE_WIDTH);
  const balls = (s) => [s.ball, ...(s.extraBalls || [])];
  const multiplier = (s) =>
    Math.min(5, 1 + Math.floor(Math.max(0, s.combo - 1) / 5));
  const ballSpeed = (s) =>
    speedFor(s.level, s.mode) * (s.effects.slow > 0 ? 0.72 : 1);
  const docked = (s) => ({
    id: 0,
    x: s.paddle + paddleWidth(s) / 2,
    y: paddleY(s) - RADIUS - 2,
    vx: 0,
    vy: 0,
    contacts: [],
  });
  function createGame(level = 1, options = {}) {
    const mode = options.mode === "endless" ? "endless" : "campaign";
    const seed = Number.isInteger(options.seed) ? options.seed >>> 0 : 1;
    level =
      Number.isSafeInteger(level) && level > 0
        ? mode === "endless"
          ? level
          : clamp(level, 1, LEVELS.length)
        : 1;
    const arena = arenaFor(options.width, options.height);
    const s = {
      ...arena,
      level,
      mode,
      seed,
      score: 0,
      lives: 3,
      paddle: (arena.width - PADDLE_WIDTH) / 2,
      status: "ready",
      bricks:
        mode === "endless"
          ? endlessBricks(level, seed, arena)
          : bricksFor(level, arena),
      effects: emptyEffects(),
      extraBalls: [],
      drops: [],
      shots: [],
      events: [],
      combo: 0,
      comboTime: 0,
      bestCombo: 0,
      energy: 0,
      overdrive: 0,
      shields: 0,
      time: 0,
      destroyed: 0,
      nextBallId: 1,
      laserClock: 0,
      coreClock: 5,
      idleTime: 0,
      dropClock: 0,
      growthCount: 0,
    };
    s.ball = docked(s);
    return s;
  }
  function movePaddle(state, x) {
    if (!Number.isFinite(x)) return state;
    const width = paddleWidth(state),
      paddle = clamp(x - width / 2, 0, state.width - width);
    return {
      ...state,
      paddle,
      ball:
        state.status === "ready"
          ? { ...state.ball, x: paddle + width / 2 }
          : state.ball,
    };
  }
  function launch(state) {
    if (state.status !== "ready") return state;
    const speed = ballSpeed(state),
      vx = speed * 0.35;
    return {
      ...state,
      status: "playing",
      events: [],
      ball: { ...state.ball, vx, vy: -Math.sqrt(speed * speed - vx * vx) },
    };
  }
  function advanceLevel(state) {
    if (
      state.status !== "level" ||
      (state.mode !== "endless" && state.level >= LEVELS.length)
    )
      return state;
    return {
      ...createGame(state.level + 1, {
        mode: state.mode,
        seed: state.seed,
        width: state.width,
        height: state.height,
      }),
      lives: Math.min(5, state.lives + lifeBonus(state)),
      score: state.score,
      energy: state.energy,
      bestCombo: state.bestCombo,
    };
  }
  function clone(state) {
    return {
      ...state,
      effects: { ...state.effects },
      ball: { ...state.ball, contacts: [...(state.ball.contacts || [])] },
      extraBalls: state.extraBalls.map((b) => ({
        ...b,
        contacts: [...(b.contacts || [])],
      })),
      bricks: state.bricks.map((b) => ({ ...b })),
      drops: state.drops.map((d) => ({ ...d })),
      shots: state.shots.map((s) => ({ ...s })),
      events: [],
    };
  }
  function normalizeBall(b, speed) {
    const old = Math.hypot(b.vx, b.vy) || speed;
    b.vx = (b.vx / old) * speed;
    b.vy = (b.vy / old) * speed;
  }
  function setWidth(s, before) {
    s.paddle = clamp(
      s.paddle + (before - paddleWidth(s)) / 2,
      0,
      s.width - paddleWidth(s),
    );
  }
  function grant(s, type) {
    if (type === "multi") {
      const source = [...balls(s)].sort((a, b) => a.y - b.y)[0];
      const speed = ballSpeed(s),
        angle = Math.atan2(source.vx, Math.abs(source.vy));
      for (const shift of [-0.52, 0.52]) {
        if (balls(s).length >= MAX_BALLS) break;
        const a = clamp(angle + shift, -1.05, 1.05);
        s.extraBalls.push({
          ...source,
          id: s.nextBallId++,
          vx: Math.sin(a) * speed,
          vy: -Math.cos(a) * speed,
          contacts: [...(source.contacts || [])],
        });
      }
    } else if (type === "rain") {
      spawnFan(s, s.paddle + paddleWidth(s) / 2, paddleY(s) - RADIUS - 4, 6);
    } else if (type === "shield") s.shields = Math.min(3, s.shields + 1);
    else if (durations[type]) {
      const before = paddleWidth(s);
      s.effects[type] = durations[type];
      if (type === "wide") setWidth(s, before);
      if (type === "slow")
        balls(s).forEach((b) => normalizeBall(b, ballSpeed(s)));
    }
    s.events.push({
      type: "power",
      power: type,
      x: s.paddle + paddleWidth(s) / 2,
      y: paddleY(s),
    });
  }
  function spawnFan(s, x, y, count) {
    const speed = ballSpeed(s);
    for (let i = 0; i < count && balls(s).length < MAX_BALLS; i++) {
      const angle = -0.9 + ((i + 0.5) / count) * 1.8;
      s.extraBalls.push({
        id: s.nextBallId++,
        x,
        y,
        vx: Math.sin(angle) * speed,
        vy: -Math.cos(angle) * speed,
        contacts: [],
      });
    }
  }
  // Public immutable operation also used by deterministic rule tests.
  function collectPower(state, type) {
    if (state.status !== "playing" || !POWERUPS.includes(type)) return state;
    const s = clone(state);
    grant(s, type);
    return s;
  }
  function activateOverdrive(state) {
    if (
      state.status !== "playing" ||
      state.level < OVERDRIVE_LEVEL ||
      state.energy < 100 ||
      state.overdrive > 0
    )
      return state;
    return {
      ...state,
      energy: 0,
      overdrive: 6,
      events: [
        { type: "overdrive", x: state.width / 2, y: state.height - 200 },
      ],
    };
  }
  function overlaps(ball, b, radius = RADIUS) {
    const x = clamp(ball.x, b.x, b.x + b.width),
      y = clamp(ball.y, b.y, b.y + b.height);
    return (ball.x - x) ** 2 + (ball.y - y) ** 2 <= radius ** 2;
  }
  function growBrick(s, source) {
    const movingRows = new Set(
      s.bricks.filter((b) => b.kind === "moving").map((b) => b.row),
    );
    const spaces = s.bricks.filter(
      (b) =>
        !b.alive &&
        b.row >= 0 &&
        !movingRows.has(b.row) &&
        !["steel", "grow", "core"].includes(b.kind),
    );
    if (!spaces.length) return false;
    const random = randomFor(
      s.seed ^
        Math.imul(s.level, 0x9e3779b1) ^
        Math.imul(s.growthCount + 1, 0x85ebca6b) ^
        source.id,
    );
    const clear = spaces.filter((b) =>
      balls(s).every((ball) => !overlaps(ball, b, RADIUS + 4)),
    );
    const pool = clear.length ? clear : spaces;
    const b = pool[Math.floor(random() * pool.length)];
    Object.assign(b, {
      kind: "normal",
      hp: 1,
      maxHp: 1,
      alive: true,
      grown: true,
      materialize: 0.25,
    });
    s.growthCount++;
    s.events.push({
      type: "grow",
      x: b.x + b.width / 2,
      y: b.y + b.height / 2,
      remaining: source.hp - 1,
    });
    return true;
  }
  function damage(s, index, amount = 1, growthHits = new Set()) {
    const b = s.bricks[index];
    if (!b.alive || b.kind === "steel" || b.materialize > 0) return;
    if (b.kind === "grow") {
      if (growthHits.has(index) || !growBrick(s, b)) return;
      growthHits.add(index);
      amount = 1;
    }
    b.hp = (b.hp ?? 1) - amount;
    if (s.combo) s.comboTime = 4;
    if (b.hp > 0) {
      if (!s.overdrive && s.level >= OVERDRIVE_LEVEL)
        s.energy = Math.min(100, s.energy + 1);
      s.events.push({
        type: "armor",
        x: b.x + b.width / 2,
        y: b.y + b.height / 2,
        row: b.row,
      });
      return;
    }
    b.alive = false;
    s.idleTime = 0;
    s.combo++;
    s.comboTime = 4;
    s.bestCombo = Math.max(s.bestCombo, s.combo);
    const points =
      (b.kind === "core" ? 300 : b.kind === "armor" ? 20 : 10) *
      multiplier(s) *
      (s.overdrive > 0 ? 2 : 1);
    s.score += points;
    s.destroyed++;
    if (!s.overdrive && s.level >= OVERDRIVE_LEVEL)
      s.energy = Math.min(100, s.energy + 5);
    const x = b.x + b.width / 2,
      y = b.y + b.height / 2;
    s.events.push({ type: "brick", x, y, row: b.row, kind: b.kind, points });
    const pool = powersFor(s.level),
      policy = dropPolicy(s.level);
    // All sources use the unlocked pool. Ordinary drops are spaced in bricks and time.
    if (
      pool.length &&
      (b.kind === "supply" ||
        (s.dropClock <= 0 &&
          s.destroyed >= policy.first &&
          (s.destroyed - policy.first) % policy.every === 0)) &&
      s.drops.length < policy.limit
    ) {
      const power =
        pool[
          b.kind === "supply"
            ? (b.supply || 0) % pool.length
            : Math.floor((s.destroyed - policy.first) / policy.every) %
              pool.length
        ];
      s.drops.push({ x, y, type: power });
      s.dropClock = 6;
    }
    if (b.kind === "prism") {
      spawnFan(s, x, y - RADIUS, 2);
      s.events.push({ type: "split", x, y });
    }
    if (b.kind === "relay") {
      s.events.push({ type: "relay", x, y });
      s.bricks.forEach((other, i) => {
        if (other.alive && other.row === b.row && other.kind !== "core")
          damage(s, i, other.hp || 1, growthHits);
      });
    }
    if (b.kind === "bomb") {
      s.events.push({ type: "blast", x, y });
      s.bricks.forEach((other, i) => {
        if (
          other.alive &&
          Math.hypot(
            other.x + other.width / 2 - x,
            other.y + other.height / 2 - y,
          ) <= 74
        )
          damage(s, i, 2, growthHits);
      });
    }
  }
  function reflect(b, brick, oldX, oldY) {
    if (oldY + RADIUS <= brick.y && b.vy > 0) {
      b.y = brick.y - RADIUS;
      b.vy = -Math.abs(b.vy);
    } else if (oldY - RADIUS >= brick.y + brick.height && b.vy < 0) {
      b.y = brick.y + brick.height + RADIUS;
      b.vy = Math.abs(b.vy);
    } else if (oldX < brick.x) {
      b.x = brick.x - RADIUS;
      b.vx = -Math.abs(b.vx);
    } else {
      b.x = brick.x + brick.width + RADIUS;
      b.vx = Math.abs(b.vx);
    }
  }
  function aimCleanup(s, ball, targets) {
    const steel = s.bricks.filter((b) => b.alive && b.kind === "steel");
    const span = s.width - RADIUS * 2;
    const foldX = (x) => {
      const wrapped = (((x - RADIUS) % (span * 2)) + span * 2) % (span * 2);
      return RADIUS + (wrapped > span ? span * 2 - wrapped : wrapped);
    };
    const paths = [];
    for (const target of targets) {
      const tx = target.x + target.width / 2,
        ty = target.y + target.height / 2;
      for (const x of [
        tx,
        RADIUS * 2 - tx,
        (s.width - RADIUS) * 2 - tx,
        tx - span * 2,
        tx + span * 2,
      ])
        for (const y of [ty, RADIUS * 2 - ty]) {
          const dx = x - ball.x,
            dy = y - ball.y,
            distance = Math.hypot(dx, dy);
          if (dy < 0 && -dy / distance >= 0.3) paths.push({ dx, dy, distance });
        }
    }
    paths.sort((a, b) => a.distance - b.distance);
    for (const path of paths) {
      let blocked = false;
      const steps = Math.ceil(path.distance / 6);
      for (let i = 1; i <= steps && !blocked; i++) {
        const y = ball.y + (path.dy * i) / steps;
        const point = {
          x: foldX(ball.x + (path.dx * i) / steps),
          y: y < RADIUS ? RADIUS * 2 - y : y,
        };
        blocked = steel.some((b) => overlaps(point, b));
      }
      if (!blocked) {
        ball.vx = path.dx;
        ball.vy = path.dy;
        normalizeBall(ball, ballSpeed(s));
        return;
      }
    }
  }
  function tickBall(s, b, dt) {
    const oldX = b.x,
      oldY = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < RADIUS) {
      b.x = RADIUS;
      b.vx = Math.abs(b.vx);
    }
    if (b.x > s.width - RADIUS) {
      b.x = s.width - RADIUS;
      b.vx = -Math.abs(b.vx);
    }
    if (b.y < RADIUS) {
      b.y = RADIUS;
      b.vy = Math.abs(b.vy);
    }
    const width = paddleWidth(s);
    if (
      b.vy > 0 &&
      oldY + RADIUS <= paddleY(s) &&
      b.y + RADIUS >= paddleY(s) &&
      b.x >= s.paddle - RADIUS &&
      b.x <= s.paddle + width + RADIUS
    ) {
      const offset = clamp((b.x - s.paddle - width / 2) / (width / 2), -1, 1),
        angle = (offset * Math.PI) / 3;
      b.vx = Math.sin(angle) * ballSpeed(s);
      b.vy = -Math.cos(angle) * ballSpeed(s);
      b.y = paddleY(s) - RADIUS;
      const targets = s.bricks.filter(
        (brick) => brick.alive && brick.kind !== "steel",
      );
      if (s.time > 15 && targets.length <= 6 && targets.length > 0) {
        aimCleanup(s, b, targets);
      }
      s.events.push({ type: "paddle", x: b.x, y: b.y });
    }
    if (
      s.shields > 0 &&
      b.vy > 0 &&
      oldY + RADIUS <= s.height - 16 &&
      b.y + RADIUS >= s.height - 16
    ) {
      b.y = s.height - 16 - RADIUS;
      b.vy = -Math.abs(b.vy);
      s.shields--;
      s.events.push({ type: "save", x: b.x, y: b.y });
    }
    b.contacts = (b.contacts || []).filter(
      (i) => s.bricks[i]?.alive && overlaps(b, s.bricks[i]),
    );
    for (let i = 0; i < s.bricks.length; i++) {
      const brick = s.bricks[i];
      if (
        !brick.alive ||
        brick.materialize > 0 ||
        b.contacts.includes(i) ||
        !overlaps(b, brick)
      )
        continue;
      b.contacts.push(i);
      const piercing =
        (s.effects.pierce > 0 || s.overdrive > 0) &&
        brick.kind !== "steel" &&
        brick.kind !== "core" &&
        brick.kind !== "grow";
      damage(
        s,
        i,
        brick.kind === "core" && s.overdrive > 0
          ? 2
          : piercing
            ? (brick.hp ?? 1)
            : 1,
      );
      if (!piercing) {
        reflect(b, brick, oldX, oldY);
        break;
      }
    }
  }
  function step(state, dt) {
    if (state.status !== "playing" || !Number.isFinite(dt) || dt <= 0)
      return state;
    const s = clone(state);
    let remaining = Math.min(dt, 0.1);
    while (remaining > 0 && s.status === "playing") {
      const delta = Math.min(remaining, 1 / 240);
      remaining -= delta;
      s.time += delta;
      s.idleTime = (s.idleTime || 0) + delta;
      s.dropClock = Math.max(0, (s.dropClock || 0) - delta);
      const oldWidth = paddleWidth(s),
        oldSlow = s.effects.slow;
      for (const key of Object.keys(s.effects))
        s.effects[key] = Math.max(0, s.effects[key] - delta);
      if (oldWidth !== paddleWidth(s)) setWidth(s, oldWidth);
      if (oldSlow > 0 && !s.effects.slow)
        balls(s).forEach((b) => normalizeBall(b, ballSpeed(s)));
      s.overdrive = Math.max(0, s.overdrive - delta);
      s.comboTime = Math.max(0, s.comboTime - delta);
      if (!s.comboTime) s.combo = 0;
      for (const b of s.bricks) {
        if (b.materialize > 0)
          b.materialize = Math.max(0, b.materialize - delta);
        if (b.kind === "moving") b.x = b.baseX + Math.sin(s.time * 1.2) * 16;
      }
      const core = s.bricks.find((b) => b.kind === "core" && b.alive);
      if (core) {
        const enraged = core.hp <= core.maxHp / 2;
        core.x =
          core.baseX +
          Math.sin(s.time * (enraged ? 1.8 : 1.1)) * (enraged ? 100 : 70);
        s.coreClock -= delta;
        if (s.coreClock <= 0) {
          s.coreClock = enraged ? 5 : 7;
          const guards = s.bricks
            .filter((b) => b.alive && b.kind === "normal")
            .slice(0, enraged ? 3 : 2);
          for (const guard of guards) {
            guard.kind = "armor";
            guard.hp = 2;
            guard.maxHp = 2;
          }
          if (guards.length)
            s.events.push({
              type: "fortify",
              x: core.x + core.width / 2,
              y: core.y,
            });
        }
      }
      for (const b of balls(s)) tickBall(s, b, delta);
      if (s.effects.laser > 0) {
        s.laserClock -= delta;
        if (s.laserClock <= 0) {
          s.laserClock = 0.35;
          for (const x of [s.paddle + 8, s.paddle + paddleWidth(s) - 8])
            s.shots.push({ x, y: paddleY(s) - 4 });
        }
      } else s.laserClock = 0;
      for (const shot of s.shots) {
        shot.y -= 650 * delta;
        const index = s.bricks.findIndex(
          (b) => b.alive && !(b.materialize > 0) && overlaps(shot, b, 3),
        );
        if (index >= 0) {
          damage(s, index);
          shot.y = -30;
        }
      }
      s.shots = s.shots.filter((shot) => shot.y > -10);
      const survivors = balls(s).filter((b) => b.y - RADIUS <= s.height);
      if (survivors.length) {
        s.ball = survivors[0];
        s.extraBalls = survivors.slice(1);
      }
      // Once the final ball is gone, a late pickup cannot resurrect it.
      if (s.bricks.every((b) => !b.alive || b.kind === "steel")) {
        s.status =
          s.mode !== "endless" && s.level === LEVELS.length ? "won" : "level";
      } else if (!survivors.length) {
        s.lives--;
        s.status = s.lives > 0 ? "ready" : "lost";
        const before = paddleWidth(s);
        s.effects = emptyEffects();
        setWidth(s, before);
        s.extraBalls = [];
        s.drops = [];
        s.shots = [];
        s.shields = 0;
        s.overdrive = 0;
        s.combo = 0;
        s.comboTime = 0;
        s.ball = docked(s);
        s.events.push({ type: "lost", x: s.ball.x, y: paddleY(s) });
      }
      if (s.status !== "playing") break;
      if (
        s.level >= 22 &&
        s.idleTime >= 18 &&
        s.dropClock <= 0 &&
        s.drops.length < dropPolicy(s.level).limit
      ) {
        s.idleTime = 0;
        s.dropClock = 6;
        s.drops.push({
          x: s.paddle + paddleWidth(s) / 2,
          y: Math.min(320, paddleY(s) - 160),
          type: "laser",
        });
        s.events.push({
          type: "resupply",
          x: s.paddle + paddleWidth(s) / 2,
          y: paddleY(s) - 160,
        });
      }
      for (const drop of s.drops) {
        const before = drop.y;
        drop.y += 125 * delta;
        if (
          before <= paddleY(s) + 12 &&
          drop.y + 10 >= paddleY(s) &&
          drop.x + 16 >= s.paddle &&
          drop.x - 16 <= s.paddle + paddleWidth(s)
        ) {
          grant(s, drop.type);
          drop.y = s.height + 50;
        }
      }
      s.drops = s.drops.filter((d) => d.y < s.height + 20);
    }
    return s;
  }
  return {
    LEVELS,
    CHAPTERS,
    stageInfo,
    endlessBricks,
    lifeBonus,
    POWERUPS,
    POWER_UNLOCKS,
    OVERDRIVE_LEVEL,
    powersFor,
    MAX_BALLS,
    speedFor,
    bricksFor,
    WIDTH,
    HEIGHT,
    PADDLE_Y,
    paddleY,
    arenaFor,
    PADDLE_WIDTH,
    RADIUS,
    createGame,
    movePaddle,
    launch,
    advanceLevel,
    step,
    paddleWidth,
    balls,
    multiplier,
    collectPower,
    activateOverdrive,
  };
});
