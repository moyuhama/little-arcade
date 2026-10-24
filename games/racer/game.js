(() => {
  "use strict";
  const E = GameEngine,
    P = CanvasPaint;
  function car(c, x, y, color, player = false) {
    P.round(c, x - 30, y - 33, 8, 23, 3, "#50465d");
    P.round(c, x + 22, y - 33, 8, 23, 3, "#50465d");
    P.round(c, x - 30, y + 12, 8, 23, 3, "#50465d");
    P.round(c, x + 22, y + 12, 8, 23, 3, "#50465d");
    P.round(c, x - 24, y - 43, 48, 86, 13, color);
    P.round(c, x - 17, y - 25, 34, 23, 6, player ? "#e9defc" : "#efe4ef");
    P.round(c, x - 15, y + 12, 30, 17, 5, "#ffffff66");
    P.round(c, x - 19, y - 38, 9, 5, 2, "#fff4bd");
    P.round(c, x + 10, y - 38, 9, 5, 2, "#fff4bd");
  }
  CanvasArcade({
    title: "赛车避障",
    intro: "左右换道，躲开车流、收集金币。三次碰撞机会，跑完 60 秒即可冲线。",
    pointer: "swipe",
    controls: [
      { id: "left", label: "◀ 左换道" },
      { id: "right", label: "右换道 ▶" },
    ],
    action(name, s) {
      if (name === "left" || name === "right")
        E.steer(s, name === "left" ? -1 : 1);
    },
    info: (s) =>
      `剩余 ${Math.ceil(60 - s.time)} 秒 · 生命 ${"♥".repeat(Math.max(0, s.lives)) || "0"} · 金币 ${s.coins}`,
    summary: (s) =>
      `${s.won ? "成功冲线！" : "本次旅途结束。"} 共 ${s.score} 分，收集 ${s.coins} 枚金币。`,
    draw(c, s) {
      P.backdrop(c, "#cee1d5", "#e2ecdc");
      P.round(c, 104, 0, 392, 700, 0, "#796e89");
      P.round(c, 113, 0, 374, 700, 0, "#8b8098");
      for (const x of [238, 358])
        for (let i = -1; i < 8; i++)
          P.round(c, x, i * 110 + (s.distance % 110), 4, 56, 2, "#ede3e799");
      for (let i = -1; i < 10; i++) {
        const y = i * 85 + (s.distance % 85);
        P.round(c, 96, y, 8, 44, 1, i % 2 ? "#f4e9e9" : "#c894a4");
        P.round(c, 496, y, 8, 44, 1, i % 2 ? "#f4e9e9" : "#c894a4");
        P.circle(c, 45, y + 28, 17, "#a3bea4");
        P.circle(c, 554, y + 70, 21, "#9bb89c");
      }
      for (const coin of s.pickups) {
        P.ball(c, coin.x, coin.y, 16, "#efc96f");
        P.text(c, "+", coin.x, coin.y, 20, "#a37a3c");
      }
      for (const o of s.traffic)
        car(c, o.x, o.y, ["#c68fa5", "#9eadd2", "#d5b680"][o.color]);
      if (s.invulnerable <= 0 || Math.floor(s.time * 12) % 2 === 0)
        car(c, s.x, 590, "#b79bd6", true);
      P.round(c, 145, 18, 310, 37, 14, "#ffffffd9");
      P.text(
        c,
        s.time > 55 ? "终点就在前方" : "保持车距，留意下一排",
        300,
        38,
        17,
        "#70607b",
      );
    },
  });
})();
