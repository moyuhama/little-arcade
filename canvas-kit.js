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
    const campaign = spec.campaign,
      C = globalThis.ArcadeCampaign;
    const recordKey = spec.recordKey || "best";
    let checkpoint = campaign
      ? C.restore(A.read("campaign"), campaign.length)
      : null;
    function initialState() {
      if (!campaign) return spec.create ? spec.create() : E.create();
      const s = E.create(checkpoint.level);
      s.score = checkpoint.score;
      if ("totalStrokes" in s) s.totalStrokes = checkpoint.score;
      return s;
    }
    let state = initialState(),
      phase = "ready",
      frame = 0,
      last = 0,
      accumulator = 0,
      lastStatus = "",
      lastInfo = "",
      pointer = null,
      lastRecordSecond = -1;
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
      if (campaign && !checkpoint.full) return;
      if (spec.lowest) {
        const old = A.number(recordKey);
        if (!old || state.score < old) A.store(recordKey, state.score);
      } else A.best(state.score, recordKey);
    }
    function render() {
      ctx.clearRect(0, 0, 600, 700);
      spec.draw(ctx, state, input);
      spec.render?.(state);
      if (
        spec.liveRecord &&
        isPlaying() &&
        Math.floor(state.time) !== lastRecordSecond
      ) {
        record();
        lastRecordSecond = Math.floor(state.time);
      }
      const best = A.number(recordKey);
      value("score", state.score);
      value(
        "score2",
        spec.lowest
          ? best || "—"
          : Math.max(best, campaign && !checkpoint.full ? 0 : state.score),
      );
      const info =
        spec.info(state) +
        (campaign ? (checkpoint.full ? " · 全程挑战" : " · 选关练习") : "");
      if (campaign) $("level-picker").value = state.level;
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
      buttons.forEach(({ button, control }) => {
        button.disabled =
          (!isPlaying() && !(phase === "paused" && control.whilePaused)) ||
          !!control.disabled?.(state);
        if (typeof control.label === "function") {
          const label = control.label(state);
          button.textContent = label;
          button.setAttribute("aria-label", label);
        }
      });
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
      state = initialState();
      lastStatus = "";
      lastInfo = "";
      lastRecordSecond = -1;
      resume();
    }
    function finish() {
      phase = "over";
      clearInput();
      A.completed();
      if (!spec.lowest || state.won) record();
      if (campaign && state.won) A.store("campaign", C.begin());
      render();
      A.overlay(
        spec.endTitle
          ? spec.endTitle(state)
          : state.won
            ? "挑战完成！"
            : "再来一局吧",
        spec.summary(state, !campaign || checkpoint.full),
        campaign ? (state.won ? "从第一关再来" : "重试当前关") : "重新开始",
        () => {
          if (campaign && state.won) {
            checkpoint = C.begin();
            A.store("campaign", checkpoint);
          }
          start();
        },
      );
    }
    function between() {
      if (campaign)
        A.store(
          "campaign",
          C.advance(checkpoint, state.score, campaign.length),
        );
      phase = "between";
      clearInput();
      render();
      A.overlay(
        `第 ${state.level + 1} ${spec.unit || "关"}完成`,
        spec.between(state),
        `下一${spec.unit || "关"} →`,
        () => {
          E.next(state);
          if (campaign) {
            checkpoint = {
              ...checkpoint,
              level: state.level,
              score: state.score,
            };
            A.store("campaign", checkpoint);
          }
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
      if (spec.liveRecord) record();
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
      const control = spec.controls.find((c) => c.id === name);
      if (!isPlaying() && !(phase === "paused" && control?.whilePaused)) return;
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
      const label =
        typeof control.label === "function"
          ? control.label(state)
          : control.label;
      const button = A.button(
        label,
        label,
        control.hold ? null : () => action(control.id),
      );
      buttons.push({ button, control });
      $(control.container || "game-controls").append(button);
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
    if (campaign) {
      const label = document.createElement("label");
      label.textContent = "关卡 ";
      const select = document.createElement("select");
      select.id = "level-picker";
      select.setAttribute("aria-label", "选择关卡");
      campaign.forEach((name, i) => {
        const option = document.createElement("option");
        option.value = i;
        option.textContent = `${i + 1}. ${name}`;
        select.append(option);
      });
      label.append(select);
      document.querySelector(".game-settings").replaceChildren(label);
      const note = document.createElement("span");
      note.className = "setting-note";
      note.textContent = "自动记住关卡起点 · 选关可练习";
      document.querySelector(".game-settings").append(note);
      select.onchange = () => {
        cancelAnimationFrame(frame);
        clearInput();
        phase = "ready";
        checkpoint = C.begin(Number(select.value));
        A.store("campaign", checkpoint);
        state = initialState();
        lastInfo = lastStatus = "";
        render();
        A.overlay(
          `第 ${state.level + 1} ${spec.unit || "关"} · ${campaign[state.level]}`,
          checkpoint.full
            ? "从第一关开始完整挑战，完成后可更新全程纪录。"
            : "自由练习从这关开始，不计入全程纪录。",
          "开始这一关",
          start,
        );
      };
    }
    $("pause").onclick = () => (phase === "paused" ? resume() : pause());
    $("restart").textContent = campaign
      ? "↻ 重试本关"
      : $("restart").textContent;
    $("restart").onclick = () => {
      if (campaign) A.store("campaign", checkpoint);
      start();
    };
    if (spec.pauseOnOpen)
      $(spec.pauseOnOpen).addEventListener("toggle", () => {
        if ($(spec.pauseOnOpen).open) pause();
      });
    A.autoPause(pause);
    render();
    A.overlay(
      spec.title,
      campaign && checkpoint.level > 0
        ? `已保存第 ${checkpoint.level + 1} ${spec.unit || "关"}的起点，累计 ${checkpoint.score} ${spec.lowest ? "杆" : "分"}。可继续或在上方选关。`
        : spec.intro,
      campaign && checkpoint.level > 0 ? "继续上次进度" : "开始游戏",
      start,
    );
  };
})();
