/* Wide-table games opt in with data-orientation="landscape". */
(() => {
  "use strict";

  // Fullscreen and orientation are separate permissions. Either can be missing
  // or rejected; the game must remain usable with ordinary device rotation.
  async function enterLandscape(doc, deviceScreen) {
    let enteredFullscreen = false;
    if (
      !doc.fullscreenElement &&
      doc.fullscreenEnabled &&
      doc.documentElement.requestFullscreen
    ) {
      try {
        await doc.documentElement.requestFullscreen({ navigationUI: "hide" });
        enteredFullscreen = true;
      } catch {
        /* Continue to the manual-rotation fallback. */
      }
    }
    let locked = false;
    if (typeof deviceScreen.orientation?.lock === "function") {
      try {
        await deviceScreen.orientation.lock("landscape");
        locked = true;
      } catch {
        /* Safari / embedded browsers may expose but reject lock(). */
      }
    }
    return { enteredFullscreen, locked };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { enterLandscape };
    return;
  }
  if (document.body.dataset.orientation !== "landscape") return;

  document.addEventListener("DOMContentLoaded", () => {
    const body = document.body;
    const mobile = matchMedia(
      "(max-width: 600px), (max-width: 1100px) and (max-height: 600px)",
    );
    const landscape = matchMedia("(orientation: landscape)");
    const pause = () => document.dispatchEvent(new Event("arcade:pause"));
    const title = document.getElementById("game-name").textContent;
    const hud = document.createElement("nav");
    hud.className = "mobile-game-bar";
    hud.setAttribute("aria-label", "手机游戏操作");
    hud.innerHTML =
      '<a class="mobile-back" href="../../index.html" aria-label="返回游戏大厅">‹</a><strong class="mobile-game-title"></strong><div class="mobile-quick"></div><button class="mobile-screen" type="button">横屏</button><button class="mobile-menu-open" type="button" aria-haspopup="dialog">菜单</button>';
    hud.querySelector(".mobile-game-title").textContent = title;
    body.prepend(hud);

    const menu = document.createElement("dialog");
    menu.className = "mobile-game-menu";
    menu.id = "mobile-game-menu";
    menu.setAttribute("aria-labelledby", "mobile-menu-title");
    menu.innerHTML =
      '<div class="mobile-menu-heading"><h2 id="mobile-menu-title">游戏菜单</h2><button type="button" class="mobile-menu-close">回到游戏</button></div><div class="mobile-menu-content"></div>';
    body.append(menu);
    const menuContent = menu.querySelector(".mobile-menu-content");
    const menuButton = hud.querySelector(".mobile-menu-open");
    menuButton.setAttribute("aria-controls", menu.id);
    menuButton.addEventListener("click", () => {
      pause();
      menu.showModal();
    });
    menu
      .querySelector(".mobile-menu-close")
      .addEventListener("click", () => menu.close());
    menuContent.addEventListener("click", (event) => {
      if (
        event.target.closest("button") &&
        !event.target.closest(".focus-toggle")
      )
        menu.close();
    });

    const rotate = document.createElement("dialog");
    rotate.className = "rotate-guide";
    rotate.setAttribute("aria-labelledby", "rotate-title");
    rotate.innerHTML =
      '<div class="rotate-phone" aria-hidden="true"><span>↻</span></div><p class="rotate-eyebrow">横着玩，更舒展</p><h2 id="rotate-title"></h2><p class="rotate-description"></p><p class="rotate-feedback" role="status" aria-live="polite">把手机转过来，自动展开游戏界面。</p><button class="rotate-start" type="button">横屏全屏玩</button><button class="rotate-skip" type="button">先用竖屏玩</button>';
    rotate.querySelector("h2").textContent = title;
    const descriptions = {
      landlord: "两家对手在左右，整排手牌在底部。出牌、提示就在手边。",
      spider: "十列牌一起展开，更容易看清可以接到哪一列。",
      freecell: "空当、收牌区和八列手牌同时展开，腾挪更顺手。",
      mahjong: "横向摊开手牌，留出看弃牌和吃、碰、杠、胡的空间。",
      tower: "展开整张防线，建造和升级放在侧边，战场更清楚。",
    };
    rotate.querySelector(".rotate-description").textContent =
      descriptions[body.dataset.game];
    body.append(rotate);
    const start = rotate.querySelector(".rotate-start");
    const feedback = rotate.querySelector(".rotate-feedback");
    const screenButton = hud.querySelector(".mobile-screen");
    const canFullscreen = !!(
      document.fullscreenEnabled && document.documentElement.requestFullscreen
    );
    const canLock = typeof screen.orientation?.lock === "function";
    start.hidden = !canFullscreen && !canLock;
    start.textContent = canFullscreen
      ? canLock
        ? "横屏全屏玩"
        : "全屏后转动手机"
      : "尝试切换横屏";
    if (!canLock)
      feedback.textContent = "请关闭手机的方向锁定，再把手机横过来。";
    let dismissed = false,
      attempt = 0,
      ownsLock = false,
      ownsFullscreen = false;
    const storageKey = `arcade-portrait-${body.dataset.game}`;
    try {
      dismissed = sessionStorage.getItem(storageKey) === "yes";
    } catch {
      /* Private browsing. */
    }
    const dismiss = () => {
      dismissed = true;
      attempt++;
      try {
        sessionStorage.setItem(storageKey, "yes");
      } catch {
        /* Optional preference. */
      }
    };
    rotate.querySelector(".rotate-skip").addEventListener("click", () => {
      dismiss();
      rotate.close();
    });
    rotate.addEventListener("cancel", dismiss);
    const unlock = () => {
      if (ownsLock) {
        try {
          screen.orientation.unlock();
        } catch {
          /* Already released by browser. */
        }
      }
      ownsLock = false;
    };
    const releaseFullscreen = async () => {
      unlock();
      if (ownsFullscreen && document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {
          /* Browser already exited. */
        }
      }
      ownsFullscreen = false;
    };
    const requestLandscape = async () => {
      const token = ++attempt;
      start.disabled = true;
      screenButton.disabled = true;
      feedback.textContent = "正在切换…";
      pause();
      const result = await enterLandscape(document, screen);
      ownsLock = result.locked;
      ownsFullscreen = ownsFullscreen || result.enteredFullscreen;
      start.disabled = false;
      screenButton.disabled = false;
      if (token !== attempt || !mobile.matches) {
        await releaseFullscreen();
        return;
      }
      feedback.textContent = result.locked
        ? "已开启横屏。"
        : "请关闭手机的方向锁定，再把手机横过来。";
      update();
    };
    start.addEventListener("click", requestLandscape);
    screenButton.addEventListener("click", async () => {
      if (document.fullscreenElement) {
        await releaseFullscreen();
        // Also allow exiting fullscreen entered outside this control.
        if (document.fullscreenElement) {
          try {
            await document.exitFullscreen();
          } catch {}
        }
      } else if (landscape.matches) await requestLandscape();
      else {
        pause();
        rotate.showModal();
      }
    });

    // Move original controls, never duplicate buttons or game state. Restore exact
    // positions when returning to a desktop viewport; listeners and focus survive.
    const moves = [];
    const remember = (node, destination) => {
      if (!node) return;
      const marker = document.createComment("mobile control home");
      node.before(marker);
      moves.push({ node, marker, destination });
    };
    remember(
      document.querySelector(".play-scores"),
      hud.querySelector(".mobile-quick"),
    );
    remember(
      document.querySelector(".game-toolbar #pause, .game-toolbar #undo"),
      hud.querySelector(".mobile-quick"),
    );
    remember(document.querySelector(".game-toolbar"), menuContent);
    if (body.dataset.game === "landlord")
      remember(document.getElementById("practice"), menuContent);
    document
      .querySelectorAll(
        ".play-column .game-settings, .play-column > .deep-panel",
      )
      .forEach((node) => remember(node, menuContent));
    if (body.dataset.game === "mahjong") {
      const tableStage = document.createElement("div");
      tableStage.className = "mobile-table-stage";
      const table = document.querySelector(".mahjong-table");
      table.before(tableStage);
      [
        table,
        ...["hand-note", "own-melds", "hand", "result", "winning-hand"].map(
          (id) => document.getElementById(id),
        ),
      ].forEach((node) => remember(node, tableStage));
    }
    if (body.dataset.game === "tower")
      remember(
        document.getElementById("guide"),
        document.querySelector(".play-bottom"),
      );
    let active = false,
      wasLandscape = landscape.matches;
    function update() {
      const enabled = mobile.matches;
      if (enabled !== active) {
        if (enabled)
          moves.forEach(({ node, destination }) => destination.append(node));
        else {
          menu.close();
          rotate.close();
          // Restore parent containers before their children.
          [...moves]
            .reverse()
            .forEach(({ node, marker }) => marker.after(node));
          attempt++;
          void releaseFullscreen();
        }
        active = enabled;
      }
      body.classList.toggle("mobile-play", enabled);
      body.classList.toggle("mobile-landscape", enabled && landscape.matches);
      hud.hidden = !enabled;
      screenButton.hidden = landscape.matches && !canFullscreen && !canLock;
      screenButton.textContent = document.fullscreenElement
        ? "退出全屏"
        : landscape.matches
          ? "全屏"
          : "横屏";
      if (wasLandscape !== landscape.matches && enabled) pause();
      wasLandscape = landscape.matches;
      if (!enabled || landscape.matches) rotate.close();
      else if (!dismissed && !document.querySelector("dialog[open]")) {
        pause();
        rotate.showModal();
      }
    }
    mobile.addEventListener("change", update);
    landscape.addEventListener("change", update);
    let wasFullscreen = !!document.fullscreenElement;
    document.addEventListener("fullscreenchange", () => {
      const isFullscreen = !!document.fullscreenElement;
      // An OS/back-button exit can arrive while lock() is still pending.
      // Invalidate that request so a late resolution cannot re-lock the device.
      if (wasFullscreen && !isFullscreen) attempt++;
      wasFullscreen = isFullscreen;
      if (!document.fullscreenElement) {
        unlock();
        ownsFullscreen = false;
      }
      update();
    });
    window.addEventListener("pagehide", unlock);
    update();
  });
})();
