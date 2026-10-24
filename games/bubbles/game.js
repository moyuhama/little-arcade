(() => {
  "use strict";
  const E = GameEngine,
    P = CanvasPaint,
    colors = ["#a68acd", "#df91a6", "#e5ba63", "#77b8a7"];
  function bubble(c, x, y, color, r = E.R) {
    P.ball(c, x, y, r - 2, colors[color]);
    P.text(c, color + 1, x, y, 18, "#fffdfb");
  }
  CanvasArcade({
    title: "泡泡龙",
    intro: "瞄准发射，三个同色相连即可消除。连续五次未消除，顶部会下降。",
    pointer: "aim",
    sliders: { angle: [15, 165, 1] },
    controls: [
      { id: "left", label: "↶ 向左" },
      { id: "primary", label: "发射泡泡", disabled: (s) => !!s.shot },
      { id: "right", label: "向右 ↷" },
    ],
    aimDisabled: (s) => !!s.shot,
    action(name, s) {
      if (name === "primary") E.shoot(s);
      else E.aim(s, s.angle + (name === "left" ? 3 : -3));
    },
    info: (s) =>
      `已发射 ${s.shots} 次 · 连续未消除 ${s.misses}/5 · 场上 ${s.grid.flat().filter((v) => v !== null).length} 个`,
    summary: (s) => `${s.last} 本局 ${s.score} 分，共发射 ${s.shots} 次。`,
    draw(c, s) {
      P.backdrop(c, "#eee7f9", "#fbf6f0");
      P.round(c, 24, 24, 552, 568, 22, "#ffffff66");
      P.round(c, 24, 24, 552, Math.max(12, s.ceiling + 12), 8, "#d1bddc");
      c.save();
      c.setLineDash([8, 8]);
      P.line(c, 30, 590, 570, 590, "#d997a5", 2);
      c.restore();
      P.text(c, "警戒线", 532, 575, 13, "#aa7184");
      if (!s.shot && !s.over)
        E.trajectory(s).forEach((p, i) => {
          if (i % 2 === 0) P.circle(c, p.x, p.y, 3, "#9e83b075");
        });
      s.grid.forEach((row, r) =>
        row.forEach((color, col) => {
          if (color !== null) {
            const p = E.point(r, col, s.ceiling);
            bubble(c, p.x, p.y, color);
          }
        }),
      );
      P.round(c, 224, 615, 152, 70, 24, "#d9c7e7");
      const a = (s.angle * Math.PI) / 180;
      P.line(
        c,
        300,
        640,
        300 + Math.cos(a) * 44,
        640 - Math.sin(a) * 44,
        "#8c6ea9",
        18,
      );
      bubble(c, 300, 640, s.current);
      if (s.shot) bubble(c, s.shot.x, s.shot.y, s.shot.color);
      bubble(c, 488, 648, s.next, 20);
      P.text(c, "下一颗", 488, 684, 14, "#8a759d");
      P.text(c, "同色相连 · 3 个消除", 106, 660, 15, "#887297");
    },
  });
})();
