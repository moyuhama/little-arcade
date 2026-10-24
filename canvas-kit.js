/* Shared fixed-step loop, pause lifecycle and input for the canvas collection. */
(() => {
  "use strict";
  const P = {
    round(c, x, y, w, h, r, color) {
      c.fillStyle = color;
      c.beginPath();
      c.roundRect(x, y, w, h, r);
      c.fill();
    },
    circle(c, x, y, r, color) {
      c.fillStyle = color;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    },
    text(c, value, x, y, size = 20, color = "#544564", align = "center") {
      c.fillStyle = color;
      c.font = `600 ${size}px system-ui, sans-serif`;
      c.textAlign = align;
      c.textBaseline = "middle";
      c.fillText(String(value), x, y);
    },
    line(c, x1, y1, x2, y2, color = "#a68bbd", width = 3) {
      c.strokeStyle = color;
      c.lineWidth = width;
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
      c.stroke();
    },
    ball(c, x, y, r, color) {
      P.circle(c, x, y + 3, r, "#39304722");
      P.circle(c, x, y, r, color);
      P.circle(c, x - r * 0.25, y - r * 0.3, r * 0.23, "#ffffff66");
    },
    backdrop(c, top, bottom) {
      const g = c.createLinearGradient(0, 0, 0, 700);
      g.addColorStop(0, top);
      g.addColorStop(1, bottom);
      c.fillStyle = g;
      c.fillRect(0, 0, 600, 700);
    },
    arrow(c, x, y, angle, power, color = "#9473b8") {
      const a = (angle * Math.PI) / 180,
        d = Math.min(160, power * 0.22);
      c.save();
      c.setLineDash([7, 9]);
      P.line(c, x, y, x + Math.cos(a) * d, y - Math.sin(a) * d, color, 3);
      c.restore();
    },
  };
  globalThis.CanvasPaint = P;
  globalThis.CanvasArcade = function (spec) {
    const A = Arcade,
      E = GameEngine,
      $ = A.$,
      canvas = $("board"),
      ctx = canvas.getContext("2d");
    let state = spec.create ? spec.create() : E.create(),
      phase = "ready",
      frame = 0,
      last = 0,
      accumulator = 0,
      lastStatus = "",
      lastInfo = "",
      pointer = null;
    const input = { axis: 0, targetX: null, drag: null },
      held = new Set(),
      buttons = [];
    const isPlaying = () => phase === "playing";
    function clearInput() {
      held.clear();
      input.axis = 0;
      input.targetX = null;
      input.drag = null;
      pointer = null;
    }
    function value(id, text) {
      if ($(id).textContent !== String(text)) $(id).textContent = text;
    }
    function record() {
      if (spec.lowest) {
        const old = A.number("best");
        if (!old || state.score < old) A.store("best", state.score);
      } else A.best(state.score);
    }
    function render() {
      ctx.clearRect(0, 0, 600, 700);
      spec.draw(ctx, state, input);
      const best = A.number("best");
      value("score", state.score);
      value("score2", spec.lowest ? best || "—" : Math.max(best, state.score));
      const info = spec.info(state);
      if (info !== lastInfo) {
        $("game-info").textContent = info;
        canvas.setAttribute("aria-label", `${spec.title}。${info}`);
        lastInfo = info;
      }
      if (state.last !== lastStatus) {
        A.status(state.last);
        lastStatus = state.last;
      }
      $("pause").disabled = !["playing", "paused"].includes(phase);
      $("pause").textContent = phase === "paused" ? "▶ 继续" : "Ⅱ 暂停";
      buttons.forEach(
        ({ button, control }) =>
          (button.disabled = !isPlaying() || !!control.disabled?.(state)),
      );
      for (const name of ["angle", "power"]) {
        const el = $("aim-" + name);
        if (el) {
          el.disabled = !isPlaying() || !!spec.aimDisabled?.(state);
          if (document.activeElement !== el) el.value = state[name];
          value(
            name + "-value",
            Math.round(state[name]) + (name === "angle" ? "°" : ""),
          );
        }
      }
    }
    function resume() {
      if (document.querySelector(".game-help[open]")) return;
      phase = "playing";
      A.hideOverlay();
      clearInput();
      last = performance.now();
      accumulator = 0;
      render();
      frame = requestAnimationFrame(loop);
      canvas.focus({ preventScroll: true });
    }
    function start() {
      cancelAnimationFrame(frame);
      state = spec.create ? spec.create() : E.create();
      lastStatus = "";
      lastInfo = "";
      resume();
    }
    function finish() {
      phase = "over";
      clearInput();
      A.completed();
      if (!spec.lowest || state.won) record();
      render();
      A.overlay(
        spec.endTitle
          ? spec.endTitle(state)
          : state.won
            ? "挑战完成！"
            : "再来一局吧",
        spec.summary(state),
        "重新开始",
        start,
      );
    }
    function between() {
      phase = "between";
      clearInput();
      render();
      A.overlay(
        `第 ${state.level + 1} ${spec.unit || "关"}完成`,
        spec.between(state),
        `下一${spec.unit || "关"} →`,
        () => {
          E.next(state);
          resume();
        },
      );
    }
    function loop(now) {
      if (!isPlaying()) return;
      accumulator += Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      while (accumulator >= 1 / 120) {
        E.step(state, 1 / 120, input);
        accumulator -= 1 / 120;
        if (state.over) {
          finish();
          return;
        }
        if (state.cleared) {
          between();
          return;
        }
      }
      render();
      frame = requestAnimationFrame(loop);
    }
    function pause() {
      if (!isPlaying()) return;
      phase = "paused";
      cancelAnimationFrame(frame);
      clearInput();
      render();
      A.overlay(
        "稍作休息",
        "画面和计时都已暂停，准备好后继续。",
        "继续游戏",
        resume,
      );
      A.status("已暂停，返回后手动继续。");
      lastStatus = "";
    }
    function action(name) {
      if (!isPlaying()) return;
      spec.action(name, state, input);
      render();
    }
    function changeAim(name, n) {
      if (!isPlaying()) return;
      E.aim(
        state,
        name === "angle" ? n : state.angle,
        name === "power" ? n : state.power,
      );
      render();
    }
    for (const control of spec.controls) {
      const button = A.button(
        control.label,
        control.label,
        control.hold ? null : () => action(control.id),
      );
      buttons.push({ button, control });
      $("game-controls").append(button);
      if (control.hold) {
        button.addEventListener("pointerdown", (e) => {
          if (!isPlaying()) return;
          e.preventDefault();
          button.setPointerCapture(e.pointerId);
          input.targetX = null;
          input.axis = control.hold;
        });
        const release = () => (input.axis = 0);
        button.addEventListener("pointerup", release);
        button.addEventListener("pointercancel", release);
        button.addEventListener("lostpointercapture", release);
        button.addEventListener("keydown", (e) => {
          if ([" ", "Enter"].includes(e.key)) {
            e.preventDefault();
            if (isPlaying()) input.axis = control.hold;
          }
        });
        button.addEventListener("keyup", release);
      }
    }
    for (const [name, range] of Object.entries(spec.sliders || {})) {
      const label = document.createElement("label");
      label.textContent = name === "angle" ? "角度" : "力度";
      const output = document.createElement("output");
      output.id = name + "-value";
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = range[0];
      slider.max = range[1];
      slider.step = range[2] || 1;
      slider.id = "aim-" + name;
      slider.setAttribute(
        "aria-label",
        name === "angle" ? "瞄准角度" : "击球力度",
      );
      slider.addEventListener("input", () =>
        changeAim(name, Number(slider.value)),
      );
      label.append(output, slider);
      $("aim-controls").append(label);
    }
    function position(e) {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) * 600) / r.width,
        y: ((e.clientY - r.top) * 700) / r.height,
      };
    }
    function aimAt(p) {
      E.aim(state, (Math.atan2(640 - p.y, p.x - 300) * 180) / Math.PI);
    }
    function pull(p) {
      const d = input.drag;
      if (!d) return;
      d.end = p;
      const dx = d.start.x - p.x,
        dy = p.y - d.start.y;
      if (Math.hypot(dx, dy) > 8)
        E.aim(
          state,
          (Math.atan2(dy, dx) * 180) / Math.PI,
          Math.hypot(dx, dy) * (spec.pullScale || 4),
        );
    }
    canvas.addEventListener("pointerdown", (e) => {
      if (!isPlaying() || pointer !== null) return;
      e.preventDefault();
      canvas.focus({ preventScroll: true });
      pointer = e.pointerId;
      canvas.setPointerCapture(pointer);
      const p = position(e);
      input.drag = { start: p, end: p };
      if (spec.pointer === "aim") aimAt(p);
      if (spec.pointer === "move") input.targetX = p.x;
      render();
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!isPlaying() || e.pointerId !== pointer) return;
      const p = position(e);
      if (spec.pointer === "aim") aimAt(p);
      if (spec.pointer === "move") input.targetX = p.x;
      if (spec.pointer === "pull") pull(p);
      if (input.drag) input.drag.end = p;
      render();
    });
    canvas.addEventListener("pointerup", (e) => {
      if (e.pointerId !== pointer) return;
      const p = position(e),
        d = input.drag;
      pointer = null;
      if (isPlaying()) {
        if (spec.pointer === "aim") {
          aimAt(p);
          action("primary");
        } else if (
          spec.pointer === "pull" &&
          d &&
          Math.hypot(p.x - d.start.x, p.y - d.start.y) >= 10
        ) {
          pull(p);
          action("primary");
        } else if (spec.pointer === "tap") action("primary");
        else if (spec.pointer === "swipe") {
          const dx = p.x - (d?.start.x ?? p.x);
          action(
            Math.abs(dx) > 20
              ? dx < 0
                ? "left"
                : "right"
              : p.x < 300
                ? "left"
                : "right",
          );
        }
      }
      input.drag = null;
      render();
    });
    const cancelPointer = (e) => {
      if (e.pointerId === pointer) {
        pointer = null;
        input.drag = null;
      }
    };
    canvas.addEventListener("pointercancel", cancelPointer);
    canvas.addEventListener("lostpointercapture", cancelPointer);
    const direction = (key) =>
      ["ArrowLeft", "a", "A"].includes(key)
        ? -1
        : ["ArrowRight", "d", "D"].includes(key)
          ? 1
          : 0;
    document.addEventListener("keydown", (e) => {
      if (
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        document.querySelector(".game-help[open]") ||
        e.target.matches("input,select,textarea")
      )
        return;
      if (e.key === "Escape" || e.key.toLowerCase() === "p") {
        e.preventDefault();
        phase === "paused" ? resume() : pause();
        return;
      }
      if (e.key === " ") {
        if (e.target.closest("button,a")) return;
        e.preventDefault();
        if (!e.repeat) action("primary");
        return;
      }
      const d = direction(e.key);
      if (d) {
        e.preventDefault();
        if (spec.move) {
          if (isPlaying()) {
            held.add(d);
            input.axis = Number(held.has(1)) - Number(held.has(-1));
            input.targetX = null;
          }
        } else if (!e.repeat || spec.sliders) action(d < 0 ? "left" : "right");
      } else if (
        ["ArrowUp", "ArrowDown"].includes(e.key) &&
        spec.sliders?.power
      ) {
        e.preventDefault();
        changeAim("power", state.power + (e.key === "ArrowUp" ? 20 : -20));
      } else if (e.key.toLowerCase() === "b" && !e.repeat) action("bomb");
    });
    document.addEventListener("keyup", (e) => {
      const d = direction(e.key);
      if (d) {
        held.delete(d);
        input.axis = Number(held.has(1)) - Number(held.has(-1));
      }
    });
    $("pause").onclick = () => (phase === "paused" ? resume() : pause());
    $("restart").onclick = start;
    A.autoPause(pause);
    render();
    A.overlay(spec.title, spec.intro, "开始游戏", start);
  };
})();
