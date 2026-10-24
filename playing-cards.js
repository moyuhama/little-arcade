(() => {
  "use strict";
  const suits = ["♠", "♥", "♣", "♦"],
    suitNames = ["黑桃", "红心", "梅花", "方块"];
  const rank = (id) => (id % 13) + 1,
    face = (id) =>
      ({ 1: "A", 11: "J", 12: "Q", 13: "K" })[rank(id)] || String(rank(id));
  const name = (id) => suitNames[Math.floor(id / 13)] + face(id);
  function card(id, label, action) {
    const b = Arcade.button(
      "",
      label || name(id),
      action,
      "playing-card" + (Math.floor(id / 13) % 2 ? " red-card" : ""),
    );
    const corner = document.createElement("span");
    corner.className = "card-corner";
    corner.textContent = face(id) + suits[Math.floor(id / 13)];
    const pip = document.createElement("span");
    pip.className = "card-pip";
    pip.textContent = suits[Math.floor(id / 13)];
    pip.setAttribute("aria-hidden", "true");
    b.append(corner, pip);
    return b;
  }
  globalThis.PlayingCards = { suits, suitNames, rank, face, name, card };
})();
