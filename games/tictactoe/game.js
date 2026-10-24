(() => {
  'use strict';
  const { createGame, play, chooseMove } = TicTacToe;
  const $ = id => document.getElementById(id), board = $('ttt-board'), help = $('game-help');
  const key = 'little-arcade-tictactoe-v1', records = {};
  let mode = 'solo', difficulty = 'hard', human = 'X', state = createGame(), history = [], recorded = null;
  let aiTimer = null, generation = 0, focusIndex = 0;
  function storageWarning() { $('save-note').textContent = '浏览器存储不可用，战绩仅在当前页面保留。'; }
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (['solo', 'local'].includes(saved?.mode)) mode = saved.mode;
    if (['easy', 'hard'].includes(saved?.difficulty)) difficulty = saved.difficulty;
    if (['X', 'O'].includes(saved?.human)) human = saved.human;
    for (const name of ['local', 'solo:easy:X', 'solo:easy:O', 'solo:hard:X', 'solo:hard:O']) {
      const entry = saved?.records?.[name];
      if (entry && ['X', 'O', 'draw'].every(side => Number.isSafeInteger(entry[side]) && entry[side] >= 0)) records[name] = { X: entry.X, O: entry.O, draw: entry.draw };
    }
  } catch { storageWarning(); }
  const recordKey = () => mode === 'local' ? 'local' : `solo:${difficulty}:${human}`;
  const tally = () => records[recordKey()] ||= { X: 0, O: 0, draw: 0 };
  const aiTurn = () => mode === 'solo' && state.status === 'playing' && state.turn !== human;
  const owner = side => mode === 'local' ? `${side} 方` : side === human ? `你（${side}）` : `电脑（${side}）`;
  const canUndo = () => mode === 'local' ? history.length > 0 : history.some(position => position.turn === human);
  function save() { try { localStorage.setItem(key, JSON.stringify({ mode, difficulty, human, records })); } catch { storageWarning(); } }
  function cancelAI() { clearTimeout(aiTimer); aiTimer = null; generation++; }
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('button'); cell.type = 'button'; cell.dataset.index = i; cell.className = 'ttt-cell'; cell.tabIndex = i === 0 ? 0 : -1; board.append(cell);
  }
  function render() {
    const stats = tally(), ended = state.status !== 'playing';
    [...board.children].forEach((cell, i) => {
      cell.textContent = state.board[i] === 'X' ? '×' : state.board[i] === 'O' ? '○' : '';
      cell.className = `ttt-cell${state.board[i] ? ` mark-${state.board[i].toLowerCase()}` : ''}${state.line.includes(i) ? ' winning' : ''}`;
      cell.setAttribute('aria-label', `第 ${Math.floor(i / 3) + 1} 行第 ${i % 3 + 1} 列，${state.board[i] || '空位'}`);
      cell.setAttribute('aria-disabled', String(ended || !!state.board[i] || aiTurn()));
    });
    $('x-score').textContent = stats.X; $('o-score').textContent = stats.O; $('draws').textContent = stats.draw;
    $('x-label').textContent = `${owner('X')}胜`; $('o-label').textContent = `${owner('O')}胜`;
    $('turn').textContent = ended ? state.status === 'draw' ? '平局，也是一场好棋' : `${owner(state.winner)}赢了！` : aiTurn() ? '电脑正在想下一步…' : `${owner(state.turn)}落子`;
    $('turn').classList.toggle('computer-turn', aiTurn());
    $('undo').disabled = !canUndo(); $('play-again').hidden = !ended;
    $('mode').value = mode; $('difficulty').value = difficulty; $('side').value = human;
    $('solo-settings').hidden = mode !== 'solo';
    $('record-caption').textContent = mode === 'local' ? '同屏双人战绩' : `${difficulty === 'hard' ? '认真' : '轻松'}模式 · 你执 ${human} 的战绩`;
  }
  function scheduleAI() {
    cancelAI();
    if (!aiTurn() || document.hidden || help.open) return;
    const token = generation;
    aiTimer = setTimeout(() => {
      if (token !== generation || !aiTurn() || document.hidden || help.open) return;
      aiTimer = null; apply(chooseMove(state, difficulty));
    }, 350);
  }
  function apply(index) {
    const next = play(state, index); if (next === state) return;
    history.push(state); state = next;
    if (state.status !== 'playing') {
      const result = state.status === 'draw' ? 'draw' : state.winner;
      tally()[result]++; recorded = { key: recordKey(), result }; save();
      $('status').textContent = state.status === 'draw' ? '九格填满，双方都守住了。再来一局？' : `${owner(state.winner)}连成一线，本局结束。`;
    } else $('status').textContent = aiTurn() ? '轮到电脑，请稍等。' : `轮到${owner(state.turn)}，横、竖、斜连成三个就赢。`;
    render(); scheduleAI();
    if (state.status !== 'playing') $('play-again').focus({ preventScroll: true });
  }
  function fresh() {
    cancelAI(); state = createGame(); history = []; recorded = null; focusIndex = 0;
    [...board.children].forEach((cell, i) => { cell.tabIndex = i === 0 ? 0 : -1; });
    render(); save(); scheduleAI(); $('status').textContent = mode === 'local' ? '两个人轮流落子，X 先走。' : human === 'X' ? '你先走，选一个格子落下 X。' : '电脑先走，你执 O。';
  }
  function undo() {
    if (!canUndo()) return;
    cancelAI();
    if (recorded) { records[recorded.key][recorded.result]--; recorded = null; }
    state = history.pop();
    while (mode === 'solo' && state.turn !== human && history.length) state = history.pop();
    save(); render(); scheduleAI(); $('status').textContent = mode === 'local' ? '已撤销一步。' : '已退回到你的上一次落子之前。';
    board.children[focusIndex].focus({ preventScroll: true });
  }
  board.addEventListener('click', event => {
    const cell = event.target.closest('[data-index]'); if (!cell || aiTurn()) return;
    focusIndex = Number(cell.dataset.index); [...board.children].forEach((button, i) => { button.tabIndex = i === focusIndex ? 0 : -1; }); apply(focusIndex);
  });
  board.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const shift = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[event.key];
    if (!shift) return; event.preventDefault();
    const current = Number(event.target.closest('[data-index]')?.dataset.index); if (!Number.isInteger(current)) return;
    if (event.key === 'ArrowLeft' && current % 3 === 0 || event.key === 'ArrowRight' && current % 3 === 2) return;
    focusIndex = Math.max(0, Math.min(8, current + shift));
    [...board.children].forEach((cell, i) => { cell.tabIndex = i === focusIndex ? 0 : -1; }); board.children[focusIndex].focus();
  });
  $('mode').addEventListener('change', event => { mode = event.target.value; fresh(); });
  $('difficulty').addEventListener('change', event => { difficulty = event.target.value; fresh(); });
  $('side').addEventListener('change', event => { human = event.target.value; fresh(); });
  $('undo').addEventListener('click', undo); $('restart').addEventListener('click', fresh); $('play-again').addEventListener('click', fresh);
  document.addEventListener('arcade:pause', cancelAI); help.addEventListener('close', scheduleAI);
  document.addEventListener('visibilitychange', () => document.hidden ? cancelAI() : scheduleAI());
  window.addEventListener('pagehide', cancelAI); window.addEventListener('pageshow', scheduleAI);
  render(); scheduleAI(); $('status').textContent = mode === 'local' ? '同屏轮流落子，X 先走。' : human === 'X' ? '你先走，选一个格子落下 X。' : '电脑先走，你执 O。';
})();
