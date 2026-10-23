# 摸鱼街机

游戏大厅 + 独立小游戏页面，纯 HTML/CSS/JavaScript，无需安装或构建。

在线地址：https://shuailongwang.github.io/little-arcade/

## 本地预览

在本目录执行 `python3 -m http.server 4173`，然后打开 `http://localhost:4173/`。

## 新增游戏

1. 在 `games/游戏英文名/` 新建游戏页面与资源，例如 `games/snake/index.html`。
2. 在 `catalog.js` 的清单中追加一条记录，确保 `id` 唯一：

```js
{
  id: 'snake',
  title: '贪吃蛇',
  description: '控制方向，吃到食物，让小蛇慢慢长大。',
  category: '街机',
  tags: ['单人', '反应'],
  keywords: ['snake', '蛇'],
  url: './games/snake/index.html',
  addedAt: '2026-10-24',
  cover: './games/snake/cover.png' // 可选，没有封面时自动显示游戏名称
}
```

3. 在新游戏 HTML 的 `<head>` 中加入：

```html
<script defer src="../../lobby.js" data-game-id="snake"></script>
```

4. 将修改提交到 GitHub 的 `main` 分支。Pages 从根目录自动发布。

请先完成游戏页面，再登记到清单。首页会自动生成游戏卡片、分类、数量与搜索结果，无需手动修改首页。

## 功能与文件

- `index.html`：游戏大厅结构。
- `hall.css`：大厅专用响应式样式。
- `catalog.js`：已上线游戏的统一清单。
- `lobby.js`：搜索、分类、排序、收藏、最近玩过和游玩记录。
- `style.css`：共享样式及 2048 页面样式。
- `games/2048/`：2048 游戏，支持方向键/WASD、手机滑动、撤销、自动保存。

收藏与最近 12 款游玩记录保存在当前浏览器，不跨设备同步。浏览器禁用存储时，大厅仍可搜索与筛选，收藏仅在当前页面有效。2048 的进度与最高分使用原有独立存储，不受大厅更新影响。

## GitHub Pages 设置

Settings → Pages → Source：Deploy from a branch → main → / (root)。之后每次提交自动发布；本项目无需额外构建工作流。
