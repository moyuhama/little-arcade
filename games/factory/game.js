(() => {
  "use strict";
  const A = Arcade,
    E = GameEngine,
    $ = A.$;
  let state = E.restore(A.read("factory")) || E.create(),
    paused = true,
    selected = 3 * E.W + 3,
    tool = "inspect",
    dir = 1,
    tiles = [],
    last = performance.now(),
    saveClock = 0,
    paintClock = 0;
  const arrows = ["↑", "→", "↓", "←"];
  function save() {
    A.store("factory", state);
  }
  function recipeOptions(select, machine, chosen) {
    const keys = Object.keys(E.RECIPES).filter(
      (k) =>
        E.available(state, k) && (!machine || E.RECIPES[k].machine === machine),
    );
    select.replaceChildren(
      ...keys.map((k) => {
        const o = document.createElement("option");
        o.value = k;
        o.textContent = E.RECIPES[k].name;
        return o;
      }),
    );
    if (keys.includes(chosen)) select.value = chosen;
  }
  function menus() {
    const old = $("craft-recipe").value;
    recipeOptions($("craft-recipe"), null, old);
    recipeOptions(
      $("build-recipe"),
      ["furnace", "assembler"].includes(tool) ? tool : null,
      $("build-recipe").value,
    );
    $("build-recipe").disabled = !["furnace", "assembler"].includes(tool);
    const m = state.cells[selected];
    recipeOptions($("machine-recipe"), m?.type, m?.recipe);
  }
  function pick(i) {
    selected = i;
    if (tool === "erase") {
      if (E.remove(state, i))
        A.status("已拆除，全额返还建造费用；机器内材料返回仓库。");
      else A.status("这里没有可拆建筑，初始入库口保留。");
    } else if (tool !== "inspect") {
      if (E.build(state, i, tool, dir, $("build-recipe").value))
        A.status("已建造。箭头是物品的输出方向。");
      else
        A.status(
          state.cells[i]
            ? "这里已有建筑，右侧面板可以查看、旋转或拆除。"
            : tool === "miner" && !state.resource[i]
              ? "采矿机需要放在有矿物的格子上。"
              : "资金不足，或该配方尚未解锁。",
        );
    }
    menus();
    save();
    render();
  }
  const grid = $("board");
  grid.style.setProperty("--cols", E.W);
  for (let i = 0; i < E.W * E.H; i++) {
    const b = A.button("", "", () => pick(i), "factory-cell");
    b.addEventListener("keydown", (ev) => {
      const delta = {
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: -E.W,
        ArrowDown: E.W,
      }[ev.key];
      if (delta !== undefined) {
        ev.preventDefault();
        if (tiles[i + delta]) tiles[i + delta].focus();
      }
    });
    b.addEventListener("focus", () =>
      tiles.forEach((t, j) => (t.tabIndex = i === j ? 0 : -1)),
    );
    b.tabIndex = i === selected ? 0 : -1;
    tiles.push(b);
    grid.append(b);
  }
  function describe(m, i) {
    if (!m)
      return state.resource[i]
        ? `${E.ITEMS[state.resource[i]][0]}矿脉 · 可建采矿机，也可手动采集。`
        : "空地 · 选择建造工具后点击这里。";
    if (m.type === "warehouse")
      return "接收相邻输送来的商品，进入仓库库存，可用于订单、手工制作或装入机器。";
    if (m.type === "solar") return "为全厂提供 4 点持续电力。";
    if (m.type === "belt" || m.type === "splitter")
      return m.out.length
        ? `正在输送 ${E.ITEMS[m.out[0]][0]}。如果停住，请检查箭头和下一格是否能接收。`
        : "等待来料。分流器会在前、左、右三个出口轮流寻找可用路径。";
    const r =
      m.type === "miner" ? { time: 1.5, input: {} } : E.RECIPES[m.recipe];
    if (m.out.length)
      return "成品等待运走：接上朝外的输送带，或在输出相邻格放入库口。";
    const missing = Object.entries(r.input)
      .filter(([k, n]) => (m.buffer[k] || 0) < n)
      .map(([k, n]) => `${E.ITEMS[k][0]} ${n - (m.buffer[k] || 0)}`);
    if (missing.length) return "等待原料：" + missing.join("、");
    return m.powered
      ? `正在加工 · ${Math.floor((m.progress / r.time) * 100)}%`
      : "等待电力；可增加太阳能板或升级电网。";
  }
  function render() {
    A.score(
      state.order < 60 ? `${state.order}/60` : `60 + ${state.order - 60}`,
      Math.floor(state.money),
    );
    $("pause").textContent = paused ? "开工 / 继续" : "暂停生产";
    $("direction").textContent = `输出方向 ${arrows[dir]} · 点击旋转`;
    $("energy").textContent = `电力 ${state.powerUsed} / ${E.energy(state)}`;
    $("uptime").textContent =
      `已运转 ${Math.floor(state.time / 60)} 分钟 · 入库 ${state.delivered} 件`;
    tiles.forEach((b, i) => {
      const m = state.cells[i],
        res = state.resource[i];
      b.classList.toggle("selected", i === selected);
      b.classList.toggle("resource", !!res);
      b.classList.toggle("running", !!m?.powered);
      b.style.setProperty("--ore", res ? E.ITEMS[res][2] : "transparent");
      const html = m
        ? `<strong>${E.BUILDINGS[m.type].glyph}</strong>${!["solar", "warehouse"].includes(m.type) ? `<span class="machine-arrow">${arrows[m.dir]}</span>` : ""}${m.out.length ? `<i class="cargo" style="background:${E.ITEMS[m.out[0]][2]}"></i>` : ""}`
        : res
          ? `<small>${E.ITEMS[res][0]}</small>`
          : "";
      if (b.innerHTML !== html) b.innerHTML = html;
      b.setAttribute(
        "aria-label",
        `第 ${Math.floor(i / E.W) + 1} 行第 ${(i % E.W) + 1} 列，${m ? E.BUILDINGS[m.type].name + (m.recipe ? "，" + E.RECIPES[m.recipe].name : "") : "空地"}${res ? "，" + E.ITEMS[res][0] : ""}`,
      );
    });
    const task = E.order(state.order);
    $("order-title").textContent =
      `${state.order < 60 ? "任务 " + (state.order + 1) + "/60" : "无尽订单"} · ${task.name}`;
    $("order-needs").replaceChildren(
      ...Object.entries(task.need).map(([k, n]) => {
        const p = document.createElement("p");
        p.className = state.stock[k] >= n ? "met" : "";
        p.textContent = `${E.ITEMS[k][0]}：${state.stock[k]} / ${n}`;
        return p;
      }),
    );
    $("claim").disabled = !Object.entries(task.need).every(
      ([k, n]) => state.stock[k] >= n,
    );
    $("claim").textContent = `交付订单 · 获得 ${task.reward} 金币`;
    const m = state.cells[selected];
    $("selected-title").textContent =
      `第 ${Math.floor(selected / E.W) + 1} 行第 ${(selected % E.W) + 1} 列 · ${m ? E.BUILDINGS[m.type].name : "空地"}`;
    $("machine-info").textContent = describe(m, selected);
    $("machine-stock").textContent = m?.recipe
      ? `配方：${Object.entries(E.RECIPES[m.recipe].input)
          .map(([k, n]) => `${E.ITEMS[k][0]}×${n}`)
          .join(
            " + ",
          )} → ${E.ITEMS[E.RECIPES[m.recipe].output][0]}×${E.RECIPES[m.recipe].count}；机内：${
          Object.entries(m.buffer)
            .filter(([, n]) => n)
            .map(([k, n]) => `${E.ITEMS[k][0]} ${n}`)
            .join("、") || "空"
        }`
      : "";
    $("rotate").disabled = !m || ["warehouse", "solar"].includes(m.type);
    $("remove").disabled = !m || selected === 3 * E.W + 5;
    $("configure").disabled = !m?.recipe;
    $("machine-recipe").disabled = !m?.recipe;
    $("load").disabled = !m?.recipe;
    $("gather").disabled = !state.resource[selected];
    const craft = E.RECIPES[$("craft-recipe").value];
    $("craft").disabled =
      !craft ||
      !Object.entries(craft.input).every(([k, n]) => state.stock[k] >= n);
    $("craft-info").textContent = craft
      ? `${Object.entries(craft.input)
          .map(([k, n]) => `${E.ITEMS[k][0]}×${n}`)
          .join(" + ")} → ${E.ITEMS[craft.output][0]}×${craft.count}`
      : "";
    $("stock").replaceChildren(
      ...Object.keys(E.ITEMS)
        .filter((k) => state.stock[k] > 0 || task.need[k])
        .map((k) => {
          const s = document.createElement("span");
          s.textContent = `${E.ITEMS[k][0]} ${state.stock[k]}`;
          return s;
        }),
    );
    for (const [id, key, name] of [
      ["speed-up", "speed", "机器效率"],
      ["belt-up", "belts", "运输速度"],
      ["power-up", "power", "电网容量"],
    ]) {
      const cost = E.upgradeCost(state, key);
      $(id).textContent =
        `${name} ${state.upgrades[key]}/10${Number.isFinite(cost) ? " · " + cost + " 金币" : " · 已满"}`;
      $(id).disabled = state.money < cost;
    }
    for (const kind of ["copper", "gear", "wire"]) {
      const parts = E.plan(kind),
        cost = parts.reduce((sum, p) => sum + E.BUILDINGS[p[2]].cost, 0);
      $("blueprint-" + kind).textContent =
        `${{ copper: "铜板", gear: "齿轮", wire: "铜线" }[kind]}示例线 · ${cost} 金币`;
      $("blueprint-" + kind).disabled =
        state.money < cost ||
        parts.some(
          ([x, y, , r]) =>
            state.cells[y * E.W + x] || (r && !E.available(state, r)),
        );
    }
    $("guide").textContent =
      state.order === 0
        ? "先点“开工”：示例线会自动把铁矿变成铁板，运到仓库。收齐 8 块后交付第一单。可以点击机器看它在等什么。"
        : state.order === 1
          ? "铜板已解锁。可以用“铜板示例线”学习完整布局，也可自己在左下铜矿旁建采矿机、输送带、熔炉和入库口。"
          : state.order < 10
            ? "逐步解锁齿轮、铜线和砖块。箭头朝向下一台机器，原料会从相邻格送入；转弯用改变输送带方向。"
            : state.order < 40
              ? "更长的生产链需要多路原料。用分流器协调供给，检查等待原料、输出堵塞和供电不足；多造一台并行机器可提高产能。"
              : "机器人需要电机、电路和电池。主线共有 60 个任务，完成后还有持续订单；工厂布局和库存长期保存。";
    $("result").hidden = state.order < 60;
    $("result").textContent =
      "60 个主线任务已完成！工厂可以继续接持续订单，研究更高效的生产线。";
  }
  function act(fn, message) {
    const result = fn();
    save();
    render();
    if (message)
      A.status(
        typeof message === "function"
          ? message(result)
          : result
            ? message
            : "当前条件还不满足。",
      );
  }
  $("tool").onchange = () => {
    tool = $("tool").value;
    menus();
    render();
  };
  $("direction").onclick = () => {
    dir = (dir + 1) % 4;
    render();
  };
  $("build-recipe").onchange = () => render();
  $("craft-recipe").onchange = () => render();
  $("rotate").onclick = () =>
    act(() => E.rotate(state, selected), "方向已旋转。");
  $("remove").onclick = () => {
    act(() => E.remove(state, selected), "已拆除并全额返还费用与机内材料。");
    menus();
  };
  $("configure").onclick = () =>
    act(
      () => E.configure(state, selected, $("machine-recipe").value),
      "配方已更换，原有机内材料回到仓库。",
    );
  $("load").onclick = () =>
    act(() => E.load(state, selected), "已从仓库装入最多三份配方原料。");
  $("gather").onclick = () =>
    act(() => E.gather(state, selected), "手动采集一份原料，已经放入仓库。");
  $("craft").onclick = () =>
    act(
      () => E.craft(state, $("craft-recipe").value),
      "手工制作完成。自动化机器可以持续代劳。",
    );
  $("sell").onclick = () =>
    act(
      () => E.sell(state),
      (n) =>
        n
          ? `已出售多余库存，收入 ${n} 金币；当前订单需要的数量保留。`
          : "没有超出当前订单需求的库存。",
    );
  $("claim").onclick = () => {
    if (E.claim(state)) {
      if (state.order === 60) A.completed();
      menus();
      save();
      render();
      A.status("订单完成！奖励已到账，新配方会随主线解锁。");
    }
  };
  for (const [id, key] of [
    ["speed-up", "speed"],
    ["belt-up", "belts"],
    ["power-up", "power"],
  ])
    $(id).onclick = () => act(() => E.upgrade(state, key), "升级完成。");
  for (const kind of ["copper", "gear", "wire"])
    $("blueprint-" + kind).onclick = () =>
      act(
        () => E.blueprint(state, kind),
        "示例线已搭建，可以点击其中的设备研究流向。",
      );
  function pause() {
    if (paused) return;
    paused = true;
    save();
    render();
  }
  A.autoPause(pause);
  $("pause").onclick = () => {
    paused = !paused;
    last = performance.now();
    save();
    render();
  };
  $("restart").onclick = () =>
    Deep.confirm(() => {
      state = E.create();
      paused = true;
      selected = 3 * E.W + 3;
      tool = "inspect";
      $("tool").value = tool;
      menus();
      save();
      render();
    }, "新建工厂会替换当前布局、库存和任务进度；已完成主线的历史纪录保留。");
  function frame(now) {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (!paused) {
      E.step(state, dt);
      saveClock += dt;
      paintClock += dt;
      if (saveClock >= 2) {
        save();
        saveClock = 0;
      }
      if (paintClock >= 0.2) {
        render();
        paintClock = 0;
      }
    }
    requestAnimationFrame(frame);
  }
  menus();
  save();
  render();
  requestAnimationFrame(frame);
})();
