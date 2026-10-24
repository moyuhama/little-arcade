/* Helpers for the longer games; each engine owns and validates its own saved state. */
(() => {
  "use strict";
  const dialog = document.createElement("dialog");
  dialog.className = "game-help";
  dialog.setAttribute("aria-labelledby", "reset-title");
  dialog.innerHTML =
    '<h2 id="reset-title">开始新的一局？</h2><p id="reset-copy">当前进度会被替换，已有纪录保留。</p><form method="dialog" class="deep-actions"><button value="cancel" autofocus>继续当前游戏</button><button value="confirm">确认重新开始</button></form>';
  document.body.append(dialog);
  let action = null;
  dialog.addEventListener("close", () => {
    if (dialog.returnValue === "confirm") action?.();
    action = null;
  });
  document.addEventListener(
    "keydown",
    (event) => {
      if (dialog.open) event.stopImmediatePropagation();
    },
    true,
  );
  globalThis.Deep = {
    confirm(fn, text) {
      document.dispatchEvent(new Event("arcade:pause"));
      action = fn;
      dialog.returnValue = "cancel";
      document.getElementById("reset-copy").textContent =
        text || "当前进度会被替换，已有纪录保留。";
      dialog.showModal();
    },
    seed: () => Math.floor(Math.random() * 4294967296),
  };
})();
