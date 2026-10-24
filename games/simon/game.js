(() => {
  "use strict";
  const A = Arcade,
    E = GameEngine,
    $ = A.$;
  let state = E.create(),
    cells,
    paused = false,
    token = 0,
    timers = new Set();
  function later(fn, ms) {
    const t = token,
      id = setTimeout(() => {
        timers.delete(id);
        if (t === token && !paused) fn();
      }, ms);
    timers.add(id);
  }
  function cancel() {
    token++;
    for (const id of timers) clearTimeout(id);
    timers.clear();
    cells?.forEach((b) => b.classList.remove("lit"));
  }
  function render() {
    A.score(state.rounds, Math.max(state.rounds, A.number("best")));
    $("pause").disabled = ["ready", "over"].includes(state.phase);
    $("pause").textContent = paused ? "▶ 继续" : "Ⅱ 暂停";
    cells.forEach((b, i) => {
      b.setAttribute("aria-label", `色块 ${i + 1}`);
      b.setAttribute(
        "aria-disabled",
        String(state.phase !== "input" || paused),
      );
    });
  }
  function flash(i, ms = 380) {
    cells[i].classList.add("lit");
    later(() => cells[i].classList.remove("lit"), ms);
  }
  function show() {
    cancel();
    state = { ...state, index: 0, phase: "showing" };
    render();
    A.status(`第 ${state.sequence.length} 轮：先看顺序，播放时不要按。`);
    state.sequence.forEach((v, i) =>
      later(
        () => {
          flash(v);
          A.status(`看顺序：第 ${i + 1} 个是 ${v + 1}。`);
        },
        600 + i * 650,
      ),
    );
    later(
      () => {
        state = E.listen(state);
        render();
        A.status(`轮到你了，按顺序点击 ${state.sequence.length} 次。`);
      },
      600 + state.sequence.length * 650,
    );
  }
  function start() {
    cancel();
    paused = false;
    A.hideOverlay();
    state = E.nextRound(E.create());
    show();
  }
  function press(i) {
    if (paused || state.phase !== "input") return;
    state = E.press(state, i);
    flash(i, 160);
    render();
    if (state.phase === "over") {
      cancel();
      A.completed();
      A.best(state.rounds);
      A.status(`顺序有一点偏差，你完整通过了 ${state.rounds} 轮。`);
      A.overlay(
        "记住了不少呢",
        `完成 ${state.rounds} 轮，最高纪录 ${A.number("best")} 轮。`,
        "再试一次",
        start,
      );
    } else if (state.phase === "round-won") {
      A.best(state.rounds);
      A.status(`第 ${state.rounds} 轮正确！准备看更长的顺序。`);
      later(() => {
        state = E.nextRound(state);
        show();
      }, 700);
    } else
      A.status(`已输入 ${state.index} / ${state.sequence.length} 个，继续。`);
  }
  function resume() {
    paused = false;
    A.hideOverlay();
    if (state.phase === "round-won") state = E.nextRound(state);
    show();
  }
  function pause() {
    if (paused || ["ready", "over"].includes(state.phase)) return;
    paused = true;
    cancel();
    render();
    A.overlay("先歇一下", "继续后会从头重播本轮顺序。", "重播并继续", resume);
    A.status("已暂停，本轮顺序保留。");
  }
  cells = A.grid(4, 2, press);
  cells.forEach((b, i) => {
    b.textContent = i + 1;
  });
  $("pause").onclick = () => (paused ? resume() : pause());
  $("restart").onclick = start;
  A.autoPause(pause);
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.target.matches("select,input"))
      return;
    if (/^[1-4]$/.test(e.key) && !e.repeat) {
      e.preventDefault();
      press(Number(e.key) - 1);
    } else if (e.key.toLowerCase() === "p") {
      e.preventDefault();
      paused ? resume() : pause();
    }
  });
  render();
  A.overlay(
    "记住它的顺序",
    "看色块亮起，再依次按下。可以用数字键 1—4。",
    "开始记忆",
    start,
  );
  A.status(`本机最高 ${A.number("best")} 轮。每轮只多一个，慢慢来。`);
})();
