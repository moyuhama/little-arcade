(() => {
  'use strict';
  const current = document.body.dataset.game;
  const nav = document.getElementById('switch-games');
  const root = new URL('./', document.currentScript.src);
  const games = globalThis.ARCADE_GAMES || [];
  const at = games.findIndex(game => game.id === current);
  // Keep the play page compact; the hall remains the complete, searchable library.
  const suggestions = at >= 0 ? [...games.slice(at), ...games.slice(0, at)].slice(0, 6) : games.slice(0, 6);
  for (const game of suggestions) {
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
  const all = document.createElement('a');
  all.className = 'all-games-link'; all.href = new URL('index.html', root).href;
  all.textContent = `查看全部 ${games.length} 款游戏 →`; nav?.append(all);
  const help = document.getElementById('game-help');
  const column = document.querySelector('.play-column');
  // Move the existing nodes once, before the game initializes. Mobile keeps the
  // original top / board / controls reading order; desktop places controls beside it.
  const surface = column?.querySelector(':scope > .play-board-frame, :scope > .canvas-stage, :scope > .network-scroll, :scope > .nonogram-scroll, :scope > .bomber-arena, :scope > .tower-field, :scope > .spider-scroll');
  if (surface) {
    const top = document.createElement('div'); top.className = 'play-top';
    const stage = document.createElement('div'); stage.className = 'play-surface';
    const bottom = document.createElement('div'); bottom.className = 'play-bottom';
    let after = false;
    for (const node of [...column.childNodes]) {
      if (node === surface) { stage.append(node); after = true; }
      else (after ? bottom : top).append(node);
    }
    const panel = stage.querySelector('.canvas-panel');
    if (panel) bottom.prepend(panel);
    column.append(top, stage, bottom);
    column.classList.add('roomy-session');
  }
  const toolbar = document.querySelector('.game-toolbar');
  if (toolbar) {
    const focus = document.createElement('button');
    focus.type = 'button'; focus.className = 'focus-toggle';
    focus.textContent = '⛶ 专注'; focus.setAttribute('aria-pressed', 'false');
    focus.setAttribute('aria-label', '专注模式');
    focus.title = '隐藏导航与推荐，留出更多游戏空间；Esc 退出';
    toolbar.append(focus);
    const setFocus = enabled => {
      // Layout changes must not leave an action game moving while the player reorients.
      document.dispatchEvent(new Event('arcade:pause'));
      document.body.classList.toggle('play-focus', enabled);
      focus.textContent = enabled ? '退出专注' : '⛶ 专注';
      focus.setAttribute('aria-pressed', String(enabled));
      focus.setAttribute('aria-label', enabled ? '退出专注模式' : '专注模式');
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    focus.addEventListener('click', () => setFocus(!document.body.classList.contains('play-focus')));
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !document.body.classList.contains('play-focus') || document.querySelector('dialog[open]')) return;
      event.preventDefault(); event.stopImmediatePropagation();
      setFocus(false); focus.focus({ preventScroll: true });
    }, true);
  }
  document.querySelector('[data-help-open]')?.addEventListener('click', () => {
    document.dispatchEvent(new Event('arcade:pause'));
    help.showModal();
  });
  // Native dialog handles focus and Escape; game hotkeys must not act behind it.
  document.addEventListener('keydown', event => {
    if (help?.open) event.stopImmediatePropagation();
  }, true);
})();
