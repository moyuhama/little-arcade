(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameEngine = factory();
})(globalThis, () => {
  "use strict";
  const cards = {
    strike: { name: "斩击", cost: 1, damage: 6, text: "造成 6 点伤害。" },
    guard: { name: "架盾", cost: 1, block: 5, text: "获得 5 点护甲。" },
    venom: {
      name: "淬毒",
      cost: 1,
      damage: 3,
      poison: 4,
      text: "造成 3 点伤害，叠加 4 层中毒。",
    },
    heavy: { name: "重斩", cost: 2, damage: 18, text: "造成 18 点伤害。" },
    brace: { name: "坚壁", cost: 1, block: 12, text: "获得 12 点护甲。" },
    fury: {
      name: "战意",
      cost: 1,
      strength: 2,
      text: "本场战斗力量 +2。每次攻击增伤。",
      exhaust: true,
    },
    siphon: {
      name: "汲取",
      cost: 2,
      damage: 10,
      heal: 4,
      text: "造成 10 点伤害，恢复 4 点生命。",
    },
    spark: {
      name: "追击",
      cost: 1,
      damage: 7,
      draw: 1,
      text: "造成 7 点伤害，抽 1 张牌。",
    },
    focus: {
      name: "静思",
      cost: 0,
      draw: 2,
      text: "抽 2 张牌。本场移除。",
      exhaust: true,
    },
    burst: {
      name: "蓄势",
      cost: 0,
      energy: 2,
      text: "获得 2 点能量。本场移除。",
      exhaust: true,
    },
    flurry: {
      name: "连刺",
      cost: 1,
      damage: 3,
      hits: 3,
      text: "造成 3 点伤害，攻击 3 次。力量对每次生效。",
    },
    weaken: {
      name: "牵制",
      cost: 1,
      damage: 4,
      weak: 2,
      text: "造成 4 点伤害。敌人接下来 2 回合攻击降低 30%。",
    },
    toxin: {
      name: "毒雾",
      cost: 2,
      poison: 10,
      text: "叠加 10 层中毒。结束回合结算，随后减 1。",
    },
    counter: {
      name: "盾击",
      cost: 1,
      block: 7,
      damage: 5,
      text: "获得 7 点护甲，造成 5 点伤害。",
    },
    mend: {
      name: "急救",
      cost: 1,
      heal: 8,
      text: "恢复 8 点生命。本场移除。",
      exhaust: true,
    },
    sweep: {
      name: "破阵",
      cost: 2,
      damage: 12,
      block: 10,
      text: "造成 12 点伤害，获得 10 点护甲。",
    },
  };
  const relics = {
    shell: { name: "古树纹章", text: "每回合开始获得 3 点护甲。" },
    fang: { name: "狼牙挂坠", text: "每场战斗初始力量 +2。" },
    heart: { name: "暖石", text: "每场战斗获胜后恢复 5 点生命。" },
    coin: { name: "旧钱袋", text: "每场战斗额外获得 15 金币。" },
    flask: { name: "旅人水壶", text: "休息时额外恢复 10 点生命。" },
  };
  function rand(s) {
    s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0;
    return s.rng / 4294967296;
  }
  function shuffle(s, a) {
    const out = [...a];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand(s) * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  function create(seed = Date.now() >>> 0, role = "knight", difficulty = 0) {
    return {
      seed,
      rng: seed >>> 0,
      role: role === "rogue" ? "rogue" : "knight",
      difficulty: Math.max(
        0,
        Math.min(10, Number.isInteger(difficulty) ? difficulty : 0),
      ),
      floor: 1,
      phase: "route",
      hp: 70,
      maxHp: 70,
      gold: 70,
      deck: [
        "strike",
        "strike",
        "strike",
        "strike",
        "guard",
        "guard",
        "guard",
        "guard",
        role === "rogue" ? "venom" : "heavy",
        role === "rogue" ? "focus" : "counter",
      ],
      relics: [],
      log: [],
      battles: 0,
    };
  }
  function routes(s) {
    if (s.floor % 6 === 0) return ["boss"];
    return {
      1: ["fight"],
      2: ["fight", "event"],
      3: ["rest", "fight"],
      4: ["elite", "shop"],
      5: ["rest", "fight"],
    }[s.floor % 6];
  }
  function draw(s, n) {
    for (let i = 0; i < n; i++) {
      if (!s.draw.length) {
        s.draw = shuffle(s, s.discard);
        s.discard = [];
      }
      if (s.draw.length && s.hand.length < 10) s.hand.push(s.draw.pop());
    }
  }
  function enemyIntent(s) {
    const e = s.enemy,
      phase = e.turn % 3;
    if (e.kind === "guardian" && phase === 1)
      return {
        type: "shield",
        value: 10 + e.act * 3,
        label: "整备：获得护甲，并蓄力",
      };
    if (e.kind === "leech" && phase === 2)
      return { type: "heal", value: 8 + e.act * 2, label: "恢复生命" };
    const base = e.attack + (phase === 2 ? 6 : 0);
    const value = Math.ceil(base * (e.weak > 0 ? 0.7 : 1));
    return {
      type: "attack",
      value,
      label: `攻击 ${value}${phase === 2 ? " · 重击" : ""}`,
    };
  }
  function startBattle(s, kind) {
    const act = Math.floor((s.floor - 1) / 6),
      boss = kind === "boss",
      elite = kind === "elite";
    const kinds = ["raider", "guardian", "leech"];
    const enemyKind = boss
      ? "guardian"
      : kinds[Math.floor(rand(s) * kinds.length)];
    const hp = Math.round(
      (boss ? 85 : elite ? 62 : 36) + act * 25 + s.difficulty * 5,
    );
    s.phase = "battle";
    s.battleKind = kind;
    s.enemy = {
      kind: enemyKind,
      name: boss
        ? ["苔石守卫", "深林巨像", "暮光领主"][act]
        : elite
          ? "精英 · " +
            { raider: "斥候", guardian: "重甲卫士", leech: "噬光者" }[enemyKind]
          : { raider: "斥候", guardian: "重甲卫士", leech: "噬光者" }[
              enemyKind
            ],
      hp,
      maxHp: hp,
      block: 0,
      attack: (boss ? 14 : elite ? 12 : 8) + act * 3 + s.difficulty,
      act,
      turn: 0,
      poison: 0,
      weak: 0,
    };
    s.draw = shuffle(s, s.deck);
    s.discard = [];
    s.exhaust = [];
    s.hand = [];
    s.energy = 3;
    s.block = s.relics.includes("shell") ? 3 : 0;
    s.strength = s.relics.includes("fang") ? 2 : 0;
    s.turn = 1;
    draw(s, 5);
  }
  function message(s, text) {
    s.log = [...s.log, text].slice(-6);
  }
  function heal(s, n) {
    s.hp = Math.min(s.maxHp, s.hp + n);
  }
  function victory(s) {
    if (s.enemy.hp > 0) return false;
    s.enemy.hp = 0;
    s.battles++;
    const amount =
      (s.battleKind === "boss" ? 65 : s.battleKind === "elite" ? 45 : 25) +
      (s.relics.includes("coin") ? 15 : 0);
    s.gold += amount;
    if (s.relics.includes("heart")) heal(s, 5);
    if (s.battleKind !== "fight") {
      const choices = Object.keys(relics).filter((r) => !s.relics.includes(r));
      if (choices.length) {
        const relic = choices[Math.floor(rand(s) * choices.length)];
        s.relics.push(relic);
        message(s, `获得遗物：${relics[relic].name}`);
      } else {
        s.maxHp += 5;
        heal(s, 5);
      }
    }
    s.rewards = shuffle(
      s,
      Object.keys(cards).filter((c) => !["strike", "guard"].includes(c)),
    ).slice(0, 3);
    s.phase = "reward";
    message(s, `战斗胜利，获得 ${amount} 金币。`);
    return true;
  }
  function nextRoom(s) {
    s.floor++;
    s.phase = s.floor > 18 ? "won" : "route";
  }
  function act(state, a) {
    if (!state || !a || ["won", "lost"].includes(state.phase)) return state;
    const s = JSON.parse(JSON.stringify(state));
    if (s.phase === "route") {
      if (!routes(s).includes(a.route)) return state;
      if (["fight", "elite", "boss"].includes(a.route)) startBattle(s, a.route);
      else if (a.route === "rest") s.phase = "rest";
      else if (a.route === "shop") {
        s.phase = "shop";
        s.stock = shuffle(
          s,
          Object.keys(cards).filter((c) => !["strike", "guard"].includes(c)),
        ).slice(0, 3);
        s.removed = false;
      } else s.phase = "event";
      return s;
    }
    if (s.phase === "battle") {
      if (a.end === true) {
        s.enemy.hp -= s.enemy.poison;
        s.enemy.poison = Math.max(0, s.enemy.poison - 1);
        if (victory(s)) return s;
        const intent = enemyIntent(s);
        if (intent.type === "attack")
          s.hp = Math.max(0, s.hp - Math.max(0, intent.value - s.block));
        else if (intent.type === "heal")
          s.enemy.hp = Math.min(s.enemy.maxHp, s.enemy.hp + intent.value);
        else s.enemy.block = intent.value;
        message(s, `第 ${s.turn} 回合：敌人${intent.label}。`);
        s.enemy.weak = Math.max(0, s.enemy.weak - 1);
        s.enemy.turn++;
        if (s.hp === 0) {
          s.phase = "lost";
          return s;
        }
        s.discard.push(...s.hand);
        s.hand = [];
        s.turn++;
        s.energy = 3;
        s.block = s.relics.includes("shell") ? 3 : 0;
        draw(s, 5);
        return s;
      }
      if (!Number.isInteger(a.card) || a.card < 0 || a.card >= s.hand.length)
        return state;
      const id = s.hand[a.card],
        c = cards[id];
      if (s.energy < c.cost) return state;
      s.energy -= c.cost;
      s.hand.splice(a.card, 1);
      (c.exhaust ? s.exhaust : s.discard).push(id);
      if (c.block) s.block += c.block;
      if (c.strength) s.strength += c.strength;
      if (c.heal) heal(s, c.heal);
      if (c.poison) s.enemy.poison += c.poison;
      if (c.weak) s.enemy.weak = Math.max(s.enemy.weak, c.weak);
      if (c.energy) s.energy += c.energy;
      for (let i = 0; i < (c.hits || 1) && c.damage; i++) {
        const damage = c.damage + s.strength,
          blocked = Math.min(s.enemy.block, damage);
        s.enemy.block -= blocked;
        s.enemy.hp -= damage - blocked;
      }
      message(s, `打出「${c.name}」。`);
      if (victory(s)) return s;
      if (c.draw) draw(s, c.draw);
      return s;
    }
    if (s.phase === "reward") {
      if (
        a.reward !== -1 &&
        (!Number.isInteger(a.reward) || !s.rewards[a.reward])
      )
        return state;
      if (a.reward !== -1) s.deck.push(s.rewards[a.reward]);
      nextRoom(s);
      return s;
    }
    if (s.phase === "rest") {
      if (a.rest === "heal") {
        heal(
          s,
          Math.ceil(s.maxHp * 0.3) + (s.relics.includes("flask") ? 10 : 0),
        );
        message(s, "在营火旁恢复了生命。");
      } else if (a.rest === "train") {
        s.maxHp += 6;
        heal(s, 6);
        message(s, "体能训练：最大生命 +6。");
      } else return state;
      nextRoom(s);
      return s;
    }
    if (s.phase === "event") {
      if (a.event === "risk" && s.hp > 10) {
        s.hp -= 10;
        s.gold += 60;
        message(s, "穿过荆棘：失去 10 点生命，获得 60 金币。");
      } else if (a.event === "safe") {
        heal(s, 8);
        message(s, "沿溪休整：恢复 8 点生命。");
      } else return state;
      nextRoom(s);
      return s;
    }
    if (s.phase === "shop") {
      if (a.leave === true) {
        nextRoom(s);
        return s;
      }
      if (Number.isInteger(a.buy) && s.stock[a.buy] && s.gold >= 45) {
        s.gold -= 45;
        s.deck.push(s.stock[a.buy]);
        s.stock[a.buy] = null;
        return s;
      }
      if (
        Number.isInteger(a.remove) &&
        a.remove >= 0 &&
        a.remove < s.deck.length &&
        !s.removed &&
        s.gold >= 55 &&
        s.deck.length > 5
      ) {
        s.gold -= 55;
        s.deck.splice(a.remove, 1);
        s.removed = true;
        return s;
      }
    }
    return state;
  }
  function restore(packet) {
    if (
      !packet ||
      packet.version !== 1 ||
      !Number.isInteger(packet.seed) ||
      packet.seed < 0 ||
      packet.seed > 4294967295 ||
      !["knight", "rogue"].includes(packet.role) ||
      !Number.isInteger(packet.difficulty) ||
      packet.difficulty < 0 ||
      packet.difficulty > 10 ||
      !Array.isArray(packet.actions) ||
      packet.actions.length > 5000
    )
      return null;
    let s = create(packet.seed, packet.role, packet.difficulty);
    for (const a of packet.actions) {
      const n = act(s, a);
      if (n === s) return null;
      s = n;
    }
    return s;
  }
  return { cards, relics, create, act, routes, enemyIntent, restore };
});
