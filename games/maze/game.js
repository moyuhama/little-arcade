(() => {
  "use strict";
  const A = Arcade,
    E = GameEngine,
    $ = A.$,
    canvas = $("board"),
    ctx = canvas.getContext("2d");
  let state,
    history,
    won,
    hinted = -1;
  function render() {
    const n = state.size,
      step = 560 / n,
      start = 20;
    ctx.fillStyle = "#faf8ff";
    ctx.fillRect(0, 0, 600, 600);
    const visited = new Set([0, ...history.map((s) => s.position)]);
    for (const i of visited) {
      ctx.fillStyle = "#eee7fa";
      ctx.fillRect(
        start + (i % n) * step + 2,
        start + Math.floor(i / n) * step + 2,
        step - 4,
        step - 4,
      );
    }
    if (hinted >= 0) {
      ctx.fillStyle = "#fae5b8";
      ctx.fillRect(
        start + (hinted % n) * step + 3,
        start + Math.floor(hinted / n) * step + 3,
        step - 6,
        step - 6,
      );
    }
    ctx.strokeStyle = "#a693bd";
    ctx.lineWidth = Math.max(2, 24 / n);
    ctx.lineCap = "round";
    state.walls.forEach((w, i) => {
      const x = start + (i % n) * step,
        y = start + Math.floor(i / n) * step;
      ctx.beginPath();
      if (w & 1) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + step, y);
      }
      if (w & 2) {
        ctx.moveTo(x + step, y);
        ctx.lineTo(x + step, y + step);
      }
      if (w & 4) {
        ctx.moveTo(x, y + step);
        ctx.lineTo(x + step, y + step);
      }
      if (w & 8) {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + step);
      }
      ctx.stroke();
    });
    ctx.fillStyle = "#d7a143";
    ctx.font = `${step * 0.7}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("★", start + (n - 0.5) * step, start + (n - 0.5) * step);
    ctx.fillStyle = "#8261c4";
    ctx.beginPath();
    ctx.arc(
      start + ((state.position % n) + 0.5) * step,
      start + (Math.floor(state.position / n) + 0.5) * step,
      step * 0.27,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    canvas.setAttribute(
      "aria-label",
      `迷宫，当前位置第 ${Math.floor(state.position / n) + 1} 行第 ${(state.position % n) + 1} 列，目标第 ${n} 行第 ${n} 列。${Object.keys(
        E.directions,
      )
        .filter((d) => E.move(state, d) !== state)
        .map((d) => ({ up: "上", right: "右", down: "下", left: "左" })[d])
        .join("、")}方可通行。`,
    );
    A.score(state.moves, A.number("completed"));
    $("undo").disabled = !history.length || won;
    $("hint").disabled = won;
  }
  function play(d) {
    if (won) return;
    const next = E.move(state, d);
    if (next === state) {
      A.status("这里是墙，换个方向试试。");
      return;
    }
    history.push(state);
    state = next;
    hinted = -1;
    if (state.position === state.size * state.size - 1) {
      won = true;
      A.completed();
      A.status(`找到出口了！走了 ${state.moves} 步。重开可探索新的迷宫。`);
    } else
      A.status(
        `第 ${Math.floor(state.position / state.size) + 1} 行，第 ${(state.position % state.size) + 1} 列。沿着通路继续走。`,
      );
    render();
  }
  function reset() {
    state = E.create(Number($("difficulty").value));
    history = [];
    won = false;
    hinted = -1;
    A.status("用方向键或下方按钮，走到右下角的星星。");
    render();
  }
  A.controls(play);
  let pointer;
  canvas.addEventListener("pointerdown", (e) => {
    pointer = { x: e.clientX, y: e.clientY, id: e.pointerId };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!pointer) return;
    const dx = e.clientX - pointer.x,
      dy = e.clientY - pointer.y;
    pointer = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 15)
      play(
        Math.abs(dx) > Math.abs(dy)
          ? dx > 0
            ? "right"
            : "left"
          : dy > 0
            ? "down"
            : "up",
      );
  });
  canvas.addEventListener("pointercancel", () => {
    pointer = null;
  });
  $("hint").onclick = () => {
    hinted = E.path(state)[1] ?? -1;
    A.status("金色格子是通往出口的下一步。");
    render();
  };
  $("undo").onclick = () => {
    if (history.length && !won) {
      state = history.pop();
      hinted = -1;
      A.status("退回了上一个位置。");
      render();
    }
  };
  $("restart").onclick = reset;
  $("difficulty").onchange = reset;
  reset();
})();
