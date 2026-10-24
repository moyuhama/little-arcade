(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  const cache = new Map();
  function geometry(n) {
    if (cache.has(n)) return cache.get(n);
    const edges = [],
      vertices = Array.from({ length: (n + 1) ** 2 }, () => []),
      cells = Array.from({ length: n * n }, () => []),
      edgeCells = [];
    for (let axis = 0; axis < 2; axis++)
      for (let r = 0; r < (axis ? n : n + 1); r++)
        for (let c = 0; c < (axis ? n + 1 : n); c++) {
          const a = r * (n + 1) + c,
            b = a + (axis ? n + 1 : 1),
            i = edges.length;
          edges.push({ a, b, r, c, axis });
          vertices[a].push(i);
          vertices[b].push(i);
          const touch = axis
            ? [c ? r * n + c - 1 : -1, c < n ? r * n + c : -1]
            : [r ? (r - 1) * n + c : -1, r < n ? r * n + c : -1];
          edgeCells.push(touch.filter((v) => v >= 0));
          for (const v of touch) if (v >= 0) cells[v].push(i);
        }
    const g = { edges, vertices, cells, edgeCells };
    cache.set(n, g);
    return g;
  }
  function solved(p, values) {
    const g = geometry(p.size),
      on = values.map((v) => (v === 1 ? 1 : 0));
    if (
      !g.cells.every(
        (es, i) =>
          p.clues[i] < 0 || es.reduce((s, e) => s + on[e], 0) === p.clues[i],
      )
    )
      return false;
    if (
      !g.vertices.every((es) =>
        [0, 2].includes(es.reduce((s, e) => s + on[e], 0)),
      )
    )
      return false;
    const first = on.indexOf(1);
    if (first < 0) return false;
    const seen = new Set([first]),
      q = [first];
    while (q.length) {
      const edge = g.edges[q.pop()];
      for (const v of [edge.a, edge.b])
        for (const e of g.vertices[v])
          if (on[e] && !seen.has(e)) {
            seen.add(e);
            q.push(e);
          }
    }
    return seen.size === on.reduce((a, b) => a + b, 0);
  }
  function propagate(p, values, record = false) {
    const g = geometry(p.size),
      reasons = [];
    let changed = true;
    const force = (e, value, text) => {
      if (values[e] === value) return true;
      if (values[e] !== -1) return false;
      values[e] = value;
      changed = true;
      if (record) reasons.push({ index: e, value, text });
      return true;
    };
    while (changed) {
      changed = false;
      for (let i = 0; i < g.cells.length; i++) {
        const clue = p.clues[i];
        if (clue < 0) continue;
        const es = g.cells[i],
          on = es.filter((e) => values[e] === 1).length,
          unknown = es.filter((e) => values[e] === -1);
        if (on > clue || on + unknown.length < clue) return null;
        if (on === clue || on + unknown.length === clue) {
          const value = on === clue ? 0 : 1;
          for (const e of unknown)
            if (
              !force(
                e,
                value,
                `第 ${Math.floor(i / p.size) + 1} 行第 ${(i % p.size) + 1} 格的 ${clue}：${value ? "剩下的边都必须画线" : "所需线段已够，其余边不能画线"}。`,
              )
            )
              return null;
        }
      }
      for (let v = 0; v < g.vertices.length; v++) {
        const es = g.vertices[v],
          on = es.filter((e) => values[e] === 1).length,
          u = es.filter((e) => values[e] === -1);
        if (on > 2 || (on === 1 && !u.length)) return null;
        let value = null;
        if (on === 2 || (on === 0 && u.length === 1)) value = 0;
        else if (on === 1 && u.length === 1) value = 1;
        if (value !== null)
          for (const e of u)
            if (
              !force(
                e,
                value,
                `每个经过的交点必须恰好连接两条线，${value ? "这条边必须接上" : "这条边不能再连"}。`,
              )
            )
              return null;
      }
    }
    const seen = new Set();
    for (let e = 0; e < values.length; e++)
      if (values[e] === 1 && !seen.has(e)) {
        const part = [],
          queue = [e];
        let closed = true;
        seen.add(e);
        while (queue.length) {
          const j = queue.pop();
          part.push(j);
          for (const v of [g.edges[j].a, g.edges[j].b]) {
            const linked = g.vertices[v].filter((k) => values[k] === 1);
            if (linked.length !== 2) closed = false;
            for (const k of linked)
              if (!seen.has(k)) {
                seen.add(k);
                queue.push(k);
              }
          }
        }
        if (closed) {
          if (values.filter((v) => v === 1).length !== part.length) return null;
          for (let k = 0; k < values.length; k++)
            if (values[k] === -1)
              force(k, 0, "已经形成闭环，其它边不能再画线。");
          if (!solved(p, values)) return null;
        }
      }
    return { values, reasons };
  }
  function solutions(p, limit = 2, budget = 20000) {
    const g = geometry(p.size),
      answers = [];
    let nodes = 0,
      exhausted = false;
    function search(values) {
      if (++nodes > budget) {
        exhausted = true;
        return;
      }
      if (!propagate(p, values)) return;
      let best = -1,
        score = -1;
      for (let e = 0; e < values.length; e++)
        if (values[e] === -1) {
          let s = g.edgeCells[e].filter((c) => p.clues[c] >= 0).length * 2;
          for (const v of [g.edges[e].a, g.edges[e].b])
            s += g.vertices[v].filter((k) => values[k] === 1).length * 4;
          s += g.edgeCells[e].reduce(
            (sum, c) => sum + g.cells[c].filter((k) => values[k] !== -1).length,
            0,
          );
          if (s > score) {
            score = s;
            best = e;
          }
        }
      if (best < 0) {
        if (solved(p, values)) answers.push(values);
        return;
      }
      for (const value of [1, 0]) {
        const next = [...values];
        next[best] = value;
        search(next);
        if (answers.length >= limit || exhausted) return;
      }
    }
    search(Array(g.edges.length).fill(-1));
    return { answers, nodes, exhausted };
  }
  function create(p) {
    return {
      id: p.id,
      values: Array(geometry(p.size).edges.length).fill(-1),
      moves: 0,
      hints: 0,
      won: false,
    };
  }
  function act(s, p, a) {
    if (
      !a ||
      s.won ||
      !Number.isInteger(a.index) ||
      a.index < 0 ||
      a.index >= s.values.length ||
      ![0, 1].includes(a.value)
    )
      return s;
    const values = [...s.values];
    values[a.index] = values[a.index] === a.value ? -1 : a.value;
    return { ...s, values, moves: s.moves + 1, won: solved(p, values) };
  }
  function restore(raw, p) {
    if (
      !raw ||
      raw.id !== p.id ||
      !Array.isArray(raw.values) ||
      raw.values.length !== geometry(p.size).edges.length ||
      !raw.values.every((v) => [-1, 0, 1].includes(v)) ||
      !Number.isInteger(raw.moves) ||
      raw.moves < 0 ||
      !Number.isInteger(raw.hints) ||
      raw.hints < 0
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
  function hint(s, p) {
    const wrong = s.values.findIndex((v, i) => v !== -1 && v !== p.solution[i]);
    if (wrong >= 0)
      return {
        index: wrong,
        value: p.solution[wrong],
        text: "这条边的标记与答案不一致，已帮你修正。可以从相邻数字重新检查。",
      };
    const result = propagate(p, [...s.values], true);
    if (result?.reasons.length) return result.reasons[0];
    const index = s.values.indexOf(-1);
    return index < 0
      ? null
      : {
          index,
          value: p.solution[index],
          text: "这一步没有直接的数字或交点推论，提供一条答案边，供你继续推理。",
        };
  }
  return { geometry, solved, propagate, solutions, create, act, restore, hint };
});
