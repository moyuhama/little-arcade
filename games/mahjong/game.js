(() => {
  "use strict";
  const A = Arcade,
    E = GameEngine,
    $ = A.$;
  let packet = A.read("run"),
    state = E.restore(packet),
    paused = !!state,
    practice = false,
    official = null,
    selected = null,
    timer = null;
  if (!state) {
    packet = { version: 1, seed: Deep.seed(), actions: [] };
    state = E.create(packet.seed);
    paused = false;
  }
  const person = (p) => ["你", "下家", "对家", "上家"][p],
    actor = () =>
      state.phase === "claim" ? state.queue[0].player : state.turn;
  function persist() {
    if (!practice) A.store("run", packet);
  }
  function tile(id, interactive = false, hidden = false) {
    const b = document.createElement(interactive ? "button" : "span"),
      t = E.type(id);
    b.className =
      "mahjong-tile " +
      (hidden
        ? "back"
        : t < 9
          ? "wan"
          : t < 18
            ? "tong"
            : t < 27
              ? "tiao"
              : "honor");
    b.textContent = hidden ? "▧" : E.label(t);
    if (!hidden) b.setAttribute("aria-label", E.label(t));
    if (interactive) {
      b.type = "button";
      b.dataset.tile = id;
      b.classList.toggle("selected", selected === id);
      b.classList.toggle("drawn", state.drawn === id && state.turn === 0);
      b.setAttribute("aria-pressed", String(selected === id));
      b.disabled = paused || state.phase !== "play" || state.turn !== 0;
      b.onclick = () => {
        selected = selected === id ? null : id;
        render();
      };
    }
    return b;
  }
  function melds(player) {
    const box = document.createElement("div");
    box.className = "melds";
    for (const m of state.melds[player]) {
      const group = document.createElement("span");
      group.className = "meld";
      group.title = {
        chow: "吃",
        pung: "碰",
        kong: "明杠",
        concealed: "暗杠",
        added: "加杠",
      }[m.kind];
      for (const id of m.cards)
        group.append(tile(id, false, player !== 0 && m.kind === "concealed"));
      box.append(group);
    }
    return box;
  }
  function optionText(o) {
    if (o.kind === "hu")
      return state.phase === "claim"
        ? state.pending.kind === "rob"
          ? "抢杠胡"
          : "胡牌"
        : "自摸";
    if (o.kind === "chow")
      return "吃 " + [o.base, o.base + 1, o.base + 2].map(E.label).join("·");
    if (o.kind === "concealed") return "暗杠 " + E.label(o.tile);
    if (o.kind === "added")
      return "加杠 " + E.label(E.type(state.melds[0][o.index].cards[0]));
    return o.kind === "pung" ? "碰" : "明杠";
  }
  function render() {
    const focused = document.activeElement?.dataset?.tile;
    A.score(state.wall.length, A.number("wins"));
    $("pause").textContent = paused ? "继续" : "暂停";
    $("pause").disabled = state.phase === "over";
    $("practice").textContent = practice
      ? "退出练习，返回牌局"
      : "两步学会胡牌";
    $("opponents").replaceChildren(
      ...[3, 2, 1].map((p) => {
        const box = document.createElement("section");
        box.className =
          "opponent" +
          (state.phase !== "over" && actor() === p ? " current" : "");
        const title = document.createElement("h3");
        title.textContent = `${person(p)}${state.dealer === p ? " · 庄家" : ""}`;
        const back = document.createElement("p");
        back.className = "hidden-hand";
        back.textContent = `▧ ▧ ▧ · ${state.hands[p].length} 张`;
        box.append(title, back, melds(p));
        return box;
      }),
    );
    $("turn-label").textContent = paused
      ? "已暂停，点击“继续”恢复"
      : state.phase === "over"
        ? "本局结束"
        : state.phase === "claim"
          ? `${person(actor())}可以${state.queue[0].options.map(optionText).join(" / ")}`
          : `${person(state.turn)}的回合${state.turn === 0 ? " · 选一张牌，再点打出" : ""}`;
    const pending = state.pending;
    $("last-discard").replaceChildren();
    if (pending) {
      $("last-discard").append(tile(pending.id));
      $("last-label").textContent =
        `${person(pending.from)}${pending.kind === "rob" ? "尝试加杠" : "打出"} · 等待响应`;
    } else {
      const latest = state.log.filter((t) => t.includes("打出")).at(-1);
      $("last-label").textContent = latest || "四组面子 + 一对将，即可胡牌";
    }
    $("rivers").replaceChildren(
      ...[3, 2, 1, 0].map((p) => {
        const row = document.createElement("div");
        row.className = "river";
        const name = document.createElement("strong");
        name.textContent = person(p);
        const tiles = document.createElement("div");
        tiles.className = "river-tiles";
        for (const id of state.rivers[p]) tiles.append(tile(id));
        if (!state.rivers[p].length) tiles.textContent = "—";
        row.append(name, tiles);
        return row;
      }),
    );
    $("own-melds").replaceChildren(melds(0));
    $("hand").replaceChildren(...state.hands[0].map((id) => tile(id, true)));
    if (focused !== undefined)
      document
        .querySelector(`[data-tile="${focused}"]`)
        ?.focus({ preventScroll: true });
    const myTurn = !paused && state.phase === "play" && state.turn === 0,
      myClaim = state.phase === "claim" && actor() === 0,
      options = myClaim
        ? state.queue[0].options
        : state.phase === "play" && state.turn === 0
          ? E.selfOptions(state)
          : [];
    $("special-actions").replaceChildren(
      ...options.map((o) => {
        const b = A.button(
          optionText(o),
          null,
          () =>
            move(
              myClaim
                ? { claim: o.kind, base: o.base }
                : { self: o.kind, tile: o.tile, index: o.index },
            ),
          "primary",
        );
        b.disabled = paused;
        return b;
      }),
    );
    $("pass").hidden = !myClaim;
    $("pass").disabled = paused;
    $("discard").disabled = !myTurn || selected === null;
    $("hint").disabled = !myTurn;
    $("discard").textContent =
      selected === null ? "打出所选牌" : `打出 ${E.label(E.type(selected))}`;
    const hand =
        selected !== null && state.phase === "play" && state.turn === 0
          ? state.hands[0].filter((id) => id !== selected)
          : state.hands[0],
      waits = E.waits(hand, state.melds[0]),
      seen = E.visibleCounts(state);
    $("hand-note").textContent =
      selected !== null
        ? `已选 ${E.label(E.type(selected))}${state.drawn === selected ? "（刚摸到）" : ""}`
        : "你的手牌 · 金边标记刚摸到的牌";
    $("waiting").textContent = waits.length
      ? `${selected !== null ? "打出后听：" : "听牌："}${waits.map((t) => `${E.label(t)}（未见 ${Math.max(0, 4 - seen[t])} 张）`).join("、")}。未见的牌可能在对手手中，不保证能摸到。`
      : selected !== null
        ? `打出后尚未听牌 · ${Math.max(1, E.shanten(hand, state.melds[0].length))} 向听（距离听牌还需改进的步数）`
        : "先观察顺子、刻子和对子；选牌后会显示能听什么。";
    $("turn-log").replaceChildren(
      ...state.log
        .slice()
        .reverse()
        .map((text) => {
          const p = document.createElement("p");
          p.textContent = text;
          return p;
        }),
    );
    $("result").hidden = state.phase !== "over";
    if (state.result)
      $("result").textContent =
        `${practice ? "教学完成！ " : ""}${state.result.winner < 0 ? "牌墙摸完，本局流局。" : `${person(state.result.winner)}${state.result.selfDraw ? "自摸" : "胡牌"} · ${state.result.pattern}。`}${practice ? "你已体验打牌、听牌和胡牌，点击退出练习回到正式牌局。" : "点击“新一局”继续。"}`;
    $("winning-hand").replaceChildren();
    if (state.result?.winner >= 0) {
      const player = state.result.winner;
      const title = document.createElement("p");
      title.textContent = `${person(player)}的获胜手牌（手牌与吃碰杠的牌分组显示）`;
      $("winning-hand").append(title);
      for (const cards of [
        state.hands[player],
        ...state.melds[player].map((m) => m.cards),
      ]) {
        const group = document.createElement("span");
        group.className = "winning-group";
        for (const id of cards) group.append(tile(id));
        $("winning-hand").append(group);
      }
    }
    $("guide").textContent =
      state.phase === "over"
        ? "本局结束，可以查看获胜手牌和最近记录，想想下次怎样调整。"
        : practice
          ? state.guideStep === 0
            ? "练习 ①：你已经有四组顺子，但 5万 和 东 还没成对。点击 东，再点“打出 东”。"
            : "练习 ②：教学略过电脑回合，你摸到了第二张 5万！四组顺子 + 一对 5万，点“自摸”获胜。"
          : state.phase === "claim" && actor() === 0
            ? "现在可以响应上一张牌。胡优先于碰杠，碰杠优先于吃；只允许吃上家的牌。不想要就点“过”。"
            : "休闲麻将 · 136 张无花牌，无起胡番数门槛。凑齐四组顺子/刻子和一对将，也支持七对、十三幺。先试“两步学会胡牌”。";
  }
  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (paused || state.phase === "over" || actor() === 0) return;
    timer = setTimeout(() => {
      timer = null;
      move(E.ai(state));
    }, 900);
  }
  function move(action) {
    if (paused) return;
    const next = E.act(state, action);
    if (next === state) {
      A.status(practice ? "跟随教学，先打出 东。" : "这一步暂时不能执行。");
      return;
    }
    state = next;
    selected = null;
    if (!practice) {
      packet.actions.push(action);
      if (state.phase === "over" && !packet.counted) {
        packet.counted = true;
        A.completed();
        if (state.result.winner === 0) A.store("wins", A.number("wins") + 1);
      }
    }
    persist();
    render();
    schedule();
    A.status(state.log.at(-1));
  }
  function pause() {
    if (paused || state.phase === "over") return;
    paused = true;
    clearTimeout(timer);
    timer = null;
    render();
    A.status("已暂停。返回后点击“继续”，电脑才会行动。");
  }
  $("pause").onclick = () => {
    if (paused) {
      paused = false;
      render();
      schedule();
    } else pause();
  };
  A.autoPause(pause);
  $("discard").onclick = () => {
    if (selected !== null) move({ discard: selected });
  };
  $("pass").onclick = () => move({ pass: true });
  $("hint").onclick = () => {
    const h =
      practice && state.guideStep === 0 ? { id: 108 } : E.bestDiscard(state, 0);
    if (!h) return;
    selected = h.id;
    render();
    A.status(
      `建议考虑打出 ${E.label(E.type(h.id))}。建议只使用自己的手牌和公开信息，最终由你决定。`,
    );
  };
  $("restart").onclick = () =>
    Deep.confirm(() => {
      clearTimeout(timer);
      packet = { version: 1, seed: Deep.seed(), actions: [] };
      state = E.create(packet.seed);
      practice = false;
      official = null;
      selected = null;
      paused = false;
      persist();
      render();
      schedule();
      A.status("新的一局开始，庄家随机轮换。");
    });
  $("practice").onclick = () => {
    clearTimeout(timer);
    if (practice) {
      packet = official;
      state = E.restore(packet);
      practice = false;
      official = null;
      paused = true;
    } else {
      official = packet;
      practice = true;
      state = E.practice();
      paused = false;
    }
    selected = null;
    render();
    schedule();
    A.status(
      practice
        ? "两步教学，正式牌局已保留，不计入胜局。"
        : "正式牌局已恢复。点击“继续”开始。",
    );
  };
  persist();
  render();
  schedule();
})();
