// Generate a fixed, reproducible collection. Every puzzle must be solvable by line deductions alone.
const fs = require("node:fs");
const E = require("../games/nonogram/engine.js");
let seed = 20261024;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
const puzzles = [];
const seen = new Set();
const first = ["00100", "01110", "11111", "01110", "00100"].join("");
puzzles.push({
  id: 0,
  size: 5,
  name: "第一课 · 从整行开始",
  cells: [...first].map(Number),
});
seen.add(first);
for (const size of [5, 10, 15]) {
  let attempts = 0;
  while (puzzles.filter((p) => p.size === size).length < 20) {
    if (++attempts > 20000) throw Error("Generation exhausted " + size);
    const density = 0.5 + random() * 0.23;
    const cells = Array.from({ length: size * size }, () =>
      Number(random() < density),
    );
    const code = cells.join("");
    if (seen.has(code) || !E.solve(cells, size)) continue;
    seen.add(code);
    puzzles.push({
      id: puzzles.length,
      size,
      name: `${size === 5 ? "入门" : size === 10 ? "进阶" : "挑战"} · ${String(puzzles.filter((p) => p.size === size).length + 1).padStart(2, "0")}`,
      cells,
    });
  }
  console.log(size + " × " + size + ": 20 puzzles verified");
}
fs.writeFileSync(
  require("node:path").join(__dirname, "../games/nonogram/puzzles.js"),
  "(function(root){const puzzles=" +
    JSON.stringify(puzzles) +
    ';if(typeof module==="object"&&module.exports)module.exports=puzzles;else root.NonogramPuzzles=puzzles;})(globalThis);\n',
);
