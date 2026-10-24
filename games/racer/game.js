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
    title: "赛车避障 · 无限公路",
    intro:
      "慢速起步，越跑越快。用氮气抢分、刹车避险，收集金币选择改装路线；生命耗尽才结束。",
    pointer: "swipe",
    recordKey: "bestEndless",
    liveRecord: true,
    pauseOnOpen: "racer-garage",
    controls: [
      { id: "left", label: "◀ 左换道" },
      { id: "right", label: "右换道 ▶" },
      {
        id: "primary",
        label: (s) =>
          s.boosting > 0
            ? `冲刺 ${s.boosting.toFixed(1)}s`
            : `氮气 ${E.boostCost(s)} · 空格`,
        disabled: (s) =>
          s.boosting > 0 || s.braking > 0 || s.energy < E.boostCost(s),
      },
      {
        id: "brake",
        label: (s) =>
          s.brakeCooldown > 0
            ? `刹车冷却 ${Math.ceil(s.brakeCooldown)}s`
            : "刹车 · B",
        disabled: (s) => s.brakeCooldown > 0,
      },
      ...Object.entries(E.upgradeNames).map(([type, name]) => ({
        id: type,
        container: "upgrade-controls",
        whilePaused: true,
        label: (s) =>
          `${name} ${s.upgrades[type]}/3 · ${s.upgrades[type] === 3 ? "已满级" : `${E.upgradeCost(s, type)} 金币`}`,
        disabled: (s) => s.wallet < E.upgradeCost(s, type),
      })),
    ],
    action(name, s) {
      if (name === "left" || name === "right")
        E.steer(s, name === "left" ? -1 : 1);
      else if (name === "primary") E.boost(s);
      else if (name === "brake" || name === "bomb") E.brake(s);
      else E.upgrade(s, name);
    },
    info: (s) =>
      `无限公路 · ${Math.floor(s.distance / 10)} 米 · ${Math.round(s.speed * 0.36)} km/h · 生命 ${"♥".repeat(Math.max(0, s.lives)) || "0"}`,
    endTitle: () => "这一程，跑得不错",
    summary: (s) =>
      `行驶 ${Math.floor(s.distance / 10)} 米，坚持 ${Math.floor(s.time)} 秒。${s.score} 分，最高 ${s.bestCombo} 连击，完成 ${s.missions} 个目标。改装在新的一局重新选择。`,
    render(s) {
      const set = (id, value) => {
        const el = document.getElementById(id);
        if (el.textContent !== value) el.textContent = value;
      };
      document.getElementById("racer-energy").value = s.energy;
      set("energy-label", `氮气 ${Math.floor(s.energy)}/100`);
      set("racer-combo", `${s.combo} 连击 · ×${E.multiplier(s)} 得分`);
      set(
        "racer-shield",
        `护盾 ${s.shield}/${E.shieldCapacity(s)} · 金币 ${s.wallet}`,
      );
      const m = E.mission(s);
      set(
        "racer-mission",
        `目标 ${s.missions + 1} · ${m.label} ${m.progress}/${m.target} → +${m.reward} 分`,
      );
      set("garage-wallet", `可用 ${s.wallet} 金币 · 本局改装`);
    },
    draw(c, s) {
      const theme = Math.floor(s.distance / 10000) % 4;
      const landscapes = [
        ["#cee1d5", "#e2ecdc"],
        ["#b2d9df", "#d5e6d8"],
        ["#e1c3a5", "#e9d1b9"],
        ["#323450", "#54526c"],
      ];
      P.backdrop(c, ...landscapes[theme]);
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
        const type = coin.type || "coin";
        P.ball(
          c,
          coin.x,
          coin.y,
          18,
          type === "shield"
            ? "#86c9d7"
            : type === "energy"
              ? "#b5a0ed"
              : "#efc96f",
        );
        P.text(
          c,
          type === "shield" ? "盾" : type === "energy" ? "氮" : "+",
          coin.x,
          coin.y,
          17,
          type === "coin" ? "#a37a3c" : "#fff",
        );
      }
      for (const o of s.traffic)
        car(c, o.x, o.y, ["#c68fa5", "#9eadd2", "#d5b680"][o.color]);
      if (s.boosting > 0) {
        P.round(
          c,
          s.x - 14,
          626,
          28,
          25 + Math.sin(s.time * 35) * 10,
          10,
          "#d8b4ff",
        );
        P.round(c, s.x - 7, 626, 14, 20, 6, "#fff0bd");
        for (const x of [127, 473])
          P.line(
            c,
            x,
            100 + (s.distance % 350),
            x,
            200 + (s.distance % 350),
            "#f7e6ff99",
            3,
          );
      }
      if (s.shield > 0) {
        c.strokeStyle = "#a4f1ed";
        c.lineWidth = 4;
        c.beginPath();
        c.ellipse(s.x, 590, 40, 58, 0, 0, Math.PI * 2);
        c.stroke();
      }
      if (s.braking > 0) {
        P.circle(c, s.x - 17, 625, 5, "#ff9c8e");
        P.circle(c, s.x + 17, 625, 5, "#ff9c8e");
      }
      if (s.invulnerable <= 0 || Math.floor(s.time * 12) % 2 === 0)
        car(c, s.x, 590, "#b79bd6", true);
      P.round(c, 145, 18, 310, 37, 14, "#ffffffd9");
      P.text(
        c,
        `${E.themes[theme]} · 第 ${Math.floor(s.distance / 10000) + 1} 路段`,
        300,
        38,
        17,
        "#70607b",
      );
    },
  });
})();
