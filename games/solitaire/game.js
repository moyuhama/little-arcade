(() => {
  "use strict";
  const A = Arcade,
    E = GameEngine,
    P = PlayingCards,
    $ = A.$;
  let state,
    selected = null,
    history = [];
  const same = (a, b) =>
    a && b && a.type === b.type && a.pile === b.pile && a.index === b.index;
  const targetName = (t) =>
    t.type === "foundation"
      ? P.suitNames[t.pile] + "收牌区"
      : `第 ${t.pile + 1} 列`;
  function empty(text, label, fn) {
    return A.button(text, label, fn, "playing-card empty-card");
  }
  function slot(title, button) {
    const node = document.createElement("div");
    node.className = "card-slot";
    const label = document.createElement("span");
    label.className = "card-slot-label";
    label.textContent = title;
    node.append(label, button);
    return node;
  }
  function mark(button, source) {
    if (same(selected, source)) button.classList.add("selected");
    return button;
  }
  function choose(source) {
    if (state.won) return;
    const list = E.cards(state, source);
    if (!list.length) return;
    selected = same(selected, source) ? null : source;
    render();
    A.status(
      selected
        ? `已选 ${P.name(list[0])}${list.length > 1 ? ` 起的 ${list.length} 张牌` : ""}，点击目标列或收牌区。`
        : "已取消选牌。",
    );
  }
  function commit(next) {
    if (next === state) return false;
    history.push(state);
    state = next;
    selected = null;
    render();
    if (state.won) {
      A.completed();
      A.status(`全部收齐！用了 ${state.moves} 步。`);
      A.overlay(
        "一副牌，理顺啦",
        `52 张全部归位，本局 ${state.moves} 步。`,
        "再开一局",
        reset,
      );
    } else A.status("移动完成。继续寻找红黑交替、点数相邻的牌。");
    return true;
  }
  function destination(target, fallback) {
    if (state.won) return;
    if (selected && commit(E.move(state, selected, target))) return;
    if (fallback) choose(fallback);
    else
      A.status(
        target.type === "foundation"
          ? "收牌区需要同花色，从 A 开始依次递增。"
          : "空列只能放 K 或以 K 开头的整段牌。",
      );
  }
  function render() {
    const stock = empty(
      state.stock.length ? "▧" : "↶",
      state.stock.length
        ? `翻一张牌，剩余 ${state.stock.length} 张`
        : "回收已翻开的牌",
      draw,
    );
    if (state.stock.length) {
      stock.classList.remove("empty-card");
      stock.classList.add("card-back");
      stock.textContent = "";
    }
    stock.disabled = state.won || (!state.stock.length && !state.waste.length);
    const waste = state.waste.length
      ? mark(
          P.card(
            state.waste.at(-1),
            "翻牌区，" + P.name(state.waste.at(-1)),
            () => choose({ type: "waste" }),
          ),
          { type: "waste" },
        )
      : empty("—", "翻牌区暂无牌");
    if (!state.waste.length) waste.disabled = true;
    const row = [
      slot(`牌堆 ${state.stock.length}`, stock),
      slot("翻牌区", waste),
    ];
    state.foundations.forEach((pile, i) => {
      const target = { type: "foundation", pile: i },
        fn = () => destination(target, pile.length ? target : null);
      const b = pile.length
        ? mark(
            P.card(
              pile.at(-1),
              `${P.suitNames[i]}收牌区，${P.name(pile.at(-1))}`,
              fn,
            ),
            target,
          )
        : empty(P.suits[i], `${P.suitNames[i]}收牌区，等待 A`, fn);
      row.push(slot(P.suitNames[i], b));
    });
    $("stock-row").replaceChildren(...row);
    const columns = state.tableau.map((pile, col) => {
      const node = document.createElement("div");
      node.className = "tableau-column";
      node.setAttribute("role", "group");
      node.setAttribute("aria-label", `第 ${col + 1} 列`);
      const label = document.createElement("span");
      label.className = "card-slot-label";
      label.textContent = col + 1;
      node.append(label);
      const stack = document.createElement("div");
      stack.className = "card-stack";
      let offset = 0;
      if (!pile.cards.length)
        stack.append(
          empty("K", `第 ${col + 1} 列空位，只能放 K`, () =>
            destination({ type: "tableau", pile: col }),
          ),
        );
      pile.cards.forEach((id, index) => {
        let b;
        const source = { type: "tableau", pile: col, index };
        if (index < pile.up) {
          b = empty("", `第 ${col + 1} 列，未翻开的牌`);
          b.className = "playing-card card-back";
          b.disabled = true;
          b.setAttribute("aria-hidden", "true");
        } else
          b = P.card(
            id,
            `第 ${col + 1} 列，${P.name(id)}${index < pile.cards.length - 1 ? "，连同下方牌" : ""}`,
            () => destination({ type: "tableau", pile: col }, source),
          );
        if (
          selected?.type === "tableau" &&
          selected.pile === col &&
          index >= selected.index
        )
          b.classList.add("selected");
        b.style.top = offset + "px";
        b.style.zIndex = String(index + 1);
        stack.append(b);
        if (index < pile.cards.length - 1) offset += index < pile.up ? 12 : 24;
      });
      stack.style.setProperty("--stack-offset", offset + "px");
      node.append(stack);
      return node;
    });
    $("tableau").replaceChildren(...columns);
    A.score(
      state.foundations.reduce((n, p) => n + p.length, 0) + "/52",
      state.moves,
    );
    $("undo").disabled = !history.length || state.won;
    $("hint").disabled = state.won;
    $("collect").disabled = state.won;
  }
  function draw() {
    const recycling = !state.stock.length;
    if (commit(E.draw(state)))
      A.status(
        recycling
          ? "已回收翻牌区的牌。再点牌堆，开始新一轮。"
          : state.stock.length
            ? "翻开一张新牌。可以移动翻牌区最上方这一张。"
            : state.waste.length
              ? "牌堆翻完了。点左上角回收，再翻一轮。"
              : "牌堆已空，继续整理桌面。",
      );
  }
  function undo() {
    if (!history.length || state.won) return;
    state = history.pop();
    selected = null;
    render();
    A.status("已撤销上一步，翻牌和回收也可以撤销。");
  }
  function reset() {
    state = E.create();
    history = [];
    selected = null;
    A.hideOverlay();
    render();
    A.status("点一张正面牌，再点目标位置。红黑交替，点数依次减一。");
  }
  $("hint").onclick = () => {
    const hint = E.hint(state);
    if (hint) {
      selected = hint.source;
      render();
      A.status(
        `试试把 ${P.name(E.cards(state, hint.source)[0])} 放到${targetName(hint.target)}。`,
      );
    } else
      A.status(
        state.stock.length || state.waste.length
          ? "桌面暂时没有可提示的移动，翻下一张或回收牌堆试试。"
          : "暂时没有可提示的移动，可以撤销或重新开局。",
      );
  };
  $("collect").onclick = () => {
    let hint = null;
    if (selected) {
      const list = E.cards(state, selected);
      if (list.length === 1) {
        const target = { type: "foundation", pile: E.suit(list[0]) };
        if (E.canMove(state, selected, target))
          hint = { source: selected, target };
      }
    } else hint = E.hint(state, true);
    if (hint) commit(E.move(state, hint.source, hint.target));
    else
      A.status(
        "暂时不能把所选牌收走。收牌区需要同花色的下一个点数；可取消选择后再试。",
      );
  };
  $("undo").onclick = undo;
  $("restart").onclick = reset;
  document.addEventListener("keydown", (e) => {
    if (
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      e.target.matches("input,select,textarea")
    )
      return;
    if (e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
    } else if (e.key.toLowerCase() === "n") {
      e.preventDefault();
      draw();
    }
  });
  reset();
})();
