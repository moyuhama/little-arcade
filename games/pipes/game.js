(() => {
  "use strict";
  const A = Arcade,
    E = GameEngine,
    $ = A.$;
  let cells = [],
    lockMode = false,
    controller,
    focus = 0;
  const glyph = (mask) =>
    `<svg viewBox="0 0 60 60" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round">${[
      [1, 30, 0],
      [2, 60, 30],
      [4, 30, 60],
      [8, 0, 30],
    ]
      .filter(([bit]) => mask & bit)
      .map(([, x, y]) => `<path d="M30 30L${x} ${y}"/>`)
      .join("")}</g><circle cx="30" cy="30" r="6" fill="currentColor"/></svg>`;
  controller = NetworkGame.start({
    puzzles: PipePuzzles,
    build(p, input) {
      const board = $("board");
      board.replaceChildren();
      board.style.setProperty("--size", p.size);
      focus = 0;
      cells = [];
      for (let i = 0; i < p.size * p.size; i++) {
        const b = A.button(
          "",
          "",
          () => input({ index: i, lock: lockMode }),
          "pipe-cell",
        );
        b.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          input({ index: i, reverse: true });
        });
        b.addEventListener("focus", () => {
          focus = i;
          cells.forEach((c, j) => (c.tabIndex = i === j ? 0 : -1));
        });
        b.addEventListener("keydown", (e) => {
          const d = {
            ArrowLeft: -1,
            ArrowRight: 1,
            ArrowUp: -p.size,
            ArrowDown: p.size,
          }[e.key];
          if (d !== undefined) {
            e.preventDefault();
            if (cells[i + d]) cells[i + d].focus();
          }
        });
        cells.push(b);
        board.append(b);
      }
    },
    render(p, s) {
      const info = E.inspect(s.board, p.size),
        center = Math.floor(s.board.length / 2);
      cells.forEach((b, i) => {
        b.innerHTML =
          glyph(s.board[i]) +
          `<span class="pipe-marker">${s.locked[i] ? "●" : i === center ? "源" : ""}</span>`;
        b.classList.toggle("wet", info.reached.includes(i));
        b.classList.toggle("leak", info.leaks.includes(i));
        b.classList.toggle("locked", s.locked[i]);
        b.disabled = s.won;
        b.tabIndex = i === focus ? 0 : -1;
        const directions = ["上", "右", "下", "左"]
          .filter((_, d) => s.board[i] & E.bits[d])
          .join("、");
        b.setAttribute(
          "aria-label",
          `第 ${Math.floor(i / p.size) + 1} 行第 ${(i % p.size) + 1} 列，开口${directions}${i === center ? "，水源" : ""}${s.locked[i] ? "，已锁定" : ""}${info.reached.includes(i) ? "，已通水" : "，未通水"}`,
        );
      });
      $("lock").classList.toggle("active", lockMode);
      $("lock").setAttribute("aria-pressed", String(lockMode));
      $("lock").textContent = lockMode ? "● 锁定模式" : "○ 旋转模式";
      $("connection").textContent =
        `通水 ${info.reached.length} / ${s.board.length} · ${info.leaks.length} 个管件有未接好的开口`;
    },
    guide(p, s) {
      return p.id === 0
        ? "第一题只差一步：点击正中央带“源”的管件，让它顺时针旋转，所有管道就能接通。绿色代表与水源相连；粉色小点表示还有开口没接好。"
        : "点击顺时针旋转，鼠标右键逆时针。所有管件要接到中间水源，开口不能悬空或朝向边界。确定方向后可切到锁定模式保护它。大棋盘可横向滑动。";
    },
    feedback(p, s, a) {
      return s.locked[a.index] && !a.lock
        ? "这格已锁定。切到锁定模式后点一下解锁。"
        : a.lock
          ? "锁定状态已更新。"
          : "管件已旋转，看看哪些区域接上了水源。";
    },
    hint(p, s) {
      const i = s.board.findIndex((v, i) => v !== p.solution[i]);
      if (i < 0) return null;
      const board = [...s.board],
        locked = [...s.locked];
      board[i] = p.solution[i];
      locked[i] = false;
      return {
        state: { ...s, board, locked, won: E.inspect(board, p.size).won },
        text: `答案提示：已把第 ${Math.floor(i / p.size) + 1} 行第 ${(i % p.size) + 1} 列转到正确方向。沿着它的开口继续连接。`,
      };
    },
  });
  $("lock").onclick = () => {
    lockMode = !lockMode;
    controller.refresh();
    A.status(
      lockMode
        ? "现在点击管件可锁定或解锁，方向不会改变。"
        : "现在点击管件会顺时针旋转。",
    );
  };
})();
