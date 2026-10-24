(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  const X = 150,
    RADIUS = 13,
    GAP = 178,
    WIDTH = 72;
  const pipe = (random, x = 650) => ({
    x,
    center: 135 + random() * 330,
    passed: false,
  });
  const create = (random = Math.random) => ({
    y: 280,
    velocity: 0,
    pipes: [pipe(random)],
    spawn: 0,
    score: 0,
    over: false,
  });
  const flap = (state) => (state.over ? state : { ...state, velocity: -330 });
  function step(state, dt, random = Math.random) {
    if (state.over || dt <= 0) return state;
    let next = { ...state, pipes: state.pipes.map((p) => ({ ...p })) };
    let remaining = Math.min(dt, 0.2);
    // Small steps avoid tunneling through an obstacle on a slow frame.
    while (remaining > 0 && !next.over) {
      const delta = Math.min(remaining, 1 / 120);
      remaining -= delta;
      next.velocity += 1000 * delta;
      next.y += next.velocity * delta;
      next.spawn += delta;
      if (next.spawn >= 1.65) {
        next.spawn -= 1.65;
        next.pipes.push(pipe(random));
      }
      for (const p of next.pipes) {
        p.x -= 165 * delta;
        if (!p.passed && p.x + WIDTH < X - RADIUS) {
          p.passed = true;
          next.score++;
        }
        if (
          p.x < X + RADIUS &&
          p.x + WIDTH > X - RADIUS &&
          (next.y - RADIUS < p.center - GAP / 2 ||
            next.y + RADIUS > p.center + GAP / 2)
        )
          next.over = true;
      }
      if (next.y - RADIUS <= 0 || next.y + RADIUS >= 600) next.over = true;
      next.pipes = next.pipes.filter((p) => p.x + WIDTH > -5);
    }
    return next;
  }
  return { X, RADIUS, GAP, WIDTH, create, flap, step };
});
