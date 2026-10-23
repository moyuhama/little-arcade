(() => {
  'use strict';
  const keys = { favorites: 'little-arcade-favorites-v1', recent: 'little-arcade-recent-v1' };
  const memory = new Map();
  let storageFailed = false;
  function read(key) {
    if (memory.has(key)) return memory.get(key);
    try { return JSON.parse(localStorage.getItem(key)); }
    catch { storageFailed = true; return null; }
  }
  function write(key, value) {
    memory.set(key, value);
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { storageFailed = true; }
  }
  function recentEntries(value) {
    const seen = new Set();
    return (Array.isArray(value) ? value : []).filter(item => {
      if (!item || typeof item.id !== 'string' || !Number.isFinite(item.playedAt) || item.playedAt <= 0 || seen.has(item.id)) return false;
      seen.add(item.id); return true;
    }).sort((a, b) => b.playedAt - a.playedAt).slice(0, 12);
  }
  function selectGames(games, { view = 'all', category = 'all', query = '', sort = 'newest', favorites = [], recent = [] } = {}) {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const positions = new Map(recent.map((item, i) => [item.id, i]));
    return games.filter(game => {
      if (view === 'favorites' && !favorites.includes(game.id)) return false;
      if (view === 'recent' && !positions.has(game.id)) return false;
      if (category !== 'all' && game.category !== category) return false;
      const text = [game.title, game.description, game.category, ...(game.tags || []), ...(game.keywords || [])].join(' ').toLocaleLowerCase();
      return terms.every(term => text.includes(term));
    }).sort((a, b) => view === 'recent' ? positions.get(a.id) - positions.get(b.id) : sort === 'name' ? a.title.localeCompare(b.title, 'zh-CN', { numeric: true }) : b.addedAt.localeCompare(a.addedAt) || a.title.localeCompare(b.title, 'zh-CN'));
  }
  if (typeof module === 'object' && module.exports) {
    module.exports = { selectGames, recentEntries }; return;
  }
  const gameId = document.currentScript?.dataset.gameId;
  if (gameId) {
    const recent = recentEntries(read(keys.recent)).filter(item => item.id !== gameId);
    write(keys.recent, [{ id: gameId, playedAt: Date.now() }, ...recent].slice(0, 12));
    return;
  }
  const grid = document.getElementById('game-grid');
  if (!grid) return;
  const games = Array.isArray(globalThis.ARCADE_GAMES) ? globalThis.ARCADE_GAMES : [];
  const $ = id => document.getElementById(id);
  const validIds = new Set(games.map(game => game.id));
  const state = { view: 'all', category: 'all', query: '', sort: 'newest', favorites: [], recent: [] };
  const viewNames = { all: '全部游戏', favorites: '我的收藏', recent: '最近玩过' };
  function loadPersonal() {
    const saved = read(keys.favorites);
    state.favorites = [...new Set(Array.isArray(saved) ? saved : [])].filter(id => validIds.has(id));
    state.recent = recentEntries(read(keys.recent)).filter(item => validIds.has(item.id));
  }
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function artwork(game, small = false) {
    const art = el('div', small ? 'resume-art' : 'catalog-art');
    art.setAttribute('aria-hidden', 'true');
    if (game.cover) {
      const image = el('img', 'catalog-cover'); image.src = game.cover; image.alt = ''; image.loading = 'lazy'; art.append(image);
    } else if (game.artwork === '2048') {
      if (small) art.append(el('b', '', '2048'));
      else {
        const tiles = el('div', 'cover-tiles');
        [2, 4, 8, 16, 32, 64, 128, 256, 2048].forEach(value => tiles.append(el('b', `tile-${value}`, String(value))));
        art.append(tiles);
      }
    } else art.append(el('b', 'cover-initial', game.title.slice(0, 2)));
    return art;
  }
  function card(game) {
    const article = el('article', 'catalog-card');
    const link = el('a', 'catalog-card-link'); link.href = game.url;
    link.setAttribute('aria-label', `开始游戏：${game.title}`);
    const art = artwork(game); art.append(el('span', 'card-play', '开始游戏')); link.append(art);
    const content = el('div', 'catalog-card-copy');
    content.append(el('h3', '', game.title), el('p', '', game.description));
    const tags = el('div', 'card-tags');
    (game.tags || []).forEach(tag => tags.append(el('span', '', tag)));
    content.append(tags); link.append(content);
    const footer = el('div', 'catalog-card-footer'); footer.append(el('span', 'card-category', game.category));
    const favorite = state.favorites.includes(game.id);
    const button = el('button', 'favorite-button', favorite ? '★ 已收藏' : '☆ 收藏');
    button.type = 'button'; button.dataset.favorite = game.id;
    button.setAttribute('aria-label', `${favorite ? '取消收藏' : '收藏'} ${game.title}`);
    button.setAttribute('aria-pressed', String(favorite));
    footer.append(button); article.append(link, footer); return article;
  }
  function renderResume() {
    const recentGames = state.recent.slice(0, 3).map(item => games.find(game => game.id === item.id)).filter(Boolean);
    $('resume-section').hidden = state.view !== 'all' || !recentGames.length || !!state.query || state.category !== 'all';
    $('resume-list').replaceChildren(...recentGames.map(game => {
      const link = el('a', 'resume-game'); link.href = game.url;
      const copy = el('div', 'resume-copy'); copy.append(el('strong', '', game.title), el('span', '', '继续游玩'));
      link.append(artwork(game, true), copy, el('span', 'resume-arrow', '↗')); return link;
    }));
  }
  function render() {
    const visible = selectGames(games, state);
    $('catalog-title').textContent = viewNames[state.view];
    $('catalog-subtitle').textContent = state.view === 'all' ? '挑一款喜欢的，点击就能玩。' : state.view === 'favorites' ? '喜欢的小游戏，都放在这里。' : '按最近游玩时间排列，随时接着玩。';
    $('all-count').textContent = games.length;
    $('favorite-count').textContent = state.favorites.length;
    $('recent-count').textContent = state.recent.length;
    $('available-count').textContent = `已上线 ${games.length} 款`;
    $('result-count').textContent = `${visible.length} 款游戏`;
    $('clear-search').hidden = !state.query;
    $('sort-games').closest('label').hidden = state.view === 'recent';
    document.querySelectorAll('[data-view]').forEach(button => {
      const active = button.dataset.view === state.view;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('[data-category]').forEach(button => {
      const active = button.dataset.category === state.category;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
    });
    grid.replaceChildren(...visible.map(card));
    $('empty-state').hidden = visible.length > 0;
    if (!visible.length) {
      const filtered = !!state.query.trim() || state.category !== 'all';
      $('empty-icon').textContent = filtered ? '⌕' : state.view === 'favorites' ? '☆' : '↶';
      $('empty-title').textContent = filtered ? '还没有找到这款游戏' : state.view === 'favorites' ? '把喜欢的游戏留在这里' : state.view === 'recent' ? '从第一局开始吧' : '游戏正在准备中';
      $('empty-copy').textContent = filtered ? '试试其他关键词，或清除筛选看看全部游戏。' : state.view === 'favorites' ? '在游戏卡片上点一下星星，下次就能更快找到它。' : state.view === 'recent' ? '玩过的游戏会出现在这里，方便你下次回来。' : '新的小游戏上线后，会自动出现在这里。';
    }
    renderResume();
    $('storage-warning').hidden = !storageFailed;
  }
  function reset() {
    state.view = 'all'; state.query = ''; state.category = 'all';
    $('game-search').value = ''; render();
    document.querySelector('[data-view="all"]').focus();
  }
  loadPersonal();
  ['all', ...new Set(games.map(game => game.category))].forEach(category => {
    const button = el('button', 'category-button', category === 'all' ? '全部分类' : category);
    button.type = 'button'; button.dataset.category = category; button.setAttribute('aria-pressed', 'false');
    $('categories').append(button);
  });
  document.querySelector('.view-nav').addEventListener('click', event => {
    const button = event.target.closest('[data-view]'); if (!button) return;
    state.view = button.dataset.view; state.category = 'all'; state.query = ''; $('game-search').value = ''; render();
  });
  $('categories').addEventListener('click', event => {
    const button = event.target.closest('[data-category]'); if (!button) return;
    state.category = button.dataset.category; render();
  });
  $('game-search').addEventListener('input', event => { state.query = event.target.value; render(); });
  $('clear-search').addEventListener('click', () => { state.query = ''; $('game-search').value = ''; render(); $('game-search').focus(); });
  $('sort-games').addEventListener('change', event => { state.sort = event.target.value; render(); });
  $('reset-filters').addEventListener('click', reset);
  grid.addEventListener('click', event => {
    const button = event.target.closest('[data-favorite]'); if (!button) return;
    const id = button.dataset.favorite;
    const wasFavorite = state.favorites.includes(id);
    state.favorites = wasFavorite ? state.favorites.filter(item => item !== id) : [...state.favorites, id];
    write(keys.favorites, state.favorites); render();
    $('lobby-status').textContent = `${games.find(game => game.id === id).title} ${wasFavorite ? '已取消收藏' : '已加入收藏'}`;
    const replacement = [...grid.querySelectorAll('[data-favorite]')].find(item => item.dataset.favorite === id);
    (replacement || document.querySelector(`[data-view="${state.view}"]`)).focus({ preventScroll: true });
  });
  window.addEventListener('storage', event => {
    if (!event.key || Object.values(keys).includes(event.key)) { memory.clear(); loadPersonal(); render(); }
  });
  window.addEventListener('pageshow', () => { loadPersonal(); render(); });
  render();
})();
