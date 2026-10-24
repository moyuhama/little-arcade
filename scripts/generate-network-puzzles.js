// Deterministic original puzzles; publish only after exhaustive uniqueness checks finish.
const fs = require("node:fs"),
  path = require("node:path"),
  B = require("../games/bridges/engine.js"),
  P = require("../games/pipes/engine.js");
let seed = 20261025;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const bridges = [];
let first = {
  id: 0,
  size: 5,
  name: "第一课 · 一桥与双桥",
  islands: [
    { x: 0, y: 0, n: 3 },
    { x: 4, y: 0, n: 1 },
    { x: 0, y: 4, n: 3 },
    { x: 4, y: 4, n: 1 },
  ],
};
first.edges = B.edges(first.islands);
first.solution = B.solutions(first).answers[0];
bridges.push(first);
for (const [grid, count, label] of [
  [4, 8, "入门"],
  [5, 14, "进阶"],
  [6, 22, "挑战"],
]) {
  let made = grid === 4 ? 1 : 0,
    attempts = 0;
  while (made < 20) {
    if (++attempts > 60000) throw Error("Bridges generation exhausted");
    const points = shuffle(
      Array.from({ length: grid * grid }, (_, i) => ({
        x: (i % grid) * 2,
        y: Math.floor(i / grid) * 2,
        n: 0,
      })),
    )
      .slice(0, count)
      .sort((a, b) => a.y - b.y || a.x - b.x);
    const p = {
      id: bridges.length,
      size: grid * 2 - 1,
      name: `${label} · ${String(made + 1).padStart(2, "0")}`,
      islands: points,
    };
    p.edges = B.edges(points);
    const values = Array(p.edges.length).fill(0),
      parent = points.map((_, i) => i);
    function root(a) {
      while (parent[a] !== a) a = parent[a];
      return a;
    }
    for (const i of shuffle(p.edges.map((_, i) => i))) {
      const [a, b] = p.edges[i];
      if (
        root(a) === root(b) ||
        p.edges.some((e, j) => values[j] && B.crosses(p, e, p.edges[i]))
      )
        continue;
      parent[root(a)] = root(b);
      values[i] = random() < 0.45 ? 2 : 1;
    }
    if (!B.connected(p, values)) continue;
    for (let i = 0; i < values.length; i++)
      if (
        !values[i] &&
        random() < 0.12 &&
        !p.edges.some((e, j) => values[j] && B.crosses(p, e, p.edges[i]))
      )
        values[i] = random() < 0.5 ? 1 : 2;
    const totals = B.totals(p, values);
    points.forEach((point, i) => (point.n = totals[i]));
    const result = B.solutions(p, 2, 20000);
    if (result.exhausted || result.answers.length !== 1) continue;
    p.solution = result.answers[0];
    bridges.push(p);
    made++;
  }
  console.log(`Bridges ${label}: 20 unique puzzles (${attempts} candidates)`);
}
const pipes = [];
const firstSolution = Array(9).fill(0);
for (const [a, b] of [
  [0, 1],
  [1, 2],
  [1, 4],
  [4, 3],
  [4, 5],
  [3, 6],
  [5, 8],
  [8, 7],
]) {
  const d = b === a + 1 ? 1 : b === a - 1 ? 3 : b === a + 3 ? 2 : 0;
  firstSolution[a] |= P.bits[d];
  firstSolution[b] |= P.bits[(d + 2) % 4];
}
const initial = [...firstSolution];
initial[4] = P.rotate(initial[4], 3);
pipes.push({
  id: 0,
  size: 3,
  name: "第一课 · 转动中央",
  solution: firstSolution,
  initial,
});
for (const [size, count, label] of [
  [3, 10, "入门"],
  [5, 20, "标准"],
  [7, 20, "进阶"],
  [9, 10, "挑战"],
]) {
  let made = size === 3 ? 1 : 0,
    attempts = 0;
  while (made < count) {
    if (++attempts > 10000) throw Error("Pipes generation exhausted");
    const solution = Array(size * size).fill(0),
      visited = new Set([0]),
      frontier = [];
    function expand(i) {
      for (let d = 0; d < 4; d++) {
        const j = P.neighbor(i, d, size);
        if (j >= 0 && !visited.has(j)) frontier.push([i, j, d]);
      }
    }
    expand(0);
    while (frontier.length) {
      const pos = Math.floor(random() * frontier.length),
        [a, b, d] = frontier.splice(pos, 1)[0];
      if (visited.has(b)) continue;
      visited.add(b);
      solution[a] |= P.bits[d];
      solution[b] |= P.bits[(d + 2) % 4];
      expand(b);
    }
    const p = {
      id: pipes.length,
      size,
      name: `${label} · ${String(made + 1).padStart(2, "0")}`,
      solution,
    };
    const result = P.solutions(p, 2, 15000);
    if (result.exhausted || result.answers.length !== 1) continue;
    p.initial = solution.map((m) => P.rotate(m, Math.floor(random() * 4)));
    if (P.inspect(p.initial, size).won) continue;
    pipes.push(p);
    made++;
  }
  console.log(
    `Pipes ${size}×${size}: ${count} unique puzzles (${attempts} candidates)`,
  );
}
for (const [slug, list, name] of [
  ["bridges", bridges, "BridgePuzzles"],
  ["pipes", pipes, "PipePuzzles"],
]) {
  fs.writeFileSync(
    path.join(__dirname, `../games/${slug}/puzzles.js`),
    `(function(root){const puzzles=${JSON.stringify(list)};if(typeof module==='object'&&module.exports)module.exports=puzzles;else root.${name}=puzzles;})(globalThis);\n`,
  );
}
