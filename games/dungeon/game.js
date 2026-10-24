(() => {
  "use strict";
  const A = Arcade,
    E = GameEngine,
    $ = A.$;
  let packet = A.read("run"),
    state = E.restore(packet);
  if (!state) {
    packet = {
      version: 1,
      seed: Deep.seed(),
      role: "knight",
      difficulty: 0,
      actions: [],
    };
    state = E.create(packet.seed, packet.role, 0);
  }
  const routeNames = {
    fight: "普通战斗",
    elite: "精英挑战",
    boss: "首领之门",
    rest: "营火休息",
    shop: "旅人商店",
    event: "林间岔路",
  };
  const routeCopy = {
    fight: "战胜敌人，获得金币并挑选一张牌。",
    elite: "敌人更强；胜利额外获得遗物。",
    boss: "击败本章守卫，带着遗物继续前行。",
    rest: "恢复生命，或训练提升最大生命。",
    shop: "45 金币买牌，55 金币删去一张。",
    event: "在生命与资源之间作一次选择。",
  };
  function difficulties() {
    const current = Number($("difficulty").value) || state.difficulty;
    $("difficulty").replaceChildren();
    for (let i = 0; i <= 10; i++) {
      const o = document.createElement("option");
      o.value = i;
      o.textContent =
        i === 0
          ? "旅途 · 标准"
          : `险途 ${i}${i > A.number("unlocked") ? " · 通关解锁" : ""}`;
      o.disabled = i > A.number("unlocked");
      $("difficulty").append(o);
    }
    $("difficulty").value = Math.min(current, A.number("unlocked"));
  }
  $("role").value = state.role;
  difficulties();
  $("difficulty").value = state.difficulty;
  function choice(title, text, action, disabled = false) {
    const b = A.button("", null, () => move(action), "choice");
    const strong = document.createElement("strong"),
      small = document.createElement("small");
    strong.textContent = title;
    small.textContent = text;
    b.append(strong, small);
    b.disabled = disabled;
    return b;
  }
  function cardButton(id, index, action) {
    const c = E.cards[id],
      b = choice(`${c.cost} 能量 · ${c.name}`, c.text, action);
    b.classList.add("dungeon-card");
    if (index !== null) {
      b.disabled = c.cost > state.energy;
      b.setAttribute("aria-label", `${c.name}，${c.cost} 点能量。${c.text}`);
    }
    return b;
  }
  function render() {
    A.score(`${state.hp}/${state.maxHp}`, state.gold);
    $("floor").textContent =
      `第 ${Math.min(3, Math.ceil(state.floor / 6))} 章 · 房间 ${Math.min(18, state.floor)}/18`;
    $("relic-count").textContent =
      `牌组 ${state.deck.length} 张 · 遗物 ${state.relics.length}`;
    $("record").textContent = `最远通过 ${A.number("bestFloor")} 间`;
    $("route-progress").replaceChildren(
      ...Array.from({ length: 18 }, (_, i) => {
        const p = document.createElement("span");
        p.className =
          (i + 1 < state.floor
            ? "passed"
            : i + 1 === state.floor
              ? "current"
              : "") + ((i + 1) % 6 === 0 ? " boss-node" : "");
        p.textContent = (i + 1) % 6 === 0 ? "♛" : i + 1;
        p.setAttribute(
          "aria-label",
          `房间 ${i + 1}${(i + 1) % 6 === 0 ? "，首领" : ""}${i + 1 === state.floor ? "，当前位置" : ""}`,
        );
        return p;
      }),
    );
    $("combat").hidden = state.phase !== "battle";
    $("choices").replaceChildren();
    $("scene").replaceChildren();
    function scene(title, copy, icon = "◇") {
      const h = document.createElement("h2"),
        p = document.createElement("p"),
        art = document.createElement("div");
      art.className = "scene-icon";
      art.textContent = icon;
      h.textContent = title;
      p.textContent = copy;
      $("scene").append(art, h, p);
    }
    if (state.phase === "route") {
      scene(
        state.floor === 1 ? "启程 · 苔石遗迹" : "下一步，走哪条路？",
        `当前起手：${state.role === "rogue" ? "游侠" : "守卫"} · 挑战 ${state.difficulty}。仔细分配生命和金币，牌组越精简越容易抽到关键牌。`,
        "⌁",
      );
      for (const route of E.routes(state))
        $("choices").append(
          choice(routeNames[route], routeCopy[route], { route }),
        );
    }
    if (state.phase === "battle") {
      const e = state.enemy,
        intent = E.enemyIntent(state);
      scene(
        e.name,
        `生命 ${e.hp}/${e.maxHp} · 护甲 ${e.block}${e.poison ? " · 中毒 " + e.poison : ""}${e.weak ? " · 虚弱 " + e.weak + " 回合" : ""}`,
        state.battleKind === "boss"
          ? "♛"
          : e.kind === "guardian"
            ? "▰"
            : e.kind === "leech"
              ? "◈"
              : "♜",
      );
      const bar = document.createElement("div");
      bar.className = "enemy-health";
      const fill = document.createElement("span");
      fill.style.width = `${Math.max(0, e.hp / e.maxHp) * 100}%`;
      bar.append(fill);
      const intentEl = document.createElement("div");
      intentEl.className = "enemy-intent";
      intentEl.textContent = `敌人意图：${intent.label}${intent.type === "attack" ? ` · 当前将承受 ${Math.max(0, intent.value - state.block)} 点伤害` : ""}`;
      $("scene").append(bar, intentEl);
      $("energy").textContent = `能量 ${state.energy} · 回合 ${state.turn}`;
      $("block").textContent = `护甲 ${state.block} · 力量 ${state.strength}`;
      $("piles").textContent =
        `抽牌 ${state.draw.length} / 弃牌 ${state.discard.length} / 移除 ${state.exhaust.length}`;
      $("hand").replaceChildren(
        ...state.hand.map((id, i) => cardButton(id, i, { card: i })),
      );
    }
    if (state.phase === "reward") {
      scene(
        "挑选战利品",
        "选一张加入牌组，也可以跳过，让牌组保持精简。精英和首领的遗物已收入背包。",
        "✧",
      );
      state.rewards.forEach((id, i) =>
        $("choices").append(cardButton(id, null, { reward: i })),
      );
      $("choices").append(
        choice("跳过选牌", "保留现在的牌组。", { reward: -1 }),
      );
    }
    if (state.phase === "rest") {
      scene("营火微光", "补充生命，或者增强体能。两者只能选一个。", "♨");
      $("choices").append(
        choice(
          "休息回血",
          `恢复 ${Math.ceil(state.maxHp * 0.3) + (state.relics.includes("flask") ? 10 : 0)} 点生命。`,
          { rest: "heal" },
        ),
        choice("体能训练", "最大生命 +6，同时恢复 6 点生命。", {
          rest: "train",
        }),
      );
    }
    if (state.phase === "event") {
      scene("荆棘后的宝箱", "旧地图上标出了一条近路，也可能划伤旅人。", "⌑");
      $("choices").append(
        choice(
          "穿过荆棘",
          "失去 10 点生命，获得 60 金币。",
          { event: "risk" },
          state.hp <= 10,
        ),
        choice("沿溪休整", "恢复 8 点生命。", { event: "safe" }),
      );
    }
    if (state.phase === "shop") {
      scene(
        "旅人商店",
        "删去不再需要的基础牌，能更快抽到关键卡。删牌每次到店限一次。",
        "▧",
      );
      state.stock.forEach((id, i) => {
        if (id)
          $("choices").append(
            choice(
              `${E.cards[id].name} · 45 金币`,
              E.cards[id].text,
              { buy: i },
              state.gold < 45,
            ),
          );
      });
      $("choices").append(
        choice("离开商店", "继续前往下一个房间。", { leave: true }),
      );
    }
    if (["won", "lost"].includes(state.phase))
      scene(
        state.phase === "won" ? "暮光散去，冒险通关！" : "本次旅途暂告一段落",
        state.phase === "won"
          ? `打通三章 18 个房间。你可以选择新的起手和更高挑战，再尝试另一种牌组。`
          : `已通过 ${state.floor - 1} 个房间。下一次留意防御与回血，减少卡组中难以配合的牌。`,
        state.phase === "won" ? "♛" : "◇",
      );
    $("deck-title").textContent =
      `查看牌组（${state.deck.length} 张）与遗物${state.phase === "shop" ? " · 在这里删牌" : ""}`;
    $("deck-list").replaceChildren();
    state.deck.forEach((id, i) => {
      const row = document.createElement("div");
      row.className = "deck-row";
      const text = document.createElement("span");
      text.textContent = `${E.cards[id].name} · ${E.cards[id].cost} 能量`;
      row.append(text);
      if (state.phase === "shop") {
        const b = A.button(
          "删去 · 55",
          `删去第 ${i + 1} 张${E.cards[id].name}，55 金币`,
          () => move({ remove: i }),
          "small-button",
        );
        b.disabled = state.removed || state.gold < 55 || state.deck.length <= 5;
        row.append(b);
      }
      $("deck-list").append(row);
    });
    $("relic-list").replaceChildren(
      ...state.relics.map((id) => {
        const p = document.createElement("p");
        p.textContent = `✧ ${E.relics[id].name}：${E.relics[id].text}`;
        return p;
      }),
    );
    $("guide").textContent =
      state.floor === 1
        ? state.phase === "route"
          ? "第一课 ①：点击“普通战斗”进入房间。每次选择都会自动保存。"
          : state.phase === "battle"
            ? "第一课 ②：先看敌人意图。每回合 3 点能量，点击卡牌立即出牌；用架盾挡伤害，再用斩击反击。准备好后点“结束回合”。"
            : "第一课 ③：战胜敌人后选一张牌。多段攻击配力量，中毒配防御；不需要的牌可以跳过。"
        : "每次选择都会自动保存。留意敌人下一步意图，组合力量、多段攻击或中毒；精英掉遗物，但需要准备充足。";
    $("battle-log").textContent = state.log.slice(-2).join(" ");
  }
  function move(action) {
    const old = state,
      next = E.act(state, action);
    if (next === state) return;
    state = next;
    packet.actions.push(action);
    if (state.phase === "won" && old.phase !== "won") {
      A.completed();
      A.best(Math.min(10, state.difficulty + 1), "unlocked");
      difficulties();
    }
    A.best(Math.min(18, state.floor - 1), "bestFloor");
    A.store("run", packet);
    render();
    A.status(
      state.phase === "battle"
        ? `第 ${state.turn} 回合，剩余 ${state.energy} 点能量。`
        : "进度已自动保存。",
    );
  }
  $("end-turn").onclick = () => move({ end: true });
  $("restart").onclick = () =>
    Deep.confirm(() => {
      packet = {
        version: 1,
        seed: Deep.seed(),
        role: $("role").value,
        difficulty: Number($("difficulty").value),
        actions: [],
      };
      state = E.create(packet.seed, packet.role, packet.difficulty);
      A.store("run", packet);
      render();
      A.status("新的冒险开始。");
    });
  A.store("run", packet);
  render();
})();
