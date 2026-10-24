(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  const directions = {
    up: [0, -1, 1, 4],
    right: [1, 0, 2, 8],
    down: [0, 1, 4, 1],
    left: [-1, 0, 8, 2],
  };
  function neighbor(index, direction, size) {
    const [dx, dy] = directions[direction],
      x = (index % size) + dx,
      y = Math.floor(index / size) + dy;
    return x < 0 || y < 0 || x >= size || y >= size ? -1 : y * size + x;
  }
  function create(size, random = Math.random) {
    const walls = Array(size * size).fill(15),
      seen = new Set([0]),
      stack = [0];
    while (stack.length) {
      const at = stack[stack.length - 1],
        choices = Object.keys(directions).filter((d) => {
          const i = neighbor(at, d, size);
          return i >= 0 && !seen.has(i);
        });
      if (!choices.length) {
        stack.pop();
        continue;
      }
      const d = choices[Math.floor(random() * choices.length)],
        next = neighbor(at, d, size);
      walls[at] &= ~directions[d][2];
      walls[next] &= ~directions[d][3];
      seen.add(next);
      stack.push(next);
    }
    return { size, walls, position: 0, moves: 0 };
  }
  function move(state, direction) {
    if (
      !directions[direction] ||
      state.walls[state.position] & directions[direction][2]
    )
      return state;
    return {
      ...state,
      position: neighbor(state.position, direction, state.size),
      moves: state.moves + 1,
    };
  }
  function path(state) {
    const goal = state.size * state.size - 1,
      queue = [state.position],
      previous = new Map([[state.position, -1]]);
    for (let i = 0; i < queue.length && !previous.has(goal); i++) {
      const at = queue[i];
      for (const d of Object.keys(directions)) {
        const next = move({ ...state, position: at }, d).position;
        if (!previous.has(next)) {
          previous.set(next, at);
          queue.push(next);
        }
      }
    }
    const result = [];
    for (let at = goal; at !== -1; at = previous.get(at)) result.push(at);
    return result.reverse();
  }
  return { directions, neighbor, create, move, path };
});
