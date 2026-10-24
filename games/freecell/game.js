(() => {
  "use strict";
  const A = Arcade,
    E = GameEngine,
    $ = A.$,
    symbols = ["♠", "♥", "♣", "♦"];
  let packet = A.read("run"),
    state = E.restore(packet),
    selected = null,
    practice = false,
    official = null,
    practiceActions = [];
  let won = A.read("dealsWon");
  won = Array.isArray(won)
    ? [
        ...new Set(
          won.filter((n) => Number.isInteger(n) && n >= 1 && n <= 1000000),
        ),
      ]
    : [];
  if (!state) {
    packet = { version: 1, deal: 1, actions: [] };
    state = E.create(1);
  }
  const text = (id) =>
    `${{ 1: "A", 11: "J", 12: "Q", 13: "K" }[E.rank(id)] || E.rank(id)}${symbols[E.suit(id)]}`;
  function persist() {
    if (!practice) A.store("run", packet);
  }
  function target(to) {
    if (!selected) {
      A.status("先点击要移动的牌，再点击目标空当、列编号或收牌区。");
      return;
    }
    const next = E.act(state, { from: selected, to });
    if (next === state) {
      A.status(
        to.zone === "tableau"
          ? `接牌要红黑交替且恰好小 1；当前空位支持向这里移动最多 ${E.capacity(state, to)} 张。`
          : "空当只能临时放一张牌；收牌区要按同花色 A 到 K 递增。",
      );
      return;
    }
    move({ from: selected, to });
  }
  function choose(from) {
    if (!E.source(state, from)) {
      A.status("这一段还没有按红黑交替、点数递减排好，请从更下面的牌开始选。");
      return;
    }
    selected = JSON.stringify(selected) === JSON.stringify(from) ? null : from;
    render();
  }
  function render() {
    const focused = document.activeElement?.dataset?.focusKey;
    A.score(
      state.foundations.reduce((sum, p) => sum + p.length, 0) + "/52",
      state.moves,
    );
    $("number").value = state.deal;
    $("deal-note").textContent = practice
      ? "教学牌局 · 正式进度已保留"
      : `编号 ${state.deal.toLocaleString()} / 1,000,000 · 已完成 ${won.length} 个不同编号 · 四个空当用于临时存牌`;
    $("practice").textContent = practice ? "返回正式牌局" : "三步入门练习";
    $("undo").disabled = !(practice ? practiceActions : packet.actions).length;
    $("hint").disabled = state.won;
    $("auto").disabled = !E.safeHome(state);
    $("cells").replaceChildren(
      ...state.cells.map((id, col) => {
        const b = A.button(
          id === null ? `空当 ${col + 1}` : text(id),
          id === null
            ? `空当 ${col + 1}，空位`
            : `空当 ${col + 1}，${text(id)}`,
          () => {
            if (selected && E.canMove(state, selected, { zone: "cell", col }))
              target({ zone: "cell", col });
            else if (id !== null) choose({ zone: "cell", col });
            else target({ zone: "cell", col });
          },
          "free-slot" + (id !== null && E.color(id) ? " red" : ""),
        );
        b.disabled = state.won;
        b.dataset.focusKey = "cell-" + col;
        b.classList.toggle(
          "chosen",
          selected?.zone === "cell" && selected.col === col,
        );
        return b;
      }),
    );
    $("foundations").replaceChildren(
      ...state.foundations.map((p, col) => {
        const b = A.button(
          p.length ? text(p.at(-1)) : `${symbols[col]} A→K`,
          `${symbols[col]}收牌区，已收 ${p.length} 张`,
          () => target({ zone: "foundation", col }),
          "free-slot home" + (col % 2 ? " red" : ""),
        );
        b.disabled = state.won;
        b.dataset.focusKey = "home-" + col;
        return b;
      }),
    );
    const board = $("board");
    board.replaceChildren();
    state.tableau.forEach((pile, col) => {
      const column = document.createElement("div");
      column.className = "free-column";
      const head = A.button(
        String(col + 1),
        `放到第 ${col + 1} 列`,
        () => target({ zone: "tableau", col }),
        "column-target",
      );
      head.dataset.focusKey = "column-" + col;
      head.disabled = state.won;
      column.append(head);
      const stack = document.createElement("div");
      stack.className = "card-stack";
      stack.style.height = `${Math.max(1, pile.length) * 25 + 52}px`;
      if (!pile.length)
        stack.append(
          A.button(
            "空列",
            `第 ${col + 1} 列空位`,
            () => target({ zone: "tableau", col }),
            "empty-card",
          ),
        );
      pile.forEach((id, index) => {
        const b = A.button(
          text(id),
          `第 ${col + 1} 列，第 ${index + 1} 张，${text(id)}`,
          () => {
            if (
              selected &&
              E.canMove(state, selected, { zone: "tableau", col })
            )
              target({ zone: "tableau", col });
            else choose({ zone: "tableau", col, index });
          },
          "free-card" + (E.color(id) ? " red" : ""),
        );
        b.style.top = `${index * 25}px`;
        b.dataset.focusKey = "card-" + id;
        b.classList.toggle(
          "chosen",
          selected?.zone === "tableau" &&
            selected.col === col &&
            index >= selected.index,
        );
        b.disabled = state.won;
        stack.append(b);
      });
      column.append(stack);
      board.append(column);
    });
    if (focused)
      document
        .querySelector(`[data-focus-key="${focused}"]`)
        ?.focus({ preventScroll: true });
    $("result").hidden = !state.won;
    $("result").textContent = practice
      ? "教学完成！空当帮你挪开挡路的牌；回到正式牌局试试。"
      : `编号 ${state.deal} 完成，用了 ${state.moves} 步。这个编号只计一次完成纪录。`;
    $("guide").textContent = state.won
      ? "已全部收齐，可以撤销复盘或换一个编号挑战。"
      : practice
        ? state.foundations[0].length === 12
          ? "练习 ③：选中空当里的 K，再点黑桃收牌区。"
          : state.cells.some((id) => id !== null)
            ? "练习 ②：点击第 1 列的 Q，再点黑桃收牌区。"
            : "练习 ①：K 挡住了 Q。先点第 1 列的 K，再点左上“空当 1”临时存放。"
        : selected
          ? "已经选牌：点击目标列、空当或收牌区。空当和空列越多，可以整段移动的牌越多。"
          : "所有牌开局可见。红黑交替递减排牌，利用四个空当周转，最后按同花色 A → K 收齐。手机可横向滑动牌桌。";
  }
  function move(action) {
    const next = E.act(state, action);
    if (next === state) return;
    state = next;
    (practice ? practiceActions : packet.actions).push(action);
    if (!practice && state.won && !won.includes(state.deal)) {
      won.push(state.deal);
      A.store("dealsWon", won);
      A.completed();
    }
    selected = null;
    persist();
    render();
    A.status(state.won ? "全部收齐！" : "移动已保存，可随时撤销。");
  }
  function fresh(deal) {
    practice = false;
    official = null;
    packet = { version: 1, deal, actions: [] };
    state = E.create(deal);
    selected = null;
    persist();
    render();
    A.status(
      "已打开固定编号牌局。本编号由本站生成，与其它软件的同编号不一定相同；未经逐局求解，不保证全部可解。",
    );
  }
  $("open").onclick = () => {
    const deal = Number($("number").value);
    if (!Number.isInteger(deal) || deal < 1 || deal > 1000000) {
      A.status("请输入 1 到 1,000,000 之间的整数。");
      return;
    }
    Deep.confirm(() => fresh(deal));
  };
  $("restart").onclick = () => Deep.confirm(() => fresh(state.deal));
  $("random").onclick = () =>
    Deep.confirm(() => fresh(1 + (Deep.seed() % 1000000)));
  $("daily").onclick = () => {
    const d = new Date(),
      date = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    let hash = 0;
    for (const c of date) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
    Deep.confirm(() => {
      fresh((hash % 1000000) + 1);
      A.status(`${date} 的每日固定牌局。`);
    });
  };
  $("auto").onclick = () => {
    const a = E.safeHome(state);
    if (a) move(a);
  };
  $("hint").onclick = () => {
    const h = E.hint(state);
    if (!h) {
      A.status("没有找到合法移动，尝试撤销并换一条整理路线。");
      return;
    }
    selected = h.from;
    render();
    A.status(
      `建议把 ${text(E.source(state, h.from)[0])} 开始的牌移到${h.to.zone === "tableau" ? "第 " + (h.to.col + 1) + " 列" : h.to.zone === "cell" ? "空当 " + (h.to.col + 1) : symbols[h.to.col] + " 收牌区"}。提示只建议当前移动，不保证通关。`,
    );
  };
  $("undo").onclick = () => {
    const actions = practice ? practiceActions : packet.actions;
    if (!actions.length) return;
    actions.pop();
    state = practice
      ? actions.reduce((s, a) => E.act(s, a), E.practice())
      : E.restore(packet);
    selected = null;
    persist();
    render();
  };
  $("practice").onclick = () => {
    if (practice) {
      packet = official;
      state = E.restore(packet);
      practice = false;
    } else {
      official = packet;
      practiceActions = [];
      practice = true;
      state = E.practice();
    }
    selected = null;
    render();
  };
  persist();
  render();
})();
