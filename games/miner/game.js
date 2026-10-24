(() => {
  "use strict";
  const E = GameEngine,
    P = CanvasPaint;
  function item(c, o, x = o.x, y = o.y) {
    if (o.type === "rock") {
      P.circle(c, x, y, o.r, "#aaa1ad");
      P.circle(c, x - 6, y - 7, o.r * 0.68, "#bab1bc");
      P.text(c, o.value, x, y, 17, "#706775");
    } else if (o.type === "gold") {
      P.ball(c, x, y, o.r, "#e7bb5e");
      P.text(c, o.value, x, y, 17, "#93702b");
    } else {
      c.fillStyle = "#a6d1de";
      c.beginPath();
      c.moveTo(x, y - o.r);
      c.lineTo(x + o.r, y);
      c.lineTo(x, y + o.r);
      c.lineTo(x - o.r, y);
      c.closePath();
      c.fill();
      P.line(c, x - o.r * 0.5, y, x + o.r * 0.5, y, "#e8fcff", 2);
      P.text(c, o.value, x, y + o.r + 17, 15, "#f4ecd7");
    }
  }
  CanvasArcade({
    title: "黄金矿工",
    intro:
      "看准摆动方向放钩，金块和宝石得分。每关 45 秒，共三关；石头太重可以炸掉。",
    pointer: "tap",
    controls: [
      { id: "primary", label: "放钩", disabled: (s) => s.phase !== "swing" },
      { id: "bomb", label: "炸掉重物", disabled: (s) => !s.caught || !s.bombs },
    ],
    action(name, s) {
      if (name === "primary") E.grab(s);
      else if (name === "bomb") E.bomb(s);
    },
    info: (s) =>
      `第 ${s.level + 1}/3 关 · 剩余 ${Math.ceil(45 - s.time)} 秒 · 目标 ${E.targets[s.level]} 分 · 炸药 ${s.bombs}`,
    between: (s) =>
      `累计 ${s.score} 分，达到本关目标 ${E.targets[s.level]} 分。下一关重新获得 45 秒和 2 份炸药。`,
    summary: (s) =>
      `${s.won ? "三关目标全部达成！" : "本次采矿结束。"} 共获得 ${s.score} 分。`,
    draw(c, s) {
      P.backdrop(c, "#c5b2a2", "#987a72");
      P.round(c, 0, 0, 600, 112, 0, "#e8deba");
      P.round(c, 0, 105, 600, 18, 0, "#bfa47a");
      for (let i = 0; i < 35; i++) {
        const x = (i * 127 + 17) % 600,
          y = 150 + ((i * 83) % 520);
        P.circle(c, x, y, 2 + (i % 3), "#7b625f40");
      }
      P.round(c, 70, 20, 180, 47, 13, "#fff6de");
      P.text(c, "慢慢来，抓准再放", 160, 44, 17, "#9c815a");
      P.round(c, 277, 56, 46, 27, 8, "#947392");
      P.circle(c, 300, 47, 17, "#e7be9b");
      P.round(c, 278, 27, 44, 13, 7, "#e2b85f");
      P.circle(c, 300, 31, 8, "#fff2bd");
      P.circle(c, 300, 80, 9, "#79586f");
      for (const o of s.items) item(c, o);
      const h = E.hook(s);
      P.line(c, 300, 80, h.x, h.y, "#f7eddb", 3);
      c.strokeStyle = "#f6e8ce";
      c.lineWidth = 4;
      c.beginPath();
      c.arc(h.x, h.y, 10, 0, Math.PI);
      c.stroke();
      if (s.caught) item(c, s.caught, h.x, h.y + s.caught.r + 7);
      P.round(c, 412, 23, 156, 40, 12, "#fff6dc");
      P.text(c, `目标 ${E.targets[s.level]}`, 490, 43, 18, "#9d7842");
    },
  });
})();
