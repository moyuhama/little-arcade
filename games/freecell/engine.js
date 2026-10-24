(function (r, f) {
  if (typeof module === "object" && module.exports) module.exports = f();
  else r.GameEngine = f();
})(globalThis, () => {
  "use strict";
  const rank = (id) => (id % 13) + 1,
    suit = (id) => Math.floor(id / 13),
    color = (id) => suit(id) % 2;
  function create(deal = 1) {
    deal = Number.isInteger(deal) && deal >= 1 && deal <= 1000000 ? deal : 1;
    let seed = (Math.imul(deal, 2654435761) ^ 0xa531e9f7) >>> 0;
    const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      },
      deck = Array.from({ length: 52 }, (_, i) => i);
    for (let i = 51; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const tableau = Array.from({ length: 8 }, () => []);
    deck.forEach((id, i) => tableau[i % 8].push(id));
    return {
      deal,
      tableau,
      cells: Array(4).fill(null),
      foundations: Array.from({ length: 4 }, () => []),
      moves: 0,
      won: false,
    };
  }
  function sequence(cards) {
    return (
      cards.length > 0 &&
      cards.every(
        (id, i) =>
          !i ||
          (rank(cards[i - 1]) === rank(id) + 1 &&
            color(cards[i - 1]) !== color(id)),
      )
    );
  }
  function source(s, from) {
    if (!from || !Number.isInteger(from.col)) return null;
    if (from.zone === "cell")
      return from.col >= 0 && from.col < 4 && s.cells[from.col] !== null
        ? [s.cells[from.col]]
        : null;
    if (from.zone === "tableau") {
      const p = s.tableau[from.col];
      if (
        !p ||
        !Number.isInteger(from.index) ||
        from.index < 0 ||
        from.index >= p.length
      )
        return null;
      const cards = p.slice(from.index);
      return sequence(cards) ? cards : null;
    }
    return null;
  }
  function capacity(s, to) {
    let empties = s.tableau.filter((p) => !p.length).length;
    if (to.zone === "tableau" && !s.tableau[to.col]?.length) empties--;
    return (
      (s.cells.filter((id) => id === null).length + 1) *
      2 ** Math.max(0, empties)
    );
  }
  function canMove(s, from, to) {
    if (
      s.won ||
      !to ||
      !Number.isInteger(to.col) ||
      (from?.zone === to.zone && from.col === to.col)
    )
      return false;
    const cards = source(s, from);
    if (!cards) return false;
    const id = cards[0];
    if (to.zone === "cell")
      return (
        to.col >= 0 &&
        to.col < 4 &&
        s.cells[to.col] === null &&
        cards.length === 1
      );
    if (to.zone === "foundation")
      return (
        to.col === suit(id) &&
        cards.length === 1 &&
        rank(id) === s.foundations[to.col].length + 1
      );
    if (to.zone !== "tableau" || !s.tableau[to.col]) return false;
    const top = s.tableau[to.col].at(-1);
    return (
      cards.length <= capacity(s, to) &&
      (top === undefined ||
        (rank(top) === rank(id) + 1 && color(top) !== color(id)))
    );
  }
  function act(s, a) {
    if (!a || !canMove(s, a.from, a.to)) return s;
    const n = JSON.parse(JSON.stringify(s)),
      cards = source(s, a.from);
    if (a.from.zone === "cell") n.cells[a.from.col] = null;
    else n.tableau[a.from.col].splice(a.from.index);
    if (a.to.zone === "cell") n.cells[a.to.col] = cards[0];
    else if (a.to.zone === "foundation") n.foundations[a.to.col].push(...cards);
    else n.tableau[a.to.col].push(...cards);
    n.moves++;
    n.won = n.foundations.every((p) => p.length === 13);
    return n;
  }
  function options(s) {
    const sources = [];
    s.tableau.forEach((p, col) =>
      p.forEach((_, index) => {
        if (sequence(p.slice(index)))
          sources.push({ zone: "tableau", col, index });
      }),
    );
    s.cells.forEach((id, col) => {
      if (id !== null) sources.push({ zone: "cell", col });
    });
    const out = [];
    for (const from of sources)
      for (const [zone, count] of [
        ["tableau", 8],
        ["cell", 4],
        ["foundation", 4],
      ])
        for (let col = 0; col < count; col++) {
          const to = { zone, col };
          if (canMove(s, from, to)) out.push({ from, to });
        }
    return out;
  }
  function safeHome(s) {
    return (
      options(s).find((a) => {
        if (a.to.zone !== "foundation") return false;
        const id = source(s, a.from)[0],
          v = rank(id);
        return (
          v <= 2 ||
          s.foundations.every(
            (p, i) =>
              i === suit(id) || p.length >= v - (i % 2 === color(id) ? 2 : 1),
          )
        );
      }) || null
    );
  }
  function hint(s) {
    const safe = safeHome(s);
    if (safe) return safe;
    return (
      options(s)
        .filter(
          (a) =>
            !(
              a.from.zone === "tableau" &&
              a.from.index === 0 &&
              a.to.zone === "tableau" &&
              !s.tableau[a.to.col].length
            ),
        )
        .sort((a, b) => value(b) - value(a))[0] || null
    );
    function value(a) {
      const cards = source(s, a.from);
      return (
        (a.to.zone === "foundation" ? 40 : 0) +
        (a.to.zone === "tableau" ? 20 + cards.length : 0) +
        (a.from.zone === "cell" ? 8 : 0) +
        (a.from.index === 1 ? 12 : 0)
      );
    }
  }
  function restore(p) {
    if (
      !p ||
      p.version !== 1 ||
      !Number.isInteger(p.deal) ||
      p.deal < 1 ||
      p.deal > 1000000 ||
      !Array.isArray(p.actions) ||
      p.actions.length > 10000
    )
      return null;
    let s = create(p.deal);
    for (const a of p.actions) {
      const n = act(s, a);
      if (n === s) return null;
      s = n;
    }
    return s;
  }
  function practice() {
    const s = create(1);
    s.tableau = Array.from({ length: 8 }, () => []);
    s.tableau[0] = [11, 12];
    s.cells.fill(null);
    s.foundations = Array.from({ length: 4 }, (_, col) =>
      Array.from({ length: col === 0 ? 11 : 13 }, (_, i) => col * 13 + i),
    );
    s.practice = true;
    return s;
  }
  return {
    rank,
    suit,
    color,
    create,
    sequence,
    source,
    capacity,
    canMove,
    act,
    options,
    safeHome,
    hint,
    restore,
    practice,
  };
});
