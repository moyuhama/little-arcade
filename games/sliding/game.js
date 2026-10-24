(() => {
  "use strict";
  const A = Arcade,
    E = GameEngine,
    $ = A.$;
  let state,
    history = [],
    cells,
    won = false;
  function render() {
    cells.forEach((b, i) => {
      const v = state.board[i];
      b.textContent = v || "";
      b.classList.toggle("empty", !v);
      b.setAttribute("aria-label", v ? `数字 ${v}` : "空格");
    });
    $("undo").disabled = !history.length || won;
    A.score(state.moves, A.number("completed"));
  }
  function play(i) {
    if (won) return;
    const next = E.move(state, i);
    if (next === state) return;
    history.push(state);
    state = next;
    if (E.solved(state.board)) {
      won = true;
      A.completed();
      A.status(`拼好了！用了 ${state.moves} 步。点重开挑战新棋盘。`);
    } else A.status("把数字从左到右排好，空格留在右下角。");
    render();
  }
  function reset() {
    state = E.create(Number($("difficulty").value));
    history = [];
    won = false;
    cells = A.grid(state.board.length, state.size, play);
    $("board").onkeydown = null;
    A.status("点击空格旁的数字，或用方向键移动空格。");
    render();
  }
  A.controls((d) => {
    const z = state.board.indexOf(0),
      n = state.size,
      i = z + { up: -n, down: n, left: -1, right: 1 }[d];
    play(i);
  });
  // Here arrows move the blank, so they should not also move cell focus.
  $("undo").onclick = () => {
    if (history.length && !won) {
      state = history.pop();
      A.status("已撤销一步。");
      render();
    }
  };
  $("restart").onclick = reset;
  $("difficulty").onchange = reset;
  reset();
})();
