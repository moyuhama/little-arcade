const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parse, move, cornered } = require("../games/sokoban/engine.js");
const levels = require("../games/sokoban/levels.js");
const solutions = [
  ["right", "right"],
  ["up", "up", "left", "up", "right", "right"],
  ["down", "left", "up", "up", "right", "down", "down", "right", "up", "up"],
  [
    "up",
    "up",
    "left",
    "up",
    "left",
    "left",
    "down",
    "right",
    "left",
    "down",
    "down",
    "right",
    "right",
    "up",
    "up",
  ],
  [
    "left",
    "left",
    "left",
    "left",
    "up",
    "up",
    "up",
    "right",
    "left",
    "down",
    "down",
    "right",
    "up",
    "up",
    "right",
    "right",
    "down",
    "right",
    "up",
  ],
  [
    "left",
    "left",
    "up",
    "left",
    "up",
    "left",
    "up",
    "right",
    "left",
    "up",
    "right",
    "down",
    "right",
    "right",
    "up",
    "right",
    "down",
    "left",
    "left",
    "left",
    "down",
    "down",
    "down",
    "left",
    "up",
  ],
  [
    "down",
    "left",
    "up",
    "right",
    "up",
    "left",
    "right",
    "down",
    "down",
    "down",
    "left",
    "left",
    "down",
    "left",
    "up",
    "up",
    "up",
    "down",
    "down",
    "down",
    "left",
    "up",
    "up",
    "up",
  ],
  [
    "left",
    "up",
    "right",
    "right",
    "right",
    "down",
    "right",
    "right",
    "up",
    "up",
    "up",
    "left",
    "left",
    "right",
    "down",
    "down",
    "right",
    "down",
    "left",
    "left",
    "left",
    "up",
    "up",
    "up",
  ],
  [
    "right",
    "right",
    "down",
    "right",
    "right",
    "up",
    "right",
    "up",
    "left",
    "left",
    "left",
    "right",
    "right",
    "right",
    "down",
    "down",
    "down",
    "down",
    "left",
    "left",
    "left",
    "right",
    "right",
    "up",
    "up",
    "up",
  ],
  [
    "right",
    "up",
    "left",
    "up",
    "right",
    "left",
    "up",
    "right",
    "down",
    "down",
    "down",
    "right",
    "right",
    "down",
    "right",
    "up",
    "up",
    "up",
    "left",
    "left",
    "left",
    "down",
    "left",
    "up",
  ],
];
const codes = { L: "left", R: "right", U: "up", D: "down" };
solutions.push(
  ...require("./fixtures/sokoban-expansion.json").map((path) =>
    [...path].map((c) => codes[c]),
  ),
);
test("all thirty original levels have legal winning paths matching their reference steps", () => {
  assert.equal(levels.length, 30);
  levels.forEach((level, i) => {
    let state = parse(level.map);
    assert.equal(state.status, "playing");
    for (const direction of solutions[i]) {
      const next = move(state, direction);
      assert.notEqual(next, state, `level ${i + 1}: ${direction}`);
      state = next;
    }
    assert.equal(state.status, "won", level.name);
    assert.equal(state.steps, level.par);
    assert.ok(state.boxes.every((box) => state.goals.includes(box)));
  });
});
test("walking and pushing count separately and do not mutate the prior board", () => {
  const state = parse(levels[0].map),
    snapshot = structuredClone(state);
  const walk = move(state, "down");
  assert.equal(walk.steps, 1);
  assert.equal(walk.pushes, 0);
  const push = move(state, "right");
  assert.equal(push.steps, 1);
  assert.equal(push.pushes, 1);
  assert.notDeepEqual(push.boxes, state.boxes);
  assert.deepEqual(state, snapshot);
});
test("walls and two boxes in a row block movement without counting a step", () => {
  const state = parse(["#######", "#@$$..#", "#######"]);
  assert.equal(move(state, "left"), state);
  assert.equal(move(state, "right"), state);
  assert.equal(move(state, "up"), state);
  assert.equal(move(state, "nope"), state);
});
test("moving away cannot pull a box; a box cannot be pushed through a wall", () => {
  const state = parse(["######", "# $@.#", "######"]);
  const away = move(state, "right");
  assert.deepEqual(away.boxes, state.boxes);
  const pushed = move(state, "left");
  assert.equal(pushed.boxes[0], state.boxes[0] - 1);
  assert.equal(move(pushed, "left"), pushed);
});
test("the last box on its goal wins and further movement is ignored", () => {
  let state = parse(levels[0].map);
  state = move(move(state, "right"), "right");
  assert.equal(state.status, "won");
  assert.equal(move(state, "left"), state);
});
test("corner warning excludes boxes on goals and treats map boundaries as walls", () => {
  assert.equal(cornered(parse(["#####", "#$ @#", "#  .#", "#####"])), true);
  assert.equal(cornered(parse(["#####", "#* @#", "#   #", "#####"])), false);
  assert.equal(cornered(parse(["$ @", "  ."])), true);
});
test("row boundaries cannot wrap, and malformed levels are rejected", () => {
  const state = parse(["  @", "$ ."]);
  assert.equal(move(state, "right"), state);
  for (const map of [["#@", "#$.#"], ["#@#"], ["@$x."], ["@@$."], ["@$.."]])
    assert.throws(() => parse(map));
});
