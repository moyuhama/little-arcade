(() => {
  'use strict';
  const { createGame, reveal, toggleFlag, levels } = Minesweeper;
  const $ = id => document.getElementById(id), board = $('mine-board');
  const key = 'little-arcade-minesweeper-v1', records = { easy: null, normal: null, hard: null };
  let level = 'easy', state, paused = false, flagMode = false, inspecting = false;
  let elapsed = 0, runningSince = null, timer = null, focusIndex = 0;
  function storageWarning() { $('save-note').textContent = '浏览器存储不可用，纪录仅在当前页面保留。'; }
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (Object.hasOwn(levels, saved?.level)) level = saved.level;
    for (const name of Object.keys(records)) {
      const value = saved?.records?.[name];
      if (Number.isSafeInteger(value) && value >= 0) records[name] = value;
    }
  } catch { storageWarning(); }
  function save() {
    try { localStorage.setItem(key, JSON.stringify({ level, records })); } catch { storageWarning(); }
  }
  function timeMs() { return elapsed + (runningSince === null ? 0 : performance.now() - runningSince); }
  function showTime() { $('time').textContent = Math.floor(timeMs() / 1000); }
  function stopClock() {
    elapsed = timeMs(); runningSince = null; clearInterval(timer); timer = null; showTime();
  }
  function startClock() {
    if (runningSince !== null) return;
    runningSince = performance.now(); timer = setInterval(showTime, 250);
  }
  function buildBoard() {
    const cells = state.cells.map((_, i) => {
      const cell = document.createElement('button'); cell.type = 'button'; cell.className = 'mine-cell';
      cell.dataset.index = i; cell.tabIndex = i === focusIndex ? 0 : -1; return cell;
    });
    board.style.setProperty('--cols', state.cols); board.replaceChildren(...cells);
  }
  function render() {
    const ended = state.status === 'won' || state.status === 'lost';
    [...board.children].forEach((button, i) => {
      const cell = state.cells[i], visibleMine = ended && cell.mine;
      const wrong = ended && cell.flag && !cell.mine;
      button.className = `mine-cell${cell.open ? ' open' : ''}${cell.flag ? ' flagged' : ''}${visibleMine ? ' mine' : ''}${cell.mine && cell.open ? ' exploded' : ''}${wrong ? ' wrong' : ''}`;
      button.textContent = wrong ? '×' : visibleMine ? '✹' : cell.flag ? '⚑' : cell.open && cell.count ? cell.count : '';
      button.dataset.count = cell.open && !cell.mine ? cell.count : '';
      const label = wrong ? '插旗错误' : visibleMine ? '地雷' : cell.flag ? '已插旗' : cell.open ? (cell.count ? `周围 ${cell.count} 颗雷` : '空白') : '未打开';
      button.setAttribute('aria-label', `第 ${Math.floor(i / state.cols) + 1} 行第 ${i % state.cols + 1} 列，${label}`);
    });
    board.inert = paused;
    board.setAttribute('aria-hidden', String(paused));
    $('remaining').textContent = state.mines - state.flags;
    $('best').textContent = records[level] === null ? '—' : `${records[level]} 秒`;
    $('difficulty').value = level;
    $('difficulty').disabled = state.status === 'playing';
    $('pause').disabled = state.status !== 'playing';
    $('pause').textContent = paused ? '▷ 继续' : 'Ⅱ 暂停';
    $('flag-mode').setAttribute('aria-pressed', String(flagMode));
    $('flag-mode').textContent = flagMode ? '⚑ 插旗中 · 切回挖开' : '⚑ 插旗模式';
    $('flag-mode').disabled = ended || paused;
    $('board-info').textContent = `${state.mines} 颗雷 · ${flagMode ? '点击格子插旗' : '首点及周围安全'}`;
    $('play-state').textContent = paused ? '已暂停' : { ready: '点击一格开始', playing: '仔细找线索', won: '全部排除！', lost: '踩到雷啦' }[state.status];
    $('game-overlay').hidden = !paused && (!ended || inspecting);
    if (paused || ended) {
      $('overlay-title').textContent = paused ? '休息一下' : state.status === 'won' ? '漂亮，全部排除！' : '差一点，再试一次';
      $('overlay-description').textContent = paused ? '计时已暂停，棋盘也暂时收起来。' : state.status === 'won' ? `用时 ${Math.floor(elapsed / 1000)} 秒，你找到了所有安全格。` : `已打开 ${state.opened} 格，点击「查看棋盘」复盘。`;
      $('overlay-action').textContent = paused ? '继续游戏 →' : '再来一局 →';
      $('inspect-board').hidden = paused;
    }
    showTime();
  }
  function fresh() {
    stopClock(); elapsed = 0; state = createGame(level); paused = false; inspecting = false; flagMode = false; focusIndex = 0;
    buildBoard(); render(); $('status').textContent = '第一格和周围都安全，放心点开。';
  }
  function act(index, flag = flagMode) {
    if (paused || state.status === 'won' || state.status === 'lost') return;
    const previous = state;
    state = flag ? toggleFlag(state, index) : reveal(state, index);
    if (state === previous) return;
    if (previous.status === 'ready' && state.status !== 'ready') startClock();
    if (state.status === 'won' || state.status === 'lost') {
      stopClock();
      if (state.status === 'won') {
        const seconds = Math.floor(elapsed / 1000);
        if (records[level] === null || seconds < records[level]) { records[level] = seconds; save(); }
      }
      $('status').textContent = state.status === 'won' ? `挑战成功！用时 ${Math.floor(elapsed / 1000)} 秒。` : '踩到雷了，本局结束。';
    } else $('status').textContent = flag ? (state.cells[index].flag ? '已插旗。' : '已取消旗子。') : `已打开 ${state.opened} / ${state.cells.length - state.mines} 个安全格。`;
    render();
    if (state.status === 'won' || state.status === 'lost') $('overlay-action').focus({ preventScroll: true });
  }
  function pause() {
    if (state.status !== 'playing' || paused) return;
    stopClock(); paused = true; render(); $('status').textContent = '已暂停，点击继续后恢复计时。';
  }
  function resume() {
    if (!paused || document.hidden) return;
    paused = false; startClock(); render();
    board.children[focusIndex]?.focus({ preventScroll: true });
    $('status').textContent = '继续找线索吧。';
  }
  board.addEventListener('click', event => {
    const button = event.target.closest('[data-index]'); if (!button) return;
    focusIndex = Number(button.dataset.index);
    [...board.children].forEach((cell, i) => { cell.tabIndex = i === focusIndex ? 0 : -1; });
    act(focusIndex);
  });
  board.addEventListener('contextmenu', event => {
    const button = event.target.closest('[data-index]'); if (!button) return;
    event.preventDefault(); act(Number(button.dataset.index), true);
  });
  board.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const button = event.target.closest('[data-index]'); if (!button) return;
    let index = Number(button.dataset.index);
    const changes = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -state.cols, ArrowDown: state.cols };
    if (Object.hasOwn(changes, event.key)) {
      event.preventDefault();
      if ((event.key === 'ArrowLeft' && index % state.cols === 0) || (event.key === 'ArrowRight' && index % state.cols === state.cols - 1)) return;
      index = Math.min(state.cells.length - 1, Math.max(0, index + changes[event.key]));
      board.children[focusIndex].tabIndex = -1; focusIndex = index;
      board.children[index].tabIndex = 0; board.children[index].focus();
    } else if (event.key.toLowerCase() === 'f') { event.preventDefault(); act(index, true); }
  });
  $('flag-mode').addEventListener('click', () => { flagMode = !flagMode; render(); });
  $('difficulty').addEventListener('change', event => { level = event.target.value; fresh(); save(); });
  $('restart').addEventListener('click', fresh);
  $('pause').addEventListener('click', () => paused ? resume() : pause());
  $('overlay-action').addEventListener('click', () => paused ? resume() : fresh());
  $('inspect-board').addEventListener('click', () => { inspecting = true; render(); board.children[focusIndex]?.focus({ preventScroll: true }); });
  document.addEventListener('arcade:pause', pause);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('blur', pause);
  window.addEventListener('pagehide', pause);
  fresh();
})();
