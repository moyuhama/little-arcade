(() => {
  "use strict";
  const phone = matchMedia(
    "(max-width: 600px), (max-width: 1100px) and (max-height: 600px)",
  );
  const menu = document.getElementById("mobile-game-menu");
  const groups = [
    [
      document.querySelector(".game-settings"),
      document.getElementById("mobile-settings-slot"),
    ],
    [
      document.querySelector(".game-toolbar"),
      document.getElementById("mobile-toolbar-slot"),
    ],
  ].map(([node, slot]) => {
    const home = document.createComment("desktop controls");
    node.before(home);
    return { node, slot, home };
  });
  function layout() {
    for (const { node, slot, home } of groups) {
      if (phone.matches) slot.append(node);
      else home.after(node);
    }
    if (!phone.matches) menu.close();
  }
  phone.addEventListener("change", layout);
  layout();
})();
