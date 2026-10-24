(() => {
  "use strict";
  const {
    LEVELS,
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
  } = Breakout;
  const $ = (id) => document.getElementById(id),
    canvas = $("breakout-board"),
    context = canvas.getContext("2d");
  const storageKey = "little-arcade-breakout-best-v1";
  let state = createGame(),
    best = 0,
    paused = false,
    animation = null,
    lastTime = null;
  const pressed = new Set();
  const progressKey = "little-arcade-breakout-progress-v1";
  let checkpoint = { level: 1, score: 0, lives: 3 };
  function saveProgress(value = checkpoint) {
    try {
      localStorage.setItem(progressKey, JSON.stringify(value));
    } catch {
      storageWarning();
    }
  }
  function restoreCheckpoint() {
    state = {
      ...createGame(checkpoint.level),
      score: checkpoint.score,
      lives: checkpoint.lives,
    };
  }
  try {
    const saved = JSON.parse(localStorage.getItem(progressKey));
    if (
      saved &&
      Number.isInteger(saved.level) &&
      saved.level >= 1 &&
      saved.level <= LEVELS.length &&
      Number.isSafeInteger(saved.score) &&
      saved.score >= 0 &&
      Number.isInteger(saved.lives) &&
      saved.lives >= 1 &&
      saved.lives <= 5
    )
      checkpoint = saved;
  } catch {
    storageWarning();
  }
  restoreCheckpoint();
  LEVELS.forEach((name, i) => {
    const option = document.createElement("option");
    option.value = i + 1;
    option.textContent = `${i + 1}. ${name}`;
    $("level-picker").append(option);
  });
  $("level-picker").onchange = () => {
    stop();
    checkpoint = { level: Number($("level-picker").value), score: 0, lives: 3 };
    restoreCheckpoint();
    saveProgress();
    paused = false;
    render();
    $("status").textContent = "已切换关卡，点击发球开始。";
  };
  function storageWarning() {
    $("save-note").textContent = "浏览器存储不可用，最高分仅在当前页面保留。";
  }
  try {
    const value = Number(localStorage.getItem(storageKey));
    if (Number.isSafeInteger(value) && value >= 0) best = value;
  } catch {
    storageWarning();
  }
  if (!context) {
    $("overlay-title").textContent = "暂时无法绘制棋盘";
    $("overlay-description").textContent = "请使用支持 Canvas 的浏览器打开。";
    $("overlay-action").disabled = true;
    return;
  }
  function rounded(x, y, w, h, radius, color) {
    context.fillStyle = color;
    context.beginPath();
    context.roundRect(x, y, w, h, radius);
    context.fill();
  }
  function draw() {
    context.fillStyle = "#f8f6fc";
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.fillStyle = "#e6dfef";
    for (let y = 20; y < HEIGHT; y += 25)
      for (let x = 12; x < WIDTH; x += 25) {
        context.beginPath();
        context.arc(x, y, 1, 0, Math.PI * 2);
        context.fill();
      }
    const colors = [
      "#9075c8",
      "#b09bdc",
      "#c9bce9",
      "#e9bdac",
      "#eaa58d",
      "#9fc6b5",
    ];
    state.bricks.forEach((brick) => {
      if (!brick.alive) return;
      rounded(brick.x, brick.y + 3, brick.width, brick.height, 5, "#d8d0e6");
      rounded(
        brick.x,
        brick.y,
        brick.width,
        brick.height,
        5,
        colors[brick.row % colors.length],
      );
      rounded(brick.x + 4, brick.y + 3, brick.width - 8, 3, 1, "#ffffff30");
    });
    rounded(state.paddle, PADDLE_Y + 3, PADDLE_WIDTH, 13, 6, "#d6c9ed");
    rounded(state.paddle, PADDLE_Y, PADDLE_WIDTH, 12, 6, "#6554df");
    context.fillStyle = "#efa98d";
    context.beginPath();
    context.arc(state.ball.x, state.ball.y, RADIUS, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#fff5df";
    context.beginPath();
    context.arc(state.ball.x - 2, state.ball.y - 2, 2.5, 0, Math.PI * 2);
    context.fill();
    const left = state.bricks.filter((brick) => brick.alive).length;
    canvas.setAttribute(
      "aria-label",
      `打砖块棋盘，第 ${state.level} 关，剩余 ${left} 块砖，${state.lives} 条生命，得分 ${state.score}`,
    );
  }
  function updateScores() {
    if (state.score > best) {
      best = state.score;
      try {
        localStorage.setItem(storageKey, String(best));
      } catch {
        storageWarning();
      }
    }
    $("score").textContent = state.score;
    $("best").textContent = best;
    $("level").textContent = state.level;
    $("lives").textContent = "● ".repeat(state.lives).trim() || "—";
    $("lives").setAttribute("aria-label", `${state.lives} 条生命`);
  }
  function render() {
    draw();
    updateScores();
    $("level-picker").value = state.level;
    $("pause").disabled = state.status !== "playing";
    $("pause").textContent = paused ? "▷ 继续" : "Ⅱ 暂停";
    $("game-overlay").hidden = state.status === "playing" && !paused;
    if ($("game-overlay").hidden) return;
    const lostLife = state.status === "ready" && state.lives < 3;
    $("overlay-title").textContent = paused
      ? "这一球，等你回来"
      : state.status === "level"
        ? "漂亮，清空这一关！"
        : state.status === "won"
          ? `${LEVELS.length} 关全通，打得漂亮！`
          : state.status === "lost"
            ? "这局也很精彩"
            : lostLife
              ? "还有机会，再来一球"
              : "把烦恼，一块块打掉";
    $("overlay-description").textContent = paused
      ? "游戏已暂停，准备好后继续。"
      : state.status === "level"
        ? `当前 ${state.score} 分，下一关补充一条生命（最多五条），球速稍快。`
        : state.status === "won" || state.status === "lost"
          ? `本局 ${state.score} 分，最高纪录 ${best} 分。`
          : lostLife
            ? `还剩 ${state.lives} 条生命，砖块进度保留。`
            : "接住小球，清空砖块。每块 +10 分。";
    $("overlay-action").textContent = paused
      ? "继续游戏 →"
      : state.status === "level"
        ? "进入下一关 →"
        : state.status === "won" || state.status === "lost"
          ? state.status === "won"
            ? "从第一关再来 →"
            : "重试当前关 →"
          : "开始发球 →";
    $("overlay-hint").textContent = "鼠标 / 拖动 / 方向键 · 空格发球或暂停";
  }
  function stop() {
    cancelAnimationFrame(animation);
    animation = null;
    lastTime = null;
    pressed.clear();
  }
  function frame(timestamp) {
    if (paused || state.status !== "playing") return;
    const dt =
      lastTime === null ? 0 : Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;
    const direction =
      Number(pressed.has("right")) - Number(pressed.has("left"));
    if (direction)
      state = movePaddle(
        state,
        state.paddle + PADDLE_WIDTH / 2 + direction * 480 * dt,
      );
    const score = state.score;
    state = step(state, dt);
    draw();
    updateScores();
    if (state.status !== "playing") {
      if (state.status === "level")
        saveProgress({
          level: state.level + 1,
          score: state.score,
          lives: Math.min(5, state.lives + 1),
        });
      else if (state.status === "won")
        saveProgress({ level: 1, score: 0, lives: 3 });
      stop();
      render();
      $("status").textContent =
        state.status === "level"
          ? "本关完成！点击进入下一关。"
          : state.status === "won"
            ? "恭喜，全部通关！"
            : state.status === "lost"
              ? "本局结束，再来一次吧。"
              : `漏接一球，还剩 ${state.lives} 条生命。`;
      $("overlay-action").focus({ preventScroll: true });
      return;
    }
    if (state.score !== score)
      $("status").textContent = `击碎砖块！当前 ${state.score} 分。`;
    animation = requestAnimationFrame(frame);
  }
  function start() {
    if (document.hidden) return;
    stop();
    if (state.status === "won") {
      checkpoint = { level: 1, score: 0, lives: 3 };
      restoreCheckpoint();
      saveProgress();
    }
    if (state.status === "lost") restoreCheckpoint();
    if (state.status === "level") {
      state = advanceLevel(state);
      checkpoint = {
        level: state.level,
        score: state.score,
        lives: state.lives,
      };
      saveProgress();
    }
    if (state.status === "ready") state = launch(state);
    paused = false;
    render();
    canvas.focus({ preventScroll: true });
    $("status").textContent = "接住小球，试试用挡板两端改变角度。";
    animation = requestAnimationFrame(frame);
  }
  function pause() {
    if (state.status !== "playing" || paused) return;
    paused = true;
    stop();
    render();
    $("status").textContent = "已暂停，准备好后手动继续。";
  }
  function restart() {
    stop();
    restoreCheckpoint();
    saveProgress();
    paused = false;
    render();
    $("status").textContent = "已重置当前关，点击发球开始。";
  }
  function point(event) {
    if (paused || state.status !== "playing") return;
    const rect = canvas.getBoundingClientRect();
    state = movePaddle(
      state,
      ((event.clientX - rect.left) / rect.width) * WIDTH,
    );
    draw();
  }
  canvas.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    point(event);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (event.isPrimary) point(event);
  });
  for (const direction of ["left", "right"]) {
    const button = $(`move-${direction}`);
    button.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary || event.button !== 0 || paused) return;
      pressed.add(direction);
      button.setPointerCapture(event.pointerId);
    });
    const release = () => pressed.delete(direction);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
    button.addEventListener("click", (event) => {
      if (event.detail === 0 && !paused) {
        state = movePaddle(
          state,
          state.paddle + PADDLE_WIDTH / 2 + (direction === "left" ? -35 : 35),
        );
        draw();
      }
    });
  }
  const directions = {
    ArrowLeft: "left",
    ArrowRight: "right",
    a: "left",
    d: "right",
  };
  document.addEventListener("keydown", (event) => {
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) ||
      event.target.isContentEditable
    )
      return;
    const direction =
      directions[event.key] || directions[event.key.toLowerCase()];
    if (direction && !paused && state.status === "playing") {
      event.preventDefault();
      pressed.add(direction);
    }
    if (event.key === "Escape") pause();
    if (event.code === "Space" && !event.target.closest("button, a")) {
      event.preventDefault();
      if (event.repeat) return;
      if (state.status === "playing" && !paused) pause();
      else start();
    }
  });
  document.addEventListener("keyup", (event) => {
    const direction =
      directions[event.key] || directions[event.key.toLowerCase()];
    if (direction) pressed.delete(direction);
  });
  $("overlay-action").addEventListener("click", start);
  $("pause").addEventListener("click", () => (paused ? start() : pause()));
  $("restart").addEventListener("click", restart);
  document.addEventListener("arcade:pause", pause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
  });
  window.addEventListener("blur", pause);
  window.addEventListener("pagehide", () => {
    pause();
    stop();
  });
  render();
  $("status").textContent =
    "20 关挑战，每过一关补一条生命。可选关，刷新恢复当前关起点。";
})();
