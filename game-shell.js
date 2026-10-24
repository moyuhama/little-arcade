(() => {
  'use strict';
  const current = document.body.dataset.game;
  const nav = document.getElementById('switch-games');
  const root = new URL('./', document.currentScript.src);
  for (const game of globalThis.ARCADE_GAMES || []) {
    const link = document.createElement('a');
    link.className = 'switch-game'; link.href = new URL(game.url, root).href;
    if (game.id === current) link.setAttribute('aria-current', 'page');
    const art = document.createElement('span'); art.className = 'switch-art'; art.setAttribute('aria-hidden', 'true');
    if (game.cover) {
      const image = document.createElement('img'); image.src = new URL(game.cover, root).href; image.alt = ''; art.append(image);
    } else art.textContent = game.title;
    const copy = document.createElement('span'), title = document.createElement('strong'), note = document.createElement('small');
    title.textContent = game.title; note.textContent = game.id === current ? '正在这里玩' : game.category;
    copy.append(title, note); link.append(art, copy); nav?.append(link);
  }
  const help = document.getElementById('game-help');
  document.querySelector('[data-help-open]')?.addEventListener('click', () => {
    document.dispatchEvent(new Event('arcade:pause'));
    help.showModal();
  });
  // Native dialog handles focus and Escape; game hotkeys must not act behind it.
  document.addEventListener('keydown', event => {
    if (help?.open) event.stopImmediatePropagation();
  }, true);
})();
