(() => {
  "use strict";
  const A = Arcade,
    E = GameEngine,
    $ = A.$,
    colors = ["#9c7bd0", "#e5a660", "#79bca3", "#de91a9", "#80aedd", "#d4c56e"],
    names = ["紫", "橙", "绿", "粉", "蓝", "黄"];
  let state, history, won, cells, limit;
  function render() {
    const region = new Set(E.region(state.board, state.size));
    cells.forEach((b, i) => {
      b.style.background = colors[state.board[i]];
      b.textContent = i === 0 ? "⚑" : String(state.board[i] + 1);
      b.classList.toggle("owned", region.has(i));
      b.setAttribute(
        "aria-label",
        `${Math.floor(i / state.size) + 1} 行 ${(i % state.size) + 1} 列，${names[state.board[i]]}色${region.has(i) ? "，已占领" : ""}`,
      );
    });
    document.querySelectorAll("#colors button").forEach((b, i) => {
      b.classList.toggle("active", i === state.board[0]);
      b.setAttribute("aria-pressed", String(i === state.board[0]));
      b.disabled = won;
    });
    A.score(state.moves, limit);
    $("undo").disabled = !history.length || won;
  }
  function play(color) {
    if (won) return;
    const next = E.move(state, color);
    if (next === state) return;
    history.push(state);
    state = next;
    if (E.solved(state)) {
      won = true;
      A.completed();
      A.status(
        state.moves <= limit
          ? `涂满啦！用了 ${state.moves} 步，挑战成功。`
          : `练习完成！用了 ${state.moves} 步，下一局试着用更少步。`,
      );
    } else if (state.moves >= limit) {
      A.status("已达到挑战步数，仍可继续自由练习，或撤销寻找新路线。");
    } else
      A.status(
        `已经涂满 ${Math.round((E.region(state.board, state.size).length / state.board.length) * 100)}% ，还可走 ${limit - state.moves} 步。`,
      );
    render();
  }
  function reset() {
    const n = Number($("difficulty").value);
    state = E.create(n);
    while (E.solved(state)) state = E.create(n);
    history = [];
    won = false;
    limit = n === 8 ? 22 : 30;
    cells = Array.from({ length: n * n }, () => {
      const cell = document.createElement("span");
      cell.className = "grid-cell";
      return cell;
    });
    $("board").style.setProperty("--columns", n);
    $("board").replaceChildren(...cells);
    A.status("左上角的小旗是起点。点击下方颜色，向外扩张。");
    render();
  }
  colors.forEach((color, i) => {
    const b = A.button(
      String(i + 1),
      `选择${names[i]}色，快捷键 ${i + 1}`,
      () => play(i),
    );
    b.style.setProperty("--swatch", color);
    $("colors").append(b);
  });
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("select,input") || e.ctrlKey || e.metaKey || e.altKey)
      return;
    if (/^[1-6]$/.test(e.key)) {
      e.preventDefault();
      play(Number(e.key) - 1);
    }
  });
  $("undo").onclick = () => {
    if (history.length && !won) {
      state = history.pop();
      A.status("已撤销，可以试试另一种颜色。");
      render();
    }
  };
  $("restart").onclick = reset;
  $("difficulty").onchange = reset;
  reset();
})();
