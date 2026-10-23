(() => {
  'use strict';
  const { move, spawn, canMove, validState } = Game2048;
  const $ = id => document.getElementById(id);
  const boardElement = $('board'), overlay = $('overlay');
  const stateKey = 'little-arcade-2048-v1', bestKey = 'little-arcade-2048-best';
  let state, previous = null, best = 0, overlayMode = '', pointer = null;
  const clone = value => ({ board: value.board.slice(), score: value.score, continued: value.continued });
  function storageUnavailable() { $('save-note').textContent = '浏览器存储不可用，本局仍可正常游玩'; }
  try {
    const saved = JSON.parse(localStorage.getItem(stateKey));
    if (validState(saved) && saved.board.some(Boolean)) state = clone(saved);
    const record = Number(localStorage.getItem(bestKey));
    if (Number.isSafeInteger(record) && record >= 0) best = record;
  } catch { storageUnavailable(); }
  function save() {
    best = Math.max(best, state.score);
    try { localStorage.setItem(stateKey, JSON.stringify(state)); localStorage.setItem(bestKey, String(best)); }
    catch { storageUnavailable(); }
  }
  function render(spawned = -1, merged = []) {
    const fragment = document.createDocumentFragment();
    state.board.forEach((value, index) => {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.setAttribute('aria-label', `第 ${Math.floor(index / 4) + 1} 行第 ${index % 4 + 1} 列：${value || '空'}`);
      if (value) {
        cell.textContent = value; cell.dataset.value = value;
        cell.classList.add(value <= 2048 ? `tile-${value}` : 'tile-super');
      }
      if (index === spawned) cell.classList.add('spawn');
      if (merged.includes(index)) cell.classList.add('merge');
      fragment.append(cell);
    });
    boardElement.replaceChildren(fragment);
    $('score').textContent = state.score; $('best').textContent = best;
    $('undo').disabled = !previous;
    const won = state.board.some(value => value >= 2048) && !state.continued;
    const lost = !canMove(state.board);
    const nextMode = won ? 'won' : lost ? 'lost' : '';
    overlay.hidden = !nextMode;
    if (nextMode) {
      $('overlay-title').textContent = won ? '2048，做到了！' : '这局很精彩';
      $('overlay-description').textContent = won ? '你的坚持，合成了一个小小的胜利。' : `本局拿下 ${state.score} 分，下一局会更好。`;
      $('overlay-main').textContent = won ? '继续挑战' : '再来一局';
      $('overlay-secondary').textContent = won ? '新的一局' : '撤销上一步';
      $('overlay-secondary').hidden = !won && !previous;
      if (overlayMode !== nextMode) $('overlay-main').focus({ preventScroll: true });
    }
    overlayMode = nextMode;
  }
  function fresh() {
    state = { board: Array(16).fill(0), score: 0, continued: false }; previous = null;
    spawn(state.board); spawn(state.board); save(); render();
    $('status').textContent = '新的一局，向 2048 出发！';
  }
  function play(direction) {
    if (overlayMode) return;
    const result = move(state.board, direction);
    if (!result.changed) { $('status').textContent = '这个方向移不动，换个方向试试。'; return; }
    previous = clone(state); state.board = result.board; state.score += result.score;
    const spawned = spawn(state.board); save(); render(spawned, result.merged);
    $('status').textContent = result.score ? `合并成功，加 ${result.score} 分！` : '';
  }
  function undo() {
    if (!previous) return;
    state = clone(previous); previous = null; save(); render();
    $('status').textContent = '已撤销上一步。'; boardElement.focus({ preventScroll: true });
  }
  $('restart').addEventListener('click', fresh);
  $('undo').addEventListener('click', undo);
  $('overlay-main').addEventListener('click', () => {
    if (overlayMode === 'won') { state.continued = true; save(); render(); }
    else fresh();
    if (!overlayMode) boardElement.focus({ preventScroll: true });
  });
  $('overlay-secondary').addEventListener('click', () => { if (overlayMode === 'won') fresh(); else undo(); });
  document.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => play(button.dataset.direction)));
  const directions = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
  document.addEventListener('keydown', event => {
    if (overlayMode && event.key === 'Tab') {
      const buttons = [...overlay.querySelectorAll('button')].filter(button => !button.hidden);
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable) return;
    const direction = directions[event.key] || directions[event.key.toLowerCase()];
    if (direction) { event.preventDefault(); play(direction); }
  });
  boardElement.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || overlayMode) return;
    pointer = { x: event.clientX, y: event.clientY, id: event.pointerId };
    boardElement.setPointerCapture(event.pointerId);
  });
  boardElement.addEventListener('pointerup', event => {
    if (!pointer || event.pointerId !== pointer.id) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    pointer = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    play(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  boardElement.addEventListener('pointercancel', () => { pointer = null; });
  if (state) { save(); render(); } else fresh();
})();
