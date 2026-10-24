(() => {
  'use strict';
  const { parse, move, cornered } = Sokoban, levels = SOKOBAN_LEVELS;
  const $ = id => document.getElementById(id), board = $('sokoban-board');
  const key = 'little-arcade-sokoban-v1', codes = { L: 'left', R: 'right', U: 'up', D: 'down' };
  const letters = { left: 'L', right: 'R', up: 'U', down: 'D' };
  let index = 0, state, path = '', history = [], best = {}, pointer = null;
  function storageWarning() { $('save-note').textContent = '浏览器存储不可用，进度和纪录仅在当前页面保留。'; }
  function restore(saved) {
    if (Number.isInteger(saved?.level) && saved.level >= 0 && saved.level < levels.length) index = saved.level;
    for (let i = 0; i < levels.length; i++) if (Number.isSafeInteger(saved?.best?.[i]) && saved.best[i] > 0) best[i] = saved.best[i];
    state = parse(levels[index].map);
    if (typeof saved?.path !== 'string' || saved.path.length > 10000 || /[^LRUD]/.test(saved.path)) return;
    const trail = []; let replay = state;
    for (const code of saved.path) {
      const next = move(replay, codes[code]);
      if (next === replay) return;
      trail.push(replay); replay = next;
    }
    state = replay; history = trail; path = saved.path;
  }
  try { restore(JSON.parse(localStorage.getItem(key))); } catch { state = parse(levels[index].map); storageWarning(); }
  function save() { try { localStorage.setItem(key, JSON.stringify({ level: index, path, best })); } catch { storageWarning(); } }
  levels.forEach((level, i) => { const option = document.createElement('option'); option.value = i; option.textContent = `${i + 1}. ${level.name}`; $('level-picker').append(option); });
  function render() {
    board.style.setProperty('--cols', state.width); board.style.setProperty('--rows', state.height);
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < state.width * state.height; i++) {
      const cell = document.createElement('span'), wall = state.walls.includes(i), goal = state.goals.includes(i), box = state.boxes.includes(i);
      cell.className = `warehouse-cell${wall ? ' wall' : ''}${goal ? ' goal' : ''}${box ? ' has-box' : ''}${i === state.player ? ' has-player' : ''}`;
      cell.setAttribute('aria-hidden', 'true');
      if (box || i === state.player) { const item = document.createElement('i'); item.className = box ? 'crate' : 'worker'; cell.append(item); }
      fragment.append(cell);
    }
    board.replaceChildren(fragment);
    const done = state.boxes.filter(box => state.goals.includes(box)).length;
    board.setAttribute('aria-label', `推箱子，第 ${index + 1} 关，角色在第 ${Math.floor(state.player / state.width) + 1} 行第 ${state.player % state.width + 1} 列，${done} / ${state.boxes.length} 个箱子到位，已走 ${state.steps} 步`);
    $('steps').textContent = state.steps; $('best').textContent = best[index] ?? '—';
    $('level-picker').value = index; $('previous-level').disabled = index === 0; $('next-level').disabled = index === levels.length - 1;
    $('undo').disabled = !history.length; $('game-overlay').hidden = state.status !== 'won';
    $('board-info').textContent = `${levels[index].name} · ${index + 1} / ${levels.length}`;
    $('placed').textContent = `${done} / ${state.boxes.length} 箱到位`;
    $('progress').textContent = `已完成 ${Object.keys(best).length} / ${levels.length} 关`;
    $('par').textContent = `参考 ${levels[index].par} 步`;
    [...$('level-picker').options].forEach((option, i) => { option.textContent = `${i + 1}. ${levels[i].name}${best[i] ? ' ✓' : ''}`; });
    if (state.status === 'won') {
      $('overlay-title').textContent = index === levels.length - 1 ? '最后一车，也归位了' : '全部归位！';
      $('overlay-description').textContent = `${state.steps} 步，推动 ${state.pushes} 次。本关最佳 ${best[index]} 步。`;
      $('overlay-action').textContent = index === levels.length - 1 ? '回到第一关 →' : '进入下一关 →';
    }
  }
  function choose(level) {
    index = level; state = parse(levels[index].map); path = ''; history = []; save(); render();
    $('status').textContent = index === 0 ? '把木箱推到圆点上。第一关试试向右走两步。' : '先找好站位，箱子只能推，不能拉。';
  }
  function play(direction) {
    const next = move(state, direction);
    if (next === state) return;
    history.push(state); path += letters[direction]; state = next;
    if (state.status === 'won' && (!best[index] || state.steps < best[index])) best[index] = state.steps;
    save(); render();
    $('status').textContent = state.status === 'won' ? '本关完成！可以进入下一关，也可以撤销继续琢磨。' : cornered(state) ? '有箱子卡在墙角了，点撤销退回一步试试。' : `已走 ${state.steps} 步，推动 ${state.pushes} 次。`;
    if (state.status === 'won') $('overlay-action').focus({ preventScroll: true });
  }
  function undo() {
    if (!history.length) return;
    state = history.pop(); path = path.slice(0, -1); save(); render();
    $('status').textContent = '已退回一步，可以换个方向。'; board.focus({ preventScroll: true });
  }
  document.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => play(button.dataset.direction)));
  $('undo').addEventListener('click', undo); $('restart').addEventListener('click', () => choose(index));
  $('previous-level').addEventListener('click', () => choose(Math.max(0, index - 1)));
  $('next-level').addEventListener('click', () => choose(Math.min(levels.length - 1, index + 1)));
  $('level-picker').addEventListener('change', event => choose(Number(event.target.value)));
  $('overlay-action').addEventListener('click', () => { choose((index + 1) % levels.length); board.focus({ preventScroll: true }); });
  $('replay-level').addEventListener('click', () => { choose(index); board.focus({ preventScroll: true }); });
  const directions = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName) || event.target.isContentEditable) return;
    const direction = directions[event.key] || directions[event.key.toLowerCase()];
    if (direction) { event.preventDefault(); play(direction); }
    if (event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); }
  });
  board.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    pointer = { x: event.clientX, y: event.clientY, id: event.pointerId }; board.setPointerCapture(event.pointerId);
  });
  board.addEventListener('pointerup', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y; pointer = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    play(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  board.addEventListener('pointercancel', () => { pointer = null; });
  render(); $('status').textContent = path ? '已恢复上次进度，接着把箱子送回家。' : '把木箱推到圆点上。方向键 / WASD 移动，Z 撤销。';
})();
