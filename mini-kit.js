/* Small shared UI helpers. Game rules live in each game's engine.js. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const key = `little-arcade-${document.body.dataset.game}-v1`;
  let saved = {},
    storageAvailable = true;
  try {
    const value = JSON.parse(localStorage.getItem(key));
    if (value && typeof value === "object" && !Array.isArray(value))
      saved = value;
  } catch {
    storageAvailable = false;
  }
  function store(name, value) {
    saved[name] = value;
    try {
      localStorage.setItem(key, JSON.stringify(saved));
    } catch {
      storageAvailable = false;
    }
    note();
  }
  function number(name) {
    return Number.isFinite(saved[name]) && saved[name] >= 0 ? saved[name] : 0;
  }
  function note() {
    $("save-note").textContent = storageAvailable
      ? `✓ 本机已完成 ${number("completed")} 局 · 纪录保存在当前浏览器`
      : "浏览器存储不可用，纪录仅在本次页面保留。";
  }
  function completed() {
    store("completed", number("completed") + 1);
  }
  function best(value, name = "best") {
    if (value > number(name)) store(name, value);
    return number(name);
  }
  function status(text) {
    $("status").textContent = text;
  }
  function score(value, second) {
    $("score").textContent = value;
    if (second !== undefined) $("score2").textContent = second;
  }
  function button(text, label, fn, className = "") {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.className = className;
    if (label) b.setAttribute("aria-label", label);
    if (fn) b.addEventListener("click", fn);
    return b;
  }
  function grid(count, columns, onClick) {
    const board = $("board");
    board.style.setProperty("--columns", columns);
    const buttons = Array.from({ length: count }, (_, i) =>
      button("", "", () => onClick(i), "grid-cell"),
    );
    board.replaceChildren(...buttons);
    // Roving keyboard focus keeps large boards to one Tab stop.
    let focus = 0;
    const update = () => {
      if (buttons[focus]?.disabled) {
        const hadFocus = board.contains(document.activeElement);
        focus = buttons.findIndex((b) => !b.disabled);
        if (hadFocus && focus >= 0)
          buttons[focus].focus({ preventScroll: true });
      }
      buttons.forEach((b, i) => {
        b.tabIndex = i === focus ? 0 : -1;
      });
    };
    buttons.forEach((b, i) =>
      b.addEventListener("focus", () => {
        focus = i;
        update();
      }),
    );
    board.onkeydown = (event) => {
      const offsets = {
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: -columns,
        ArrowDown: columns,
      };
      if (!(event.key in offsets)) return;
      event.preventDefault();
      let next = focus + offsets[event.key];
      while (next >= 0 && next < count && buttons[next].disabled)
        next += offsets[event.key];
      if (next >= 0 && next < count) {
        focus = next;
        update();
        buttons[focus].focus();
      }
    };
    buttons.refreshFocus = update;
    update();
    return buttons;
  }
  function overlay(title, copy, action, fn) {
    $("overlay-title").textContent = title;
    $("overlay-description").textContent = copy;
    $("overlay-action").textContent = action;
    $("overlay-action").onclick = fn;
    $("game-overlay").hidden = false;
    $("board").inert = true;
  }
  function hideOverlay() {
    $("game-overlay").hidden = true;
    $("board").inert = false;
  }
  function clock(tick = () => {}) {
    let elapsed = 0,
      since = null;
    const value = () =>
      elapsed + (since === null ? 0 : performance.now() - since);
    setInterval(() => {
      if (since !== null) tick(value());
    }, 200);
    return {
      value,
      start() {
        if (since === null) since = performance.now();
      },
      pause() {
        elapsed = value();
        since = null;
        tick(elapsed);
      },
      reset() {
        elapsed = 0;
        since = null;
        tick(0);
      },
    };
  }
  function autoPause(fn) {
    document.addEventListener("arcade:pause", fn);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) fn();
    });
    window.addEventListener("blur", fn);
  }
  function controls(fn) {
    document
      .querySelectorAll("[data-direction]")
      .forEach((b) =>
        b.addEventListener("click", () => fn(b.dataset.direction)),
      );
    document.addEventListener("keydown", (e) => {
      if (
        e.target.matches("select,input,textarea") ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey
      )
        return;
      const direction = {
        ArrowUp: "up",
        w: "up",
        ArrowRight: "right",
        d: "right",
        ArrowDown: "down",
        s: "down",
        ArrowLeft: "left",
        a: "left",
      }[e.key];
      if (direction) {
        e.preventDefault();
        fn(direction);
      }
    });
  }
  note();
  globalThis.Arcade = {
    $,
    store,
    number,
    read: (name) => saved[name],
    completed,
    best,
    status,
    score,
    button,
    grid,
    overlay,
    hideOverlay,
    clock,
    autoPause,
    controls,
  };
})();
