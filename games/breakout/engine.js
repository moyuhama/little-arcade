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
  const speedFor = (level) =>
    275 + (Math.min(LEVELS.length, Math.max(1, level)) - 1) * 9;
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
      return {
        x: 25 + col * 69,
        y: 66 + row * 30,
        width: 62,
        height: 22,
        alive: masks[level - 1](row, col),
        row,
      };
    });
  }
  function createGame(level = 1) {
    level = Number.isInteger(level) ? clamp(level, 1, LEVELS.length) : 1;
    return {
      level,
      score: 0,
      lives: 3,
      paddle: 250,
      ball: { x: 300, y: PADDLE_Y - RADIUS - 2, vx: 0, vy: 0 },
      status: "ready",
      bricks: bricksFor(level),
    };
  }
  function movePaddle(state, x) {
    const paddle = clamp(x - PADDLE_WIDTH / 2, 0, WIDTH - PADDLE_WIDTH);
    return {
      ...state,
      paddle,
      ball:
        state.status === "ready"
          ? { ...state.ball, x: paddle + PADDLE_WIDTH / 2 }
          : state.ball,
    };
  }
  function launch(state) {
    if (state.status !== "ready") return state;
    const speed = speedFor(state.level),
      vx = speed * 0.35;
    return {
      ...state,
      status: "playing",
      ball: { ...state.ball, vx, vy: -Math.sqrt(speed * speed - vx * vx) },
    };
  }
  function advanceLevel(state) {
    if (state.status !== "level") return state;
    return {
      ...state,
      level: state.level + 1,
      lives: Math.min(5, state.lives + 1),
      status: "ready",
      bricks: bricksFor(state.level + 1),
      ball: {
        x: state.paddle + PADDLE_WIDTH / 2,
        y: PADDLE_Y - RADIUS - 2,
        vx: 0,
        vy: 0,
      },
    };
  }
  function step(state, dt) {
    if (state.status !== "playing" || !Number.isFinite(dt) || dt <= 0)
      return state;
    const next = {
      ...state,
      ball: { ...state.ball },
      bricks: state.bricks.map((brick) => ({ ...brick })),
    };
    // Small integration steps prevent tunneling through a brick after a slow frame.
    let remaining = Math.min(dt, 0.1);
    while (remaining > 0 && next.status === "playing") {
      const delta = Math.min(remaining, 1 / 240);
      remaining -= delta;
      const ball = next.ball,
        oldX = ball.x,
        oldY = ball.y;
      ball.x += ball.vx * delta;
      ball.y += ball.vy * delta;
      if (ball.x < RADIUS) {
        ball.x = RADIUS;
        ball.vx = Math.abs(ball.vx);
      }
      if (ball.x > WIDTH - RADIUS) {
        ball.x = WIDTH - RADIUS;
        ball.vx = -Math.abs(ball.vx);
      }
      if (ball.y < RADIUS) {
        ball.y = RADIUS;
        ball.vy = Math.abs(ball.vy);
      }
      if (
        ball.vy > 0 &&
        oldY + RADIUS <= PADDLE_Y &&
        ball.y + RADIUS >= PADDLE_Y &&
        ball.x >= next.paddle - RADIUS &&
        ball.x <= next.paddle + PADDLE_WIDTH + RADIUS
      ) {
        const offset = clamp(
          (ball.x - next.paddle - PADDLE_WIDTH / 2) / (PADDLE_WIDTH / 2),
          -1,
          1,
        );
        const speed = speedFor(next.level),
          angle = (offset * Math.PI) / 3;
        ball.vx = Math.sin(angle) * speed;
        ball.vy = -Math.cos(angle) * speed;
        ball.y = PADDLE_Y - RADIUS;
      }
      for (const brick of next.bricks) {
        if (!brick.alive) continue;
        const nearX = clamp(ball.x, brick.x, brick.x + brick.width),
          nearY = clamp(ball.y, brick.y, brick.y + brick.height);
        if ((ball.x - nearX) ** 2 + (ball.y - nearY) ** 2 > RADIUS ** 2)
          continue;
        brick.alive = false;
        next.score += 10;
        if (oldY + RADIUS <= brick.y && ball.vy > 0) {
          ball.y = brick.y - RADIUS;
          ball.vy = -Math.abs(ball.vy);
        } else if (oldY - RADIUS >= brick.y + brick.height && ball.vy < 0) {
          ball.y = brick.y + brick.height + RADIUS;
          ball.vy = Math.abs(ball.vy);
        } else if (oldX < brick.x) {
          ball.x = brick.x - RADIUS;
          ball.vx = -Math.abs(ball.vx);
        } else {
          ball.x = brick.x + brick.width + RADIUS;
          ball.vx = Math.abs(ball.vx);
        }
        break;
      }
      if (next.bricks.every((brick) => !brick.alive)) {
        next.status = next.level === LEVELS.length ? "won" : "level";
      } else if (ball.y - RADIUS > HEIGHT) {
        next.lives--;
        next.status = next.lives > 0 ? "ready" : "lost";
        next.ball = {
          x: next.paddle + PADDLE_WIDTH / 2,
          y: PADDLE_Y - RADIUS - 2,
          vx: 0,
          vy: 0,
        };
      }
    }
    return next;
  }
  return {
    LEVELS,
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
  };
});
