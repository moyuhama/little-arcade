(() => {
  "use strict";
  const A = Arcade,
    E = GameEngine,
    $ = A.$;
  let stars = A.read("stars"),
    talents = A.read("talents");
  stars =
    Array.isArray(stars) && stars.length === 80
      ? stars.map((n) => (Number.isInteger(n) && n >= 0 && n <= 3 ? n : 0))
      : Array(80).fill(0);
  talents = talents && typeof talents === "object" ? talents : {};
  for (const k of ["range", "capacity", "vitality"])
    if (!Number.isInteger(talents[k]) || talents[k] < 0 || talents[k] > 2)
      talents[k] = 0;
  const spent = () =>
      Object.values(talents).reduce((sum, n) => sum + ([0, 3, 10][n] || 0), 0),
    totalStars = () => stars.reduce((s, n) => s + n, 0);
  if (spent() > totalStars()) talents = { range: 0, capacity: 0, vitality: 0 };
  let state = E.restore(A.read("run")) || E.create(0, talents),
    paused = true,
    held = null,
    showDanger = true,
    last = performance.now(),
    saveClock = 0,
    paintClock = 0;
  const canvas = $("canvas"),
    ctx = canvas.getContext("2d");
  for (let i = 0; i < 80; i++) {
    const o = document.createElement("option");
    o.value = i;
    o.textContent = `第 ${i + 1} 关 · ${E.CHAPTERS[Math.floor(i / 10)]}`;
    $("level").append(o);
  }
  $("level").value = state.mode === "campaign" ? state.level : 0;
  $("mode").value = state.mode;
  function save() {
    A.store("run", state);
    A.store("stars", stars);
    A.store("talents", talents);
  }
  function award() {
    if (state.status !== "won" || state.recorded) return;
    state.recorded = true;
    if (state.mode === "campaign") {
      if (!stars[state.level]) A.completed();
      stars[state.level] = Math.max(stars[state.level], state.stars);
    } else A.best(state.level + 1, "endlessStages");
    save();
    A.status(
      state.mode === "campaign"
        ? `第 ${state.level + 1} 关完成，获得 ${state.stars} 星。`
        : `无尽模式已闯过 ${state.level + 1} 关。`,
    );
  }
  function render() {
    award();
    A.score(
      state.mode === "campaign"
        ? `${state.level + 1}/80`
        : `无尽 ${state.level + 1}`,
      state.player.lives,
    );
    $("pause").textContent = paused ? "开始 / 继续" : "暂停";
    $("pause").disabled = state.status !== "play";
    $("field-pause").textContent = paused ? "开始 / 继续战斗" : "暂停战斗";
    $("field-pause").disabled = state.status !== "play";
    $("bomb").disabled =
      paused ||
      state.status !== "play" ||
      state.bombs.length >= state.player.capacity;
    $("next").hidden = state.status !== "won";
    $("next").disabled = state.mode === "campaign" && state.level === 79;
    $("next").textContent =
      state.mode === "campaign" && state.level === 79
        ? "80 关已全部走完"
        : "下一关 →";
    $("keys").textContent =
      `钥匙 ${state.keys}/3 · 剩余敌人 ${state.enemies.length}`;
    $("equipment").textContent =
      `范围 ${state.player.range} · 炸弹 ${state.bombs.length}/${state.player.capacity} · 护盾 ${state.player.shield}`;
    $("clock").textContent =
      `用时 ${Math.floor(state.time)} 秒 · 本关三星参考 ${120 + state.level * 2} 秒`;
    $("danger").setAttribute("aria-pressed", String(showDanger));
    $("danger").textContent = showDanger ? "爆炸范围：显示" : "爆炸范围：隐藏";
    $("star-count").textContent =
      `可用星星 ${totalStars() - spent()} · 已完成 ${stars.filter(Boolean).length}/80 关 · 无尽纪录 ${A.number("endlessStages")} 关`;
    for (const [k, name] of [
      ["capacity", "炸弹携带"],
      ["range", "初始范围"],
      ["vitality", "初始生命"],
    ]) {
      const cost = E.talentCost(talents[k]);
      $("upgrade-" + k).textContent =
        `${name} ${talents[k]}/2${Number.isFinite(cost) ? " · " + cost + " 星" : " · 已满"}`;
      $("upgrade-" + k).disabled = totalStars() - spent() < cost;
    }
    const banner = $("field-message");
    banner.hidden = !paused && state.status === "play";
    banner.textContent =
      state.status === "won"
        ? "出口已抵达，关卡完成！"
        : state.status === "lost"
          ? "这次被困住了，重新挑战试试。"
          : "准备好了就点“开始 / 继续”";
    $("result").hidden = state.status === "play";
    $("result").textContent =
      state.status === "won"
        ? `${"★".repeat(state.stars)}${"☆".repeat(3 - state.stars)} · 找齐钥匙并击败敌人后到达出口。${state.mode === "campaign" && state.level === 79 ? "终章完成，还可以回头收集星星，或挑战无尽模式。" : "下一关会保留你的准备升级。"}`
        : "生命耗尽。炸弹放下后，转过墙角或离开十字范围；可以重试本关。";
    const mechanic = [
      "先练习放炸弹后转到墙角躲避。",
      "箱子更多，连续放置的炸弹会互相引爆。",
      "带 II 的坚固箱子需要两次爆炸；部分敌人也有两格生命。",
      "苔藓格会减慢你的移动，追踪敌人会靠近你。",
      "粉色地面每 5 秒喷火一次，变亮时不要踏上去。",
      "两座传送门可以互相穿越，出口被炸弹占据时不会传送。",
      "追踪敌人更多，要利用炸弹引诱和箱子掩护。",
      "坚固箱、喷火地面、传送门与多血守卫同时登场。",
    ][state.chapter];
    $("guide").textContent =
      `${E.CHAPTERS[state.chapter]}：${mechanic} 炸开箱子找齐 3 把钥匙、击败全部敌人，再走到右下出口。`;
    draw();
  }
  function draw() {
    const n = state.n,
      u = 624 / n,
      colors = [
        ["#eef3e9", "#b7c7ac"],
        ["#f3ece5", "#cbb49b"],
        ["#ecebf0", "#aaa8bd"],
        ["#e4efea", "#a0bcae"],
        ["#f4e9e7", "#c8a7a4"],
        ["#eee8f5", "#baa7ce"],
        ["#e7eaf2", "#a6afc7"],
        ["#f2e9ef", "#c2a4bc"],
      ][state.chapter];
    ctx.clearRect(0, 0, 624, 624);
    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, 624, 624);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const i = y * n + x,
          px = x * u,
          py = y * u,
          t = state.tiles[i];
        ctx.strokeStyle = "#d5cedc55";
        ctx.strokeRect(px, py, u, u);
        if (t === -1) {
          ctx.fillStyle = colors[1];
          ctx.fillRect(px + 2, py + 2, u - 4, u - 4);
          ctx.fillStyle = "#ffffff25";
          ctx.fillRect(px + 5, py + 5, u - 10, 5);
        } else if (t > 0) {
          ctx.fillStyle = t === 2 ? "#b2a2b8" : "#d2b591";
          ctx.fillRect(px + 5, py + 5, u - 10, u - 10);
          ctx.strokeStyle = "#ffffff55";
          ctx.lineWidth = 3;
          ctx.strokeRect(px + 8, py + 8, u - 16, u - 16);
          ctx.beginPath();
          ctx.moveTo(px + 8, py + 8);
          ctx.lineTo(px + u - 8, py + u - 8);
          ctx.stroke();
          if (t === 2) {
            ctx.fillStyle = "#fff7ef";
            ctx.font = `bold ${u * 0.34}px sans-serif`;
            ctx.fillText("II", px + u / 2, py + u / 2);
          }
        } else if (state.terrain[i]) {
          ctx.fillStyle =
            state.terrain[i] === 1
              ? "#a3c3ae"
              : E.ventActive(state)
                ? "#e6a479"
                : "#e0bbc2";
          ctx.fillRect(px + 8, py + 8, u - 16, u - 16);
          ctx.fillStyle = "#fff9";
          ctx.font = `${u * 0.3}px sans-serif`;
          ctx.fillText(
            state.terrain[i] === 1 ? "≈" : "♨",
            px + u / 2,
            py + u / 2,
          );
        }
      }
    if (showDanger) {
      ctx.fillStyle = "#e9b96a33";
      for (const b of state.bombs)
        for (const i of E.blast(state, b))
          ctx.fillRect(
            (i % n) * u + 2,
            Math.floor(i / n) * u + 2,
            u - 4,
            u - 4,
          );
    }
    for (const p of state.portals) {
      ctx.strokeStyle = "#aa86c5";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc((p.x + 0.5) * u, (p.y + 0.5) * u, u * 0.28, 0, Math.PI * 2);
      ctx.stroke();
    }
    const exit = state.exit;
    ctx.fillStyle =
      state.keys >= 3 && !state.enemies.length ? "#81b29a" : "#c4c1ce";
    ctx.fillRect(exit.x * u + 8, exit.y * u + 8, u - 16, u - 16);
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${u * 0.3}px sans-serif`;
    ctx.fillText("出", (exit.x + 0.5) * u, (exit.y + 0.5) * u);
    for (const item of state.items) {
      ctx.fillStyle = item.type === "key" ? "#c5a052" : "#a282bb";
      ctx.font = `bold ${u * 0.45}px sans-serif`;
      ctx.fillText(
        { key: "⚿", range: "↔", capacity: "＋", shield: "◇", heart: "♥" }[
          item.type
        ],
        (item.x + 0.5) * u,
        (item.y + 0.5) * u,
      );
    }
    for (const f of state.flames) {
      ctx.fillStyle = "#edbe74dd";
      for (const i of f.cells)
        ctx.fillRect((i % n) * u + 4, Math.floor(i / n) * u + 4, u - 8, u - 8);
    }
    for (const b of state.bombs) {
      ctx.fillStyle = "#665c79";
      ctx.beginPath();
      ctx.arc((b.x + 0.5) * u, (b.y + 0.55) * u, u * 0.23, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f5d89f";
      ctx.font = `bold ${u * 0.24}px sans-serif`;
      ctx.fillText(Math.ceil(b.fuse), (b.x + 0.5) * u, (b.y + 0.55) * u);
    }
    for (const e of state.enemies) {
      ctx.fillStyle =
        e.type === "warden"
          ? "#b17a91"
          : e.type === "hunter"
            ? "#c58e82"
            : "#b09cbe";
      ctx.beginPath();
      ctx.arc((e.x + 0.5) * u, (e.y + 0.5) * u, u * 0.29, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${u * 0.28}px sans-serif`;
      ctx.fillText(
        e.type === "warden" ? "守" : e.type === "hunter" ? "追" : "巡",
        (e.x + 0.5) * u,
        (e.y + 0.5) * u,
      );
      for (let h = 0; h < e.hp; h++) {
        ctx.fillStyle = "#8f647c";
        ctx.fillRect(
          (e.x + 0.25 + h * 0.17) * u,
          (e.y + 0.88) * u,
          u * 0.12,
          u * 0.04,
        );
      }
    }
    const p = state.player;
    ctx.fillStyle = "#8a72bb";
    ctx.beginPath();
    ctx.arc((p.x + 0.5) * u, (p.y + 0.5) * u, u * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${u * 0.3}px sans-serif`;
    ctx.fillText("你", (p.x + 0.5) * u, (p.y + 0.5) * u);
    if (p.shield || p.invincible) {
      ctx.strokeStyle = p.invincible ? "#ead79d" : "#8dbba9";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc((p.x + 0.5) * u, (p.y + 0.5) * u, u * 0.37, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  function move(dir) {
    if (paused) return;
    E.move(state, dir);
    save();
    render();
  }
  function drop() {
    if (paused) return;
    if (E.bomb(state)) {
      A.status("炸弹已放下，2.4 秒后爆炸；迅速转过墙角躲开。");
      save();
      render();
    }
  }
  function pause() {
    paused = true;
    held = null;
    save();
    render();
  }
  A.autoPause(pause);
  $("pause").onclick = $("field-pause").onclick = () => {
    if (state.status !== "play") return;
    paused = !paused;
    held = null;
    last = performance.now();
    render();
    if (!paused) {
      const box = $("arena").getBoundingClientRect();
      if (box.top < 0 || box.bottom > innerHeight)
        $("arena").scrollIntoView({ block: "center", behavior: "instant" });
    }
  };
  $("bomb").onclick = drop;
  $("danger").onclick = () => {
    showDanger = !showDanger;
    render();
  };
  for (const b of document.querySelectorAll("[data-move]")) {
    b.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      held = Number(b.dataset.move);
      b.setPointerCapture(ev.pointerId);
      move(held);
    });
    b.addEventListener("click", (ev) => {
      if (ev.detail === 0) move(Number(b.dataset.move));
    });
    b.addEventListener("pointerup", () => (held = null));
    b.addEventListener("pointercancel", () => (held = null));
  }
  document.addEventListener("keydown", (ev) => {
    if (
      ev.target.closest("input,select,dialog") ||
      ev.ctrlKey ||
      ev.metaKey ||
      ev.altKey
    )
      return;
    const dir = {
      ArrowUp: 0,
      w: 0,
      ArrowRight: 1,
      d: 1,
      ArrowDown: 2,
      s: 2,
      ArrowLeft: 3,
      a: 3,
    }[ev.key];
    if (dir !== undefined) {
      ev.preventDefault();
      held = dir;
      if (!ev.repeat) move(dir);
    }
    if (ev.code === "Space") {
      ev.preventDefault();
      if (!ev.repeat) drop();
    }
    if (ev.key.toLowerCase() === "p" || ev.key === "Escape") pause();
  });
  document.addEventListener("keyup", (ev) => {
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "w",
        "a",
        "s",
        "d",
      ].includes(ev.key)
    )
      held = null;
  });
  function start(level, mode, seed) {
    state = E.create(level, talents, mode, seed);
    paused = true;
    held = null;
    save();
    render();
    A.status("新关卡已准备好。准备升级将在新关卡生效。");
  }
  $("start-level").onclick = () =>
    Deep.confirm(
      () =>
        start(
          $("mode").value === "campaign" ? Number($("level").value) : 0,
          $("mode").value,
          $("mode").value === "campaign" ? 38171 : Deep.seed(),
        ),
      "切换到所选关卡会替换当前战斗进度；星星与升级保留。",
    );
  $("restart").onclick = () =>
    Deep.confirm(
      () => start(state.level, state.mode, state.seed),
      "重试本关会重新生成同一地图；已获得的星星和准备升级保留。",
    );
  $("next").onclick = () => {
    if (
      state.status === "won" &&
      (state.mode === "endless" || state.level < 79)
    ) {
      start(state.level + 1, state.mode, state.seed);
      if (state.mode === "campaign") $("level").value = state.level;
    }
  };
  for (const k of ["capacity", "range", "vitality"])
    $("upgrade-" + k).onclick = () => {
      const cost = E.talentCost(talents[k]);
      if (totalStars() - spent() < cost) return;
      talents[k]++;
      save();
      render();
      A.status("准备升级已购买，下次开关或重试时生效。");
    };
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!paused && state.status === "play") {
      E.step(state, dt);
      if (held !== null) E.move(state, held);
      saveClock += dt;
      paintClock += dt;
      if (saveClock >= 0.75) {
        save();
        saveClock = 0;
      }
      if (paintClock >= 0.1 || state.status !== "play") {
        render();
        paintClock = 0;
      } else draw();
    }
    requestAnimationFrame(frame);
  }
  save();
  render();
  requestAnimationFrame(frame);
})();
