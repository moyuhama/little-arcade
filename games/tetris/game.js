(() => {
  'use strict';
  const { COLS, ROWS, piece, blocks, createGame, move, rotate, ghost, lock, softDrop, hardDrop } = Tetris;
  const $ = id => document.getElementById(id), canvas = $('tetris-board'), ctx = canvas.getContext('2d');
  const preview = $('next-piece'), nextCtx = preview.getContext('2d');
  const colors = { I: '#7ebac9', O: '#e4bb77', T: '#a88ad0', J: '#8299c9', L: '#e6a285', S: '#8ebaac', Z: '#d78ea5' };
  const key = 'little-arcade-tetris-best-v1';
  let state = createGame(), mode = 'ready', best = 0, frameId = null, lastTime = null;
  let fallTime = 0, lockTime = 0, resets = 0, heldTimer = null, repeatTimer = null;
  function storageWarning() { $('save-note').textContent = '浏览器存储不可用，最高分仅在当前页面保留。'; }
  try { const value = Number(localStorage.getItem(key)); if (Number.isSafeInteger(value) && value >= 0) best = value; } catch { storageWarning(); }
  if (!ctx || !nextCtx) { $('overlay-title').textContent = '浏览器暂不支持绘制棋盘'; $('overlay-action').disabled = true; return; }
  function square(context, x, y, size, type, outline = false) {
    context.beginPath(); context.roundRect(x + 1.5, y + 1.5, size - 3, size - 3, 3);
    if (outline) { context.strokeStyle = colors[type]; context.lineWidth = 2; context.stroke(); }
    else { context.fillStyle = colors[type]; context.fill(); context.fillStyle = '#ffffff35'; context.fillRect(x + 5, y + 4, size - 10, 3); }
  }
  function draw() {
    ctx.fillStyle = '#f8f6fc'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      ctx.fillStyle = '#eee9f5'; ctx.fillRect(x * 30 + 1, y * 30 + 1, 28, 28);
      const type = state.board[y * COLS + x]; if (type) square(ctx, x * 30, y * 30, 30, type);
    }
    if (state.status === 'playing') {
      ctx.globalAlpha = .65;
      blocks(ghost(state)).forEach(({ x, y }) => { if (y >= 0) square(ctx, x * 30, y * 30, 30, state.active.type, true); });
      ctx.globalAlpha = 1;
      blocks(state.active).forEach(({ x, y }) => { if (y >= 0) square(ctx, x * 30, y * 30, 30, state.active.type); });
    }
    nextCtx.clearRect(0, 0, 120, 120);
    const next = piece(state.queue[0]), cells = blocks({ ...next, x: 0, y: 0 });
    const minX = Math.min(...cells.map(c => c.x)), maxX = Math.max(...cells.map(c => c.x));
    const minY = Math.min(...cells.map(c => c.y)), maxY = Math.max(...cells.map(c => c.y));
    cells.forEach(({ x, y }) => square(nextCtx, (x - minX) * 24 + (120 - (maxX - minX + 1) * 24) / 2, (y - minY) * 24 + (120 - (maxY - minY + 1) * 24) / 2, 24, next.type));
    preview.setAttribute('aria-label', `下一块：${next.type} 形`);
    canvas.setAttribute('aria-label', `俄罗斯方块棋盘，${state.active.type} 形，第 ${state.level} 级，已消除 ${state.lines} 行，得分 ${state.score}`);
  }
  function render() {
    if (state.score > best) { best = state.score; try { localStorage.setItem(key, best); } catch { storageWarning(); } }
    $('score').textContent = state.score; $('best').textContent = best; $('level').textContent = state.level; $('lines').textContent = state.lines;
    $('pause').disabled = mode === 'ready' || mode === 'ended'; $('pause').textContent = mode === 'paused' ? '▷ 继续' : 'Ⅱ 暂停';
    $('game-overlay').hidden = mode === 'running';
    $('play-state').textContent = { ready: '准备开局', running: '留好下一块的位置', paused: '已暂停', ended: '本局结束' }[mode];
    $('overlay-title').textContent = mode === 'paused' ? '方块等你回来' : mode === 'ended' ? '这局拼得不错' : '一行一行，消掉烦恼';
    $('overlay-description').textContent = mode === 'paused' ? '准备好后继续，方块不会自动落下。' : mode === 'ended' ? `${state.score} 分 · 消除了 ${state.lines} 行` : '排满一行就消除，看看能坚持到第几级。';
    $('overlay-action').textContent = mode === 'paused' ? '继续游戏 →' : mode === 'ended' ? '再来一局 →' : '开始游戏 →';
    document.querySelectorAll('[data-action]').forEach(button => { button.disabled = mode !== 'running'; });
    draw();
  }
  function release() { clearTimeout(heldTimer); clearInterval(repeatTimer); heldTimer = repeatTimer = null; }
  function stop() { cancelAnimationFrame(frameId); frameId = null; lastTime = null; release(); }
  function afterLock() {
    fallTime = lockTime = resets = 0;
    if (state.status === 'lost') { mode = 'ended'; stop(); $('status').textContent = '方块堆到顶了，重新开局再试试。'; }
    else $('status').textContent = state.lastClear ? `消除 ${state.lastClear} 行！当前第 ${state.level} 级。` : '空心方块是落点，空格可以直接落下。';
    render();
    if (mode === 'ended') $('overlay-action').focus({ preventScroll: true });
  }
  function frame(time) {
    if (mode !== 'running') return;
    const dt = lastTime === null ? 0 : Math.min(time - lastTime, 100); lastTime = time;
    fallTime += dt;
    const interval = Math.max(85, 850 * .8 ** (state.level - 1));
    if (fallTime >= interval) { state = move(state, 0, 1); fallTime %= interval; }
    if (move(state, 0, 1) === state) lockTime += dt; else lockTime = 0;
    if (lockTime >= 500) { state = lock(state); afterLock(); } else draw();
    if (mode === 'running') frameId = requestAnimationFrame(frame);
  }
  function start() {
    if (document.hidden) return;
    if (mode === 'ended') { state = createGame(); fallTime = lockTime = resets = 0; }
    stop(); mode = 'running'; render(); canvas.focus({ preventScroll: true });
    $('status').textContent = '左右移动，向上旋转；空格直接落下。'; frameId = requestAnimationFrame(frame);
  }
  function pause() {
    if (mode !== 'running') return;
    mode = 'paused'; stop(); render(); $('status').textContent = '已暂停，点击继续后恢复。';
  }
  function restart() { stop(); state = createGame(); mode = 'ready'; fallTime = lockTime = resets = 0; render(); $('status').textContent = '新的一局，准备好了就开始。'; }
  function act(action) {
    if (mode !== 'running') return;
    const before = state, grounded = move(state, 0, 1) === state;
    if (action === 'drop') { release(); state = hardDrop(state); afterLock(); return; }
    if (action === 'left' || action === 'right') state = move(state, action === 'left' ? -1 : 1, 0);
    else if (action === 'rotate') state = rotate(state);
    else if (action === 'down') state = softDrop(state);
    if (state === before) return;
    if (action === 'down') { fallTime = 0; lockTime = 0; }
    else if (grounded && resets < 15) { lockTime = 0; resets++; }
    render();
  }
  document.querySelectorAll('[data-action]').forEach(button => {
    const action = button.dataset.action;
    button.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || mode !== 'running') return;
      event.preventDefault(); release(); button.setPointerCapture(event.pointerId); act(action);
      if (['left', 'right', 'down'].includes(action)) heldTimer = setTimeout(() => { repeatTimer = setInterval(() => act(action), 70); }, 200);
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, release);
    button.addEventListener('click', event => { if (event.detail === 0) act(action); });
  });
  const actions = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'rotate', ArrowDown: 'down', a: 'left', d: 'right', w: 'rotate', s: 'down' };
  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName) || event.target.isContentEditable) return;
    const action = actions[event.key] || actions[event.key.toLowerCase()];
    if (action) { event.preventDefault(); if (action !== 'rotate' || !event.repeat) act(action); }
    if (event.key === 'Escape') pause();
    if (event.key.toLowerCase() === 'p' && !event.repeat) { if (mode === 'running') pause(); else if (mode === 'paused') start(); }
    if (event.code === 'Space' && !event.target.closest('button, a')) {
      event.preventDefault(); if (event.repeat) return;
      if (mode === 'running') act('drop'); else start();
    }
  });
  $('overlay-action').addEventListener('click', start);
  $('pause').addEventListener('click', () => mode === 'paused' ? start() : pause());
  $('restart').addEventListener('click', restart);
  document.addEventListener('arcade:pause', pause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('blur', pause); window.addEventListener('pagehide', () => { pause(); stop(); });
  render(); $('status').textContent = '七种方块轮流登场，每消除 10 行升一级。';
})();
