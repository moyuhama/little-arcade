/* Shared turn/undo UI for three distinct board-game engines. */
globalThis.ArcadeChess = function (type) {
  "use strict";
  const A = Arcade,
    E = GameEngine,
    $ = A.$,
    names = type === "connect4" ? ["", "紫方", "金方"] : ["", "黑方", "白方"];
  let state,
    cells,
    history = [],
    timer = null,
    paused = false,
    version = 0;
  const solo = () => $("mode").value === "solo";
  function cancel() {
    clearTimeout(timer);
    timer = null;
    version++;
  }
  function render() {
    const legal = new Set(E.legal(state));
    cells.forEach((b, i) => {
      const v = state.board[i];
      b.className =
        "grid-cell" +
        (v ? ` stone-${v}` : "") +
        (i === state.last ? " last" : "") +
        (state.winning?.includes(i) ? " winning" : "");
      b.textContent = "";
      if (v) {
        const stone = document.createElement("span");
        stone.className = "stone";
        b.append(stone);
      } else if (type === "reversi" && legal.has(i)) {
        const dot = document.createElement("span");
        dot.className = "legal-dot";
        b.append(dot);
      }
      b.setAttribute(
        "aria-label",
        `${Math.floor(i / state.size) + 1} 行 ${(i % state.size) + 1} 列，${v ? names[v] : "空位"}${!v && type === "reversi" && legal.has(i) ? "，可以落子" : ""}`,
      );
    });
    if (type === "reversi")
      A.score(
        state.board.filter((v) => v === 1).length,
        state.board.filter((v) => v === 2).length,
      );
    else A.score(state.over ? "结束" : names[state.turn], state.moves);
    $("undo").disabled = !history.length || state.over;
    if (state.over)
      A.status(
        state.winner
          ? `${names[state.winner]}获胜！点重开再来一局。`
          : "本局平局。点重开再来一局。",
      );
    else if (paused) A.status("电脑落子已暂停，点继续后再走。");
    else
      A.status(
        `${state.passed ? `${names[state.passed]}无棋可下，自动让行。` : ""}${solo() && state.turn === 2 ? "电脑正在想下一步…" : `轮到${names[state.turn]}${solo() ? "（你）" : ""}落子。`}`,
      );
  }
  function commit(i) {
    const next = E.move(state, i);
    if (next === state) return false;
    history.push(state);
    state = next;
    if (state.over) A.completed();
    render();
    schedule();
    return true;
  }
  function schedule() {
    cancel();
    if (!solo() || state.over || state.turn !== 2 || paused) return;
    if (document.hidden) {
      pause();
      return;
    }
    const token = version;
    timer = setTimeout(() => {
      timer = null;
      if (token !== version || paused || state.over || state.turn !== 2) return;
      const index = E.ai(state);
      if (index !== null) commit(index);
    }, 380);
  }
  function play(i) {
    if (paused || state.over || (solo() && state.turn === 2)) return;
    if (!commit(i))
      A.status(
        type === "reversi"
          ? "这里不能夹住对方棋子，请选择带圆点的格子。"
          : type === "connect4"
            ? "这一列已经满了，换一列试试。"
            : "这里已经有棋子了，换一个交点吧。",
      );
  }
  function pause() {
    if (solo() && !state.over && state.turn === 2) {
      cancel();
      paused = true;
      A.overlay(
        "稍作休息",
        "棋盘已经保留，准备好后继续这一局。",
        "继续对局",
        () => {
          paused = false;
          A.hideOverlay();
          render();
          schedule();
        },
      );
      render();
    }
  }
  function reset() {
    cancel();
    paused = false;
    A.hideOverlay();
    state = E.create();
    history = [];
    cells = A.grid(state.board.length, state.size, play);
    render();
  }
  $("undo").onclick = () => {
    if (!history.length || state.over) return;
    cancel();
    paused = false;
    A.hideOverlay();
    if (solo()) {
      let i = history.length - 1;
      while (i > 0 && history[i].turn !== 1) i--;
      state = history[i];
      history = history.slice(0, i);
    } else state = history.pop();
    render();
    schedule();
  };
  $("restart").onclick = reset;
  $("mode").onchange = reset;
  A.autoPause(pause);
  reset();
};
