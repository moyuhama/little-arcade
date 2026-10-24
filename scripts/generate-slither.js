/* Seeded polyomino boundaries, followed by uniqueness-preserving clue removal. */
const fs = require("node:fs"),
  path = require("node:path"),
  E = require("../games/slither/engine");
let seed = 20261024;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    let j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
function boundary(inside, n) {
  return E.geometry(n).edgeCells.map((cs) =>
    cs.filter((c) => inside.has(c)).length === 1 ? 1 : 0,
  );
}
const puzzles = [],
  seen = new Set();
for (const [tier, n, ratio] of [
  [0, 4, 0.75],
  [1, 6, 0.65],
  [2, 8, 0.58],
  [3, 10, 0.52],
]) {
  let attempts = 0;
  while (puzzles.length < (tier + 1) * 60) {
    attempts++;
    const region = new Set([Math.floor((n * n) / 2)]),
      target = Math.floor(n * n * (0.3 + random() * 0.35));
    for (let tries = 0; region.size < target && tries < n * n * 30; tries++) {
      const near = shuffle([...region]);
      let added = false;
      for (const i of near) {
        const options = shuffle(
          [
            i % n ? i - 1 : -1,
            i % n < n - 1 ? i + 1 : -1,
            i >= n ? i - n : -1,
            i < n * (n - 1) ? i + n : -1,
          ].filter((i) => i >= 0 && !region.has(i)),
        );
        for (const j of options) {
          region.add(j);
          const solution = boundary(region, n);
          if (E.solved({ size: n, clues: Array(n * n).fill(-1) }, solution)) {
            added = true;
            break;
          }
          region.delete(j);
        }
        if (added) break;
      }
      if (!added) break;
    }
    const solution = boundary(region, n),
      key = n + ":" + solution.join("");
    if (seen.has(key)) continue;
    const g = E.geometry(n),
      p = {
        id: puzzles.length,
        size: n,
        name:
          ["入门", "进阶", "高级", "专家"][tier] +
          " · " +
          String((puzzles.length % 60) + 1).padStart(2, "0"),
        clues: g.cells.map((es) => es.reduce((s, e) => s + solution[e], 0)),
        solution,
      };
    const full = E.solutions(p, 2, 10000);
    if (full.exhausted || full.answers.length !== 1) continue;
    let left = p.clues.length;
    for (const i of shuffle(Array.from({ length: n * n }, (_, i) => i))) {
      if (left <= Math.ceil(n * n * ratio)) break;
      const old = p.clues[i];
      p.clues[i] = -1;
      const result = E.solutions(p, 2, 5000);
      if (result.exhausted || result.answers.length !== 1) p.clues[i] = old;
      else left--;
    }
    seen.add(key);
    puzzles.push(p);
    if (puzzles.length % 20 === 0)
      console.log(
        puzzles.length + " unique puzzles, " + attempts + " candidates in tier",
      );
  }
}
const tutorial = {
  id: 0,
  size: 2,
  name: "第一课 · 一条闭环",
  clues: [3, 1, 3, 1],
  solution: boundary(new Set([0, 2]), 2),
};
if (E.solutions(tutorial).answers.length !== 1)
  throw Error("Tutorial ambiguous");
puzzles[0] = tutorial;
fs.writeFileSync(
  path.join(__dirname, "../games/slither/puzzles.js"),
  "(function(r){const p=" +
    JSON.stringify(puzzles) +
    ';if(typeof module==="object"&&module.exports)module.exports=p;else r.SlitherPuzzles=p;})(globalThis);\n',
);
