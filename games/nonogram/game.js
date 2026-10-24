(() => {
  "use strict";
  const A = Arcade,
    E = GameEngine,
    $ = A.$,
    P = NonogramPuzzles;
  let saved = A.read("puzzles");
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) saved = {};
  let completed = A.read("solved") || [];
  if (!Array.isArray(completed)) completed = [];
  completed = [
    ...new Set(completed.filter((i) => Number.isInteger(i) && P[i])),
  ];
  let puzzle,
    state,
    history = [],
    mode = 1,
    cells = [],
    clueNodes = { rows: [], cols: [] },
    focus = 0;
  for (const p of P) {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = `${p.size}×${p.size} · ${p.name}`;
    $("level").append(o);
  }
  function persist() {
    saved[puzzle.id] = state;
    A.store("puzzles", saved);
    A.store("current", puzzle.id);
  }
  function load(id) {
    puzzle = P[id] || P[0];
    state = E.restore(saved[puzzle.id], puzzle) || E.create(puzzle);
    history = [];
    focus = 0;
    $("level").value = puzzle.id;
    build();
    render();
    persist();
    A.status("点击格子填色，切换“标空”记录确定的空格。");
  }
  function build() {
    document
      .querySelector(".nonogram-scroll")
      .style.setProperty("--puzzle-size", puzzle.size);
    const board = $("board"),
      info = E.describe(puzzle.cells, puzzle.size);
    board.replaceChildren();
    board.style.setProperty("--size", puzzle.size);
    clueNodes = { rows: [], cols: [] };
    const corner = document.createElement("span");
    corner.className = "clue-corner";
    corner.textContent = `${puzzle.size}×${puzzle.size}`;
    board.append(corner);
    function clue(axis, line) {
      const el = document.createElement("div");
      el.className = "clue " + (axis === "cols" ? "column-clue" : "row-clue");
      el.setAttribute(
        "aria-label",
        `第 ${line + 1} ${axis === "rows" ? "行" : "列"}：${info[axis][line].join("、")}`,
      );
      for (const n of info[axis][line]) {
        const span = document.createElement("span");
        span.textContent = n;
        el.append(span);
      }
      clueNodes[axis].push(el);
      return el;
    }
    for (let c = 0; c < puzzle.size; c++) board.append(clue("cols", c));
    cells = [];
    for (let r = 0; r < puzzle.size; r++) {
      board.append(clue("rows", r));
      for (let c = 0; c < puzzle.size; c++) {
        const i = r * puzzle.size + c,
          b = A.button("", null, () => input(i, mode), "pixel");
        b.dataset.index = i;
        if (c % 5 === 0) b.classList.add("group-left");
        if (r % 5 === 0) b.classList.add("group-top");
        b.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          input(i, -1);
        });
        b.addEventListener("focus", () => {
          focus = i;
          cells.forEach((cell, j) => (cell.tabIndex = j === i ? 0 : -1));
        });
        b.addEventListener("keydown", (e) => {
          const delta = {
            ArrowLeft: -1,
            ArrowRight: 1,
            ArrowUp: -puzzle.size,
            ArrowDown: puzzle.size,
          }[e.key];
          if (delta !== undefined) {
            e.preventDefault();
            const n = i + delta;
            if (n >= 0 && n < cells.length) cells[n].focus();
          }
        });
        cells.push(b);
        board.append(b);
      }
    }
  }
  function render() {
    const n = puzzle.size,
      info = E.describe(puzzle.cells, n);
    cells.forEach((b, i) => {
      b.classList.toggle("filled", state.board[i] === 1);
      b.classList.toggle("crossed", state.board[i] === -1);
      b.textContent = state.board[i] === -1 ? "×" : "";
      b.disabled = state.won;
      b.tabIndex = i === focus ? 0 : -1;
      b.setAttribute(
        "aria-label",
        `第 ${Math.floor(i / n) + 1} 行第 ${(i % n) + 1} 列，${state.board[i] === 1 ? "已填色" : state.board[i] === -1 ? "已标空" : "未确定"}`,
      );
    });
    for (const axis of ["rows", "cols"])
      for (let line = 0; line < n; line++) {
        const values = Array.from(
          { length: n },
          (_, p) => state.board[axis === "rows" ? line * n + p : p * n + line],
        );
        clueNodes[axis][line].classList.toggle(
          "done",
          JSON.stringify(E.clues(values)) === JSON.stringify(info[axis][line]),
        );
      }
    A.score(completed.length, state.hints);
    $("undo").disabled = !history.length || state.won;
    $("hint").disabled = state.won;
    for (const [id, value] of [
      ["fill", 1],
      ["cross", -1],
    ]) {
      $(id).classList.toggle("active", mode === value);
      $(id).setAttribute("aria-pressed", String(mode === value));
    }
    $("guide").textContent =
      puzzle.id === 0
        ? state.won
          ? "入门完成！下一题继续试试，先找长数字和 0。"
          : !state.board.slice(10, 15).every((v) => v === 1)
            ? "第一课 ①：第 3 行的数字是 5，而这一行恰好有 5 格。把第 3 行全部涂满。"
            : "第一课 ②：第 3 列也是 5，可以全部涂满。再看数字 3：连续三格无论从哪里开始，中间那格都要填色。"
        : "数字表示连续色块的长度，各段之间至少空一格。先找长数字；拿不准时，用“推理提示”看看依据。";
    $("puzzle-note").textContent =
      `${puzzle.name} · ${completed.includes(puzzle.id) ? "已完成" : "进度自动保存"} · 大棋盘可横向滚动`;
    $("result").hidden = !state.won;
    $("result").textContent =
      `图案完成！本题使用 ${state.hints} 次提示。点击“下一题”继续。`;
  }
  function finish() {
    const was = state.won;
    state.won = E.won(state.board, puzzle.cells);
    if (state.won && !was && !completed.includes(puzzle.id)) {
      completed.push(puzzle.id);
      A.store("solved", completed);
      A.completed();
    }
    persist();
    render();
  }
  function input(i, value) {
    if (state.won) return;
    history.push([...state.board]);
    state.board[i] = state.board[i] === value ? 0 : value;
    A.status("标记已保存。");
    finish();
  }
  $("fill").onclick = () => {
    mode = 1;
    render();
  };
  $("cross").onclick = () => {
    mode = -1;
    render();
  };
  $("undo").onclick = () => {
    if (!history.length || state.won) return;
    state.board = history.pop();
    persist();
    render();
    A.status("已撤销，提示次数保留。");
  };
  $("hint").onclick = () => {
    if (state.won) return;
    const wrong = state.board.findIndex(
      (v, i) => v !== 0 && (v === 1) !== (puzzle.cells[i] === 1),
    );
    if (wrong >= 0) {
      cells[wrong].focus();
      A.status(
        `先检查第 ${Math.floor(wrong / puzzle.size) + 1} 行第 ${(wrong % puzzle.size) + 1} 列：这里的标记与最终图案不一致。可再次点击清空。`,
      );
      state.hints++;
      persist();
      render();
      return;
    }
    const h = E.deduction(
      state.board,
      puzzle.size,
      E.describe(puzzle.cells, puzzle.size),
    );
    if (!h || h.conflict) {
      A.status("检查已有标记，或尝试撤销上一步。");
      return;
    }
    history.push([...state.board]);
    state.hints++;
    for (const c of h.changes) state.board[c.index] = c.value;
    A.status(
      `第 ${h.line + 1} ${h.axis === "rows" ? "行" : "列"}：根据数字和已知标记，剩下 ${h.count} 种排法；这 ${h.changes.length} 格在所有排法中都相同，已帮你标出。`,
    );
    finish();
  };
  $("level").onchange = () => load(Number($("level").value));
  $("next").onclick = () => load((puzzle.id + 1) % P.length);
  $("restart").onclick = () =>
    Deep.confirm(() => {
      state = E.create(puzzle);
      history = [];
      persist();
      render();
      A.status("本题已清空，可以重新推理。");
    }, "清空本题的填色、标空和提示次数；已完成题目纪录保留。");
  $("daily").onclick = () => {
    const date = new Date(),
      text = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    let hash = 0;
    for (const c of text) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
    load(hash % P.length);
    A.status(`${text} · 每日一题，同一天打开为同一道题。`);
  };
  load(Number.isInteger(A.read("current")) ? A.read("current") : 0);
})();
