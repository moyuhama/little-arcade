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
  const LEVELS = [
    "热身方阵",
    "斜纹小径",
    "双翼展开",
    "阶梯向上",
    "菱形花窗",
    "左右分营",
    "拱门回声",
    "棋盘节奏",
    "双塔之间",
    "波浪长廊",
    "环形要塞",
    "星光散落",
    "倒悬阶梯",
    "三条航线",
    "风车转角",
    "山谷回音",
    "交织网格",
    "最后屏障",
    "星河之门",
    "满天繁星",
  ];
  const speedFor = (level, mode = "campaign") =>
    mode === "endless"
      ? 285 + 195 * (1 - Math.exp(-(Math.max(1, level) - 1) / 24))
      : 275 + (Math.min(LEVELS.length, Math.max(1, level)) - 1) * 9;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  function bricksFor(level) {
    const rows = 4 + Math.floor((level - 1) / 4);
    const masks = [
      (r, c) => true,
      (r, c) => (r + c) % 3 !== 0,
      (r, c) => c < 3 || c > 4 || r === 0,
      (r, c) => c <= r + 2,
      (r, c) => Math.abs(c - 3.5) + Math.abs(r - (rows - 1) / 2) < 4,
      (r, c) => c !== 3 && c !== 4,
      (r, c) => r < 2 || c < 2 || c > 5,
      (r, c) => (r + c) % 2 === 0,
      (r, c) => c < 2 || c > 5 || r === rows - 1,
      (r, c) => (c + r * 2) % 5 < 3,
      (r, c) => r === 0 || r === rows - 1 || c === 0 || c === 7,
      (r, c) => (c * 3 + r * 5) % 7 < 4,
      (r, c) => c >= r - 1,
      (r, c) => r % 2 === 0 || c === 1 || c === 6,
      (r, c) => (r < rows / 2 && c < 4) || (r >= rows / 2 && c >= 4) || r === 3,
      (r, c) => r >= Math.abs(c - 3.5) - 1,
      (r, c) => c % 3 === 0 || r % 3 === 0,
      (r, c) => r % 3 !== 1 || c === 0 || c === 7,
      (r, c) => r < 2 || c === 1 || c === 6 || r === rows - 1,
      (r, c) => (r + c) % 3 !== 1 || r === rows - 1,
    ];
    return Array.from({ length: rows * 8 }, (_, i) => {
      const row = Math.floor(i / 8),
        col = i % 8;
      const moving = level >= 4 && level % 4 === 0 && row === 1;
      const kind = moving
        ? "moving"
        : level >= 6 && row === 2 && (col === 1 || col === 6)
          ? "steel"
          : level >= 2 && (row * 3 + col + level) % 9 === 0
            ? "bomb"
            : level >= 3 && (row + col) % 4 === 0
              ? "armor"
              : "normal";
      return {
        id: i,
        x: 25 + col * 69,
        baseX: 25 + col * 69,
        y: 66 + row * 30,
        width: 62,
        height: 22,
        alive: masks[level - 1](row, col),
        row,
        kind,
        hp: kind === "armor" ? (level >= 11 ? 3 : 2) : 1,
        maxHp: kind === "armor" ? (level >= 11 ? 3 : 2) : 1,
      };
    });
  }
  // Each run has a seed; rebuilding a checkpoint reproduces exactly the same wave.
  function endlessBricks(wave, seed) {
    let value =
      (seed ^ Math.imul(wave, 0x9e3779b1) ^ Math.floor(wave / 4294967296)) >>>
      0;
    const random = () => {
      value += 0x6d2b79f5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const rows = Math.min(8, 4 + Math.floor((wave - 1) / 5));
    const family = Math.floor(random() * 6),
      shift = Math.floor(random() * 8);
    const movingRow =
      wave >= 4 && wave % 2 === 0 ? Math.floor(random() * rows) : -1;
    const armorRate = Math.min(0.38, 0.1 + wave * 0.008);
    const hp = Math.min(4, 2 + Math.floor(wave / 18));
    const result = [];
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < 8; col++) {
        const patterns = [
          true,
          (row + col + shift) % 3 !== 0,
          col < 3 || col > 4 || row % 3 === 0,
          Math.abs(col - 3.5) + Math.abs(row - (rows - 1) / 2) < 4.5,
          row % 2 === 0 || (col + shift) % 3 === 0,
          (col + row * 2 + shift) % 5 < 3,
        ];
        const alive = random() < 0.13 ? !patterns[family] : patterns[family];
        const roll = random();
        const kind =
          row === movingRow
            ? "moving"
            : wave >= 6 && row === 2 && (col === 1 || col === 6)
              ? "steel"
              : wave >= 2 && roll < 0.15
                ? "bomb"
                : wave >= 3 && roll < 0.15 + armorRate
                  ? "armor"
                  : "normal";
        result.push({
          id: row * 8 + col,
          x: 25 + col * 69,
          baseX: 25 + col * 69,
          y: 66 + row * 30,
          width: 62,
          height: 22,
          row,
          alive,
          kind,
          hp: kind === "armor" ? hp : 1,
          maxHp: kind === "armor" ? hp : 1,
        });
      }
    // Keep a sparse random layout worthwhile and reserve breakable targets.
    let count = result.filter((b) => b.alive && b.kind !== "steel").length;
    for (const b of result)
      if (count < 16 && !b.alive && b.kind !== "steel") {
        b.alive = true;
        count++;
      }
    return result;
  }
  const lifeBonus = (s) =>
    s.mode === "endless" ? (s.level % 5 === 0 ? 1 : 0) : 1;
  const POWERUPS = ["multi", "wide", "laser", "pierce", "slow", "shield"];
  const MAX_BALLS = 5;
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
    y: PADDLE_Y - RADIUS - 2,
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
    const s = {
      level,
      mode,
      seed,
      score: 0,
      lives: 3,
      paddle: 250,
      status: "ready",
      bricks:
        mode === "endless" ? endlessBricks(level, seed) : bricksFor(level),
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
    };
    s.ball = docked(s);
    return s;
  }
  function movePaddle(state, x) {
    if (!Number.isFinite(x)) return state;
    const width = paddleWidth(state),
      paddle = clamp(x - width / 2, 0, WIDTH - width);
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
      ...createGame(state.level + 1, { mode: state.mode, seed: state.seed }),
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
      WIDTH - paddleWidth(s),
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
      y: PADDLE_Y,
    });
  }
  // Public immutable operation also used by deterministic rule tests.
  function collectPower(state, type) {
    if (state.status !== "playing" || !POWERUPS.includes(type)) return state;
    const s = clone(state);
    grant(s, type);
    return s;
  }
  function activateOverdrive(state) {
    if (state.status !== "playing" || state.energy < 100 || state.overdrive > 0)
      return state;
    return {
      ...state,
      energy: 0,
      overdrive: 6,
      events: [{ type: "overdrive", x: 300, y: 400 }],
    };
  }
  function overlaps(ball, b, radius = RADIUS) {
    const x = clamp(ball.x, b.x, b.x + b.width),
      y = clamp(ball.y, b.y, b.y + b.height);
    return (ball.x - x) ** 2 + (ball.y - y) ** 2 <= radius ** 2;
  }
  function damage(s, index, amount = 1) {
    const b = s.bricks[index];
    if (!b.alive || b.kind === "steel") return;
    b.hp = (b.hp ?? 1) - amount;
    if (s.combo) s.comboTime = 4;
    if (b.hp > 0) {
      if (!s.overdrive) s.energy = Math.min(100, s.energy + 1);
      s.events.push({
        type: "armor",
        x: b.x + b.width / 2,
        y: b.y + b.height / 2,
        row: b.row,
      });
      return;
    }
    b.alive = false;
    s.combo++;
    s.comboTime = 4;
    s.bestCombo = Math.max(s.bestCombo, s.combo);
    const points =
      (b.kind === "armor" ? 20 : 10) *
      multiplier(s) *
      (s.overdrive > 0 ? 2 : 1);
    s.score += points;
    s.destroyed++;
    if (!s.overdrive) s.energy = Math.min(100, s.energy + 5);
    const x = b.x + b.width / 2,
      y = b.y + b.height / 2;
    s.events.push({ type: "brick", x, y, row: b.row, kind: b.kind, points });
    // Guaranteed, rotating supplies: the first one appears after three breaks.
    if (s.destroyed >= 3 && (s.destroyed - 3) % 5 === 0 && s.drops.length < 8) {
      const power =
        POWERUPS[
          (Math.floor((s.destroyed - 3) / 5) + s.level - 1) % POWERUPS.length
        ];
      s.drops.push({ x, y, type: power });
    }
    if (b.kind === "bomb") {
      s.events.push({ type: "blast", x, y });
      s.bricks.forEach((other, i) => {
        if (
          other.alive &&
          Math.hypot(
            other.x + other.width / 2 - x,
            other.y + other.height / 2 - y,
          ) <= 100
        )
          damage(s, i, 2);
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
  function tickBall(s, b, dt) {
    const oldX = b.x,
      oldY = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < RADIUS) {
      b.x = RADIUS;
      b.vx = Math.abs(b.vx);
    }
    if (b.x > WIDTH - RADIUS) {
      b.x = WIDTH - RADIUS;
      b.vx = -Math.abs(b.vx);
    }
    if (b.y < RADIUS) {
      b.y = RADIUS;
      b.vy = Math.abs(b.vy);
    }
    const width = paddleWidth(s);
    if (
      b.vy > 0 &&
      oldY + RADIUS <= PADDLE_Y &&
      b.y + RADIUS >= PADDLE_Y &&
      b.x >= s.paddle - RADIUS &&
      b.x <= s.paddle + width + RADIUS
    ) {
      const offset = clamp((b.x - s.paddle - width / 2) / (width / 2), -1, 1),
        angle = (offset * Math.PI) / 3;
      b.vx = Math.sin(angle) * ballSpeed(s);
      b.vy = -Math.cos(angle) * ballSpeed(s);
      b.y = PADDLE_Y - RADIUS;
      s.events.push({ type: "paddle", x: b.x, y: b.y });
    }
    if (
      s.shields > 0 &&
      b.vy > 0 &&
      oldY + RADIUS <= HEIGHT - 16 &&
      b.y + RADIUS >= HEIGHT - 16
    ) {
      b.y = HEIGHT - 16 - RADIUS;
      b.vy = -Math.abs(b.vy);
      s.shields--;
      s.events.push({ type: "save", x: b.x, y: b.y });
    }
    b.contacts = (b.contacts || []).filter(
      (i) => s.bricks[i]?.alive && overlaps(b, s.bricks[i]),
    );
    for (let i = 0; i < s.bricks.length; i++) {
      const brick = s.bricks[i];
      if (!brick.alive || b.contacts.includes(i) || !overlaps(b, brick))
        continue;
      b.contacts.push(i);
      const piercing =
        (s.effects.pierce > 0 || s.overdrive > 0) && brick.kind !== "steel";
      damage(s, i, piercing ? (brick.hp ?? 1) : 1);
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
      for (const b of s.bricks)
        if (b.kind === "moving") b.x = b.baseX + Math.sin(s.time * 1.2) * 16;
      for (const b of balls(s)) tickBall(s, b, delta);
      if (s.effects.laser > 0) {
        s.laserClock -= delta;
        if (s.laserClock <= 0) {
          s.laserClock = 0.35;
          for (const x of [s.paddle + 8, s.paddle + paddleWidth(s) - 8])
            s.shots.push({ x, y: PADDLE_Y - 4 });
        }
      } else s.laserClock = 0;
      for (const shot of s.shots) {
        shot.y -= 650 * delta;
        const index = s.bricks.findIndex(
          (b) => b.alive && overlaps(shot, b, 3),
        );
        if (index >= 0) {
          damage(s, index);
          shot.y = -30;
        }
      }
      s.shots = s.shots.filter((shot) => shot.y > -10);
      const survivors = balls(s).filter((b) => b.y - RADIUS <= HEIGHT);
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
        s.events.push({ type: "lost", x: s.ball.x, y: PADDLE_Y });
      }
      if (s.status !== "playing") break;
      for (const drop of s.drops) {
        const before = drop.y;
        drop.y += 125 * delta;
        if (
          before <= PADDLE_Y + 12 &&
          drop.y + 10 >= PADDLE_Y &&
          drop.x + 16 >= s.paddle &&
          drop.x - 16 <= s.paddle + paddleWidth(s)
        ) {
          grant(s, drop.type);
          drop.y = HEIGHT + 50;
        }
      }
      s.drops = s.drops.filter((d) => d.y < HEIGHT + 20);
    }
    return s;
  }
  return {
    LEVELS,
    endlessBricks,
    lifeBonus,
    POWERUPS,
    MAX_BALLS,
    speedFor,
    bricksFor,
    WIDTH,
    HEIGHT,
    PADDLE_Y,
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
