(() => {
  "use strict";
  const A = Arcade,
    E = GameEngine,
    $ = A.$;
  let puzzle,
    solution,
    board,
    notes,
    cells,
    selected = 0,
    pencil = false,
    history,
    hints,
    won;
  function render() {
    const bad = E.conflicts(board);
    cells.forEach((b, i) => {
      b.replaceChildren();
      if (board[i]) b.textContent = board[i];
      else {
        const small = document.createElement("span");
        small.className = "pencil-grid";
        for (let v = 1; v <= 9; v++) {
          const s = document.createElement("span");
          s.textContent = notes[i].includes(v) ? v : "";
          small.append(s);
        }
        b.append(small);
      }
      b.className =
        "grid-cell" +
        (puzzle[i] ? " given" : "") +
        (i === selected ? " selected" : "") +
        (bad[i] ? " conflict" : "") +
        (board[selected] && board[i] === board[selected] ? " same" : "");
      b.setAttribute(
        "aria-label",
        `第 ${Math.floor(i / 9) + 1} 行第 ${(i % 9) + 1} 列，${board[i] || "空格"}${puzzle[i] ? "，题目数字" : ""}${bad[i] ? "，数字冲突" : ""}${!board[i] && notes[i].length ? "，笔记 " + notes[i].join("、") : ""}`,
      );
    });
    A.score(board.filter(Boolean).length, hints);
    $("undo").disabled = !history.length || won;
    $("hint").disabled = won;
    $("erase").disabled = !!puzzle[selected] || won;
    $("notes").classList.toggle("active", pencil);
    $("notes").setAttribute("aria-pressed", String(pencil));
    if (bad.some(Boolean)) A.status("红色数字与同一行、列或宫冲突，检查一下。");
  }
  function snapshot() {
    history.push({ board: [...board], notes: notes.map((n) => [...n]) });
  }
  function input(value, force = false) {
    if (won || puzzle[selected]) return;
    if (pencil && !force && value) {
      snapshot();
      const list = notes[selected];
      notes[selected] = list.includes(value)
        ? list.filter((v) => v !== value)
        : [...list, value].sort();
      board[selected] = 0;
    } else {
      if (board[selected] === value && (!notes[selected].length || value))
        return;
      snapshot();
      board[selected] = value;
      notes[selected] = [];
      if (value)
        E.peers[selected].forEach((i) => {
          notes[i] = notes[i].filter((v) => v !== value);
        });
    }
    A.status(pencil && !force ? "笔记已更新。" : "继续寻找下一个确定的数字。");
    if (E.solved(board)) {
      won = true;
      A.completed();
      A.status(`全部正确！本局使用了 ${hints} 次提示。点重开生成新题。`);
    }
    render();
  }
  function reset() {
    const created = E.create($("difficulty").value);
    puzzle = created.puzzle;
    solution = created.solution;
    board = [...puzzle];
    notes = Array.from({ length: 81 }, () => []);
    history = [];
    hints = 0;
    won = false;
    selected = board.indexOf(0);
    pencil = false;
    cells = A.grid(81, 9, (i) => {
      selected = i;
      A.status(
        puzzle[i]
          ? "这是题目给定的数字。"
          : "选择 1—9 填入，或用笔记记录候选数。",
      );
      render();
    });
    cells.forEach((b, i) =>
      b.addEventListener("focus", () => {
        selected = i;
        render();
      }),
    );
    A.status("选择空格，点击数字键。也可以用键盘 1—9。");
    render();
  }
  for (let v = 1; v <= 9; v++)
    $("numbers").append(A.button(String(v), `填入 ${v}`, () => input(v)));
  $("notes").onclick = () => {
    pencil = !pencil;
    A.status(
      pencil
        ? "笔记模式：数字会记为小号候选数。"
        : "填写模式：数字直接填入格子。",
    );
    render();
  };
  $("erase").onclick = () => input(0, true);
  $("hint").onclick = () => {
    if (won) return;
    if (puzzle[selected] || board[selected] === solution[selected])
      selected = board.findIndex((v, i) => v !== solution[i]);
    if (selected >= 0) {
      hints++;
      input(solution[selected], true);
    }
  };
  $("undo").onclick = () => {
    if (history.length && !won) {
      ({ board, notes } = history.pop());
      A.status("已撤销上一步。");
      render();
    }
  };
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("select,input") || e.ctrlKey || e.metaKey || e.altKey)
      return;
    if (/^[1-9]$/.test(e.key)) {
      e.preventDefault();
      input(Number(e.key));
    } else if (["0", "Backspace", "Delete"].includes(e.key)) {
      e.preventDefault();
      input(0, true);
    }
  });
  $("difficulty").onchange = reset;
  $("restart").onclick = reset;
  reset();
})();
