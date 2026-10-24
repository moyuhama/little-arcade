(() => {
  "use strict";
  const A = Arcade,
    E = GameEngine,
    $ = A.$,
    canvas = $("board"),
    ctx = canvas.getContext("2d");
  let state = E.create(),
    phase = "ready",
    frame,
    last = 0;
  function draw() {
    ctx.fillStyle = "#eaf1fb";
    ctx.fillRect(0, 0, 600, 600);
    ctx.fillStyle = "#ffffffb0";
    for (const [x, y] of [
      [65, 95],
      [320, 160],
      [510, 75],
    ]) {
      ctx.beginPath();
      ctx.ellipse(x, y, 50, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const p of state.pipes) {
      ctx.fillStyle = "#b1a0d4";
      ctx.fillRect(p.x, 0, E.WIDTH, p.center - E.GAP / 2);
      ctx.fillRect(p.x, p.center + E.GAP / 2, E.WIDTH, 600);
      ctx.fillStyle = "#9b85c3";
      ctx.fillRect(p.x - 4, p.center - E.GAP / 2 - 14, E.WIDTH + 8, 14);
      ctx.fillRect(p.x - 4, p.center + E.GAP / 2, E.WIDTH + 8, 14);
    }
    ctx.save();
    ctx.translate(E.X, state.y);
    ctx.rotate(Math.max(-0.35, Math.min(0.6, state.velocity / 800)));
    ctx.fillStyle = "#edc87e";
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ddac5b";
    ctx.beginPath();
    ctx.ellipse(-6, 4, 10, 6, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4a66c";
    ctx.beginPath();
    ctx.moveTo(15, -1);
    ctx.lineTo(25, 3);
    ctx.lineTo(15, 7);
    ctx.fill();
    ctx.fillStyle = "#51425c";
    ctx.beginPath();
    ctx.arc(8, -4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    A.score(state.score, Math.max(state.score, A.number("best")));
    $("pause").disabled = phase === "ready" || phase === "over";
    $("pause").textContent = phase === "paused" ? "▶ 继续" : "Ⅱ 暂停";
    canvas.setAttribute(
      "aria-label",
      `小鸟飞行画面，本局 ${state.score} 分。空格或点击让小鸟向上飞。`,
    );
  }
  function loop(now) {
    if (phase !== "playing") return;
    state = E.step(state, Math.min((now - last) / 1000, 0.08));
    last = now;
    draw();
    if (state.over) {
      phase = "over";
      A.completed();
      A.best(state.score);
      draw();
      A.overlay(
        "再飞一次吧",
        `本局穿过 ${state.score} 道障碍，最高 ${A.number("best")} 分。`,
        "重新出发",
        start,
      );
      A.status("碰到障碍了。每次轻点都能让小鸟向上飞。");
    } else frame = requestAnimationFrame(loop);
  }
  function resume() {
    phase = "playing";
    A.hideOverlay();
    last = performance.now();
    draw();
    frame = requestAnimationFrame(loop);
    A.status("轻点画面或按空格飞跃，P / Escape 暂停。");
    canvas.focus({ preventScroll: true });
  }
  function start() {
    cancelAnimationFrame(frame);
    state = E.flap(E.create());
    resume();
  }
  function pause() {
    if (phase !== "playing") return;
    phase = "paused";
    cancelAnimationFrame(frame);
    draw();
    A.overlay("飞行暂停", "位置已经保留，准备好后继续。", "继续飞行", resume);
    A.status("已暂停。");
  }
  function flap() {
    if (phase === "playing") {
      state = E.flap(state);
      draw();
    }
  }
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    flap();
  });
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.target.matches("select,input"))
      return;
    if ([" ", "ArrowUp"].includes(e.key)) {
      if (e.target.closest("button,a") && e.key === " ") return;
      e.preventDefault();
      if (!e.repeat) flap();
    } else if (e.key.toLowerCase() === "p" || e.key === "Escape") {
      e.preventDefault();
      phase === "paused" ? resume() : pause();
    }
  });
  $("pause").onclick = () => (phase === "paused" ? resume() : pause());
  $("restart").onclick = start;
  A.autoPause(pause);
  draw();
  A.overlay(
    "轻轻一点，向上飞",
    "点击、轻触或按空格穿过障碍。完整通过一组加 1 分。",
    "开始飞行",
    start,
  );
  A.status(`本机最高 ${A.number("best")} 分。点击开始，试试你的节奏。`);
})();
