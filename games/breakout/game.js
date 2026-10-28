(() => {
  "use strict";
  const E = Breakout,
    $ = (id) => document.getElementById(id);
  const canvas = $("breakout-board"),
    ctx = canvas.getContext("2d");
  const colors = [
    "#ff658e",
    "#ffb65c",
    "#ffe979",
    "#66efae",
    "#56d7ff",
    "#a18aff",
    "#ed88ec",
    "#80aaff",
  ];
  const supplies = {
    multi: ["三球", "Ⅲ", "#64edbb"],
    wide: ["长板", "↔", "#56d7ff"],
    laser: ["激光", "Ⅱ", "#ff759f"],
    pierce: ["穿透", "↑", "#ffbc68"],
    slow: ["减速", "◷", "#b59aff"],
    shield: ["护盾", "◇", "#82b5ff"],
  };
  const keys = {
    campaign: {
      progress: "little-arcade-breakout-neon-progress-v2",
      best: "little-arcade-breakout-neon-best-v2",
    },
    endless: {
      progress: "little-arcade-breakout-endless-progress-v1",
      best: "little-arcade-breakout-endless-best-v1",
    },
  };
  const modeKey = "little-arcade-breakout-mode-v1",
    waveRecordKey = "little-arcade-breakout-endless-cleared-v1";
  let mode = "campaign",
    progressKey = keys.campaign.progress,
    recordKey = keys.campaign.best;
  let state = E.createGame(),
    checkpoint,
    best = 0,
    clearedRecord = 0;
  const isEndless = () => mode === "endless";
  const phoneLayout = () =>
    window.innerWidth > 0 &&
    (window.innerWidth <= 600 ||
      (window.innerWidth <= 1100 && window.innerHeight <= 600));
  function courtBounds() {
    const rect = document
      .querySelector(".play-surface")
      ?.getBoundingClientRect();
    return {
      width: Math.max(1, (rect?.width || window.innerWidth - 16) - 8),
      height: Math.max(1, (rect?.height || window.innerHeight - 192) - 29),
    };
  }
  function preferredArena() {
    if (phoneLayout()) {
      const { width, height } = courtBounds();
      return window.innerWidth > window.innerHeight
        ? E.arenaFor((E.HEIGHT * width) / height, E.HEIGHT)
        : E.arenaFor(E.WIDTH, (E.WIDTH * height) / width);
    }
    const surface = document.querySelector(".play-surface");
    const width = surface?.getBoundingClientRect?.().width || E.WIDTH + 18;
    const desktop =
      (window.innerWidth || 0) > 900 ||
      ((window.innerWidth || 0) >= 600 && window.innerHeight <= 600);
    return E.arenaFor(
      width - 18,
      desktop ? (window.innerHeight || 738) - 138 : E.HEIGHT,
    );
  }
  function freshCheckpoint() {
    return {
      level: 1,
      score: 0,
      lives: 3,
      energy: 0,
      ...preferredArena(),
      ...(isEndless() ? { seed: Math.floor(Math.random() * 4294967296) } : {}),
    };
  }
  let paused = false,
    animation = null,
    lastTime = null,
    storageAvailable = true;
  let drag = null;
  let particles = [],
    rings = [],
    trails = new Map(),
    flash = null;
  const held = new Set(),
    reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let audio = null,
    soundEnabled = false,
    lastSound = 0;
  const memory = new Map();
  function read(key) {
    if (memory.has(key)) return memory.get(key);
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      storageAvailable = false;
      return null;
    }
  }
  function write(key, value) {
    memory.set(key, value);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      storageAvailable = false;
    }
  }
  function validCheckpoint(s) {
    return (
      s &&
      Number.isSafeInteger(s.level) &&
      s.level >= 1 &&
      (isEndless()
        ? Number.isInteger(s.seed) && s.seed >= 0 && s.seed <= 4294967295
        : s.level <= E.LEVELS.length) &&
      Number.isSafeInteger(s.score) &&
      s.score >= 0 &&
      Number.isInteger(s.lives) &&
      s.lives >= 1 &&
      s.lives <= 5
    );
  }
  function loadMode() {
    progressKey = keys[mode].progress;
    recordKey = keys[mode].best;
    checkpoint = freshCheckpoint();
    const stored = read(progressKey);
    if (validCheckpoint(stored))
      checkpoint = {
        ...stored,
        energy: Number.isFinite(stored.energy)
          ? Math.max(0, Math.min(100, stored.energy))
          : 0,
      };
    else if (!isEndless()) {
      const legacy = read("little-arcade-breakout-progress-v1");
      if (validCheckpoint(legacy))
        checkpoint = {
          level: legacy.level,
          score: 0,
          lives: legacy.lives,
          energy: 0,
        };
    }
    const record = read(recordKey);
    best = Number.isSafeInteger(record) && record >= 0 ? record : 0;
    const cleared = read(waveRecordKey);
    clearedRecord = Number.isSafeInteger(cleared) && cleared >= 0 ? cleared : 0;
  }
  mode = read(modeKey) === "endless" ? "endless" : "campaign";
  loadMode();
  soundEnabled = read("little-arcade-breakout-sound") === true;
  function soundInit() {
    if (!soundEnabled) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      audio.resume().catch(() => {});
    } catch {
      soundEnabled = false;
    }
  }
  function beep(type) {
    if (!soundEnabled || !audio || audio.state !== "running") return;
    const now = audio.currentTime;
    if (now - lastSound < 0.04) return;
    lastSound = now;
    const oscillator = audio.createOscillator(),
      gain = audio.createGain();
    const frequency =
      type === "power"
        ? 880
        : type === "overdrive"
          ? 220
          : type === "lost"
            ? 110
            : type === "paddle"
              ? 260
              : 460 + Math.min(state.combo, 20) * 22;
    oscillator.type = type === "power" ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      type === "lost" ? 50 : frequency * 1.4,
      now + 0.1,
    );
    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(now + 0.15);
  }
  function clearFX() {
    particles = [];
    rings = [];
    trails.clear();
    flash = null;
  }
  function restore() {
    state = {
      ...E.createGame(checkpoint.level, {
        mode,
        seed: checkpoint.seed,
        ...preferredArena(),
        ...(!phoneLayout() && checkpoint.width && checkpoint.height
          ? { width: checkpoint.width, height: checkpoint.height }
          : {}),
      }),
      score: checkpoint.score,
      lives: checkpoint.lives,
      energy: checkpoint.energy || 0,
    };
    checkpoint = checkpointFor(state);
    clearFX();
  }
  function saveCheckpoint() {
    write(progressKey, checkpoint);
  }
  function checkpointFor(s) {
    return {
      level: s.level,
      score: s.score,
      lives: s.lives,
      energy: s.energy,
      width: s.width,
      height: s.height,
      ...(isEndless() ? { seed: s.seed } : {}),
    };
  }
  function rememberNext() {
    if (isEndless()) {
      clearedRecord = Math.max(clearedRecord, state.level);
      write(waveRecordKey, clearedRecord);
    }
    write(
      progressKey,
      state.status === "won"
        ? freshCheckpoint()
        : checkpointFor({
            ...state,
            ...preferredArena(),
            level: state.level + 1,
            lives: Math.min(5, state.lives + E.lifeBonus(state)),
          }),
    );
  }
  restore();
  E.LEVELS.forEach((name, i) => {
    const option = document.createElement("option");
    option.value = i + 1;
    option.textContent = `${String(i + 1).padStart(2, "0")} · ${name}`;
    $("level-picker").append(option);
  });
  function round(x, y, w, h, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
  }
  function text(value, x, y, size, color, align = "center") {
    ctx.fillStyle = color;
    ctx.font = `700 ${size}px ui-monospace, monospace`;
    ctx.textAlign = align;
    ctx.fillText(value, x, y);
  }
  function line(x, y, endX, endY, color, width = 1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }
  function effects(events) {
    for (const event of events) {
      if (
        [
          "brick",
          "armor",
          "power",
          "paddle",
          "lost",
          "overdrive",
          "save",
        ].includes(event.type)
      )
        beep(event.type);
      if (event.type === "power")
        flash = {
          label: `${supplies[event.power][0]}已接收`,
          color: supplies[event.power][2],
          ttl: 1.5,
        };
      if (event.type === "overdrive")
        flash = { label: "OVERDRIVE", color: "#ffbc68", ttl: 1.8 };
      if (event.type === "save")
        flash = { label: "护盾救球", color: "#82b5ff", ttl: 1.2 };
      if (reduced.matches) continue;
      if (["brick", "armor", "power", "save"].includes(event.type)) {
        const color =
          event.type === "power"
            ? supplies[event.power][2]
            : colors[(event.row || 0) % colors.length];
        for (let i = 0; i < (event.type === "brick" ? 9 : 4); i++) {
          const a = Math.random() * Math.PI * 2,
            speed = 40 + Math.random() * 140;
          particles.push({
            x: event.x,
            y: event.y,
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed,
            color,
            ttl: 0.5 + Math.random() * 0.35,
          });
        }
      }
      if (event.type === "blast")
        rings.push({ x: event.x, y: event.y, ttl: 0.4 });
    }
    particles = particles.slice(-200);
    rings = rings.slice(-12);
  }
  function tickFX(dt) {
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 90 * dt;
      p.ttl -= dt;
    }
    particles = particles.filter((p) => p.ttl > 0);
    rings.forEach((r) => (r.ttl -= dt));
    rings = rings.filter((r) => r.ttl > 0);
    if (flash) {
      flash.ttl -= dt;
      if (flash.ttl <= 0) flash = null;
    }
    const ids = new Set(E.balls(state).map((b) => b.id));
    for (const id of trails.keys()) if (!ids.has(id)) trails.delete(id);
    for (const b of E.balls(state)) {
      const trail = trails.get(b.id) || [];
      trail.push({ x: b.x, y: b.y });
      if (trail.length > (reduced.matches ? 3 : 13)) trail.shift();
      trails.set(b.id, trail);
    }
  }
  function draw() {
    if (!ctx) return;
    const W = state.width,
      H = state.height;
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const pixelsWide = Math.round(W * dpr),
      pixelsHigh = Math.round(H * dpr);
    if (canvas.width !== pixelsWide || canvas.height !== pixelsHigh) {
      canvas.width = pixelsWide;
      canvas.height = pixelsHigh;
    }
    canvas.style.aspectRatio = `${W} / ${H}`;
    const frame = document.querySelector(".play-board-frame");
    frame?.style?.setProperty("--arena-width", `${W + 18}px`);
    frame?.style?.setProperty("--arena-ratio", W / H);
    ctx.setTransform(pixelsWide / W, 0, 0, pixelsHigh / H, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const gradient = ctx.createLinearGradient(0, 0, W, H);
    gradient.addColorStop(0, "#0c132c");
    gradient.addColorStop(0.55, "#080c20");
    gradient.addColorStop(1, "#15102b");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    for (let x = 25; x < W; x += 25)
      for (let y = 25; y < H; y += 25) round(x, y, 1, 1, 0, "#3d50732c");
    ctx.shadowColor = state.overdrive > 0 ? "#ffbc68" : "#45c9e7";
    ctx.shadowBlur = 12;
    ctx.strokeStyle = state.overdrive > 0 ? "#ffbc6888" : "#56d7ff66";
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, W - 4, H - 4);
    ctx.shadowBlur = 0;
    for (const [x, y, dx, dy] of [
      [3, 3, 1, 1],
      [W - 3, 3, -1, 1],
      [3, H - 3, 1, -1],
      [W - 3, H - 3, -1, -1],
    ]) {
      line(x, y, x + dx * 20, y, "#94efff", 3);
      line(x, y, x, y + dy * 20, "#94efff", 3);
    }
    text(
      `${isEndless() ? "WAVE" : "SECTOR"} ${String(state.level).padStart(2, "0")}`,
      22,
      31,
      12,
      "#6e85ab",
      "left",
    );
    text(
      `${state.bricks.filter((b) => b.alive && b.kind !== "steel").length} BRICKS`,
      W - 22,
      31,
      12,
      "#6e85ab",
      "right",
    );
    for (const b of state.bricks) {
      if (!b.alive) continue;
      const color =
        b.kind === "steel"
          ? "#667d9c"
          : b.kind === "bomb"
            ? "#ff8c69"
            : colors[b.row % colors.length];
      round(b.x, b.y + 3, b.width, b.height, 3, "#00000070");
      round(
        b.x,
        b.y,
        b.width,
        b.height,
        3,
        b.kind === "steel" ? "#25334d" : color,
      );
      round(b.x + 3, b.y + 2, b.width - 6, 2, 1, "#ffffff65");
      if (b.kind === "armor") {
        round(b.x + 4, b.y + 6, b.width - 8, b.height - 9, 2, "#111a3866");
        for (let i = 0; i < b.hp; i++)
          round(
            b.x + b.width / 2 - (b.hp * 8 - 3) / 2 + i * 8,
            b.y + 11,
            5,
            3,
            1,
            "#ffffff",
          );
      } else if (b.kind === "bomb")
        text("✦", b.x + b.width / 2, b.y + 17, 18, "#502027");
      else if (b.kind === "steel") {
        line(b.x + 7, b.y + 6, b.x + b.width - 7, b.y + b.height - 6, color, 2);
        line(b.x + 7, b.y + b.height - 6, b.x + b.width - 7, b.y + 6, color, 2);
      } else if (b.kind === "moving")
        text("‹ ›", b.x + b.width / 2, b.y + 16, 15, "#12213c");
    }
    if (state.combo >= 3) {
      ctx.globalAlpha = Math.min(0.85, state.comboTime);
      text(
        `${state.combo} COMBO`,
        W / 2,
        H - 224,
        33,
        state.combo >= 10 ? "#ffe979" : "#8098bf",
      );
      text(`×${E.multiplier(state)} SCORE`, W / 2, H - 200, 13, "#6985ae");
      ctx.globalAlpha = 1;
    }
    if (flash) text(flash.label, W / 2, H - 154, 20, flash.color);
    for (const shot of state.shots) {
      round(shot.x - 2, shot.y - 9, 4, 15, 2, "#ff759f");
    }
    for (const d of state.drops) {
      const [, symbol, color] = supplies[d.type];
      round(d.x - 19, d.y - 11, 38, 22, 7, "#0b1530");
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(d.x - 18, d.y - 10, 36, 20);
      text(symbol, d.x, d.y + 6, 17, color);
    }
    if (state.shields) {
      line(6, H - 16, W - 6, H - 16, "#82b5ff", 3);
      text(`SHIELD ${state.shields}`, W / 2, H - 22, 11, "#82b5ff");
    }
    const width = E.paddleWidth(state),
      paddleColor = state.overdrive ? "#ffbc68" : "#69e4f7";
    ctx.shadowColor = paddleColor;
    ctx.shadowBlur = 16;
    round(state.paddle, E.paddleY(state), width, 12, 4, paddleColor);
    ctx.shadowBlur = 0;
    round(state.paddle + 5, E.paddleY(state) + 3, width - 10, 3, 1, "#e8ffff");
    if (state.effects.laser)
      for (const x of [state.paddle + 4, state.paddle + width - 10])
        round(x, E.paddleY(state) - 6, 6, 14, 2, "#ff759f");
    for (const b of E.balls(state)) {
      const color =
        state.effects.pierce || state.overdrive
          ? "#ffbd72"
          : ["#f6f7ff", "#66efae", "#ff80b5", "#ffbc68", "#9f97ff"][
              (b.id || 0) % 5
            ];
      const trail = trails.get(b.id) || [];
      trail.forEach((p, i) => {
        ctx.globalAlpha = ((i + 1) / trail.length) * 0.35;
        const size = 3 + (i / trail.length) * 6;
        round(p.x - size / 2, p.y - size / 2, size, size, 1, color);
      });
      ctx.globalAlpha = 1;
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      round(b.x - 6, b.y - 6, 12, 12, 2, color);
      ctx.shadowBlur = 0;
    }
    for (const p of particles) {
      ctx.globalAlpha = Math.min(1, p.ttl * 2);
      round(p.x, p.y, 4, 4, 1, p.color);
    }
    for (const r of rings) {
      ctx.globalAlpha = r.ttl * 2;
      ctx.strokeStyle = "#ffbc68";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, (0.4 - r.ttl) * 250, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function value(id, v) {
    if ($(id).textContent !== String(v)) $(id).textContent = v;
  }
  function hud() {
    if (state.score > best) {
      best = state.score;
      write(recordKey, best);
    }
    value("score", state.score.toLocaleString());
    value("mobile-score", state.score.toLocaleString());
    value("mobile-mode", isEndless() ? "无限挑战" : "闯关");
    value(
      "mobile-record",
      `${isEndless() ? "无限" : "闯关"}最高分 ${best.toLocaleString()}${isEndless() ? ` · 最高通过 ${clearedRecord} 波` : ""}`,
    );
    value("best", best.toLocaleString());
    value("level", String(state.level).padStart(2, "0"));
    value("stage-total", isEndless() ? " 波" : " / 20 关");
    value("record-label", isEndless() ? "无限纪录" : "闯关纪录");
    value("endless-record", `最高通过 ${clearedRecord} 波`);
    value("lives", "♥".repeat(state.lives) || "—");
    $("lives").setAttribute("aria-label", `${state.lives} 条生命`);
    value("ball-count", E.balls(state).length);
    value("arena-info", `${state.columns} 列砖阵 · 下一关 / 波随窗口扩展`);
    value("combo-count", `${state.combo} / ×${E.multiplier(state)}`);
    const percent = Math.floor(state.energy);
    $("energy-fill").style.width = `${percent}%`;
    $("energy-meter").setAttribute("aria-valuenow", percent);
    value(
      "energy-label",
      state.overdrive > 0
        ? `强化 ${Math.ceil(state.overdrive)}s`
        : percent === 100
          ? "能量已满"
          : `${percent}%`,
    );
    $("overdrive").disabled =
      paused ||
      state.status !== "playing" ||
      percent < 100 ||
      state.overdrive > 0;
    $("overdrive").classList.toggle(
      "charged",
      percent === 100 && !state.overdrive,
    );
    value(
      "overdrive",
      state.overdrive
        ? "穿透强化中"
        : phoneLayout()
          ? "释放强化"
          : "释放强化 · E",
    );
    const active = Object.entries(state.effects)
      .filter(([, t]) => t > 0)
      .map(([k, t]) => `${supplies[k][0]} ${Math.ceil(t)}s`);
    if (state.shields) active.push(`护盾 ×${state.shields}`);
    value("active-effects", active.join(" · ") || "接住掉落胶囊，获得强化");
    value(
      "save-note",
      storageAvailable
        ? isEndless()
          ? "✓ 保存波次起点 · 每 5 波补一命 · 生命耗尽结束本轮"
          : "✓ 保存关卡起点 · 闯关纪录独立计分"
        : "浏览器存储不可用，本次成绩暂存在页面中",
    );
    canvas.setAttribute(
      "aria-label",
      `第${state.level}${isEndless() ? "波" : "关"}，${state.lives}条生命，${E.balls(state).length}个球，${state.score}分，${state.combo}连击`,
    );
  }
  function fitCourt() {
    if (phoneLayout()) {
      const { height } = courtBounds();
      document
        .querySelector(".play-board-frame")
        ?.style.setProperty(
          "--phone-frame-width",
          `${(height * state.width) / state.height + 8}px`,
        );
    }
  }
  function render() {
    draw();
    fitCourt();
    hud();
    $("mode-picker").value = mode;
    $("level-choice").hidden = isEndless();
    $("endless-record").hidden = !isEndless();
    $("level-picker").value = isEndless() ? 1 : state.level;
    value("restart", isEndless() ? "↻ 重新挑战" : "↻ 重试本关");
    $("pause").disabled = state.status !== "playing";
    value("pause", paused ? "▷ 继续" : "Ⅱ 暂停");
    $("mobile-pause").disabled = state.status !== "playing";
    value("mobile-pause", paused ? "▷" : "Ⅱ");
    $("mobile-pause").setAttribute(
      "aria-label",
      paused ? "继续游戏" : "暂停游戏",
    );
    value("touch-hint", paused ? "已暂停 · 点击继续游戏" : "在这里左右滑动");
    value("sound", soundEnabled ? "声音 开" : "声音 关");
    $("sound").setAttribute("aria-pressed", soundEnabled);
    $("game-overlay").hidden = state.status === "playing" && !paused;
    if ($("game-overlay").hidden) return;
    value(
      "overlay-kicker",
      paused
        ? "TAKE A BREAK"
        : state.status === "level" || state.status === "won"
          ? isEndless()
            ? "WAVE CLEAR"
            : "SECTOR CLEAR"
          : state.status === "lost"
            ? "TRY AGAIN"
            : isEndless()
              ? "ENDLESS RUN"
              : "NEON BREAKER",
    );
    value(
      "overlay-title",
      paused
        ? "等你，再来一球"
        : state.status === "level"
          ? isEndless()
            ? `第 ${state.level} 波，突破成功！`
            : "漂亮，突破成功！"
          : state.status === "won"
            ? "20 关，全部击破！"
            : state.status === "lost"
              ? isEndless()
                ? `挑战止步第 ${state.level} 波`
                : "再试一次，找到突破口"
              : isEndless()
                ? `无限挑战 · 第 ${state.level} 波`
                : "让连击亮起来",
    );
    value(
      "overlay-description",
      paused
        ? "计时与道具效果已暂停。准备好后手动继续。"
        : state.status === "level"
          ? `${state.score} 分 · 最长 ${state.bestCombo} 连击。${E.lifeBonus(state) ? "补充一条生命（最多五条）。" : `再过 ${5 - (state.level % 5)} 波补一命。`}`
          : state.status === "won" || state.status === "lost"
            ? `本局 ${state.score} 分 · 最长 ${state.bestCombo} 连击`
            : isEndless()
              ? "持续生成新砖阵，每 5 波补一命。生命耗尽结束本轮，刷新可从本波起点继续。"
              : `${E.LEVELS[state.level - 1]} · 接住补给，分裂多球。全部球掉落才扣一条生命。`,
    );
    value(
      "overlay-action",
      paused
        ? "继续游戏 →"
        : state.status === "level"
          ? isEndless()
            ? "下一波 →"
            : "下一关 →"
          : state.status === "won"
            ? "从第一关开始 →"
            : state.status === "lost"
              ? isEndless()
                ? "新一轮挑战 →"
                : "重试当前关 →"
              : "发球，开始连击 →",
    );
    value(
      "overlay-hint",
      phoneLayout()
        ? "底部滑动区控制挡板 · 能量满后点强化"
        : "鼠标 / 拖动 / ← → 移动 · 空格暂停 · E 强化",
    );
  }
  function stop() {
    cancelAnimationFrame(animation);
    animation = null;
    lastTime = null;
    held.clear();
    drag = null;
    $("paddle-touch-zone").setAttribute("data-dragging", "false");
  }
  function frame(timestamp) {
    if (paused || state.status !== "playing") return;
    const dt =
      lastTime === null ? 0 : Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;
    const direction = Number(held.has("right")) - Number(held.has("left"));
    if (direction)
      state = E.movePaddle(
        state,
        state.paddle +
          E.paddleWidth(state) / 2 +
          direction * Math.max(520, state.width * 0.9) * dt,
      );
    state = E.step(state, dt);
    effects(state.events);
    tickFX(dt);
    draw();
    hud();
    if (state.status !== "playing") {
      if (state.status === "level" || state.status === "won") rememberNext();
      else if (state.status === "lost" && isEndless()) write(progressKey, null);
      stop();
      clearFX();
      render();
      value(
        "status",
        state.status === "level"
          ? isEndless()
            ? "本波完成，下一波起点已保存。"
            : "本关完成，下一关已保存。"
          : state.status === "won"
            ? "全部通关！"
            : state.status === "lost"
              ? isEndless()
                ? "本轮结束，分数和通过波次已记录。"
                : "挑战结束，可重试当前关。"
              : `全部球掉落，还剩 ${state.lives} 条生命。`,
      );
      $("overlay-action").focus({ preventScroll: true });
      return;
    }
    if (state.events.some((e) => e.type === "power"))
      value(
        "status",
        `已接收${supplies[state.events.find((e) => e.type === "power").power][0]}补给。`,
      );
    animation = requestAnimationFrame(frame);
  }
  function start() {
    if (document.hidden || !ctx || document.querySelector("dialog[open]"))
      return;
    soundInit();
    stop();
    if (state.status === "won") {
      checkpoint = freshCheckpoint();
      restore();
      saveCheckpoint();
    } else if (state.status === "lost") {
      if (isEndless()) checkpoint = freshCheckpoint();
      restore();
      saveCheckpoint();
    } else if (state.status === "level") {
      const next = read(progressKey);
      state = E.advanceLevel({
        ...state,
        width: next?.width || state.width,
        height: next?.height || state.height,
      });
      clearFX();
      checkpoint = checkpointFor(state);
      saveCheckpoint();
    }
    if (state.status === "ready") {
      saveCheckpoint();
      state = E.launch(state);
    }
    state = { ...state, events: [] };
    paused = false;
    render();
    canvas.focus({ preventScroll: true });
    value("status", "接住胶囊获得强化；能量满后按 E 或点击释放。");
    animation = requestAnimationFrame(frame);
  }
  function pause() {
    if (state.status !== "playing" || paused) return;
    paused = true;
    stop();
    render();
    value("status", "已暂停，准备好后手动继续。");
  }
  function restart() {
    stop();
    if (isEndless()) checkpoint = freshCheckpoint();
    restore();
    saveCheckpoint();
    paused = false;
    render();
    value(
      "status",
      isEndless() ? "新一轮挑战已就绪，从第 1 波开始。" : "已回到本关起点。",
    );
  }
  function activate() {
    if (paused || document.querySelector("dialog[open]")) return;
    const next = E.activateOverdrive(state);
    if (next === state) return;
    state = next;
    effects(state.events);
    state = { ...state, events: [] };
    render();
    value("status", "强化启动：六秒穿透、双倍得分！");
  }
  function point(event) {
    if (paused || state.status !== "playing") return;
    const rect = canvas.getBoundingClientRect();
    state = E.movePaddle(
      state,
      ((event.clientX - rect.left) / rect.width) * state.width,
    );
    draw();
  }
  function beginDrag(event, target) {
    if (
      !event.isPrimary ||
      event.button !== 0 ||
      paused ||
      !["ready", "playing"].includes(state.status) ||
      document.querySelector("dialog[open]")
    )
      return;
    drag = { id: event.pointerId, x: event.clientX, target };
    target.setPointerCapture(event.pointerId);
    $("paddle-touch-zone").setAttribute("data-dragging", "true");
  }
  function moveDrag(event) {
    if (!drag || drag.id !== event.pointerId || paused) return;
    const width = drag.target.getBoundingClientRect().width;
    const delta =
      ((event.clientX - drag.x) / Math.max(1, width)) * state.width * 1.25;
    drag.x = event.clientX;
    state = E.movePaddle(
      state,
      state.paddle + E.paddleWidth(state) / 2 + delta,
    );
    draw();
  }
  function endDrag(event) {
    if (drag?.id !== event.pointerId) return;
    drag = null;
    $("paddle-touch-zone").setAttribute("data-dragging", "false");
  }
  canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch" || event.pointerType === "pen") {
      beginDrag(event, canvas);
      return;
    }
    if (!event.isPrimary || event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    point(event);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch" || event.pointerType === "pen") {
      moveDrag(event);
      return;
    }
    if (event.isPrimary) point(event);
  });
  const touchZone = $("paddle-touch-zone");
  touchZone.addEventListener("pointerdown", (event) =>
    beginDrag(event, touchZone),
  );
  touchZone.addEventListener("pointermove", moveDrag);
  for (const target of [canvas, touchZone])
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
      target.addEventListener(name, endDrag);
  for (const direction of ["left", "right"]) {
    const button = $(`move-${direction}`);
    button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || paused || state.status !== "playing") return;
      held.add(direction);
      button.setPointerCapture(event.pointerId);
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
      button.addEventListener(name, () => held.delete(direction));
    button.addEventListener("click", (event) => {
      if (event.detail === 0 && !paused && state.status === "playing") {
        state = E.movePaddle(
          state,
          state.paddle +
            E.paddleWidth(state) / 2 +
            (direction === "left" ? -35 : 35),
        );
        draw();
      }
    });
  }
  const directions = {
    ArrowLeft: "left",
    ArrowRight: "right",
    a: "left",
    d: "right",
  };
  document.addEventListener("keydown", (event) => {
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) ||
      event.target.isContentEditable ||
      document.querySelector("dialog[open]")
    )
      return;
    const direction =
      directions[event.key] || directions[event.key.toLowerCase()];
    if (direction && !paused && state.status === "playing") {
      event.preventDefault();
      held.add(direction);
    }
    if (event.key === "Escape") pause();
    if (event.key.toLowerCase() === "e" && !event.repeat) activate();
    if (event.code === "Space" && !event.target.closest("button, a")) {
      event.preventDefault();
      if (!event.repeat)
        state.status === "playing" && !paused ? pause() : start();
    }
  });
  document.addEventListener("keyup", (event) =>
    held.delete(directions[event.key] || directions[event.key.toLowerCase()]),
  );
  $("level-picker").addEventListener("change", () => {
    if (isEndless()) return;
    stop();
    checkpoint = {
      level: Number($("level-picker").value),
      score: 0,
      lives: 3,
      energy: 0,
    };
    restore();
    saveCheckpoint();
    paused = false;
    render();
    value("status", "已切换关卡，发球开始新挑战。");
  });
  $("overlay-action").addEventListener("click", start);
  $("pause").addEventListener("click", () => (paused ? start() : pause()));
  $("mobile-pause").addEventListener("click", () =>
    paused ? start() : pause(),
  );
  $("mobile-menu-open").addEventListener("click", () => {
    pause();
    $("mobile-game-menu").showModal();
  });
  $("mode-picker").addEventListener("change", () => {
    stop();
    mode = $("mode-picker").value === "endless" ? "endless" : "campaign";
    write(modeKey, mode);
    loadMode();
    restore();
    paused = false;
    render();
    value(
      "status",
      isEndless()
        ? "无限挑战：持续生成新波次，每 5 波补一命。"
        : "已返回闯关模式，恢复关卡起点。",
    );
  });
  $("restart").addEventListener("click", () => {
    $("mobile-game-menu").close();
    if (
      isEndless() &&
      state.status !== "lost" &&
      (state.level > 1 || state.status === "playing" || state.score > 0)
    ) {
      pause();
      $("endless-reset").showModal();
    } else restart();
  });
  $("confirm-new-run").addEventListener("click", () => {
    $("endless-reset").close();
    restart();
  });
  $("overdrive").addEventListener("click", activate);
  $("sound").addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    write("little-arcade-breakout-sound", soundEnabled);
    soundInit();
    render();
  });
  document.addEventListener("arcade:pause", pause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
  });
  window.addEventListener("blur", pause);
  let viewportWidth = window.innerWidth,
    viewportHeight = window.innerHeight;
  window.addEventListener("resize", () => {
    const changedWidth = viewportWidth !== window.innerWidth;
    const desktop =
      window.innerWidth > 900 ||
      (window.innerWidth >= 600 && window.innerHeight <= 600);
    const changedHeight = viewportHeight !== window.innerHeight;
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;
    // Mobile address bars change viewport height during ordinary scrolling.
    if (!changedWidth && phoneLayout()) {
      render();
      return;
    }
    if (!changedWidth && !(desktop && changedHeight)) return;
    pause();
    // Before the first launch there is no live ball or partially cleared field to preserve.
    if (state.status === "ready" && state.time === 0) {
      checkpoint = { ...checkpoint, ...preferredArena() };
      restore();
    }
    render();
    value(
      "status",
      "本波场地保持不变；下一关 / 波按窗口生成新场地。准备好后手动继续。",
    );
  });
  window.addEventListener("pagehide", () => {
    pause();
    stop();
  });
  // Safari can resize the dynamic viewport without a matching window resize event.
  // Observe the fixed grid area; fitting its child never changes the game physics.
  const surface = document.querySelector(".play-surface");
  if (surface && typeof ResizeObserver !== "undefined")
    new ResizeObserver(fitCourt).observe(surface);
  render();
  if (!ctx) {
    value("overlay-title", "暂时无法绘制棋盘");
    value("overlay-description", "请使用支持 Canvas 的浏览器。");
    $("overlay-action").disabled = true;
  }
  value(
    "status",
    isEndless()
      ? "无限挑战已就绪 · 每 5 波补一命，冲击你的纪录。"
      : "20 关闯关 / 无限挑战 · 在上方切换模式。",
  );
})();
