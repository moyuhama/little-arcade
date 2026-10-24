/* Select-and-move UI. Engines own legal moves, forced chains and result rules. */
globalThis.ArcadeStrategy = function (type) {
  "use strict";
  const A = Arcade,
    E = GameEngine,
    $ = A.$,
    isXiangqi = type === "xiangqi",
    size = isXiangqi ? 9 : 8;
  const names = { r: "红方", b: isXiangqi ? "黑方" : "白方" };
  const pieceNames = {
    rK: "帅",
    bK: "将",
    rA: "仕",
    bA: "士",
    rB: "相",
    bB: "象",
    rN: "马",
    bN: "马",
    rR: "车",
    bR: "车",
    rC: "炮",
    bC: "炮",
    rP: "兵",
    bP: "卒",
  };
  let state,
    cells,
    selected = -1,
    hinted = -1,
    history = [],
    timer = null,
    paused = false,
    version = 0,
    legal = [];
  const solo = () => $("mode").value === "solo";
  function cancel() {
    clearTimeout(timer);
    timer = null;
    version++;
  }
  function label(p) {
    return !p
      ? "空位"
      : names[p[0]] +
          (isXiangqi ? pieceNames[p] : p[1] === "K" ? "王" : "普通棋子");
  }
  function message() {
    if (state.over) {
      const reasons = {
        checkmate: "将死",
        stalemate: "困毙",
        blocked: "对方无棋可走",
        quiet: "连续多回合无进展",
        repetition: "同一局面出现三次",
      };
      A.status(
        state.winner
          ? `${names[state.winner]}获胜（${reasons[state.reason]}）。点重开再来一局。`
          : `本局和棋：${reasons[state.reason]}。`,
      );
    } else if (paused) A.status("电脑走棋已暂停，准备好后继续。");
    else if (solo() && state.turn === "b") A.status("电脑正在考虑下一步…");
    else if (state.chain >= 0)
      A.status(`${names[state.turn]}还可以跳吃，必须用高亮的这颗棋子继续。`);
    else
      A.status(
        `${isXiangqi && E.inCheck(state.board, state.turn) ? "将军！请先保护将帅。" : ""}轮到${names[state.turn]}${solo() ? "（你）" : ""}，先选棋子再选落点。${!isXiangqi && legal.some((m) => m.capture >= 0) ? "当前有吃子机会，必须跳吃。" : ""}`,
      );
  }
  function render() {
    legal = E.legal(state);
    const targets = new Set(
      legal.filter((m) => m.from === selected).map((m) => m.to),
    );
    cells.forEach((b, i) => {
      const p = state.board[i],
        dark = ((i % size) + Math.floor(i / size)) % 2 === 1;
      b.className =
        "grid-cell" +
        (dark ? " dark" : " light") +
        (i === selected ? " selected" : "") +
        (targets.has(i) ? " target" : "") +
        (i === hinted ? " hinted" : "") +
        (state.last && (i === state.last.from || i === state.last.to)
          ? " last-move"
          : "");
      b.replaceChildren();
      if (p) {
        const stone = document.createElement("span");
        stone.className =
          "strategy-piece side-" +
          p[0] +
          (!isXiangqi && p[1] === "K" ? " king" : "");
        stone.textContent = isXiangqi ? pieceNames[p] : p[1] === "K" ? "♛" : "";
        b.append(stone);
      }
      b.setAttribute(
        "aria-label",
        `${Math.floor(i / size) + 1} 行 ${(i % size) + 1} 列，${label(p)}${targets.has(i) ? "，可走" : ""}`,
      );
      b.setAttribute("aria-pressed", String(i === selected));
      b.disabled = !isXiangqi && !dark;
    });
    cells.refreshFocus();
    A.score(state.over ? "结束" : names[state.turn], state.moves);
    $("undo").disabled = !history.length || state.over;
    $("hint").disabled = state.over || paused || (solo() && state.turn === "b");
    message();
  }
  function commit(m) {
    const next = E.move(state, m.from, m.to);
    if (next === state) return;
    if (state.chain < 0) history.push(state);
    state = next;
    selected = state.chain;
    hinted = -1;
    if (state.over) A.completed();
    render();
    schedule();
  }
  function schedule() {
    cancel();
    if (!solo() || state.turn !== "b" || state.over || paused) return;
    if (document.hidden) {
      pause();
      return;
    }
    const token = version;
    timer = setTimeout(() => {
      timer = null;
      if (token !== version || paused || state.over || state.turn !== "b")
        return;
      const m = E.ai(state);
      if (m) commit(m);
    }, 400);
  }
  function play(i) {
    if (state.over || paused || (solo() && state.turn === "b")) return;
    const m = legal.find((m) => m.from === selected && m.to === i);
    if (m) {
      commit(m);
      return;
    }
    if (state.chain >= 0) {
      A.status("这一步还没跳完，请点高亮的下一处落点。");
      return;
    }
    if (state.board[i]?.[0] === state.turn) {
      selected = selected === i ? -1 : i;
      hinted = -1;
      render();
      if (selected >= 0 && !legal.some((m) => m.from === i))
        A.status(
          isXiangqi
            ? "这颗棋子现在没有合法走法。"
            : "有吃子时要先吃；这颗棋子当前不能走。",
        );
    } else A.status("先点自己的棋子，再点带提示的落点。");
  }
  function pause() {
    if (solo() && !state.over && state.turn === "b") {
      cancel();
      paused = true;
      A.overlay("稍作休息", "当前局面已经保留。", "继续对局", () => {
        paused = false;
        A.hideOverlay();
        render();
        schedule();
      });
      render();
    }
  }
  function reset() {
    cancel();
    paused = false;
    A.hideOverlay();
    state = E.create();
    history = [];
    selected = -1;
    hinted = -1;
    cells = A.grid(state.board.length, size, play);
    $("board").style.setProperty("--rows", isXiangqi ? 10 : 8);
    render();
  }
  $("undo").onclick = () => {
    if (!history.length || state.over) return;
    cancel();
    paused = false;
    A.hideOverlay();
    if (solo()) {
      let i = history.length - 1;
      while (i > 0 && history[i].turn !== "r") i--;
      state = history[i];
      history = history.slice(0, i);
    } else state = history.pop();
    selected = -1;
    hinted = -1;
    render();
    schedule();
  };
  $("hint").onclick = () => {
    if (state.over || paused || (solo() && state.turn === "b")) return;
    const m = E.ai(state);
    if (m) {
      selected = m.from;
      hinted = m.to;
      render();
      A.status(
        `可以试试把 ${label(state.board[m.from])} 从 ${Math.floor(m.from / size) + 1} 行 ${(m.from % size) + 1} 列，移到 ${Math.floor(m.to / size) + 1} 行 ${(m.to % size) + 1} 列。`,
      );
    }
  };
  $("restart").onclick = reset;
  $("mode").onchange = reset;
  A.autoPause(pause);
  reset();
};
