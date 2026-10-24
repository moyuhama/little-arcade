(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  function edges(islands) {
    const out = [];
    for (let a = 0; a < islands.length; a++)
      for (const axis of ["x", "y"]) {
        const other = axis === "x" ? "y" : "x";
        const options = islands
          .map((p, b) => ({ p, b }))
          .filter(
            ({ p }) =>
              p[other] === islands[a][other] && p[axis] > islands[a][axis],
          )
          .sort((v, w) => v.p[axis] - w.p[axis]);
        if (options.length) out.push([a, options[0].b]);
      }
    return out;
  }
  function crosses(p, e, f) {
    const [a, b] = e.map((i) => p.islands[i]),
      [c, d] = f.map((i) => p.islands[i]);
    if (e.some((i) => f.includes(i))) return false;
    const between = (x, a, b) => x > Math.min(a, b) && x < Math.max(a, b);
    return a.y === b.y && c.x === d.x
      ? between(c.x, a.x, b.x) && between(a.y, c.y, d.y)
      : a.x === b.x && c.y === d.y
        ? between(a.x, c.x, d.x) && between(c.y, a.y, b.y)
        : false;
  }
  function totals(p, values) {
    const sums = Array(p.islands.length).fill(0);
    p.edges.forEach(([a, b], i) => {
      sums[a] += values[i];
      sums[b] += values[i];
    });
    return sums;
  }
  function connected(p, values) {
    const visited = new Set([0]),
      q = [0];
    while (q.length) {
      const a = q.pop();
      p.edges.forEach(([u, v], i) => {
        if (!values[i]) return;
        const b = u === a ? v : v === a ? u : -1;
        if (b >= 0 && !visited.has(b)) {
          visited.add(b);
          q.push(b);
        }
      });
    }
    return visited.size === p.islands.length;
  }
  function solved(p, values) {
    return (
      totals(p, values).every((v, i) => v === p.islands[i].n) &&
      connected(p, values) &&
      p.edges.every(
        (e, i) =>
          !values[i] ||
          p.edges.every((f, j) => !values[j] || !crosses(p, e, f)),
      )
    );
  }
  function solutions(p, limit = 2, budget = 50000) {
    const incident = p.islands.map((_, a) =>
        p.edges.flatMap(([u, v], i) => (u === a || v === a ? [i] : [])),
      ),
      cross = p.edges.map((e) =>
        p.edges.flatMap((f, i) => (crosses(p, e, f) ? [i] : [])),
      );
    let nodes = 0,
      exhausted = false;
    const answers = [];
    function search(ds) {
      if (++nodes > budget) {
        exhausted = true;
        return;
      }
      let change = true;
      while (change) {
        change = false;
        for (let i = 0; i < p.islands.length; i++) {
          const list = incident[i],
            target = p.islands[i].n;
          let min = list.reduce((s, j) => s + ds[j][0], 0),
            max = list.reduce((s, j) => s + ds[j].at(-1), 0);
          if (min > target || max < target) return;
          for (const j of list) {
            const next = ds[j].filter(
              (v) =>
                v + min - ds[j][0] <= target &&
                v + max - ds[j].at(-1) >= target,
            );
            if (!next.length) return;
            if (next.length !== ds[j].length) {
              ds[j] = next;
              change = true;
            }
          }
        }
        for (let i = 0; i < ds.length; i++)
          if (ds[i][0] > 0)
            for (const j of cross[i]) {
              if (!ds[j].includes(0)) return;
              if (ds[j].length > 1) {
                ds[j] = [0];
                change = true;
              }
            }
      }
      if (
        !connected(
          p,
          ds.map((d) => d.at(-1)),
        )
      )
        return;
      let chosen = -1;
      for (let i = 0; i < ds.length; i++)
        if (
          ds[i].length > 1 &&
          (chosen < 0 || ds[i].length < ds[chosen].length)
        )
          chosen = i;
      if (chosen < 0) {
        const values = ds.map((d) => d[0]);
        if (solved(p, values)) answers.push(values);
        return;
      }
      for (const v of ds[chosen]) {
        const next = ds.map((d) => [...d]);
        next[chosen] = [v];
        search(next);
        if (answers.length >= limit || exhausted) return;
      }
    }
    search(p.edges.map(() => [0, 1, 2]));
    return { answers, exhausted, nodes };
  }
  function create(p) {
    return {
      id: p.id,
      values: Array(p.edges.length).fill(0),
      moves: 0,
      hints: 0,
      won: false,
    };
  }
  function act(s, p, index) {
    if (
      s.won ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= p.edges.length
    )
      return s;
    const next = { ...s, values: [...s.values], moves: s.moves + 1 };
    let value = (s.values[index] + 1) % 3;
    if (
      value > 0 &&
      p.edges.some((e, j) => s.values[j] > 0 && crosses(p, e, p.edges[index]))
    )
      value = 0;
    if (value === s.values[index]) return s;
    next.values[index] = value;
    next.won = solved(p, next.values);
    return next;
  }
  function restore(raw, p) {
    if (
      !raw ||
      raw.id !== p.id ||
      !Array.isArray(raw.values) ||
      raw.values.length !== p.edges.length ||
      !raw.values.every((v) => [0, 1, 2].includes(v)) ||
      !Number.isInteger(raw.moves) ||
      raw.moves < 0 ||
      !Number.isInteger(raw.hints) ||
      raw.hints < 0 ||
      p.edges.some(
        (e, i) =>
          raw.values[i] > 0 &&
          p.edges.some((f, j) => raw.values[j] > 0 && crosses(p, e, f)),
      )
    )
      return null;
    return {
      ...create(p),
      values: [...raw.values],
      moves: raw.moves,
      hints: raw.hints,
      won: solved(p, raw.values),
    };
  }
  return {
    edges,
    crosses,
    totals,
    connected,
    solved,
    solutions,
    create,
    act,
    restore,
  };
});
