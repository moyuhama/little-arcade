(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) [a, b] = [b, a % b];
    return a || 1;
  }
  function fraction(n, d = 1) {
    if (!d) throw Error("不能除以 0。");
    if (d < 0) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d);
    return { n: n / g, d: d / g };
  }
  function operate(a, b, op) {
    if (op === "+") return fraction(a.n * b.d + b.n * a.d, a.d * b.d);
    if (op === "-") return fraction(a.n * b.d - b.n * a.d, a.d * b.d);
    if (op === "*") return fraction(a.n * b.n, a.d * b.d);
    if (op === "/") return fraction(a.n * b.d, a.d * b.n);
    throw Error("运算符不正确。");
  }
  function solve(values) {
    function search(items) {
      if (items.length === 1)
        return items[0].value.n === 24 * items[0].value.d
          ? items[0].expr
          : null;
      for (let i = 0; i < items.length; i++)
        for (let j = i + 1; j < items.length; j++) {
          const rest = items.filter((_, k) => k !== i && k !== j),
            a = items[i],
            b = items[j],
            tried = new Set();
          for (const [x, y, op] of [
            [a, b, "+"],
            [a, b, "*"],
            [a, b, "-"],
            [b, a, "-"],
            [a, b, "/"],
            [b, a, "/"],
          ]) {
            if (op === "/" && !y.value.n) continue;
            const value = operate(x.value, y.value, op),
              key = value.n + "/" + value.d;
            if (tried.has(key)) continue;
            tried.add(key);
            const answer = search([
              ...rest,
              { value, expr: `(${x.expr}${op}${y.expr})` },
            ]);
            if (answer) return answer;
          }
        }
      return null;
    }
    return search(values.map((v) => ({ value: fraction(v), expr: String(v) })));
  }
  function create(random = Math.random) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const deck = Array.from({ length: 52 }, (_, i) => i);
      for (let i = 51; i > 47; i--) {
        const j = Math.floor(random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      const cards = deck.slice(-4),
        values = cards.map((id) => (id % 13) + 1),
        solution = solve(values);
      if (solution) return { cards, values, solution };
    }
    return {
      cards: [0, 14, 28, 42],
      values: [1, 2, 3, 4],
      solution: "((1*2)*(3*4))",
    };
  }
  // Token parser, never eval: numbers can only come from the four original cards.
  function evaluate(tokens, values) {
    try {
      if (!Array.isArray(tokens) || tokens.length > 40)
        throw Error("算式太长了，整理一下再试。");
      const used = tokens.filter((t) => Number.isInteger(t));
      if (
        used.length !== 4 ||
        new Set(used).size !== 4 ||
        used.some((i) => i < 0 || i >= 4)
      )
        throw Error("四张牌都要使用，而且每张只能用一次。");
      let at = 0;
      function factor() {
        const t = tokens[at++];
        if (Number.isInteger(t)) return fraction(values[t]);
        if (t === "(") {
          const value = expression();
          if (tokens[at++] !== ")") throw Error("括号还没有配对。");
          return value;
        }
        throw Error("这里需要一张牌或左括号。");
      }
      function term() {
        let value = factor();
        while (tokens[at] === "*" || tokens[at] === "/") {
          const op = tokens[at++];
          value = operate(value, factor(), op);
        }
        return value;
      }
      function expression() {
        let value = term();
        while (tokens[at] === "+" || tokens[at] === "-") {
          const op = tokens[at++];
          value = operate(value, term(), op);
        }
        return value;
      }
      const value = expression();
      if (at !== tokens.length) throw Error("牌之间需要运算符，也请检查括号。");
      return { valid: true, correct: value.n === 24 * value.d, value };
    } catch (error) {
      return { valid: false, correct: false, error: error.message };
    }
  }
  return { fraction, operate, solve, create, evaluate };
});
