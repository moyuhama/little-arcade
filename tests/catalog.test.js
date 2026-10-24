const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { selectGames, recentEntries } = require('../lobby.js');
const root = path.resolve(__dirname, '..'), sandbox = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'catalog.js'), 'utf8'), sandbox);
const games = Array.from(sandbox.ARCADE_GAMES);
test('all six games have working resources and the shared play toolbar', () => {
  assert.equal(games.length, 6); assert.equal(new Set(games.map(game => game.id)).size, 6);
  for (const game of games) {
    const filename = path.resolve(root, game.url), html = fs.readFileSync(filename, 'utf8');
    assert.ok(html.includes(`data-game-id="${game.id}"`));
    for (const marker of ['game-toolbar', 'data-help-open', 'game-help', 'switch-games']) assert.ok(html.includes(marker), `${game.id}: ${marker}`);
    for (const [, url] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) assert.ok(fs.existsSync(path.resolve(path.dirname(filename), url)), `${game.id}: ${url}`);
    if (game.cover) assert.ok(fs.existsSync(path.resolve(root, game.cover)));
  }
});
test('new games participate in search, categories, favorites and recent ordering', () => {
  assert.deepEqual(selectGames(games, { query: '扫雷' }).map(g => g.id), ['minesweeper']);
  assert.deepEqual(selectGames(games, { query: 'arkanoid' }).map(g => g.id), ['breakout']);
  assert.deepEqual(selectGames(games, { query: 'tetris' }).map(g => g.id), ['tetris']);
  assert.deepEqual(selectGames(games, { query: '推箱子' }).map(g => g.id), ['sokoban']);
  assert.equal(selectGames(games, { category: '街机' }).length, 3);
  assert.equal(selectGames(games, { category: '益智' }).length, 3);
  assert.deepEqual(selectGames(games, { view: 'favorites', favorites: ['breakout'] }).map(g => g.id), ['breakout']);
  const recent = recentEntries([{ id: 'minesweeper', playedAt: 2 }, { id: 'snake', playedAt: 4 }]);
  assert.deepEqual(selectGames(games, { view: 'recent', recent }).map(g => g.id), ['snake', 'minesweeper']);
});
