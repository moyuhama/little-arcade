(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  const suit = (id) => Math.floor(id / 13),
    rank = (id) => (id % 13) + 1,
    color = (id) => suit(id) % 2;
  function create(random = Math.random) {
    const deck = Array.from({ length: 52 }, (_, i) => i);
    for (let i = 51; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    // Deal row by row, exposing only the last card in each of seven columns.
    const tableau = Array.from({ length: 7 }, () => ({ cards: [], up: 0 }));
    for (let row = 0; row < 7; row++)
      for (let col = row; col < 7; col++) tableau[col].cards.push(deck.pop());
    tableau.forEach((p) => {
      p.up = p.cards.length - 1;
    });
    return {
      tableau,
      stock: deck,
      waste: [],
      foundations: [[], [], [], []],
      moves: 0,
      won: false,
    };
  }
  const clone = (s) => ({
    ...s,
    tableau: s.tableau.map((p) => ({ cards: [...p.cards], up: p.up })),
    stock: [...s.stock],
    waste: [...s.waste],
    foundations: s.foundations.map((p) => [...p]),
  });
  function draw(s) {
    if (s.won || (!s.stock.length && !s.waste.length)) return s;
    const next = clone(s);
    if (next.stock.length) next.waste.push(next.stock.pop());
    else {
      next.stock = next.waste.reverse();
      next.waste = [];
    }
    next.moves++;
    return next;
  }
  function cards(s, source) {
    if (!source) return [];
    if (source.type === "waste") return s.waste.length ? [s.waste.at(-1)] : [];
    if (source.type === "foundation") {
      const p = s.foundations[source.pile];
      return p?.length ? [p.at(-1)] : [];
    }
    if (source.type === "tableau") {
      const p = s.tableau[source.pile],
        i = source.index;
      if (!p || !Number.isInteger(i) || i < p.up || i >= p.cards.length)
        return [];
      const result = p.cards.slice(i);
      if (
        result.some(
          (v, j) =>
            j > 0 &&
            (rank(result[j - 1]) !== rank(v) + 1 ||
              color(result[j - 1]) === color(v)),
        )
      )
        return [];
      return result;
    }
    return [];
  }
  function canMove(s, source, target) {
    if (s.won || !target) return false;
    const list = cards(s, source);
    if (
      !list.length ||
      (source.type === target.type && source.pile === target.pile)
    )
      return false;
    if (target.type === "foundation") {
      const p = s.foundations[target.pile];
      return (
        !!p &&
        list.length === 1 &&
        suit(list[0]) === target.pile &&
        rank(list[0]) === p.length + 1
      );
    }
    if (target.type === "tableau") {
      const p = s.tableau[target.pile];
      return (
        !!p &&
        (p.cards.length
          ? rank(p.cards.at(-1)) === rank(list[0]) + 1 &&
            color(p.cards.at(-1)) !== color(list[0])
          : rank(list[0]) === 13)
      );
    }
    return false;
  }
  function move(s, source, target) {
    if (!canMove(s, source, target)) return s;
    const next = clone(s),
      list = cards(s, source);
    if (source.type === "waste") next.waste.pop();
    else if (source.type === "foundation") next.foundations[source.pile].pop();
    else {
      const p = next.tableau[source.pile];
      p.cards.splice(source.index);
      p.up = Math.max(0, Math.min(p.up, p.cards.length - 1));
    }
    if (target.type === "foundation")
      next.foundations[target.pile].push(...list);
    else next.tableau[target.pile].cards.push(...list);
    next.moves++;
    next.won = next.foundations.every((p) => p.length === 13);
    return next;
  }
  function sources(s) {
    const result = [];
    if (s.waste.length) result.push({ type: "waste" });
    s.tableau.forEach((p, pile) => {
      for (let index = p.up; index < p.cards.length; index++)
        result.push({ type: "tableau", pile, index });
    });
    s.foundations.forEach((p, pile) => {
      if (p.length) result.push({ type: "foundation", pile });
    });
    return result;
  }
  function hint(s, foundationOnly = false) {
    const list = sources(s);
    for (const source of list)
      if (source.type !== "foundation")
        for (let pile = 0; pile < 4; pile++) {
          const target = { type: "foundation", pile };
          if (canMove(s, source, target)) return { source, target };
        }
    if (foundationOnly) return null;
    // Prefer uncovering a hidden card; skip empty-column king shuffles and foundation backtracking.
    for (const source of list.sort(
      (a, b) =>
        Number(b.type === "tableau" && b.index > 0) -
        Number(a.type === "tableau" && a.index > 0),
    ))
      if (source.type !== "foundation")
        for (let pile = 0; pile < 7; pile++) {
          const target = { type: "tableau", pile };
          if (
            !s.tableau[pile].cards.length &&
            source.type === "tableau" &&
            source.index === 0
          )
            continue;
          if (canMove(s, source, target)) return { source, target };
        }
    return null;
  }
  return { create, suit, rank, color, draw, cards, canMove, move, hint };
});
