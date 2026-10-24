(() => {
  'use strict';
  const { createGame, turn, step } = SnakeGame;
  const $ = id => document.getElementById(id);
  const canvas = $('snake-board');
  const context = canvas.getContext('2d');
  const speeds = {
    slow: { label: '悠闲', delay: 230 },
    normal: { label: '标准', delay: 150 },
    fast: { label: '挑战', delay: 95 }
  };
  const storageKey = 'little-arcade-snake-v1';
  const records = { slow: 0, normal: 0, fast: 0 };
  let speed = 'slow', state = createGame(), mode = 'ready', timer = null, pointer = null;
  let storageFailed = false;

  function storageWarning() {
    storageFailed = true;
    $('save-note').textContent = '浏览器存储不可用，最高分仅在本次页面中保留。';
  }
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && Object.hasOwn(speeds, saved.speed)) speed = saved.speed;
    for (const key of Object.keys(records)) {
      const value = saved?.records?.[key];
      if (Number.isSafeInteger(value) && value >= 0) records[key] = value;
    }
  } catch { storageWarning(); }

  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify({ speed, records })); }
    catch { storageWarning(); }
  }

  function roundedRect(x, y, width, height, radius, color) {
    context.fillStyle = color;
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.fill();
  }

  function draw() {
    const cell = canvas.width / state.size;
    const point = index => [(index % state.size + .5) * cell, (Math.floor(index / state.size) + .5) * cell];
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#f8f6fc';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#e1daed';
    for (let y = 0; y < state.size; y++) {
      for (let x = 0; x < state.size; x++) {
        context.beginPath();
        context.arc((x + .5) * cell, (y + .5) * cell, 1.6, 0, Math.PI * 2);
        context.fill();
      }
    }
    if (state.food !== null) {
      const [x, y] = point(state.food);
      context.fillStyle = '#efa98d';
      context.beginPath(); context.arc(x, y + 2, cell * .32, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#fbe1d4';
      context.beginPath(); context.arc(x - 5, y - 3, 4, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#86b39b';
      context.beginPath(); context.ellipse(x + 5, y - 16, 8, 4, -.6, 0, Math.PI * 2); context.fill();
    }
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#a08ad5';
    context.lineWidth = cell * .68;
    context.beginPath();
    state.snake.forEach((index, i) => {
      const [x, y] = point(index);
      if (i === 0) context.moveTo(x, y); else context.lineTo(x, y);
    });
    context.stroke();
    state.snake.slice(1).forEach((index, i) => {
      const [x, y] = point(index);
      roundedRect(x - cell * .33, y - cell * .33, cell * .66, cell * .66, cell * .19, i % 2 ? '#a08ad5' : '#a893da');
    });
    const [hx, hy] = point(state.snake[0]);
    context.save();
    context.translate(hx, hy);
    context.rotate({ right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[state.direction]);
    roundedRect(-cell * .4, -cell * .39, cell * .8, cell * .78, cell * .23, '#6554df');
    for (const y of [-cell * .19, cell * .19]) {
      context.fillStyle = 'white';
      context.beginPath(); context.ellipse(cell * .15, y, 6, 6.5, 0, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#383050';
      context.beginPath(); context.arc(cell * .19, y, 3, 0, Math.PI * 2); context.fill();
    }
    context.restore();
    const directionName = { up: '上', down: '下', left: '左', right: '右' }[state.direction];
    const foodDescription = state.food === null ? '棋盘已填满' : `果子在第 ${Math.floor(state.food / state.size) + 1} 行第 ${state.food % state.size + 1} 列`;
    canvas.setAttribute('aria-label', `贪吃蛇棋盘，长度 ${state.snake.length}，朝${directionName}，蛇头在第 ${Math.floor(state.snake[0] / state.size) + 1} 行第 ${state.snake[0] % state.size + 1} 列，${foodDescription}`);
  }

  function updateScores() {
    $('score').textContent = state.score;
    $('best').textContent = records[speed];
    $('length').textContent = state.snake.length;
  }

  function render() {
    draw();
    updateScores();
    $('play-state').textContent = { ready: '准备出发', running: '正在游玩', paused: '休息一下', ended: '本局结束' }[mode];
    $('play-state').dataset.mode = mode;
    $('pause').disabled = mode === 'ready' || mode === 'ended';
    $('pause').textContent = mode === 'paused' ? '▷ 继续' : 'Ⅱ 暂停';
    $('speed-picker').disabled = mode === 'running' || mode === 'paused';
    $('speed-note').textContent = $('speed-picker').disabled ? `本局节奏：${speeds[speed].label}。重新开始后可切换速度。` : '每档单独记录最高分，开始前可切换。';
    document.querySelectorAll('[name="speed"]').forEach(input => { input.checked = input.value === speed; });
    $('game-overlay').hidden = mode === 'running';
    if (mode === 'running') return;
    const won = state.status === 'won';
    $('overlay-icon').textContent = mode === 'ready' ? '↗' : mode === 'paused' ? 'Ⅱ' : won ? '✦' : '↻';
    $('overlay-title').textContent = mode === 'ready' ? '准备好出发了吗？' : mode === 'paused' ? '快乐，暂停一下' : won ? '整片果园，都被你承包了！' : '这局，吃得很开心';
    $('overlay-description').textContent = mode === 'ready' ? '吃到小果子，让快乐长一点。' : mode === 'paused' ? '小蛇在等你，准备好再继续。' : `${state.reason === 'wall' ? '碰到围墙啦' : state.reason === 'self' ? '碰到自己啦' : '填满棋盘啦'} · 本局 ${state.score} 分`;
    $('overlay-action').textContent = mode === 'ready' ? '开始游戏 →' : mode === 'paused' ? '继续游戏 →' : '再来一局 →';
    $('overlay-hint').textContent = mode === 'paused' ? '空格也可以继续，回来后不会自动开跑' : mode === 'ended' ? `${speeds[speed].label}最高 ${records[speed]} 分 · 每一局都是新开始` : '方向键 / WASD / 触屏滑动';
  }

  function stopTimer() { clearTimeout(timer); timer = null; }

  function tick() {
    timer = null;
    if (mode !== 'running') return;
    const oldScore = state.score;
    state = step(state);
    if (state.score > records[speed]) { records[speed] = state.score; save(); }
    if (state.status !== 'playing') {
      mode = 'ended'; render();
      $('status').textContent = state.status === 'won' ? `填满棋盘，挑战成功！本局 ${state.score} 分。` : `本局结束，获得 ${state.score} 分。再来一局吧！`;
      $('overlay-action').focus({ preventScroll: true });
      return;
    }
    draw(); updateScores();
    if (state.score > oldScore) $('status').textContent = `吃到果子，加 10 分！已经吃掉 ${state.score / 10} 颗。`;
    timer = setTimeout(tick, speeds[speed].delay);
  }

  function start() {
    if (document.hidden) return;
    if (mode === 'ended' || mode === 'ready') state = createGame();
    stopTimer();
    mode = 'running'; pointer = null;
    render();
    $('status').textContent = '出发！朝果子的方向，慢慢变长。';
    canvas.focus({ preventScroll: true });
    timer = setTimeout(tick, speeds[speed].delay);
  }

  function pause(message = '已暂停，准备好后再继续。') {
    if (mode !== 'running') return;
    stopTimer(); mode = 'paused'; pointer = null;
    state = { ...state, turns: [] };
    render(); $('status').textContent = message;
  }

  function restart() {
    stopTimer(); mode = 'ready'; pointer = null; state = createGame();
    render(); $('status').textContent = '新的一局，可以先换个节奏。';
    $('overlay-action').focus({ preventScroll: true });
  }

  function steer(direction) {
    if (mode !== 'running') return;
    state = turn(state, direction);
  }

  $('overlay-action').addEventListener('click', start);
  document.addEventListener('arcade:pause', () => pause('查看玩法时已暂停，关闭说明后手动继续。'));
  $('pause').addEventListener('click', () => { if (mode === 'paused') start(); else pause(); });
  $('restart').addEventListener('click', restart);
  $('speed-picker').addEventListener('change', event => {
    if (!Object.hasOwn(speeds, event.target.value) || mode === 'running' || mode === 'paused') return;
    speed = event.target.value;
    mode = 'ready'; state = createGame(); save(); render();
    $('status').textContent = `已选择${speeds[speed].label}，点击开始游戏。`;
  });
  document.querySelectorAll('[data-direction]').forEach(button => {
    button.addEventListener('click', () => steer(button.dataset.direction));
  });
  const directions = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable) return;
    if (event.key === 'Escape') { pause(); return; }
    if (event.code === 'Space' && !event.target.closest('button, a')) {
      event.preventDefault();
      if (event.repeat) return;
      if (mode === 'running') pause(); else start();
      return;
    }
    const direction = directions[event.key] || directions[event.key.toLowerCase()];
    if (direction && mode === 'running') {
      event.preventDefault();
      if (!event.repeat) steer(direction);
    }
  });
  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || mode !== 'running') return;
    pointer = { x: event.clientX, y: event.clientY, id: event.pointerId };
    canvas.setPointerCapture(event.pointerId);
  });
  // Turn as soon as a swipe crosses the threshold; the player needn't lift their finger.
  canvas.addEventListener('pointermove', event => {
    if (!pointer || event.pointerId !== pointer.id) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    pointer = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });
  const releasePointer = () => { pointer = null; };
  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);
  canvas.addEventListener('lostpointercapture', releasePointer);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause('页面已切到后台，已自动暂停。回来后点击继续。');
  });
  window.addEventListener('blur', () => pause('已离开游戏窗口，已自动暂停。准备好后继续。'));
  window.addEventListener('pagehide', () => { pause(); stopTimer(); });
  if (!context) {
    $('overlay-title').textContent = '暂时无法绘制棋盘';
    $('overlay-description').textContent = '请使用支持 Canvas 的浏览器打开。';
    $('overlay-action').disabled = true; $('restart').disabled = true; $('speed-picker').disabled = true;
    return;
  }
  render();
  if (storageFailed) storageWarning();
})();
