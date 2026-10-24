(() => {
  "use strict";
  const A = Arcade,
    E = GameEngine,
    $ = A.$,
    canvas = $("canvas"),
    ctx = canvas.getContext("2d");
  let state = E.restore(A.read("run")) || E.create(),
    selected = 0,
    paused = false,
    speed = 1,
    last = 0,
    acc = 0,
    paintTime = 0;
  $("map").value = state.map;
  function save() {
    const snap = E.checkpoint(state);
    if (snap) A.store("run", snap);
  }
  function buttons() {
    $("pads").replaceChildren(
      ...E.maps[state.map].pads.map(([x, y], i) => {
        const b = A.button(
          String(i + 1),
          `选择 ${i + 1} 号建造位置`,
          () => {
            selected = i;
            render();
          },
          "tower-pad",
        );
        b.style.left = `${x / 6}%`;
        b.style.top = `${y / 4}%`;
        return b;
      }),
    );
    $("tower-types").replaceChildren(
      ...Object.entries(E.types).map(([id, t]) => {
        const b = A.button(
          "",
          null,
          () => {
            if (E.build(state, selected, id)) {
              save();
              render();
              A.status(`已在 ${selected + 1} 号位置建造${t.name}。`);
            }
          },
          "choice",
        );
        b.innerHTML = `<strong>${t.icon} ${t.name} · ${t.cost} 金币</strong><small>${t.note}</small>`;
        b.dataset.type = id;
        return b;
      }),
    );
  }
  function render() {
    const t = state.towers.find((t) => t.pad === selected),
      over = state.phase === "over";
    A.score(state.wave, state.gold);
    $("lives").textContent = `城防 ${state.lives} / 20`;
    $("wave-info").textContent =
      state.phase === "wave"
        ? `剩余敌人 ${state.total - state.spawned + state.enemies.length}`
        : over
          ? "防线结束"
          : `下一波 ${state.wave + 1}${(state.wave + 1) % 5 === 0 ? " · 首领来袭" : ""}`;
    $("research").textContent =
      state.wave < 3
        ? "火力研究 · 守住 3 波解锁"
        : `火力研究 ${state.research}/50 · ${E.researchCost(state)} 金币`;
    $("research").disabled =
      state.phase !== "build" ||
      state.wave < 3 ||
      !state.towers.length ||
      state.research >= 50 ||
      state.gold < E.researchCost(state);
    $("repair").disabled =
      state.phase !== "build" || state.lives >= 20 || state.gold < 120;
    $("best-wave").textContent = `最高守住 ${A.number("bestWave")} 波`;
    $("start").disabled = state.phase !== "build" || !state.towers.length;
    $("start").textContent =
      state.phase === "wave"
        ? `第 ${state.wave} 波进行中`
        : `开始第 ${state.wave + 1} 波`;
    $("pause").disabled = state.phase !== "wave";
    $("pause").textContent = paused ? "继续" : "暂停";
    $("pulse").disabled = state.phase !== "wave" || paused || state.pulse > 0;
    $("pulse").textContent =
      state.pulse > 0
        ? `震荡波 · ${Math.ceil(state.pulse)} 秒`
        : "震荡波 · 就绪";
    $("speed").textContent = `速度 ${speed}×`;
    $("speed").setAttribute("aria-pressed", String(speed === 2));
    $("field-message").hidden = !paused && !over;
    $("field-message").textContent = over
      ? `守住 ${Math.max(0, state.wave - 1)} 波 · 点击“新防线”再挑战`
      : paused
        ? "已暂停 · 点击“继续”返回防线"
        : "";
    $("build-title").textContent = t
      ? `${selected + 1} 号 · ${E.types[t.type].name} Lv.${t.level}`
      : `${selected + 1} 号空地 · 选择炮塔`;
    $("tower-types").hidden = !!t;
    $("upgrades").hidden = !t;
    document
      .querySelectorAll("[data-type]")
      .forEach(
        (b) => (b.disabled = over || state.gold < E.types[b.dataset.type].cost),
      );
    if (t) {
      const st = E.stats(t),
        cost = E.upgradeCost(t);
      $("power").textContent =
        t.level === 1
          ? `威力升级 · ${cost}`
          : t.level === 2
            ? `升至 3 级 · ${cost}`
            : "已达最高等级";
      $("range").hidden = t.level !== 1;
      $("range").textContent = `射程升级 · ${cost}`;
      $("power").disabled = over || t.level >= 3 || state.gold < cost;
      $("range").disabled = over || state.gold < cost;
      $("sell").disabled = over;
      $("sell").textContent = `出售 · +${Math.floor(t.spent * 0.7)}`;
      $("tower-info").textContent =
        `伤害 ${Math.round(st.damage * (1 + state.research * 0.08))} · 射程 ${st.range} · 间隔 ${st.delay.toFixed(2)} 秒${t.branch ? " · " + (t.branch === "power" ? "威力分支" : "射程分支") : ""}`;
    } else
      $("tower-info").textContent =
        "选中位置时，虚线圆圈展示连弩的基础射程。靠近弯道的位置能覆盖更多路程。";
    Array.from($("pads").children).forEach((b, i) => {
      const tower = state.towers.find((t) => t.pad === i);
      b.classList.toggle("active", i === selected);
      b.classList.toggle("occupied", !!tower);
      b.textContent = tower
        ? `${E.types[tower.type].icon}${tower.level}`
        : i + 1;
      b.setAttribute(
        "aria-label",
        `${i + 1} 号位置${tower ? "，" + E.types[tower.type].name + "，" + tower.level + " 级" : "，空地"}`,
      );
      b.disabled = over;
    });
    $("guide").textContent = over
      ? "这条防线结束了。尝试把火炮放在折返处，配合霜塔减速，再挑战更高波次。"
      : !state.towers.length
        ? "入门 ①：点击道路旁的数字空地，再选“连弩”。你有 175 金币，可以先建两座塔。"
        : state.wave === 0
          ? "入门 ②：点击“开始第 1 波”。炮塔自动攻击；选择已建炮塔可升级，或再搭配一座火炮、霜塔。"
          : state.wave < 3
            ? "入门 ③：敌人越过终点会扣城防。点击震荡波救急，波次之间用金币升级；每 5 波会出现首领。"
            : "霜塔控制速度，连弩负责单体，火炮处理成群与重甲。波次之间自动存档，刷新从本波准备阶段继续。";
  }
  function draw() {
    const m = E.maps[state.map];
    ctx.clearRect(0, 0, 600, 400);
    ctx.fillStyle = ["#e8eee2", "#f0e5da", "#e1edf0"][state.map];
    ctx.fillRect(0, 0, 600, 400);
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = i % 2 ? "#b8c6b733" : "#ffffff88";
      ctx.beginPath();
      ctx.arc(
        (i * 97 + 33) % 600,
        (i * 53 + 21) % 400,
        3 + (i % 5),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    m.path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = "#d3c6ae";
    ctx.lineWidth = 39;
    ctx.stroke();
    ctx.strokeStyle = "#f8edda";
    ctx.lineWidth = 29;
    ctx.stroke();
    ctx.strokeStyle = "#d6c8af";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 10]);
    ctx.stroke();
    ctx.setLineDash([]);
    const tower = state.towers.find((t) => t.pad === selected),
      origin = m.pads[selected];
    ctx.fillStyle = "#8b6dbb10";
    ctx.strokeStyle = "#8b6dbb66";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(...origin, tower ? E.stats(tower).range : 140, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    for (const t of state.towers) {
      const [x, y] = m.pads[t.pad];
      ctx.fillStyle = E.types[t.type].color;
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const shot of state.shots) {
      ctx.strokeStyle = shot.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(...shot.from);
      ctx.lineTo(...shot.to);
      ctx.stroke();
    }
    for (const e of state.enemies) {
      const [x, y] = E.point(m.path, e.d),
        r = e.kind === "boss" ? 17 : 11;
      ctx.fillStyle =
        e.slow > 0
          ? "#6daeb6"
          : {
              normal: "#b7889f",
              fast: "#c39955",
              armor: "#7c819c",
              boss: "#9c627e",
            }[e.kind];
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText(
        e.kind === "boss"
          ? "♛"
          : e.kind === "armor"
            ? "◆"
            : e.kind === "fast"
              ? "»"
              : "•",
        x,
        y + 4,
      );
      ctx.fillStyle = "#ffffffcc";
      ctx.fillRect(x - 15, y - r - 8, 30, 4);
      ctx.fillStyle = "#8b668e";
      ctx.fillRect(x - 15, y - r - 8, 30 * Math.max(0, e.hp / e.max), 4);
    }
    const end = m.path.at(-1);
    ctx.fillStyle = "#735e86";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("守护终点", Math.min(585, end[0]), Math.min(390, end[1] + 25));
  }
  $("start").onclick = () => {
    save();
    if (E.start(state)) {
      paused = false;
      acc = 0;
      render();
      A.status(`第 ${state.wave} 波开始。`);
    }
  };
  $("pause").onclick = () => {
    if (state.phase === "wave") {
      paused = !paused;
      acc = 0;
      render();
    }
  };
  $("pulse").onclick = () => {
    if (!paused && E.pulse(state)) {
      render();
      A.status("震荡波已释放，敌人受伤并减速。");
    }
  };
  $("research").onclick = () => {
    if (E.research(state)) {
      save();
      render();
      A.status(`全体炮塔火力提高，当前加成 ${state.research * 8}%。`);
    }
  };
  $("repair").onclick = () => {
    if (E.repair(state)) {
      save();
      render();
      A.status("城防已修复。");
    }
  };
  $("speed").onclick = () => {
    speed = speed === 1 ? 2 : 1;
    render();
  };
  $("power").onclick = () => {
    const t = state.towers.find((t) => t.pad === selected);
    if (E.upgrade(state, selected, t?.branch || "power")) {
      save();
      render();
    }
  };
  $("range").onclick = () => {
    if (E.upgrade(state, selected, "range")) {
      save();
      render();
    }
  };
  $("sell").onclick = () => {
    if (E.sell(state, selected)) {
      save();
      render();
    }
  };
  $("restart").onclick = () =>
    Deep.confirm(() => {
      state = E.create(Number($("map").value));
      selected = 0;
      paused = false;
      acc = 0;
      buttons();
      save();
      render();
      A.status("新的防线已准备。先建造炮塔。");
    });
  A.autoPause(() => {
    if (state.phase === "wave") {
      paused = true;
      acc = 0;
      render();
    }
  });
  function frame(now) {
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    if (!paused && state.phase === "wave") {
      acc += dt * speed;
      while (acc >= 1 / 60 && state.phase === "wave") {
        E.step(state, 1 / 60);
        acc -= 1 / 60;
      }
      if (state.phase === "build") {
        A.best(state.wave, "bestWave");
        save();
        render();
        A.status(`第 ${state.wave} 波守住了！准备阶段已保存。`);
      } else if (state.phase === "over") {
        A.store("run", null);
        A.completed();
        render();
        A.status(`防线结束，本局守住 ${state.wave - 1} 波。`);
      }
    }
    if (now - paintTime > 100) {
      render();
      paintTime = now;
    }
    draw();
    requestAnimationFrame(frame);
  }
  buttons();
  save();
  render();
  requestAnimationFrame(frame);
})();
