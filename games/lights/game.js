(() => {
  "use strict";
  const A = Arcade,
    E = GameEngine,
    $ = A.$;
  let board,
    n,
    cells,
    history,
    moves,
    won,
    hint = -1;
  function render() {
    cells.forEach((b, i) => {
      b.textContent = board[i] ? "☀" : "·";
      b.classList.toggle("on", !!board[i]);
      b.classList.toggle("hint", i === hint);
      b.setAttribute(
        "aria-label",
        `第 ${Math.floor(i / n) + 1} 行第 ${(i % n) + 1} 列，${board[i] ? "亮灯" : "熄灭"}${i === hint ? "，提示位置" : ""}`,
      );
    });
    $("undo").disabled = !history.length || won;
    $("hint").disabled = won;
    A.score(moves, A.number("completed"));
  }
  function play(i) {
    if (won) return;
    history.push(board);
    board = E.press(board, i, n);
    moves++;
    hint = -1;
    if (!board.some(Boolean)) {
      won = true;
      A.completed();
      A.status(`灯都熄灭了！这次用了 ${moves} 步。点重开再来一局。`);
    } else
      A.status(
        `还亮着 ${board.filter(Boolean).length} 盏灯。试着让它们一起暗下来。`,
      );
    render();
  }
  function reset() {
    n = Number($("difficulty").value);
    board = E.create(n);
    history = [];
    moves = 0;
    won = false;
    hint = -1;
    cells = A.grid(n * n, n, play);
    A.status("按一格，同时翻转自己和上下左右的灯。");
    render();
  }
  $("hint").onclick = () => {
    hint = E.solve(board, n)?.[0] ?? -1;
    A.status("带紫色边框的格子，可以作为下一步。");
    render();
  };
  $("undo").onclick = () => {
    if (history.length && !won) {
      board = history.pop();
      moves--;
      hint = -1;
      A.status("已撤销上一步。");
      render();
    }
  };
  $("restart").onclick = reset;
  $("difficulty").onchange = reset;
  reset();
})();
