(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  const create = () => ({
    time: 0,
    score: 0,
    hits: 0,
    active: -1,
    last: -1,
    spawnAt: 0,
    expires: 0,
    over: false,
  });
  function advance(state, seconds, random = Math.random) {
    if (state.over || seconds < 0) return state;
    const time = Math.min(30, state.time + seconds);
    if (time >= 30) return { ...state, time, active: -1, over: true };
    const next = { ...state, time };
    if (time >= state.expires) next.active = -1;
    if (time >= state.spawnAt) {
      const choice = Math.floor(random() * 8);
      next.active =
        state.last < 0
          ? Math.floor(random() * 9)
          : choice >= state.last
            ? choice + 1
            : choice;
      next.last = next.active;
      next.expires = time + Math.max(0.38, 0.95 - time * 0.014);
      next.spawnAt = next.expires + 0.15;
    }
    return next;
  }
  function hit(state, index) {
    if (state.over || index < 0 || index > 8) return state;
    if (index === state.active)
      return {
        ...state,
        active: -1,
        score: state.score + 10,
        hits: state.hits + 1,
      };
    return { ...state, score: Math.max(0, state.score - 2) };
  }
  return { create, advance, hit };
});
