(() => {
  "use strict";
  const A = Arcade,
    E = GameEngine,
    $ = A.$,
    symbols = [
      "",
      "🍒",
      "🍋",
      "🍇",
      "🍊",
      "🥝",
      "🍓",
      "🍍",
      "🍑",
      "🌸",
      "🍀",
      "⭐",
      "🌙",
    ];
  let board,
    rows,
    cols,
    cells,
    selected = -1,
    history = [],
    moves = 0,
    won = false,
    busy = false,
    hint = [],
    timer,
    version = 0;
  function render() {
    cells.forEach((b, i) => {
      b.disabled = !board[i];
      b.textContent = board[i] ? symbols[board[i]] : "";
      b.className =
        "grid-cell" +
        (!board[i] ? " cleared" : "") +
        (i === selected ? " selected" : "") +
        (hint.includes(i) ? " hint" : "");
      b.setAttribute(
        "aria-label",
        `${Math.floor(i / cols) + 1} 行 ${(i % cols) + 1} 列，${board[i] ? symbols[board[i]] : "已消除"}`,
      );
    });
    cells.refreshFocus();
    A.score(
      `${(board.length - board.filter(Boolean).length) / 2}/${board.length / 2}`,
      moves,
    );
    $("undo").disabled = !history.length || won || busy;
    $("hint").disabled = won || busy;
    $("shuffle").disabled = won || busy;
  }
  function message() {
    A.status(
      won
        ? "全部连上了！点重开，再玩一张新棋盘。"
        : E.pair(board, rows, cols)
          ? "选两块相同图案，用不超过两次转弯的路线连起来。"
          : "暂时没有可连的一对。点洗牌，继续这一局。",
    );
  }
  function drawPath(path) {
    const rect = $("board").getBoundingClientRect(),
      first = cells[0].getBoundingClientRect(),
      last = cells.at(-1).getBoundingClientRect(),
      x0 = first.x - rect.x + first.width / 2,
      y0 = first.y - rect.y + first.height / 2,
      dx = (last.x - first.x) / (cols - 1),
      dy = (last.y - first.y) / (rows - 1);
    const points = path
      .map(
        (p) =>
          `${p.col === 0 ? 5 : p.col === cols + 1 ? rect.width - 5 : x0 + (p.col - 1) * dx},${p.row === 0 ? 5 : p.row === rows + 1 ? rect.height - 5 : y0 + (p.row - 1) * dy}`,
      )
      .join(" ");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
    svg.classList.add("connection");
    svg.setAttribute("aria-hidden", "true");
    const line = document.createElementNS(svg.namespaceURI, "polyline");
    line.setAttribute("points", points);
    svg.append(line);
    $("board").parentElement.append(svg);
  }
  function clearPath() {
    document.querySelector(".connection")?.remove();
  }
  function play(i) {
    if (won || busy || !board[i]) return;
    hint = [];
    if (selected < 0) {
      selected = i;
      render();
      return;
    }
    if (selected === i) {
      selected = -1;
      render();
      return;
    }
    const path = E.route(board, selected, i, rows, cols);
    if (!path) {
      selected = i;
      A.status("这两块暂时连不上。已改选这一块，再选一个同伴。");
      render();
      return;
    }
    const a = selected;
    history.push({ board: [...board], moves });
    busy = true;
    selected = -1;
    render();
    drawPath(path);
    const token = version;
    timer = setTimeout(() => {
      if (token !== version) return;
      clearPath();
      board = E.remove(board, a, i, rows, cols);
      moves++;
      busy = false;
      won = !board.some(Boolean);
      if (won) A.completed();
      message();
      render();
    }, 260);
  }
  function reset() {
    version++;
    clearTimeout(timer);
    clearPath();
    [rows, cols] = $("difficulty").value === "large" ? [6, 8] : [4, 6];
    board = E.create(rows, cols);
    selected = -1;
    history = [];
    moves = 0;
    won = false;
    busy = false;
    hint = [];
    cells = A.grid(board.length, cols, play);
    $("board").style.aspectRatio = `${cols + 1}/${rows + 1}`;
    message();
    render();
  }
  $("hint").onclick = () => {
    hint = E.pair(board, rows, cols) || [];
    selected = -1;
    A.status(
      hint.length
        ? "紫色边框标出了一对，现在可以把它们连起来。"
        : "没有可连配对，请洗牌后继续。",
    );
    render();
  };
  $("shuffle").onclick = () => {
    history.push({ board: [...board], moves });
    board = E.shuffle(board, rows, cols);
    selected = -1;
    hint = [];
    A.status("已保留剩余图案重新洗牌，至少有一组可连。");
    render();
  };
  $("undo").onclick = () => {
    if (history.length && !won && !busy) {
      ({ board, moves } = history.pop());
      selected = -1;
      hint = [];
      message();
      render();
    }
  };
  $("restart").onclick = reset;
  $("difficulty").onchange = reset;
  reset();
})();
