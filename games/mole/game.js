(() => {
  "use strict";
  const A = Arcade,
    E = GameEngine,
    $ = A.$;
  let state,
    cells,
    phase = "ready",
    last = 0,
    frame;
  function render() {
    cells.forEach((b, i) => {
      b.classList.toggle("up", state.active === i && phase === "playing");
      b.replaceChildren();
      const mole = document.createElement("span");
      mole.className = "mole";
      mole.textContent = state.active === i && phase === "playing" ? "🐹" : "·";
      const key = document.createElement("small");
      key.textContent = i + 1;
      b.append(mole, key);
      b.setAttribute(
        "aria-label",
        `洞 ${i + 1}，${state.active === i && phase === "playing" ? "地鼠出现" : "空洞"}`,
      );
    });
    A.score(state.score, Math.ceil(30 - state.time));
    $("pause").disabled = phase === "ready" || phase === "over";
    $("pause").textContent = phase === "paused" ? "▶ 继续" : "Ⅱ 暂停";
  }
  function loop(now) {
    if (phase !== "playing") return;
    state = E.advance(state, Math.max(0, (now - last) / 1000));
    last = now;
    if (state.over) {
      phase = "over";
      A.completed();
      const best = A.best(state.score);
      A.status(
        `命中 ${state.hits} 只，得分 ${state.score}；本机最高 ${best} 分。`,
      );
      A.overlay(
        "时间到！",
        `你命中了 ${state.hits} 只地鼠，得分 ${state.score}。最高 ${best} 分。`,
        "再来一局",
        start,
      );
    }
    render();
    if (phase === "playing") frame = requestAnimationFrame(loop);
  }
  function resume() {
    phase = "playing";
    last = performance.now();
    A.hideOverlay();
    render();
    frame = requestAnimationFrame(loop);
    A.status("地鼠探头就点它！空洞会扣 2 分。");
  }
  function start() {
    cancelAnimationFrame(frame);
    state = E.create();
    resume();
  }
  function pause() {
    if (phase !== "playing") return;
    phase = "paused";
    cancelAnimationFrame(frame);
    render();
    A.overlay(
      "歇一小会",
      "倒计时已经停止，准备好再继续。",
      "继续打地鼠",
      resume,
    );
    A.status("已暂停，剩余时间保留。");
  }
  function hit(i) {
    if (phase !== "playing") return;
    state = E.hit(state, i);
    render();
  }
  cells = A.grid(9, 3, hit);
  state = E.create();
  render();
  $("pause").onclick = () => (phase === "paused" ? resume() : pause());
  $("restart").onclick = start;
  A.autoPause(pause);
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.target.matches("select,input"))
      return;
    if (/^[1-9]$/.test(e.key) && !e.repeat) {
      e.preventDefault();
      hit(Number(e.key) - 1);
    }
    if (e.key.toLowerCase() === "p") {
      e.preventDefault();
      phase === "paused" ? resume() : pause();
    }
  });
  A.overlay(
    "地鼠点名时间",
    "30 秒挑战。点中 +10，点空 −2。也可以用数字键 1—9。",
    "开始游戏",
    start,
  );
  A.status(`本机最高 ${A.number("best")} 分，准备好就开始。`);
})();
