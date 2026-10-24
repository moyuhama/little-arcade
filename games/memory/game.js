(() => {
  'use strict';
  const { levels, createGame, flip, settle } = MemoryPairs;
  const $ = id => document.getElementById(id), board = $('memory-board');
  const marks = ['☀','☾','★','♥','✿','◆','♫','☁','☂','⚑','☕','✉'];
  const names = ['太阳','月亮','星星','爱心','小花','菱形','音符','云朵','雨伞','旗子','咖啡','信封'];
  const key = 'little-arcade-memory-v1', records = {};
  let level = 'normal', state, paused = false, elapsed = 0, since = null, timer = null;
  let pending = null, deadline = 0, remaining = 900, round = 0, focusIndex = 0;
  function storageWarning() { $('save-note').textContent = '浏览器存储不可用，纪录仅在当前页面保留。'; }
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (Object.hasOwn(levels, saved?.level)) level = saved.level;
    for (const name of Object.keys(levels)) {
      const value = saved?.records?.[name];
      if (Number.isSafeInteger(value?.moves) && value.moves >= levels[name].pairs && Number.isSafeInteger(value?.ms) && value.ms >= 0) records[name] = value;
    }
  } catch { storageWarning(); }
  const format = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
  function timeMs() { return elapsed + (since === null ? 0 : performance.now() - since); }
  function showTime() { $('time').textContent = format(timeMs()); }
  function startClock() { if (since !== null) return; since = performance.now(); timer = setInterval(showTime, 250); }
  function stopClock() { elapsed = timeMs(); since = null; clearInterval(timer); timer = null; showTime(); }
  function cancelPending() { clearTimeout(pending); pending = null; }
  function save() { try { localStorage.setItem(key, JSON.stringify({ level, records })); } catch { storageWarning(); } }
  function build() {
    board.style.setProperty('--cols', state.cols); board.style.setProperty('--rows', state.cards.length / state.cols);
    board.replaceChildren(...state.cards.map((_, i) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'memory-card'; button.dataset.index = i; button.tabIndex = i === 0 ? 0 : -1;
      const symbol = document.createElement('span'); symbol.className = 'card-symbol'; symbol.setAttribute('aria-hidden', 'true');
      const number = document.createElement('small'); number.textContent = i + 1; number.setAttribute('aria-hidden', 'true');
      button.append(symbol, number); return button;
    }));
  }
  function render() {
    [...board.children].forEach((button, i) => {
      const visible = state.matched[i] || state.selected.includes(i);
      button.className = `memory-card${visible ? ' face-up' : ''}${state.matched[i] ? ' matched' : ''}`;
      button.firstElementChild.textContent = visible ? marks[state.cards[i]] : '✦';
      button.setAttribute('aria-label', `第 ${i + 1} 张，${visible ? names[state.cards[i]] + (state.matched[i] ? '，已配对' : '，已翻开') : '背面'}`);
      button.setAttribute('aria-disabled', String(paused || state.matched[i] || state.selected.includes(i) || state.status === 'settling' || state.status === 'won'));
    });
    board.inert = paused; board.setAttribute('aria-hidden', String(paused));
    $('moves').textContent = state.moves; $('pairs').textContent = `${state.pairs} / ${state.pairCount} 对`;
    $('play-state').textContent = paused ? '已暂停' : state.status === 'ready' ? '翻开第一张开始' : state.status === 'settling' ? '记住它们的位置' : state.status === 'won' ? '全部配对！' : '找到相同图案';
    $('difficulty').value = level; $('difficulty').disabled = !['ready', 'won'].includes(state.status);
    $('pause').disabled = ['ready', 'won'].includes(state.status); $('pause').textContent = paused ? '▷ 继续' : 'Ⅱ 暂停';
    $('best').textContent = records[level] ? `${records[level].moves} 次 · ${format(records[level].ms)}` : '—';
    $('game-overlay').hidden = !paused && state.status !== 'won';
    $('overlay-title').textContent = paused ? '记忆也歇一会儿' : '全部找到了！';
    $('overlay-description').textContent = paused ? '计时已暂停，卡牌也收起来了。' : `${state.moves} 次翻牌 · 用时 ${format(elapsed)}。再试试更少的次数？`;
    $('overlay-action').textContent = paused ? '继续游戏 →' : '再来一局 →';
    showTime();
  }
  function schedule() {
    cancelPending(); if (state.status !== 'settling' || paused) return;
    const token = round; deadline = performance.now() + remaining;
    pending = setTimeout(() => {
      if (token !== round || paused) return;
      pending = null; state = settle(state); remaining = 900; render();
      $('status').textContent = '这两张不一样，记住位置，再找一找。';
    }, remaining);
  }
  function fresh() {
    stopClock(); cancelPending(); round++; remaining = 900; elapsed = 0; state = createGame(level); paused = false; focusIndex = 0;
    build(); render(); $('status').textContent = '每次翻开两张，找到相同图案就配对。';
  }
  function act(index) {
    if (paused) return;
    const previous = state; state = flip(state, index); if (state === previous) return;
    if (previous.status === 'ready') startClock();
    if (state.status === 'settling') { remaining = 900; schedule(); }
    if (state.status === 'won') {
      stopClock(); const result = { moves: state.moves, ms: Math.floor(elapsed) }, record = records[level];
      if (!record || result.moves < record.moves || result.moves === record.moves && result.ms < record.ms) { records[level] = result; save(); }
      $('status').textContent = '全部配对完成！';
    } else $('status').textContent = state.pairs > previous.pairs ? '配对成功，记得真准！' : state.selected.length === 1 ? '再翻一张，找找它的伙伴。' : '两张不同，稍后会翻回背面。';
    render(); if (state.status === 'won') $('overlay-action').focus({ preventScroll: true });
  }
  function pause() {
    if (paused || ['ready', 'won'].includes(state.status)) return;
    if (pending !== null) { remaining = Math.max(0, deadline - performance.now()); cancelPending(); }
    stopClock(); paused = true; render(); $('status').textContent = '已暂停，回来后点击继续。';
  }
  function resume() {
    if (!paused || document.hidden) return;
    paused = false; startClock(); schedule(); render(); board.children[focusIndex]?.focus({ preventScroll: true });
    $('status').textContent = '接着找它们的伙伴吧。';
  }
  board.addEventListener('click', event => {
    const button = event.target.closest('[data-index]'); if (!button) return;
    focusIndex = Number(button.dataset.index); [...board.children].forEach((cell, i) => { cell.tabIndex = i === focusIndex ? 0 : -1; }); act(focusIndex);
  });
  board.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const shifts = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -state.cols, ArrowDown: state.cols };
    if (!Object.hasOwn(shifts, event.key)) return;
    event.preventDefault();
    const current = Number(event.target.closest('[data-index]')?.dataset.index); if (!Number.isInteger(current)) return;
    if (event.key === 'ArrowLeft' && current % state.cols === 0 || event.key === 'ArrowRight' && current % state.cols === state.cols - 1) return;
    focusIndex = Math.max(0, Math.min(state.cards.length - 1, current + shifts[event.key]));
    [...board.children].forEach((cell, i) => { cell.tabIndex = i === focusIndex ? 0 : -1; }); board.children[focusIndex].focus();
  });
  $('difficulty').addEventListener('change', event => { level = event.target.value; fresh(); save(); });
  $('restart').addEventListener('click', fresh); $('pause').addEventListener('click', () => paused ? resume() : pause());
  $('overlay-action').addEventListener('click', () => paused ? resume() : fresh());
  document.addEventListener('arcade:pause', pause); document.addEventListener('keydown', event => { if (event.key === 'Escape') pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); }); window.addEventListener('blur', pause); window.addEventListener('pagehide', pause);
  fresh();
})();
