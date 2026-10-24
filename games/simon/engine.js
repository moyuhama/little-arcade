(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  const create = () => ({ sequence: [], index: 0, rounds: 0, phase: "ready" });
  function nextRound(state, random = Math.random) {
    return {
      ...state,
      sequence: [...state.sequence, Math.floor(random() * 4)],
      index: 0,
      phase: "showing",
    };
  }
  const listen = (state) =>
    state.phase === "showing" ? { ...state, index: 0, phase: "input" } : state;
  function press(state, value) {
    if (
      state.phase !== "input" ||
      !Number.isInteger(value) ||
      value < 0 ||
      value > 3
    )
      return state;
    if (state.sequence[state.index] !== value)
      return { ...state, phase: "over" };
    const index = state.index + 1;
    return {
      ...state,
      index,
      phase: index === state.sequence.length ? "round-won" : "input",
      rounds: state.rounds + Number(index === state.sequence.length),
    };
  }
  return { create, nextRound, listen, press };
});
