(() => {
  "use strict";
  const E = GameEngine,
    P = CanvasPaint;
  CanvasArcade({
    title: "迷你高尔夫",
    intro: "六个原创球洞，杆数越少越好。向后拖动蓄力，或调好角度、力度后击球。",
    pointer: "pull",
    lowest: true,
    unit: "洞",
    sliders: { angle: [0, 359, 1], power: [80, 650, 10] },
    aimDisabled: (s) => !s.rest || s.cleared,
    controls: [
      { id: "primary", label: "击球", disabled: (s) => !s.rest || s.cleared },
    ],
    action(name, s) {
      if (name === "primary") E.shoot(s);
      else if (name === "left" || name === "right")
        E.aim(s, s.angle + (name === "left" ? 5 : -5), s.power);
    },
    info: (s) =>
      `第 ${s.level + 1}/6 洞 · ${E.courses[s.level].name} · 本洞 ${s.strokes} 杆 / 标准 ${E.courses[s.level].par} 杆`,
    between: (s) =>
      `本洞 ${s.strokes} 杆，标准 ${E.courses[s.level].par} 杆。累计 ${s.totalStrokes} 杆。`,
    summary: (s) =>
      `六洞全部完成，共 ${s.totalStrokes} 杆。下次试着用更少的杆数！`,
    draw(c, s, input) {
      const course = E.courses[s.level];
      P.backdrop(c, "#9ac2a5", "#78aa90");
      for (let i = 0; i < 12; i++)
        P.round(c, 25, 25 + i * 55, 550, 28, 0, "#c6e1c51b");
      c.strokeStyle = "#e5efe0";
      c.lineWidth = 12;
      c.strokeRect(25, 25, 550, 650);
      for (const [x, y, w, h] of course.sand) {
        P.round(c, x, y, w, h, 20, "#e4d29e");
        for (let i = 0; i < 14; i++)
          P.circle(
            c,
            x + 10 + ((i * 29) % (w - 20)),
            y + 10 + ((i * 41) % (h - 20)),
            1.8,
            "#c7b279",
          );
      }
      for (const [x, y, w, h] of course.water) {
        P.round(c, x, y, w, h, 22, "#80bccc");
        for (let i = 0; i < 4; i++)
          P.line(
            c,
            x + 18,
            y + 22 + i * 25,
            x + w - 18,
            y + 22 + i * 25,
            "#bce0e5",
            2,
          );
      }
      for (const [x, y, w, h] of course.walls) {
        P.round(c, x, y + 5, w, h, 5, "#486a5c44");
        P.round(c, x, y, w, h, 5, "#e8dfc9");
        P.round(
          c,
          x + 4,
          y + 3,
          Math.max(1, w - 8),
          Math.max(1, h - 6),
          3,
          "#f6edda",
        );
      }
      const [hx, hy] = course.hole;
      P.circle(c, hx, hy, 16, "#46735b");
      P.circle(c, hx, hy, 12, "#334c40");
      P.line(c, hx, hy, hx, hy - 53, "#fff8e4", 3);
      c.fillStyle = "#e7b77e";
      c.beginPath();
      c.moveTo(hx, hy - 54);
      c.lineTo(hx + 30, hy - 43);
      c.lineTo(hx, hy - 33);
      c.fill();
      P.text(c, s.level + 1, hx + 13, hy - 43, 12, "#8a6348");
      if (s.rest && !s.cleared)
        P.arrow(c, s.ball.x, s.ball.y, s.angle, s.power, "#f6f1d3");
      if (input.drag && s.rest && !s.cleared) {
        const d = input.drag;
        P.line(
          c,
          s.ball.x,
          s.ball.y,
          s.ball.x + d.end.x - d.start.x,
          s.ball.y + d.end.y - d.start.y,
          "#fff7d880",
          2,
        );
      }
      if (!s.cleared) P.ball(c, s.ball.x, s.ball.y, 10, "#fffaf1");
      P.round(c, 160, 38, 280, 38, 13, "#eaf3e1dd");
      P.text(c, course.name, 300, 58, 19, "#527962");
    },
  });
})();
