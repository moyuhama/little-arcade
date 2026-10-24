(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  const rank = (id) => (id % 13) + 1,
    suit = (id, suits) => Math.floor(id / 13) % suits;
  function rng(seed) {
    let v = seed >>> 0;
    return () => {
      v = (Math.imul(v, 1664525) + 1013904223) >>> 0;
      return v / 4294967296;
    };
  }
  function create(seed = Date.now() >>> 0, suits = 1) {
    suits = [1, 2, 4].includes(suits) ? suits : 1;
    const random = rng(seed),
      deck = Array.from({ length: 104 }, (_, i) => i);
    for (let i = 103; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const tableau = Array.from({ length: 10 }, () => ({ cards: [], up: 0 }));
    for (let row = 0; row < 6; row++)
      for (let col = 0; col < (row === 5 ? 4 : 10); col++)
        tableau[col].cards.push(deck.pop());
    for (const p of tableau) p.up = p.cards.length - 1;
    return {
      seed,
      suits,
      tableau,
      stock: deck,
      finished: [],
      moves: 0,
      won: false,
    };
  }
  function movable(s, col, index) {
    const p = s.tableau[col];
    return (
      !!p &&
      Number.isInteger(index) &&
      index >= p.up &&
      index < p.cards.length &&
      p.cards
        .slice(index)
        .every(
          (v, i, a) =>
            !i ||
            (rank(a[i - 1]) === rank(v) + 1 &&
              suit(a[i - 1], s.suits) === suit(v, s.suits)),
        )
    );
  }
  function canMove(s, from, index, to) {
    if (
      s.won ||
      !Number.isInteger(to) ||
      from === to ||
      !s.tableau[to] ||
      !movable(s, from, index)
    )
      return false;
    const p = s.tableau[to];
    return (
      !p.cards.length ||
      rank(p.cards.at(-1)) === rank(s.tableau[from].cards[index]) + 1
    );
  }
  function settle(s) {
    for (const p of s.tableau) {
      p.up = Math.max(0, Math.min(p.up, p.cards.length - 1));
      while (p.cards.length - p.up >= 13) {
        const a = p.cards.slice(-13);
        if (
          !a.every(
            (v, i) =>
              rank(v) === 13 - i && suit(v, s.suits) === suit(a[0], s.suits),
          )
        )
          break;
        s.finished.push(p.cards.splice(-13));
        p.up = Math.max(0, Math.min(p.up, p.cards.length - 1));
      }
    }
    s.won = s.finished.length === 8;
  }
  function act(s, a) {
    if (!a || s.won) return s;
    const next = JSON.parse(JSON.stringify(s));
    if (a.deal === true) {
      if (s.stock.length < 10 || s.tableau.some((p) => !p.cards.length))
        return s;
      for (const p of next.tableau) p.cards.push(next.stock.pop());
    } else {
      if (!canMove(s, a.from, a.index, a.to)) return s;
      next.tableau[a.to].cards.push(
        ...next.tableau[a.from].cards.splice(a.index),
      );
    }
    next.moves++;
    settle(next);
    return next;
  }
  function options(s) {
    const out = [];
    for (let from = 0; from < 10; from++)
      for (
        let index = s.tableau[from].up;
        index < s.tableau[from].cards.length;
        index++
      )
        for (let to = 0; to < 10; to++)
          if (canMove(s, from, index, to)) out.push({ from, index, to });
    return out;
  }
  function hint(s) {
    return (
      options(s)
        .filter((a) => s.tableau[a.to].cards.length || a.index > 0)
        .sort((a, b) => {
          const value = (a) => {
            const source = s.tableau[a.from],
              dest = s.tableau[a.to],
              same =
                dest.cards.length &&
                suit(source.cards[a.index], s.suits) ===
                  suit(dest.cards.at(-1), s.suits);
            return (
              Number(a.index === source.up && source.up > 0) * 30 +
              Number(same) * 20 +
              (source.cards.length - a.index) * 2
            );
          };
          return value(b) - value(a);
        })[0] || null
    );
  }
  function restore(packet) {
    if (
      !packet ||
      packet.version !== 1 ||
      !Number.isInteger(packet.seed) ||
      packet.seed < 0 ||
      packet.seed > 4294967295 ||
      ![1, 2, 4].includes(packet.suits) ||
      !Array.isArray(packet.actions) ||
      packet.actions.length > 5000
    )
      return null;
    let s = create(packet.seed, packet.suits);
    for (const a of packet.actions) {
      const next = act(s, a);
      if (next === s) return null;
      s = next;
    }
    return s;
  }
  function practice() {
    const s = create(1, 1);
    s.tableau = Array.from({ length: 10 }, () => ({ cards: [], up: 0 }));
    s.tableau[0].cards = Array.from({ length: 12 }, (_, i) => 12 - i);
    s.tableau[1].cards = [0];
    const used = new Set(s.tableau.flatMap((p) => p.cards));
    s.stock = Array.from({ length: 104 }, (_, i) => i).filter(
      (i) => !used.has(i),
    );
    s.practice = true;
    return s;
  }
  return {
    rank,
    suit,
    create,
    movable,
    canMove,
    act,
    options,
    hint,
    restore,
    practice,
  };
});
