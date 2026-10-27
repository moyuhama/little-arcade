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
    const symbol = rank >= 16 ? "★" : ["♠", "♥", "♣", "♦"][id % 4];
    b.classList.toggle("joker", rank >= 16);
    b.innerHTML = `<strong aria-hidden="true">${E.label(id)}</strong><small aria-hidden="true">${symbol}</small><span class="card-pip" aria-hidden="true">${symbol}</span>`;
    b.setAttribute(
      "aria-label",
      rank >= 16
        ? E.label(id)
        : `${["黑桃", "红桃", "梅花", "方块"][id % 4]} ${E.label(id)}`,
    );
    if (!interactive) b.setAttribute("role", "img");
    if (interactive) {
      b.dataset.card = id;
      b.type = "button";
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
  const rolesKnown = () => ["play", "over"].includes(state.phase);
  function role(p) {
    return !rolesKnown() ? "待定" : p === state.landlord ? "地主" : "农民";
  }
  function fan(container, cards, interactive = false) {
    const overlaps = Math.max(0, cards.length - 1);
    container.style.setProperty("--overlap-count", overlaps);
    container.style.gridTemplateColumns = overlaps
      ? `repeat(${overlaps}, minmax(0, 1fr)) var(--card-width)`
      : "var(--card-width)";
    container.replaceChildren(...cards.map((id) => card(id, interactive)));
  }
  function drawPlay(container, player) {
    container.replaceChildren();
    container.classList.toggle(
      "is-leading",
      !!state.last && state.lastPlayer === player,
    );
    const cards = state.turnPlays[player];
    if (cards?.length) {
      const scroll = document.createElement("div");
      scroll.className = "played-scroll";
      const pile = document.createElement("div");
      pile.className = "card-fan";
      fan(
        pile,
        cards.slice().sort((a, b) => b - a),
      );
      scroll.append(pile);
      const caption = document.createElement("p");
      caption.className = "play-caption";
      const pattern =
        state.lastPlayer === player ? state.last.pattern : E.classify(cards);
      caption.textContent = `${person(player)} · ${pattern.name}`;
      container.append(scroll, caption);
    } else if (player !== 0 || cards) {
      const note = document.createElement("span");
      note.className = cards ? "seat-pass" : "seat-wait";
      note.textContent = cards
        ? "不出"
        : state.phase === "bid"
          ? state.log
              .findLast((line) => line.startsWith(`${person(player)}：`))
              ?.split("：")[1] || "等待叫分"
          : "等待出牌";
      container.append(note);
    }
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
        box.className = `opponent opponent-${p === 2 ? "left" : "right"}`;
        box.classList.toggle(
          "thinking",
          !paused && ["bid", "play"].includes(state.phase) && state.turn === p,
        );
        box.classList.toggle(
          "is-landlord",
          rolesKnown() && state.landlord === p,
        );
        box.setAttribute("role", "group");
        box.setAttribute(
          "aria-label",
          `${person(p)}，${role(p)}，剩余 ${state.hands[p].length} 张`,
        );
        const profile = document.createElement("div");
        profile.className = "seat-profile";
        const avatar = document.createElement("span");
        avatar.className = "seat-avatar";
        avatar.textContent = p === 2 ? "♠" : "♣";
        avatar.setAttribute("aria-hidden", "true");
        const identity = document.createElement("div");
        identity.className = "seat-identity";
        const title = document.createElement("strong");
        title.textContent = `${person(p)} · 电脑`;
        const badge = document.createElement("span");
        badge.className = "seat-role";
        badge.textContent = role(p);
        identity.append(title, badge);
        profile.append(avatar, identity);
        const count = document.createElement("div");
        count.className = "seat-count";
        count.classList.toggle("low-cards", state.hands[p].length <= 2);
        count.textContent = `剩余 ${state.hands[p].length} 张`;
        const last = document.createElement("div");
        last.className = "seat-play";
        drawPlay(last, p);
        box.append(profile, count, last);
        return box;
      }),
    );
    $("room-state").textContent = practice
      ? "教学短牌局 · 不计战绩"
      : "三人对局 · 电脑陪练";
    $("bottom").replaceChildren(
      ...(rolesKnown()
        ? state.bottom.map((id) => card(id))
        : Array.from({ length: 3 }, () => {
            const back = document.createElement("span");
            back.className = "poker-card card-back";
            back.setAttribute("role", "img");
            back.setAttribute("aria-label", "未揭晓的底牌");
            return back;
          })),
    );
    $("bottom").parentElement.hidden = practice;
    $("self-role").textContent = role(0);
    $("self-role").classList.toggle(
      "is-landlord",
      rolesKnown() && state.landlord === 0,
    );
    $("hand-count").textContent = `${state.hands[0].length} 张手牌`;
    $("turn-label").classList.toggle(
      "your-turn",
      !paused && state.turn === 0 && ["bid", "play"].includes(state.phase),
    );
    $("turn-label").textContent =
      state.phase === "over"
        ? "本局结束"
        : state.phase === "redeal"
          ? "全员不叫，请重新发牌"
          : paused
            ? "对局已暂停"
            : state.phase === "bid"
              ? `${person(state.turn)}正在叫分`
              : `${person(state.turn)}的回合 · ${role(state.turn)}`;
    drawPlay($("last-cards"), 0);
    $("last-label").textContent = state.last
      ? `当前：${person(state.lastPlayer)} · ${state.last.pattern.name}`
      : state.phase === "play"
        ? "自由领出任意合法牌型"
        : state.bid
          ? `${person(state.landlord)}暂叫 ${state.bid} 分`
          : "叫分确定地主，地主先出牌";
    $("bid-actions").hidden = state.phase !== "bid";
    $("play-actions").hidden = state.phase !== "play";
    $("bid-actions").replaceChildren(
      ...[0, 1, 2, 3].map((n) => {
        const b = A.button(n ? `叫 ${n} 分` : "不叫", null, () =>
          move({ bid: n }),
        );
        b.classList.toggle("primary", n === 3);
        b.disabled = paused || state.turn !== 0 || (n > 0 && n <= state.bid);
        return b;
      }),
    );
    const pattern = E.classify([...selected], state.last?.pattern);
    $("selection").textContent = selected.size
      ? `已选 ${selected.size} 张 · ${pattern ? pattern.name : "尚未组成合法牌型"}${pattern && !E.beats(pattern, state.last?.pattern) ? " · 不能压过上一手" : ""}`
      : ["over", "redeal"].includes(state.phase)
        ? "本局已结束"
        : paused
          ? "点击「继续」恢复对局"
          : state.phase === "bid"
            ? "先看手牌，再决定叫分"
            : state.turn !== 0
              ? "等待对手出牌"
              : "点击牌面选中，再点出牌";
    $("play").disabled =
      paused ||
      state.turn !== 0 ||
      !pattern ||
      !E.beats(pattern, state.last?.pattern);
    $("pass").disabled =
      paused || state.turn !== 0 || !state.last || state.lastPlayer === 0;
    $("hint").disabled = paused || state.turn !== 0;
    $("clear").disabled = !selected.size;
    fan(
      $("hand"),
      state.hands[0].slice().sort((a, b) => b - a),
      true,
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
        ? "叫分越高越有机会做地主；不叫也可以与另一位农民合作。"
        : state.phase === "play"
          ? state.last
            ? "同牌型、同张数才能跟牌；不合适可以不出。"
            : "你可以自由领出。点击提示可试选一种出法。"
          : "地主独自获胜，或者两位农民共同获胜。复盘最近出牌记录，再来一局。";
    if (["bid", "play"].includes(state.phase)) {
      if (paused) $("guide").textContent = "对局已暂停，点击上方「继续」。";
      else if (state.turn !== 0)
        $("guide").textContent =
          `${person(state.turn)}正在${state.phase === "bid" ? "叫分" : "出牌"}，稍等片刻。`;
    }
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
    A.status(
      paused ? (practice ? "教学对局已暂停。" : "已暂停，进度已保存。") : "",
    );
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
      A.status("新牌局已发好。先看手牌，再决定叫分。");
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
    A.status(
      practice ? "教学牌局不计入正式战绩。" : "正式牌局已恢复，点击继续。",
    );
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
