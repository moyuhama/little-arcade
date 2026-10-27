(() => {
  "use strict";
  const A = Arcade,
    E = GameEngine,
    $ = A.$,
    symbols = ["♠", "♥", "♣", "♦"],
    names = ["黑桃", "红桃", "梅花", "方块"];
  let packet = A.read("run"),
    state = E.restore(packet),
    selected = null,
    hintTarget = -1,
    practice = false;
  if (!state) {
    packet = {
      version: 1,
      seed: Deep.seed(),
      suits: 1,
      actions: [],
      daily: "",
    };
    state = E.restore(packet);
  }
  let official = null,
    practiceActions = [];
  function cardText(id) {
    const rank = E.rank(id);
    return `${rank === 1 ? "A" : rank === 11 ? "J" : rank === 12 ? "Q" : rank === 13 ? "K" : rank}${symbols[E.suit(id, state.suits)]}`;
  }
  function persist() {
    if (!practice) {
      A.store("run", packet);
      if (packet.daily)
        A.store("daily-" + packet.daily + "-" + packet.suits, packet);
    }
  }
  function render() {
    const focused = document.activeElement?.dataset?.focusKey;
    const board = $("board");
    board.replaceChildren();
    state.tableau.forEach((pile, col) => {
      const column = document.createElement("div");
      column.className = "spider-column";
      column.classList.toggle("hint-target", col === hintTarget);
      const head = A.button(
        `${col + 1}`,
        `放到第 ${col + 1} 列`,
        () => target(col),
        "column-target",
      );
      head.dataset.focusKey = `column-${col}`;
      head.disabled = done();
      column.append(head);
      const cards = document.createElement("div");
      cards.className = "card-stack";
      cards.style.setProperty(
        "--stack-offset",
        `${Math.max(0, pile.cards.length - 1) * 24}px`,
      );
      cards.addEventListener("click", (e) => {
        if (e.target === cards) target(col);
      });
      if (!pile.cards.length) {
        cards.append(
          A.button(
            "空位",
            `第 ${col + 1} 列空位`,
            () => target(col),
            "empty-card",
          ),
        );
      }
      pile.cards.forEach((id, index) => {
        const face = index >= pile.up,
          b = A.button(
            face ? cardText(id) : "",
            "",
            () => {
              if (
                selected &&
                E.canMove(state, selected.from, selected.index, col)
              ) {
                target(col);
                return;
              }
              if (!E.movable(state, col, index)) {
                A.status(
                  "只能移动同花色、依次递减的一整段明牌。先把不同花色的牌拆开。",
                );
                return;
              }
              if (selected?.from === col && selected.index === index)
                selected = null;
              else selected = { from: col, index };
              hintTarget = -1;
              render();
              A.status(
                selected
                  ? `已选第 ${col + 1} 列的 ${cardText(id)} 起的一段，点击目标列编号或牌面。`
                  : "已取消选择。",
              );
            },
            "spider-card",
          );
        b.dataset.focusKey = `card-${id}`;
        b.style.top = `${index * 24}px`;
        b.classList.toggle("back", !face);
        b.classList.toggle("red", [1, 3].includes(E.suit(id, state.suits)));
        b.classList.toggle(
          "chosen",
          selected?.from === col && index >= selected.index,
        );
        b.disabled = !face || done();
        b.setAttribute(
          "aria-label",
          face
            ? `第 ${col + 1} 列，第 ${index + 1} 张，${names[E.suit(id, state.suits)]}${E.rank(id)}${E.movable(state, col, index) ? "，可选择这一段" : ""}`
            : `第 ${col + 1} 列，暗牌`,
        );
        cards.append(b);
      });
      column.append(cards);
      board.append(column);
    });
    if (focused)
      document
        .querySelector(`[data-focus-key="${focused}"]`)
        ?.focus({ preventScroll: true });
    A.score(state.finished.length + (practice ? "/1" : "/8"), state.moves);
    $("mode").value = state.suits;
    $("undo").disabled = !(practice
      ? practiceActions.length
      : packet.actions.length);
    $("deal").disabled =
      practice ||
      done() ||
      state.stock.length < 10 ||
      state.tableau.some((p) => !p.cards.length);
    $("hint").disabled = done();
    $("stock-note").textContent = practice
      ? "教学牌局 · 不影响正式存档"
      : `剩余 ${Math.floor(state.stock.length / 10)} 轮发牌 · ${packet.daily ? "每日牌局 " + packet.daily : "随机牌局"} · 本档已赢 ${A.number("wins" + state.suits)} 局`;
    $("practice").textContent = practice ? "返回正式牌局" : "一分钟练习";
    $("result").hidden = !done();
    $("result").textContent = practice
      ? "这整套 K 到 A 已自动收走！返回正式牌局，试着整理八套。"
      : `八套全部收齐，用了 ${state.moves} 步。可以换个难度再挑战。`;
    $("guide").textContent = done()
      ? "已经完成！可以撤销复盘，也可以开始新的挑战。"
      : practice
        ? "练习：先点第 2 列的 A，再点第 1 列。把同花色 K 到 A 排齐，会自动收走。"
        : selected
          ? "再点目标列：只要顶牌比所选第一张大 1，就能接上；空列可放任意可移动的一段。"
          : "先从一花色开始：牌按 K → A 递减排列；同花色连续一段才能一起移动。收齐八套获胜。手机可横向滑动牌桌查看十列。";
  }
  function done() {
    return state.won || (practice && state.finished.length > 0);
  }
  function action(a) {
    if (done()) return;
    const next = E.act(state, a);
    if (next === state) return;
    state = next;
    if (practice) practiceActions.push(a);
    else {
      packet.actions.push(a);
      if (state.won && !packet.counted) {
        packet.counted = true;
        A.store("wins" + state.suits, A.number("wins" + state.suits) + 1);
        A.completed();
      }
    }
    selected = null;
    hintTarget = -1;
    persist();
    render();
    A.status(
      done()
        ? "全部收齐，恭喜！"
        : state.finished.length
          ? "已整理收牌，可以继续寻找同花色长序列。"
          : "移动已保存。",
    );
  }
  function target(col) {
    if (!selected) {
      A.status("先点一张明牌，选择要移动的整段。");
      return;
    }
    if (!E.canMove(state, selected.from, selected.index, col)) {
      A.status("这里接不上：目标顶牌必须恰好大 1，或选择空列。");
      return;
    }
    action({ ...selected, to: col });
  }
  function fresh(suits, daily = "") {
    practice = false;
    official = null;
    let seed = Deep.seed();
    if (daily) {
      seed = 0;
      for (const c of daily + ":" + suits)
        seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
    }
    const old = A.read("daily-" + daily + "-" + suits);
    packet =
      daily && E.restore(old)
        ? old
        : { version: 1, seed, suits, actions: [], daily };
    state = E.restore(packet);
    selected = null;
    hintTarget = -1;
    persist();
    render();
    A.status(
      daily
        ? "同一天、同难度是同一副牌，保留已完成纪录。"
        : "新牌局已发好。随机发牌不保证可解，可以撤销研究。",
    );
  }
  $("deal").onclick = () => action({ deal: true });
  $("hint").onclick = () => {
    const h = E.hint(state);
    if (!h) {
      A.status(
        state.tableau.some((p) => !p.cards.length)
          ? "暂时没有推荐移动。先把空列填上，才能发下一轮。"
          : state.stock.length
            ? "暂时没有推荐移动，可以发下一轮。"
            : "没有推荐移动，可以撤销或重新开局。",
      );
      return;
    }
    selected = { from: h.from, index: h.index };
    hintTarget = h.to;
    render();
    A.status(
      `建议把第 ${h.from + 1} 列 ${cardText(state.tableau[h.from].cards[h.index])} 开始的一段移到第 ${h.to + 1} 列。点目标列执行；提示不保证通关。`,
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
    hintTarget = -1;
    persist();
    render();
    A.status("已撤销，可试另一条整理路线。");
  };
  $("restart").onclick = () => Deep.confirm(() => fresh(state.suits));
  $("mode").onchange = () => {
    const suits = Number($("mode").value);
    $("mode").value = state.suits;
    Deep.confirm(
      () => fresh(suits),
      "切换难度并开始新牌局；当前牌局会被替换，胜局纪录保留。",
    );
  };
  $("daily").onclick = () => {
    const d = new Date(),
      date = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    Deep.confirm(
      () => fresh(state.suits, date),
      "进入今天这档难度的固定牌局。当前随机牌局会被替换。",
    );
  };
  $("practice").onclick = () => {
    if (practice) {
      packet = official;
      state = E.restore(packet);
      practice = false;
      official = null;
    } else {
      official = packet;
      practice = true;
      practiceActions = [];
      state = E.practice();
    }
    selected = null;
    hintTarget = -1;
    render();
    A.status(
      practice ? "练习只需移动一次，正式牌局已保留。" : "已返回正式牌局。",
    );
  };
  persist();
  render();
})();
