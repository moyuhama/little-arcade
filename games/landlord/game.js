(() => {
  "use strict";
  const A = Arcade,
    E = GameEngine,
    $ = A.$;
  let packet = A.read("run"),
    state = E.restore(packet),
    paused = !!state,
    selected = new Set(),
    timer = null,
    hintIndex = 0,
    practice = false;
  if (!state) {
    packet = { version: 1, seed: Deep.seed(), actions: [] };
    state = E.create(packet.seed);
    paused = false;
  }
  function persist() {
    if (!practice) A.store("run", packet);
  }
  function card(id, interactive = false) {
    const b = document.createElement(interactive ? "button" : "span"),
      rank = E.rank(id);
    b.className =
      "poker-card" +
      ((id < 52 && [1, 3].includes(id % 4)) || id === 53 ? " red" : "");
    b.innerHTML = `<strong>${E.label(id)}</strong><small>${rank >= 16 ? "JOKER" : ["♠", "♥", "♣", "♦"][id % 4]}</small>`;
    if (interactive) {
      b.dataset.card = id;
      b.type = "button";
      b.setAttribute(
        "aria-label",
        rank >= 16
          ? E.label(id)
          : `${["黑桃", "红桃", "梅花", "方块"][id % 4]} ${E.label(id)}`,
      );
      b.setAttribute("aria-pressed", String(selected.has(id)));
      b.classList.toggle("selected", selected.has(id));
      b.disabled = paused || state.turn !== 0 || state.phase !== "play";
      b.onclick = () => {
        selected.has(id) ? selected.delete(id) : selected.add(id);
        render();
      };
    }
    return b;
  }
  const person = (p) => (p === 0 ? "你" : p === 1 ? "下家" : "上家");
  function role(p) {
    return state.landlord < 0
      ? "等待叫分"
      : p === state.landlord
        ? "地主"
        : "农民";
  }
  function render() {
    const focused = document.activeElement?.dataset?.card;
    A.score(`${state.bid || "—"} × ${state.multiplier}`, A.number("wins"));
    $("pause").textContent = paused ? "继续" : "暂停";
    $("pause").disabled = ["over", "redeal"].includes(state.phase);
    $("practice").textContent = practice ? "退出练习，返回对局" : "新手练习";
    $("opponents").replaceChildren(
      ...[2, 1].map((p) => {
        const box = document.createElement("div");
        box.className = "opponent" + (state.turn === p ? " thinking" : "");
        const title = document.createElement("strong");
        title.textContent = `${person(p)} · ${role(p)} · ${state.hands[p].length} 张`;
        const last = document.createElement("small");
        const cards = state.turnPlays[p];
        last.textContent =
          cards === null
            ? "等待出牌"
            : !cards.length
              ? "不出"
              : `${E.classify(cards).name} ${cards.map(E.label).join(" ")}`;
        box.append(title, last);
        return box;
      }),
    );
    $("bottom").textContent =
      state.landlord < 0
        ? "底牌：▧ ▧ ▧"
        : `底牌：${state.bottom.map(E.label).join(" · ")}${practice ? "教学短牌局" : ""}`;
    $("turn-label").textContent = paused
      ? "对局已暂停"
      : state.phase === "bid"
        ? `${person(state.turn)}正在叫分`
        : state.phase === "play"
          ? `${person(state.turn)}的回合 · ${role(state.turn)}`
          : state.phase === "over"
            ? "本局结束"
            : "全员不叫，请重新发牌";
    $("last-cards").replaceChildren(
      ...(state.last?.cards || []).map((c) => card(c)),
    );
    $("last-label").textContent = state.last
      ? `${person(state.lastPlayer)} · ${state.last.pattern.name}`
      : state.phase === "play"
        ? "自由领出任意合法牌型"
        : "叫分确定地主，地主先出牌";
    $("bid-actions").hidden = state.phase !== "bid";
    $("play-actions").hidden = state.phase !== "play";
    $("bid-actions").replaceChildren(
      ...[0, 1, 2, 3].map((n) => {
        const b = A.button(n ? `叫 ${n} 分` : "不叫", null, () =>
          move({ bid: n }),
        );
        b.disabled = paused || state.turn !== 0 || (n > 0 && n <= state.bid);
        return b;
      }),
    );
    const pattern = E.classify([...selected], state.last?.pattern);
    $("selection").textContent = selected.size
      ? `已选 ${selected.size} 张 · ${pattern ? pattern.name : "尚未组成合法牌型"}${pattern && !E.beats(pattern, state.last?.pattern) ? " · 不能压过上一手" : ""}`
      : `你的手牌 · ${role(0)} · 点击选牌`;
    $("play").disabled =
      paused ||
      state.turn !== 0 ||
      !pattern ||
      !E.beats(pattern, state.last?.pattern);
    $("pass").disabled =
      paused || state.turn !== 0 || !state.last || state.lastPlayer === 0;
    $("hint").disabled = paused || state.turn !== 0;
    $("clear").disabled = !selected.size;
    $("hand").replaceChildren(
      ...state.hands[0]
        .slice()
        .sort((a, b) => b - a)
        .map((c) => card(c, true)),
    );
    if (focused !== undefined)
      document
        .querySelector(`[data-card="${focused}"]`)
        ?.focus({ preventScroll: true });
    $("turn-log").replaceChildren(
      ...state.log.map((text) => {
        const p = document.createElement("p");
        p.textContent = text;
        return p;
      }),
    );
    $("result").hidden = !["over", "redeal"].includes(state.phase);
    const won =
      state.winner === 0 ||
      (state.winner !== state.landlord && state.landlord !== 0);
    $("result").textContent =
      state.phase === "redeal"
        ? "三人都没有叫分。点击“重新发牌”开始下一局。"
        : `${practice ? "练习结束 · " : ""}${won ? "你所在的一方获胜！" : "这局对方获胜。"}${state.spring ? "触发春天 · " : ""}底分 ${state.bid}，${state.multiplier} 倍。${practice ? "点击新手练习按钮可返回正式对局。" : "点击重新发牌继续。"}`;
    $("guide").textContent = practice
      ? state.phase === "over"
        ? "练习结束。你已经试过选牌、跟牌和让牌；点击“退出练习”回到正式对局。"
        : state.playCounts[0] === 0
          ? "练习 ①：选中两张 3，再点“出牌”。对子必须用更大的对子来跟。"
          : state.last?.pattern.type === "pair"
            ? "练习 ②：对方出了更大的对子，你手里只剩一张 A。点击“不出”，等待下一轮领出。"
            : "练习 ③：上一轮连续两人不出后可以换牌型。现在试着用 A 压住单张，出完手牌获胜。"
      : state.phase === "bid"
        ? "入门 ①：根据手牌叫分。2、王和炸弹有利于争夺出牌权；也可以“不叫”，与另一位农民合作。"
        : state.phase === "play"
          ? state.last
            ? "跟牌要同类型、同张数且更大；不合适就“不出”。提示会选出可出的牌，再由你决定。"
            : "入门 ②：点击手牌组成牌型，再点“出牌”。优先思考怎样减少剩余手数；农民可以让队友先走。"
          : "地主独自获胜，或者两位农民共同获胜。复盘最近出牌记录，再来一局。";
  }
  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (paused || state.turn === 0 || !["bid", "play"].includes(state.phase))
      return;
    timer = setTimeout(() => {
      timer = null;
      move(E.ai(state));
    }, 850);
  }
  function move(action) {
    if (paused) return;
    const previous = state,
      next = E.act(state, action);
    if (next === state) {
      A.status("这手牌不符合当前出牌要求。");
      return;
    }
    state = next;
    selected.clear();
    hintIndex = 0;
    if (!practice) packet.actions.push(action);
    if (state.phase === "over" && previous.phase !== "over" && !practice) {
      A.completed();
      if (
        state.winner === 0 ||
        (state.winner !== state.landlord && state.landlord !== 0)
      )
        A.store("wins", A.number("wins") + 1);
    }
    persist();
    render();
    schedule();
    A.status(state.log.at(-1) || "");
  }
  $("play").onclick = () => move({ cards: [...selected] });
  $("pass").onclick = () => move({ cards: [] });
  $("clear").onclick = () => {
    selected.clear();
    render();
  };
  $("hint").onclick = () => {
    const options = E.moves(state.hands[0], state.last?.pattern);
    if (!options.length) {
      selected.clear();
      render();
      A.status("没有能压过的牌，可以点击“不出”。");
      return;
    }
    const recommended = E.ai(state).cards;
    const first = options.findIndex(
      (m) =>
        m.cards.slice().sort().join() === recommended?.slice().sort().join(),
    );
    if (first > 0) [options[0], options[first]] = [options[first], options[0]];
    const m = options[hintIndex++ % options.length];
    selected = new Set(m.cards);
    render();
    A.status(
      `已选出${m.pattern.name}，再次点提示可换一种出法。点击出牌才会打出。`,
    );
  };
  $("pause").onclick = () => {
    paused = !paused;
    render();
    schedule();
  };
  $("restart").onclick = () =>
    Deep.confirm(() => {
      clearTimeout(timer);
      practice = false;
      packet = { version: 1, seed: Deep.seed(), actions: [] };
      state = E.create(packet.seed);
      paused = false;
      selected.clear();
      persist();
      render();
      schedule();
    });
  $("practice").onclick = () => {
    clearTimeout(timer);
    selected.clear();
    practice = !practice;
    if (practice) {
      state = E.practice();
      paused = false;
    } else {
      packet = A.read("run");
      state = E.restore(packet);
      if (!state) {
        packet = { version: 1, seed: Deep.seed(), actions: [] };
        state = E.create(packet.seed);
      }
      paused = true;
    }
    render();
    schedule();
  };
  A.autoPause(() => {
    paused = true;
    clearTimeout(timer);
    render();
  });
  persist();
  render();
  schedule();
})();
