const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const E = require("../games/breakout/engine");
const PROGRESS = "little-arcade-breakout-neon-progress-v2";
const BEST = "little-arcade-breakout-neon-best-v2";
const OLD = "little-arcade-breakout-progress-v1";
const ENDLESS = "little-arcade-breakout-endless-progress-v1";
const ENDLESS_BEST = "little-arcade-breakout-endless-best-v1";
const WAVE_BEST = "little-arcade-breakout-endless-cleared-v1";
const MODE = "little-arcade-breakout-mode-v1";
// A DOM/animation adapter exercises the real controller and real engine with deterministic time.
function mount(
  saved = {},
  {
    blockedStorage = false,
    viewportWidth = 0,
    viewportHeight = 0,
    surfaceWidth = 618,
    surfaceHeight = 0,
    pixelRatio = 1,
  } = {},
) {
  const elements = new Map(),
    frames = new Map(),
    documentEvents = {},
    windowEvents = {};
  let frameId = 0,
    now = 0,
    current,
    dialog = false;
  const context = new Proxy(
    {},
    {
      get: (_, name) =>
        name === "createLinearGradient"
          ? () => ({ addColorStop() {} })
          : () => {},
    },
  );
  function element() {
    return {
      textContent: "",
      value: "",
      tagName: "BUTTON",
      disabled: false,
      hidden: false,
      style: {},
      attributes: {},
      listeners: {},
      children: [],
      classList: { toggle() {} },
      replaceChildren() {
        this.children = [];
      },
      append(child) {
        this.children.push(child);
      },
      addEventListener(name, fn) {
        this.listeners[name] = fn;
      },
      setAttribute(k, v) {
        this.attributes[k] = v;
      },
      focus() {},
      showModal() {
        dialog = true;
      },
      close() {
        dialog = false;
      },
      setPointerCapture() {},
      getContext() {
        return context;
      },
      getBoundingClientRect() {
        return { left: 0, top: 0, width: 300, height: 300 };
      },
      closest() {
        return null;
      },
    };
  }
  const html = fs.readFileSync(
    path.join(__dirname, "../games/breakout/index.html"),
    "utf8",
  );
  for (const [, id] of html.matchAll(/id="([^"]+)"/g))
    elements.set(id, element());
  elements.get("breakout-board").tagName = "CANVAS";
  const capture =
    (fn) =>
    (...args) =>
      (current = fn(...args));
  const sandbox = {
    Breakout: {
      ...E,
      createGame: capture(E.createGame),
      launch: capture(E.launch),
      step: capture(E.step),
      advanceLevel: capture(E.advanceLevel),
      movePaddle: capture(E.movePaddle),
      activateOverdrive: capture(E.activateOverdrive),
    },
    document: {
      hidden: false,
      getElementById: (id) => elements.get(id),
      createElement: element,
      querySelector: (selector) =>
        selector === ".play-surface"
          ? {
              getBoundingClientRect: () => ({
                width: surfaceWidth,
                height: surfaceHeight,
              }),
            }
          : selector.includes("dialog") && dialog
            ? {}
            : null,
      addEventListener: (name, fn) => (documentEvents[name] = fn),
    },
    window: {
      innerWidth: viewportWidth,
      innerHeight: viewportHeight,
      devicePixelRatio: pixelRatio,
      addEventListener: (name, fn) => (windowEvents[name] = fn),
    },
    localStorage: {
      getItem(k) {
        if (blockedStorage) throw Error("blocked");
        return saved[k] ?? null;
      },
      setItem(k, v) {
        if (blockedStorage) throw Error("blocked");
        saved[k] = v;
      },
    },
    matchMedia: () => ({ matches: true }),
    requestAnimationFrame(fn) {
      frames.set(++frameId, fn);
      return frameId;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "../games/breakout/game.js"), "utf8"),
    sandbox,
  );
  return {
    $: (id) => elements.get(id),
    saved,
    documentEvents,
    windowEvents,
    resize(width, height, surface = {}) {
      sandbox.window.innerWidth = width;
      sandbox.window.innerHeight = height;
      surfaceWidth = surface.width ?? surfaceWidth;
      surfaceHeight = surface.height ?? surfaceHeight;
      windowEvents.resize();
    },
    get state() {
      return current;
    },
    setDialog(open) {
      dialog = open;
    },
    click(id) {
      const e = elements.get(id);
      if (!e.disabled) e.listeners.click?.({ detail: 1 });
    },
    mode(value) {
      elements.get("mode-picker").value = value;
      elements.get("mode-picker").listeners.change();
    },
    get dialogOpen() {
      return dialog;
    },
    select(level) {
      elements.get("level-picker").value = String(level);
      elements.get("level-picker").listeners.change();
    },
    key(key, code = key) {
      documentEvents.keydown({
        key,
        code,
        target: elements.get("breakout-board"),
        preventDefault() {},
      });
    },
    advance(ms = 16) {
      now += ms;
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((fn) => fn(now));
    },
  };
}
function start(m) {
  m.click("overlay-action");
  m.advance();
}
function finish(m) {
  m.state.ball = { id: 0, x: 130, y: 133, vx: 0, vy: -275 };
  m.state.bricks = [
    {
      x: 100,
      y: 100,
      width: 62,
      height: 22,
      alive: true,
      row: 0,
      kind: "normal",
      hp: 1,
    },
  ];
  m.advance(30);
}

test("legacy migration carries sector and lives without mixing old score or records", () => {
  const saved = {
    [OLD]: JSON.stringify({ level: 12, lives: 4, score: 1000 }),
    "little-arcade-breakout-best-v1": "9000",
  };
  const m = mount(saved);
  start(m);
  assert.equal(m.state.level, 12);
  assert.equal(m.state.lives, 4);
  assert.equal(m.state.score, 0);
  assert.equal(m.$("best").textContent, "0");
  assert.equal(saved["little-arcade-breakout-best-v1"], "9000");
});
test("help, blur and hidden-page pauses freeze effects and require explicit resume; held input is cleared", () => {
  const m = mount();
  start(m);
  m.state.effects.laser = 10;
  m.key("ArrowRight");
  m.advance(16);
  const paddle = m.state.paddle;
  m.documentEvents["arcade:pause"]();
  m.setDialog(true);
  const before = JSON.stringify(m.state);
  m.advance(5000);
  m.key("e");
  m.key(" ", "Space");
  assert.equal(JSON.stringify(m.state), before);
  assert.equal(m.$("pause").textContent, "▷ 继续");
  m.setDialog(false);
  m.advance(5000);
  assert.equal(JSON.stringify(m.state), before);
  m.click("overlay-action");
  m.advance();
  m.advance(16);
  assert.equal(m.state.paddle, paddle);
  assert.ok(m.state.effects.laser < 10);
  m.windowEvents.blur();
  const time = m.state.time;
  m.advance(2000);
  assert.equal(m.state.time, time);
});
test("completion saves the next checkpoint before continuing; retry rolls back the current sector", () => {
  const original = { level: 4, score: 70, lives: 3, energy: 20 };
  const m = mount({ [PROGRESS]: JSON.stringify(original) });
  start(m);
  finish(m);
  assert.equal(m.state.status, "level");
  const next = JSON.parse(m.saved[PROGRESS]);
  assert.equal(next.level, 5);
  assert.equal(next.score, 80);
  assert.equal(next.lives, 4);
  const reload = mount({ ...m.saved });
  start(reload);
  assert.equal(reload.state.level, 5);
  assert.equal(reload.state.score, 80);
  m.click("restart");
  start(m);
  assert.equal(m.state.level, 4);
  assert.equal(m.state.score, 70);
  assert.equal(m.state.lives, 3);
  assert.equal(m.saved[BEST], "80");
});
test("next-sector continuation, defeat retry and final victory all retain correct checkpoint boundaries", () => {
  const m = mount();
  start(m);
  finish(m);
  m.click("overlay-action");
  m.advance();
  assert.equal(m.state.level, 2);
  assert.equal(m.state.score, 10);
  assert.equal(m.state.lives, 4);
  m.state.score = 150;
  m.state.lives = 1;
  m.state.ball = { id: 0, x: 10, y: 620, vx: 0, vy: 275 };
  m.advance(16);
  assert.equal(m.state.status, "lost");
  m.click("overlay-action");
  m.advance();
  assert.equal(m.state.score, 10);
  assert.equal(m.state.lives, 4);
  assert.equal(m.state.level, 2);
  m.select(100);
  start(m);
  finish(m);
  assert.equal(m.state.status, "won");
  assert.equal(JSON.parse(m.saved[PROGRESS]).level, 1);
  m.click("overlay-action");
  m.advance();
  assert.equal(m.state.level, 1);
  assert.equal(m.state.score, 0);
});
test("touch coordinates map to the logical court; energy button and E hotkey consume charge once", () => {
  const m = mount();
  start(m);
  m.$("breakout-board").listeners.pointerdown({
    isPrimary: true,
    button: 0,
    pointerId: 1,
    clientX: 75,
  });
  assert.equal(m.state.paddle + 50, 150);
  m.state.energy = 100;
  m.advance();
  assert.equal(m.$("overdrive").disabled, false);
  m.click("overdrive");
  assert.equal(m.state.energy, 0);
  assert.equal(m.state.overdrive, 6);
  m.key("e");
  assert.equal(m.state.overdrive, 6);
  m.advance();
  assert.equal(m.$("overdrive").disabled, true);
  m.$("move-right").listeners.pointerdown({ button: 0, pointerId: 2 });
  m.advance();
  assert.ok(m.state.paddle > 100);
  m.$("move-right").listeners.pointercancel();
  const paddle = m.state.paddle;
  m.advance();
  assert.equal(m.state.paddle, paddle);
});
test("invalid saves and denied storage do not prevent playing or render a misleading persistence promise", () => {
  for (const saved of [
    null,
    { level: 101, score: 0, lives: 3 },
    { level: 2, score: -1, lives: 3 },
  ]) {
    const m = mount({ [PROGRESS]: JSON.stringify(saved) });
    start(m);
    assert.equal(m.state.level, 1);
  }
  const m = mount({}, { blockedStorage: true });
  start(m);
  finish(m);
  assert.equal(m.state.status, "level");
  assert.match(m.$("save-note").textContent, /不可用/);
  m.click("overlay-action");
  m.advance();
  assert.equal(m.state.level, 2);
});

test("endless continues past wave twenty, records cleared waves, and restores the same seeded next wave", () => {
  const initial = { level: 20, score: 1000, lives: 2, energy: 40, seed: 1932 };
  const m = mount({
    [MODE]: JSON.stringify("endless"),
    [ENDLESS]: JSON.stringify(initial),
  });
  start(m);
  finish(m);
  assert.equal(m.state.status, "level");
  assert.equal(m.saved[WAVE_BEST], "20");
  const saved = JSON.parse(m.saved[ENDLESS]);
  assert.equal(saved.level, 21);
  assert.equal(saved.lives, 3);
  assert.equal(saved.seed, 1932);
  m.click("overlay-action");
  m.advance();
  const layout = JSON.stringify(m.state.bricks);
  assert.equal(m.state.level, 21);
  assert.equal(m.state.mode, "endless");
  const reload = mount({ ...m.saved });
  start(reload);
  assert.equal(JSON.stringify(reload.state.bricks), layout);
  assert.equal(reload.state.score, 1010);
  assert.equal(reload.$("stage-total").textContent, " 波");
  assert.equal(reload.$("level-choice").hidden, true);
});
test("switching modes restores independent checkpoints, seeds, scores and records", () => {
  const campaign = { level: 12, score: 600, lives: 4, energy: 70 };
  const endless = { level: 42, score: 4200, lives: 2, energy: 10, seed: 9821 };
  const m = mount({
    [PROGRESS]: JSON.stringify(campaign),
    [ENDLESS]: JSON.stringify(endless),
    [BEST]: "800",
    [ENDLESS_BEST]: "5000",
  });
  start(m);
  m.mode("endless");
  start(m);
  assert.equal(m.state.level, 42);
  assert.equal(m.state.seed, 9821);
  assert.equal(m.state.score, 4200);
  assert.equal(m.$("best").textContent, "5,000");
  m.mode("campaign");
  start(m);
  assert.equal(m.state.level, 12);
  assert.equal(m.state.score, 600);
  assert.equal(m.state.lives, 4);
  assert.equal(m.$("best").textContent, "800");
  assert.equal(m.$("level-choice").hidden, false);
  assert.equal(JSON.parse(m.saved[ENDLESS]).level, 42);
});
test("endless defeat ends the run across reloads; replay starts at wave one without deleting records", () => {
  const saved = {
    [MODE]: JSON.stringify("endless"),
    [ENDLESS]: JSON.stringify({
      level: 37,
      score: 9000,
      lives: 1,
      energy: 80,
      seed: 999,
    }),
    [WAVE_BEST]: "36",
  };
  const m = mount(saved);
  start(m);
  m.state.ball = { id: 0, x: 10, y: 620, vx: 0, vy: 275 };
  m.advance(16);
  assert.equal(m.state.status, "lost");
  assert.equal(m.saved[ENDLESS], "null");
  assert.equal(m.saved[ENDLESS_BEST], "9000");
  const reload = mount({ ...m.saved });
  start(reload);
  assert.equal(reload.state.level, 1);
  assert.equal(reload.state.score, 0);
  m.click("overlay-action");
  m.advance();
  assert.equal(m.state.level, 1);
  assert.equal(m.state.lives, 3);
  assert.equal(m.state.score, 0);
  assert.equal(m.saved[WAVE_BEST], "36");
  assert.equal(m.$("best").textContent, "9,000");
});
test("starting a new endless run asks before replacing progress and pauses behind the dialog", () => {
  const m = mount({
    [MODE]: JSON.stringify("endless"),
    [ENDLESS]: JSON.stringify({
      level: 8,
      score: 1200,
      lives: 2,
      energy: 30,
      seed: 1984,
    }),
  });
  start(m);
  m.click("restart");
  assert.equal(m.dialogOpen, true);
  const before = JSON.stringify(m.state);
  m.advance(5000);
  m.key("e");
  assert.equal(JSON.stringify(m.state), before);
  m.$("endless-reset").close();
  m.click("overlay-action");
  m.advance();
  assert.equal(m.state.level, 8);
  m.click("restart");
  m.click("confirm-new-run");
  assert.equal(m.dialogOpen, false);
  start(m);
  assert.equal(m.state.level, 1);
  assert.equal(m.state.score, 0);
  assert.equal(m.state.lives, 3);
  assert.equal(m.$("best").textContent, "1,200");
});
test("corrupt endless seeds are rejected, while denied storage retains both mode checkpoints in memory", () => {
  for (const seed of [-1, "7", 4294967296, null]) {
    const m = mount({
      [MODE]: JSON.stringify("endless"),
      [ENDLESS]: JSON.stringify({ level: 99, score: 1, lives: 3, seed }),
    });
    start(m);
    assert.equal(m.state.level, 1);
  }
  const m = mount({}, { blockedStorage: true });
  m.mode("endless");
  start(m);
  finish(m);
  m.mode("campaign");
  start(m);
  m.mode("endless");
  start(m);
  assert.equal(m.state.level, 2);
  assert.equal(m.state.score, 10);
  assert.match(m.$("save-note").textContent, /不可用/);
});

test("phone checkpoints retain progress in a taller court; live resize preserves the current arena", () => {
  const m = mount(
    {},
    {
      viewportWidth: 1440,
      viewportHeight: 900,
      surfaceWidth: 940,
      pixelRatio: 2,
    },
  );
  start(m);
  assert.equal(m.state.width, 876);
  assert.equal(m.state.height, 750);
  assert.equal(m.$("breakout-board").width, 1752);
  assert.equal(m.$("breakout-board").height, 1500);
  m.$("breakout-board").listeners.pointerdown({
    isPrimary: true,
    button: 0,
    pointerId: 1,
    clientX: 270,
  });
  assert.equal(m.state.paddle + 50, m.state.width * 0.9);
  const checkpoint = JSON.parse(m.saved[PROGRESS]);
  const reload = mount(m.saved, {
    viewportWidth: 390,
    viewportHeight: 844,
    surfaceWidth: 370,
  });
  start(reload);
  assert.equal(reload.state.width, 600);
  assert.equal(reload.state.height, 840);
  assert.equal(reload.state.level, checkpoint.level);
  assert.equal(reload.state.score, checkpoint.score);
  assert.equal(reload.state.lives, checkpoint.lives);
  assert.equal(reload.state.energy, checkpoint.energy);
  assert.equal(reload.state.bricks[0].width, m.state.bricks[0].width);
  reload.resize(390, 800);
  const time = reload.state.time;
  reload.advance(16);
  assert.ok(
    reload.state.time > time,
    "mobile address bar resizing must not interrupt play",
  );
  reload.resize(844, 390, { width: 610, height: 330 });
  const paused = JSON.stringify(reload.state);
  reload.advance(50);
  assert.equal(JSON.stringify(reload.state), paused);
  reload.click("overlay-action");
  reload.advance();
  finish(reload);
  assert.ok(JSON.parse(reload.saved[PROGRESS]).width > 600);
  reload.click("overlay-action");
  assert.ok(reload.state.width > 600);
  assert.equal(reload.state.height, 600);
});

test("touch trackpad moves relatively without a first-touch jump, ignores extra fingers and clears capture", () => {
  const m = mount(
    {},
    {
      viewportWidth: 390,
      viewportHeight: 664,
      surfaceWidth: 374,
      surfaceHeight: 472,
    },
  );
  const zone = m.$("paddle-touch-zone");
  const pointer = (x, extra = {}) => ({
    isPrimary: true,
    button: 0,
    pointerId: 7,
    clientX: x,
    pointerType: "touch",
    ...extra,
  });
  const paddle = m.state.paddle;
  zone.listeners.pointerdown(pointer(30));
  assert.equal(
    m.state.paddle,
    paddle,
    "first touch must not teleport the paddle",
  );
  zone.listeners.pointermove(pointer(60, { pointerId: 8, isPrimary: false }));
  assert.equal(m.state.paddle, paddle);
  zone.listeners.pointermove(pointer(60));
  assert.equal(m.state.paddle, paddle + 75);
  assert.equal(
    m.state.ball.x,
    m.state.paddle + 50,
    "ready ball follows the paddle",
  );
  zone.listeners.pointercancel(pointer(60));
  zone.listeners.pointermove(pointer(90));
  assert.equal(m.state.paddle, paddle + 75);
  assert.equal(zone.attributes["data-dragging"], "false");
  start(m);
  zone.listeners.pointerdown(pointer(160));
  zone.listeners.pointermove(pointer(-1000));
  assert.equal(m.state.paddle, 0);
  zone.listeners.pointermove(pointer(-990));
  assert.equal(
    m.state.paddle,
    25,
    "reverse immediately at the edge, without a dead zone",
  );
  m.click("mobile-menu-open");
  const frozen = JSON.stringify(m.state);
  zone.listeners.pointermove(pointer(180));
  m.advance(5000);
  assert.equal(JSON.stringify(m.state), frozen);
  assert.equal(m.dialogOpen, true);
  m.$("mobile-game-menu").close();
  m.click("mobile-pause");
  m.advance();
  zone.listeners.pointermove(pointer(200));
  assert.equal(
    m.state.paddle,
    25,
    "resuming does not revive an interrupted drag",
  );
});

test("touch on the court is relative too, while mouse hover remains absolute", () => {
  const m = mount();
  start(m);
  const board = m.$("breakout-board");
  const event = {
    isPrimary: true,
    button: 0,
    pointerId: 1,
    pointerType: "touch",
    clientX: 10,
  };
  const initial = m.state.paddle;
  board.listeners.pointerdown(event);
  assert.equal(m.state.paddle, initial);
  board.listeners.pointermove({ ...event, clientX: 30 });
  assert.equal(m.state.paddle, initial + 50);
  board.listeners.lostpointercapture(event);
  board.listeners.pointermove({ ...event, clientX: 80 });
  assert.equal(m.state.paddle, initial + 50);
  board.listeners.pointermove({ ...event, pointerType: "mouse", clientX: 240 });
  assert.equal(m.state.paddle + 50, 480);
});

test("phone menus keep campaign and endless controls, checkpoints and seed reproducibility", () => {
  const m = mount(
    {
      [MODE]: JSON.stringify("endless"),
      [ENDLESS]: JSON.stringify({
        level: 31,
        score: 900,
        lives: 4,
        energy: 100,
        seed: 91,
        width: 1152,
        height: 600,
      }),
    },
    {
      viewportWidth: 390,
      viewportHeight: 664,
      surfaceWidth: 374,
      surfaceHeight: 472,
    },
  );
  start(m);
  assert.equal(m.state.level, 31);
  assert.equal(m.state.score, 900);
  assert.equal(m.state.seed, 91);
  assert.equal(m.state.width, 600);
  assert.ok(m.state.height > 600);
  m.click("mobile-menu-open");
  const before = JSON.stringify(m.state);
  m.click("overdrive");
  m.advance(5000);
  assert.equal(JSON.stringify(m.state), before);
  m.mode("campaign");
  m.select(4);
  m.mode("endless");
  m.$("mobile-game-menu").close();
  start(m);
  assert.equal(m.state.level, 31);
  assert.equal(m.state.score, 900);
  m.click("overdrive");
  assert.equal(m.state.energy, 0);
  assert.ok(m.state.overdrive > 0);
  assert.equal(m.$("overdrive").textContent, "穿透强化中");
  const reload = mount(
    { ...m.saved },
    {
      viewportWidth: 390,
      viewportHeight: 664,
      surfaceWidth: 374,
      surfaceHeight: 472,
    },
  );
  start(reload);
  assert.deepEqual(reload.state.bricks, m.state.bricks);
});

test("rotation can adapt an unstarted court but never rebuilds a partly cleared life", () => {
  const m = mount(
    {},
    {
      viewportWidth: 390,
      viewportHeight: 664,
      surfaceWidth: 374,
      surfaceHeight: 472,
    },
  );
  assert.equal(m.state.width, 600);
  m.resize(844, 390, { width: 610, height: 330 });
  assert.ok(m.state.width > 600);
  start(m);
  m.state.bricks[0].alive = false;
  m.state.ball = { id: 0, x: 10, y: m.state.height + 20, vx: 0, vy: 275 };
  m.advance(16);
  assert.equal(m.state.status, "ready");
  const before = JSON.stringify(m.state);
  m.resize(390, 664, { width: 374, height: 472 });
  assert.equal(JSON.stringify(m.state), before);
  assert.equal(m.state.bricks[0].alive, false);
});

test("chapter navigation exposes ten levels at a time and persists the hundredth level", () => {
  const m = mount();
  assert.equal(m.$("chapter-picker").children.length, 10);
  assert.equal(m.$("level-picker").children.length, 10);
  m.$("chapter-picker").value = "10";
  m.$("chapter-picker").listeners.change();
  assert.equal(m.$("level-picker").children[0].value, 91);
  assert.equal(m.$("level-picker").children[9].value, 100);
  m.select(100);
  start(m);
  assert.equal(m.state.level, 100);
  assert.equal(m.state.bricks.filter((b) => b.kind === "core").length, 1);
  assert.equal(JSON.parse(m.saved[PROGRESS]).level, 100);
  finish(m);
  assert.equal(m.state.status, "won");
  assert.match(m.$("overlay-title").textContent, /100/);
});
