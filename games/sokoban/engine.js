(function (root, factory) {
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  else root.Sokoban = engine;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const directions = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
  function parse(map) {
    const width = map[0]?.length, height = map.length, walls = [], goals = [], boxes = [], players = [];
    if (!width || !height || map.some(row => row.length !== width || /[^# .$@*+]/.test(row))) throw new Error('Invalid level map');
    [...map.join('')].forEach((cell, i) => {
      if (cell === '#') walls.push(i);
      if ('.*+'.includes(cell)) goals.push(i);
      if ('$*'.includes(cell)) boxes.push(i);
      if ('@+'.includes(cell)) players.push(i);
    });
    if (players.length !== 1 || !boxes.length || boxes.length !== goals.length) throw new Error('Invalid level contents');
    return { width, height, walls, goals, boxes, player: players[0], steps: 0, pushes: 0, status: boxes.every(box => goals.includes(box)) ? 'won' : 'playing' };
  }
  function adjacent(state, from, direction) {
    const vector = directions[direction]; if (!vector) return -1;
    const x = from % state.width + vector[0], y = Math.floor(from / state.width) + vector[1];
    return x < 0 || x >= state.width || y < 0 || y >= state.height ? -1 : y * state.width + x;
  }
  function move(state, direction) {
    if (state.status !== 'playing') return state;
    const to = adjacent(state, state.player, direction);
    if (to < 0 || state.walls.includes(to)) return state;
    const index = state.boxes.indexOf(to), boxes = state.boxes.slice();
    if (index >= 0) {
      const beyond = adjacent(state, to, direction);
      if (beyond < 0 || state.walls.includes(beyond) || boxes.includes(beyond)) return state;
      boxes[index] = beyond;
    }
    return { ...state, player: to, boxes, steps: state.steps + 1, pushes: state.pushes + (index >= 0 ? 1 : 0), status: boxes.every(box => state.goals.includes(box)) ? 'won' : 'playing' };
  }
  function cornered(state) {
    const wall = index => index < 0 || state.walls.includes(index);
    return state.boxes.some(box => !state.goals.includes(box)
      && (wall(adjacent(state, box, 'left')) || wall(adjacent(state, box, 'right')))
      && (wall(adjacent(state, box, 'up')) || wall(adjacent(state, box, 'down'))));
  }
  return { parse, move, adjacent, cornered };
});
