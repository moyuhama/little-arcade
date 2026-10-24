const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { selectGames, recentEntries } = require("../lobby.js");
const root = path.resolve(__dirname, ".."),
  sandbox = {};
vm.runInNewContext(
  fs.readFileSync(path.join(root, "catalog.js"), "utf8"),
  sandbox,
);
const games = Array.from(sandbox.ARCADE_GAMES);
test("all thirty games have working resources and the shared play toolbar", () => {
  assert.equal(games.length, 30);
  assert.equal(new Set(games.map((game) => game.id)).size, 30);
  for (const game of games) {
    const filename = path.resolve(root, game.url),
      html = fs.readFileSync(filename, "utf8");
    assert.ok(html.includes(`data-game-id="${game.id}"`));
    for (const marker of [
      "game-toolbar",
      "data-help-open",
      "game-help",
      "switch-games",
    ])
      assert.ok(html.includes(marker), `${game.id}: ${marker}`);
    for (const [, url] of html.matchAll(/(?:src|href)="([^"#]+)"/g))
      assert.ok(
        fs.existsSync(path.resolve(path.dirname(filename), url.split("?")[0])),
        `${game.id}: ${url}`,
      );
    if (game.cover) assert.ok(fs.existsSync(path.resolve(root, game.cover)));
  }
});
test("new games participate in search, categories, favorites and recent ordering", () => {
  assert.deepEqual(
    selectGames(games, { query: "扫雷" }).map((g) => g.id),
    ["minesweeper"],
  );
  assert.deepEqual(
    selectGames(games, { query: "arkanoid" }).map((g) => g.id),
    ["breakout"],
  );
  assert.deepEqual(
    selectGames(games, { query: "tetris" }).map((g) => g.id),
    ["tetris"],
  );
  assert.deepEqual(
    selectGames(games, { query: "推箱子" }).map((g) => g.id),
    ["sokoban"],
  );
  assert.deepEqual(
    selectGames(games, { query: "翻牌" }).map((g) => g.id),
    ["memory"],
  );
  assert.deepEqual(
    selectGames(games, { query: "tic tac toe" }).map((g) => g.id),
    ["tictactoe"],
  );
  assert.equal(selectGames(games, { category: "街机" }).length, 5);
  assert.equal(selectGames(games, { category: "益智" }).length, 12);
  assert.deepEqual(
    selectGames(games, { category: "棋牌" })
      .map((g) => g.id)
      .sort(),
    [
      "tictactoe",
      "gomoku",
      "connect4",
      "reversi",
      "xiangqi",
      "checkers",
      "solitaire",
      "twentyfour",
    ].sort(),
  );
  for (const id of ["xiangqi", "checkers", "solitaire", "twentyfour"])
    assert.ok(
      selectGames(games, { query: games.find((g) => g.id === id).title }).some(
        (g) => g.id === id,
      ),
    );
  for (const category of ["动作", "体育"])
    assert.equal(selectGames(games, { category }).length, 2);
  assert.equal(selectGames(games, { category: "休闲" }).length, 1);
  for (const id of ["bubbles", "space", "racer", "basketball", "golf", "miner"])
    assert.ok(
      selectGames(games, { query: games.find((g) => g.id === id).title }).some(
        (g) => g.id === id,
      ),
    );
  assert.deepEqual(
    selectGames(games, { view: "favorites", favorites: ["breakout"] }).map(
      (g) => g.id,
    ),
    ["breakout"],
  );
  const recent = recentEntries([
    { id: "minesweeper", playedAt: 2 },
    { id: "snake", playedAt: 4 },
  ]);
  assert.deepEqual(
    selectGames(games, { view: "recent", recent }).map((g) => g.id),
    ["snake", "minesweeper"],
  );
});
