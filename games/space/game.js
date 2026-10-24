(() => {
  "use strict";
  const E = GameEngine,
    P = CanvasPaint;
  function ship(c, x, y, color, scale = 1, enemy = false) {
    c.save();
    c.translate(x, y);
    c.scale(scale, enemy ? -scale : scale);
    P.round(c, -8, 20, 16, 18, 7, "#f0bf72");
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(0, -27);
    c.lineTo(25, 24);
    c.lineTo(0, 13);
    c.lineTo(-25, 24);
    c.closePath();
    c.fill();
    P.round(c, -6, -7, 12, 20, 6, "#e7edff");
    c.restore();
  }
  CanvasArcade({
    title: "太空射击",
    intro: "自动射击，左右移动躲开敌机。坚持三波进攻，再击破旗舰。",
    pointer: "move",
    move: true,
    controls: [
      { id: "left", label: "◀ 向左", hold: -1 },
      { id: "right", label: "向右 ▶", hold: 1 },
    ],
    action() {},
    info: (s) =>
      `生命 ${"♥".repeat(Math.max(0, s.lives)) || "0"} · ${s.bossSpawned ? "旗舰决战" : `第 ${Math.min(3, 1 + Math.floor(s.time / 15))}/3 波`} · ${s.shield ? "护盾开启" : s.rapid > 0 ? `速射 ${Math.ceil(s.rapid)} 秒` : "自动射击"}`,
    summary: (s) =>
      `${s.won ? "旗舰已击破！" : "飞船需要休整了。"} 本局 ${s.score} 分，击落 ${s.kills} 架敌机。`,
    draw(c, s) {
      P.backdrop(c, "#302746", "#554568");
      for (let i = 0; i < 45; i++) {
        const x = (i * 137 + 29) % 600,
          y = (i * 89 + s.time * (12 + (i % 4) * 7)) % 700;
        P.circle(c, x, y, i % 5 === 0 ? 2.3 : 1.2, "#e8dbef88");
      }
      P.circle(c, 520, 110, 62, "#82709835");
      P.circle(c, 493, 94, 60, "#3a304e");
      for (const b of s.bullets)
        P.round(c, b.x - 3, b.y - 11, 6, 22, 3, "#c3f0d7");
      for (const b of s.shots) P.circle(c, b.x, b.y, 6, "#eeadba");
      for (const e of s.enemies) {
        ship(c, e.x, e.y, e.hp > 1 ? "#c5a373" : "#b287bd", 0.85, true);
        if (e.hp > 1) P.circle(c, e.x, e.y + 4, 4, "#f3da9b");
      }
      if (s.boss) {
        const b = s.boss;
        P.round(c, b.x - 57, b.y - 29, 114, 58, 20, "#b28bb7");
        P.round(c, b.x - 81, b.y - 13, 42, 42, 13, "#856b9c");
        P.round(c, b.x + 39, b.y - 13, 42, 42, 13, "#856b9c");
        P.round(c, b.x - 24, b.y - 14, 48, 25, 10, "#e4b2bb");
        P.round(c, 150, 25, 300, 9, 5, "#7a668f");
        P.round(c, 150, 25, (300 * Math.max(0, b.hp)) / 45, 9, 5, "#e8b86f");
        P.text(c, "星空旗舰", 300, 57, 16, "#e9dfee");
      }
      for (const d of s.drops) {
        P.circle(c, d.x, d.y, 18, d.type === "shield" ? "#8abbaa" : "#e4b765");
        P.text(c, d.type === "shield" ? "盾" : "速", d.x, d.y, 15, "#fff");
      }
      if (s.invulnerable <= 0 || Math.floor(s.time * 12) % 2 === 0)
        ship(c, s.x, 620, "#c8b3ef");
      if (s.shield) {
        c.strokeStyle = "#9ad9ce";
        c.lineWidth = 3;
        c.beginPath();
        c.arc(s.x, 620, 38, 0, Math.PI * 2);
        c.stroke();
      }
      P.text(c, "拖动飞船 · 自动射击", 300, 680, 16, "#e1d3ed");
    },
  });
})();
