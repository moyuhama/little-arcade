const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const Racer = require("../games/racer/engine");

// A deterministic DOM/RAF adapter tests the shared controller lifecycle without real timers.
function mount() {
  const elements = new Map(),
    frames = new Map(),
    saved = { best: 9999 };
  let now = 0,
    frame = 0,
    state,
    autoPause;
  function element() {
    return {
      textContent: "",
      disabled: false,
      children: [],
      listeners: {},
      open: false,
      append(child) {
        this.children.push(child);
      },
      addEventListener(name, fn) {
        this.listeners[name] = fn;
      },
      setAttribute() {},
      focus() {},
      getContext() {
        return { clearRect() {} };
      },
    };
  }
  for (const id of [
    "board",
    "score",
    "score2",
    "game-info",
    "pause",
    "restart",
    "game-controls",
    "garage",
    "upgrades",
    "overlay-title",
    "overlay-action",
  ])
    elements.set(id, element());
  const $ = (id) => elements.get(id) || null;
  const sandbox = {
    document: { querySelector: () => null, addEventListener() {} },
    performance: { now: () => now },
    requestAnimationFrame(fn) {
      frames.set(++frame, fn);
      return frame;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
    GameEngine: {
      ...Racer,
      create() {
        state = Racer.create();
        state.wallet = 4;
        return state;
      },
    },
    Arcade: {
      $,
      number: (key) => saved[key] || 0,
      store: (key, value) => (saved[key] = value),
      best(value, key) {
        if (value > (saved[key] || 0)) saved[key] = value;
      },
      status() {},
      completed() {},
      button(text, label, fn) {
        const b = element();
        b.textContent = text;
        b.onclick = fn;
        return b;
      },
      overlay(title, copy, label, fn) {
        $("overlay-title").textContent = title;
        $("overlay-action").onclick = fn;
      },
      hideOverlay() {},
      autoPause(fn) {
        autoPause = fn;
      },
    },
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "../canvas-kit.js"), "utf8"),
    sandbox,
  );
  sandbox.CanvasArcade({
    title: "test",
    intro: "",
    recordKey: "endless",
    liveRecord: true,
    pauseOnOpen: "garage",
    controls: [
      { id: "primary", label: "boost" },
      {
        id: "handling",
        container: "upgrades",
        whilePaused: true,
        label: (s) => `handling ${s.upgrades.handling}`,
        disabled: (s) => s.wallet < Racer.upgradeCost(s, "handling"),
      },
    ],
    action(name, s) {
      if (name === "handling") Racer.upgrade(s, name);
      else Racer.boost(s);
    },
    info: (s) => String(s.time),
    draw() {},
    summary: (s) => String(s.score),
  });
  return {
    $,
    saved,
    get state() {
      return state;
    },
    pause: () => autoPause(),
    advance(ms) {
      now += ms;
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((fn) => fn(now));
    },
  };
}
test("opening the garage pauses simulation but permits purchases and updates dynamic buttons", () => {
  const m = mount();
  assert.equal(m.$("upgrades").children[0].disabled, true);
  m.$("overlay-action").onclick();
  m.advance(100);
  const time = m.state.time;
  m.$("garage").open = true;
  m.$("garage").listeners.toggle();
  assert.equal(m.$("overlay-title").textContent, "稍作休息");
  assert.equal(m.$("game-controls").children[0].disabled, true);
  assert.equal(m.$("upgrades").children[0].disabled, false);
  m.$("upgrades").children[0].onclick();
  assert.equal(m.state.wallet, 0);
  assert.equal(m.state.upgrades.handling, 1);
  assert.equal(m.$("upgrades").children[0].textContent, "handling 1");
  assert.equal(m.$("upgrades").children[0].disabled, true);
  m.advance(5000);
  assert.equal(m.state.time, time);
  m.$("overlay-action").onclick();
  m.advance(100);
  assert.ok(m.state.time > time);
});
test("live records survive pausing independently of the old timed record, while restarting resets upgrades", () => {
  const m = mount();
  m.$("overlay-action").onclick();
  m.state.score = 123;
  m.pause();
  assert.equal(m.saved.endless, 123);
  assert.equal(m.saved.best, 9999);
  m.$("upgrades").children[0].onclick();
  assert.equal(m.state.upgrades.handling, 1);
  m.$("restart").onclick();
  assert.equal(m.state.upgrades.handling, 0);
  assert.equal(m.state.score, 0);
  assert.equal(m.saved.endless, 123);
});
