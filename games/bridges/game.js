(() => {
  "use strict";
  const A = Arcade,
    E = GameEngine,
    $ = A.$;
  let selected = -1,
    cells = [],
    lines = [],
    current,
    currentState,
    input;
  const NS = "http://www.w3.org/2000/svg";
  const view = {
    puzzles: BridgePuzzles,
    build(p, fn) {
      current = p;
      input = fn;
      selected = -1;
      cells = [];
      lines = [];
      const board = $("board");
      board.replaceChildren();
      board.style.setProperty("--size", p.size);
      const svg = document.createElementNS(NS, "svg");
      svg.setAttribute("viewBox", `-1 -1 ${p.size + 1} ${p.size + 1}`);
      svg.setAttribute("aria-hidden", "true");
      board.append(svg);
      p.edges.forEach(([a, b], i) => {
        const group = document.createElementNS(NS, "g");
        for (let k = 0; k < 2; k++) {
          const line = document.createElementNS(NS, "line");
          group.append(line);
        }
        svg.append(group);
        lines.push(group);
      });
      p.islands.forEach((island, i) => {
        const b = A.button(
          String(island.n),
          "",
          () => {
            if (currentState.won) return;
            if (selected === i) {
              selected = -1;
              render(p, currentState);
              return;
            }
            const edge = p.edges.findIndex(
              ([a, b]) =>
                (a === selected && b === i) || (b === selected && a === i),
            );
            if (edge >= 0) {
              selected = -1;
              input(edge);
            } else {
              selected = i;
              render(p, currentState);
              A.status(`已选第 ${i + 1} 座岛，再点同一横线或竖线上最近的岛。`);
            }
          },
          "island",
        );
        b.style.left = `${((island.x + 1) / (p.size + 1)) * 100}%`;
        b.style.top = `${((island.y + 1) / (p.size + 1)) * 100}%`;
        board.append(b);
        cells.push(b);
      });
    },
    render,
    guide(p, s) {
      return p.id === 0
        ? "入门：点左上角的 3，再点右上角的 1，搭一座桥。两座 3 之间要双桥；右侧两个 1 不能连成孤岛。"
        : "数字是这座岛需要的桥数。连接相邻岛：一次单桥、再次双桥、第三次拆除。所有岛最终要连成一片。";
    },
    feedback(p, s, i) {
      return E.act(s, p, i) === s
        ? "这条桥会与已有的桥交叉，先拆除交叉的桥。"
        : "桥已更新。数字达标还不够，所有岛都要连通。";
    },
    hint(p, s) {
      let i = s.values.findIndex((v, i) => v > p.solution[i]);
      if (i < 0) i = s.values.findIndex((v, i) => v !== p.solution[i]);
      if (i < 0) return null;
      const values = [...s.values];
      values[i] = p.solution[i];
      const [a, b] = p.edges[i];
      selected = -1;
      return {
        state: { ...s, values, won: E.solved(p, values) },
        text: `答案提示：第 ${a + 1} 岛与第 ${b + 1} 岛之间应有 ${values[i]} 座桥。已调整这一处；结合岛上总数和全图连通继续推理。`,
      };
    },
  };
  function render(p, s) {
    currentState = s;
    const sums = E.totals(p, s.values);
    cells.forEach((b, i) => {
      const island = p.islands[i];
      b.classList.toggle("selected", selected === i);
      b.classList.toggle("done", sums[i] === island.n);
      b.classList.toggle("over", sums[i] > island.n);
      b.classList.toggle(
        "neighbor",
        selected >= 0 &&
          p.edges.some(
            ([a, c]) =>
              (a === selected && c === i) || (c === selected && a === i),
          ),
      );
      b.setAttribute(
        "aria-label",
        `第 ${i + 1} 岛，需要 ${island.n} 座桥，已有 ${sums[i]} 座`,
      );
      b.setAttribute("aria-pressed", String(selected === i));
      b.disabled = s.won;
    });
    p.edges.forEach(([a, b], i) => {
      const start = p.islands[a],
        end = p.islands[b],
        horizontal = start.y === end.y;
      [...lines[i].children].forEach((line, k) => {
        const offset = s.values[i] === 2 ? (k ? 0.09 : -0.09) : 0;
        line.setAttribute("x1", start.x + (horizontal ? 0 : offset));
        line.setAttribute("y1", start.y + (horizontal ? offset : 0));
        line.setAttribute("x2", end.x + (horizontal ? 0 : offset));
        line.setAttribute("y2", end.y + (horizontal ? offset : 0));
        line.style.display = k < s.values[i] ? "" : "none";
      });
    });
    $("connection").textContent =
      `数字达标 ${sums.filter((n, i) => n === p.islands[i].n).length} / ${p.islands.length} · ${E.connected(p, s.values) ? "已连成一片" : "还有岛未连通"}`;
  }
  NetworkGame.start(view);
})();
