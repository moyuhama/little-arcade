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
function mount(saved = {}, { blockedStorage = false } = {}) {
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
      querySelector: () => (dialog ? {} : null),
      addEventListener: (name, fn) => (documentEvents[name] = fn),
    },
    window: { addEventListener: (name, fn) => (windowEvents[name] = fn) },
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
  m.select(20);
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
    { level: 21, score: 0, lives: 3 },
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
