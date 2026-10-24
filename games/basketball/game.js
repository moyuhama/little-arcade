(() => {
  "use strict";
  const E = GameEngine,
    P = CanvasPaint;
  function ball(c, x, y) {
    P.ball(c, x, y, 14, "#d9975d");
    c.save();
    c.beginPath();
    c.arc(x, y, 13, 0, Math.PI * 2);
    c.clip();
    P.line(c, x - 14, y, x + 14, y, "#9e673e", 1.5);
    P.line(c, x, y - 14, x, y + 14, "#9e673e", 1.5);
    c.restore();
  }
  CanvasArcade({
    title: "投篮挑战",
    intro:
      "60 秒投篮挑战，连续命中有额外加分。拖动蓄力，或调节角度和力度后投篮。",
    pointer: "pull",
    pullScale: 6,
    sliders: { angle: [35, 145, 1], power: [460, 900, 10] },
    aimDisabled: (s) => !!s.ball,
    controls: [{ id: "primary", label: "投篮", disabled: (s) => !!s.ball }],
    action(name, s) {
      if (name === "primary") E.shoot(s);
      else if (name === "left" || name === "right")
        E.aim(s, s.angle + (name === "left" ? 3 : -3), s.power);
    },
    info: (s) =>
      `剩余 ${Math.ceil(60 - s.time)} 秒 · 命中 ${s.made}/${s.shots} · 连进 ${s.streak}`,
    summary: (s) => `时间到！投中 ${s.made} 球，本局 ${s.score} 分。`,
    endTitle: () => "投篮挑战完成",
    draw(c, s, input) {
      P.backdrop(c, "#e6edf5", "#f8f0e5");
      P.round(c, 0, 510, 600, 190, 0, "#e4c6a7");
      for (let x = 0; x < 600; x += 65)
        P.line(c, x, 510, x, 700, "#c8a68655", 2);
      P.line(c, 0, 570, 600, 570, "#fff9ed", 4);
      c.strokeStyle = "#ffffffcc";
      c.lineWidth = 4;
      c.beginPath();
      c.ellipse(300, 610, 115, 33, 0, 0, Math.PI * 2);
      c.stroke();
      P.round(c, 36, 35, 180, 48, 12, "#ffffffb8");
      P.text(c, "街角小球场", 126, 60, 21, "#8f769f");
      const h = s.hoop,
        side = h.x > 300 ? 1 : -1;
      P.round(c, h.x + side * 60 - 5, 220, 10, 290, 4, "#b4abc0");
      P.round(c, h.x + side * 59 - 5, h.y - 112, 10, 120, 3, "#ddd2e8");
      P.round(c, h.x + side * 59 - 11, h.y - 106, 22, 104, 5, "#ffffffc9");
      for (let i = 0; i < 5; i++) {
        const x = h.x - 39 + i * 19.5;
        P.line(c, x, h.y + 4, h.x + (x - h.x) * 0.6, h.y + 56, "#d0c4d6", 2);
      }
      P.line(c, h.x - 24, h.y + 56, h.x + 24, h.y + 56, "#d0c4d6", 2);
      P.line(c, h.x - 42, h.y, h.x + 42, h.y, "#c37f72", 7);
      P.circle(c, h.x - 42, h.y, 5, "#b96b61");
      P.circle(c, h.x + 42, h.y, 5, "#b96b61");
      if (!s.ball) {
        P.arrow(c, 300, 610, s.angle, s.power, "#a685bb");
        ball(c, 300, 610);
        if (input.drag) {
          const d = input.drag;
          P.line(
            c,
            300,
            610,
            300 + d.end.x - d.start.x,
            610 + d.end.y - d.start.y,
            "#b6a2c780",
            2,
          );
        }
      } else ball(c, s.ball.x, s.ball.y);
      P.text(c, "投中后，篮筐会换到另一侧", 300, 675, 16, "#997c71");
      if (s.streak > 1)
        P.text(c, `${s.streak} 连进！`, 300, 135, 29, "#b17b51");
    },
  });
})();
