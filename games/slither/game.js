(() => {
  "use strict";
  const A = Arcade,
    E = GameEngine,
    $ = A.$;
  let mode = 1,
    edges = [],
    clues = [],
    dots = [],
    focus = 0,
    controller;
  controller = NetworkGame.start({
    puzzles: SlitherPuzzles,
    build(p, input) {
      const board = $("board"),
        g = E.geometry(p.size),
        n = p.size;
      board.replaceChildren();
      board.style.setProperty("--size", n);
      edges = [];
      clues = [];
      dots = [];
      focus = 0;
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++) {
          const label = document.createElement("span");
          label.className = "loop-clue";
          label.style.left = `${((c + 1) / (n + 1)) * 100}%`;
          label.style.top = `${((r + 1) / (n + 1)) * 100}%`;
          label.textContent = p.clues[r * n + c] < 0 ? "" : p.clues[r * n + c];
          board.append(label);
          clues.push(label);
        }
      for (let r = 0; r <= n; r++)
        for (let c = 0; c <= n; c++) {
          const dot = document.createElement("span");
          dot.className = "loop-dot";
          dot.style.left = `${((c + 0.5) / (n + 1)) * 100}%`;
          dot.style.top = `${((r + 0.5) / (n + 1)) * 100}%`;
          board.append(dot);
          dots.push(dot);
        }
      g.edges.forEach((e, i) => {
        const b = A.button(
          "",
          "",
          () => input({ index: i, value: mode }),
          "loop-edge " + (e.axis ? "vertical" : "horizontal"),
        );
        b.style.left = `${((e.c + (e.axis ? 0.5 : 1)) / (n + 1)) * 100}%`;
        b.style.top = `${((e.r + (e.axis ? 1 : 0.5)) / (n + 1)) * 100}%`;
        b.style.setProperty("--length", `${100 / (n + 1)}%`);
        b.addEventListener("contextmenu", (ev) => {
          ev.preventDefault();
          input({ index: i, value: 0 });
        });
        b.addEventListener("focus", () => {
          focus = i;
          edges.forEach((b, j) => (b.tabIndex = j === focus ? 0 : -1));
        });
        b.addEventListener("keydown", (ev) => {
          if (["ArrowLeft", "ArrowRight"].includes(ev.key)) {
            ev.preventDefault();
            edges[
              (i + (ev.key === "ArrowLeft" ? -1 : 1) + edges.length) %
                edges.length
            ].focus();
          }
          if (ev.key.toLowerCase() === "x") {
            ev.preventDefault();
            input({ index: i, value: 0 });
          }
        });
        edges.push(b);
        board.append(b);
      });
    },
    render(p, s) {
      const g = E.geometry(p.size);
      edges.forEach((b, i) => {
        const e = g.edges[i];
        b.classList.toggle("on", s.values[i] === 1);
        b.classList.toggle("off", s.values[i] === 0);
        b.textContent = s.values[i] === 0 ? "×" : "";
        b.disabled = s.won;
        b.tabIndex = focus === i ? 0 : -1;
        b.setAttribute(
          "aria-label",
          `${e.axis ? "竖" : "横"}线第 ${e.r + 1} 行第 ${e.c + 1} 段，${s.values[i] === 1 ? "已画线" : s.values[i] === 0 ? "已排除" : "未确定"}`,
        );
      });
      g.cells.forEach((es, i) => {
        const on = es.filter((e) => s.values[e] === 1).length,
          unknown = es.filter((e) => s.values[e] === -1).length;
        clues[i].classList.toggle("done", p.clues[i] >= 0 && on === p.clues[i]);
        clues[i].classList.toggle(
          "error",
          p.clues[i] >= 0 && (on > p.clues[i] || on + unknown < p.clues[i]),
        );
      });
      g.vertices.forEach((es, i) =>
        dots[i].classList.toggle(
          "error",
          es.filter((e) => s.values[e] === 1).length > 2,
        ),
      );
      $("line").classList.toggle("active", mode === 1);
      $("cross").classList.toggle("active", mode === 0);
      $("line").setAttribute("aria-pressed", String(mode === 1));
      $("cross").setAttribute("aria-pressed", String(mode === 0));
      $("connection").textContent =
        `已画 ${s.values.filter((v) => v === 1).length} 条边 · 所有线必须连成唯一闭环，不能分叉或形成多个小圈`;
    },
    guide(p) {
      return p.id === 0
        ? "第一课：左边两格都写着 3。沿着这两格的外边框画一个长方形，形成一条闭环；两格中间的横线不要画。"
        : "数字表示该格四周有几条线。先从 0、3 和角落推理；线不能分叉或留断头，最后只有一个圈。大棋盘可横向滑动。";
    },
    hint(p, s) {
      const h = E.hint(s, p);
      if (!h) return null;
      const values = [...s.values];
      values[h.index] = h.value;
      focus = h.index;
      edges[h.index].focus();
      return {
        state: { ...s, values, won: E.solved(p, values) },
        text: h.text,
      };
    },
    feedback() {
      return "标记已保存。数字达标后，还要检查整条回路是否闭合。";
    },
  });
  $("line").onclick = () => {
    mode = 1;
    controller.refresh();
  };
  $("cross").onclick = () => {
    mode = 0;
    controller.refresh();
  };
})();
