// 新游戏上线：在清单中添加一条记录。分类与数量会由首页自动生成。
// url 和可选的 cover 均使用相对于网站首页的路径，兼容 GitHub Pages。
globalThis.ARCADE_GAMES = [
  {
    id: '2048',
    title: '2048',
    description: '滑动方块，合并相同数字。从一个小小的 2，向 2048 出发。',
    category: '益智',
    tags: ['数字合并', '单人', '键盘 / 触屏'],
    keywords: ['puzzle', '数字', '合成', '2048'],
    url: './games/2048/index.html',
    addedAt: '2026-10-23',
    artwork: '2048'
  },
  {
    id: 'snake',
    title: '贪吃蛇',
    description: '转个弯，吃颗果子。跟着自己的节奏，让小蛇和快乐一起慢慢变长。',
    category: '街机',
    tags: ['三档速度', '单人', '键盘 / 触屏'],
    keywords: ['snake', '蛇', '反应', '经典', '贪吃蛇'],
    url: './games/snake/index.html',
    addedAt: '2026-10-24',
    cover: './games/snake/cover.svg'
  },
  {
    id: 'minesweeper',
    title: '扫雷',
    description: '跟着数字找线索，标出地雷。每一次小心翼翼，都离答案近一点。',
    category: '益智',
    tags: ['逻辑推理', '首点安全', '键盘 / 触屏'],
    keywords: ['minesweeper', '扫雷', '雷区', '逻辑', '数字'],
    url: './games/minesweeper/index.html',
    addedAt: '2026-10-24',
    cover: './games/minesweeper/cover.svg'
  },
  {
    id: 'breakout',
    title: '打砖块',
    description: '移动挡板，接住小球，把砖块一块块打掉。三关挑战，快乐反弹。',
    category: '街机',
    tags: ['三关挑战', '反应', '键盘 / 触屏'],
    keywords: ['breakout', 'arkanoid', '打砖块', '弹球', '反弹'],
    url: './games/breakout/index.html',
    addedAt: '2026-10-24',
    cover: './games/breakout/cover.svg'
  },
  {
    id: 'tetris',
    title: '俄罗斯方块',
    description: '旋转、移动、消除整行。给下一块留个位置，慢慢找到自己的节奏。',
    category: '街机',
    tags: ['消行升级', '落点预览', '键盘 / 触屏'],
    keywords: ['tetris', '俄罗斯方块', '方块', '消除', '堆叠'],
    url: './games/tetris/index.html',
    addedAt: '2026-10-24',
    cover: './games/tetris/cover.svg'
  },
  {
    id: 'sokoban',
    title: '推箱子',
    description: '把木箱一一送回家。十个小关卡，走错可以退一步，慢慢想也没关系。',
    category: '益智',
    tags: ['10 个关卡', '逐步撤销', '进度保存'],
    keywords: ['sokoban', '推箱子', '搬箱子', '仓库', '逻辑', '解谜'],
    url: './games/sokoban/index.html',
    addedAt: '2026-10-24',
    cover: './games/sokoban/cover.svg'
  }
];
