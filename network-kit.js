/* Shared progress, undo and daily selection for the two network puzzles. */
(() => {
  "use strict";
  globalThis.NetworkGame = {
    start(view) {
      const A = Arcade,
        $ = A.$,
        E = GameEngine,
        P = view.puzzles;
      let saved = A.read("puzzles");
      if (!saved || typeof saved !== "object" || Array.isArray(saved))
        saved = {};
      let completed = A.read("solved");
      completed = Array.isArray(completed)
        ? [...new Set(completed.filter((i) => Number.isInteger(i) && P[i]))]
        : [];
      let puzzle,
        state,
        history = [];
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
      function render() {
        view.render(puzzle, state);
        A.score(completed.length, state.hints);
        $("undo").disabled = !history.length || state.won;
        $("hint").disabled = state.won;
        $("result").hidden = !state.won;
        $("result").textContent =
          `全部连通！用了 ${state.moves} 步、${state.hints} 次提示。下一题继续。`;
        $("puzzle-note").textContent =
          `${puzzle.name} · ${state.moves} 步 · 已完成 ${completed.length} / ${P.length} 题`;
        $("guide").textContent = state.won
          ? "本题已经完成！点击“下一题”继续挑战，或从题目列表选择更大的棋盘。"
          : view.guide(puzzle, state);
      }
      function apply(next, text) {
        if (next === state) {
          if (text) A.status(text);
          return;
        }
        history.push(JSON.parse(JSON.stringify(state)));
        state = next;
        if (state.won && !completed.includes(puzzle.id)) {
          completed.push(puzzle.id);
          A.store("solved", completed);
          A.completed();
        }
        persist();
        render();
        if (state.won) A.status("全部条件达成，完成记录已保存。");
        else if (text) A.status(text);
      }
      function input(action) {
        apply(
          E.act(state, puzzle, action),
          view.feedback?.(puzzle, state, action),
        );
      }
      function load(id) {
        puzzle = P[id] || P[0];
        state = E.restore(saved[puzzle.id], puzzle) || E.create(puzzle);
        history = [];
        $("level").value = puzzle.id;
        view.build(puzzle, input);
        render();
        persist();
        A.status("进度自动保存，可以随时换题或回来继续。");
      }
      $("undo").onclick = () => {
        if (!history.length || state.won) return;
        const hints = state.hints;
        state = history.pop();
        state.hints = hints;
        persist();
        render();
        A.status("已撤销，提示次数保留。");
      };
      $("hint").onclick = () => {
        if (state.won) return;
        const h = view.hint(puzzle, state);
        if (h)
          apply(
            { ...h.state, hints: state.hints + 1, moves: state.moves + 1 },
            h.text,
          );
      };
      $("restart").onclick = () =>
        Deep.confirm(() => {
          state = E.create(puzzle);
          history = [];
          view.build(puzzle, input);
          persist();
          render();
          A.status("本题已重置，完成纪录保留。");
        }, "清空本题进度和提示次数；已完成题数保留。");
      $("level").onchange = () => load(Number($("level").value));
      $("next").onclick = () => load((puzzle.id + 1) % P.length);
      $("daily").onclick = () => {
        const d = new Date(),
          text = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        let hash = 0;
        for (const c of text) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
        load(hash % P.length);
        A.status(`${text} · 每日固定选题，与普通题库共用进度。`);
      };
      load(Number.isInteger(A.read("current")) ? A.read("current") : 0);
      return { refresh: render };
    },
  };
})();
