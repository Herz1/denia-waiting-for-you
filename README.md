# До свидания · 直到下次再见

等待达妮娅（《鸣潮》共鸣者 Denia）的应援小站。
本版（2026-10-26）在旧站基础上整体重制：**前端重排、新增零依赖后端、UI 延续旧站薰衣草纸面语言、桌宠交互大幅扩展**；
旧站的素材与元素（主视觉手绘图、相册相机装帧、二创管理台、蛋糕仪式、对话桌宠）全部保留并完善，没有直接删除。

## 一句话逛站

| 页面 | 内容 |
| --- | --- |
| `/` | 等待天数计数、给娅娅留蛋糕（全站累计）、 draggable 迷你桌宠、分区传送门 |
| `/gallery.html` | 相册画廊：手绘同人（真人绘制）+ 摄影shelf + 「AI 草稿·已归档」说明；相机相册装帧、灯箱大图、作者署名与原作链接 |
| `/fanworks.html` | 二创区：分类/搜索/排序/收藏/分页/精选/详情/编辑/导入导出 JSON 的完整管理台 |
| `/pet.html` | 互动区：完整桌宠（拖拽抛掷、摸摸头、喂蛋糕、打盹、深夜睡觉、散步）+ 聊天面板（记忆名字、表情包、粘贴/拖入图片）+ 吹泡泡小游戏 |
| `/daily/index.html` | 达妮娅日报：期刊卡片与本期精选（保留原投稿入口） |

## 运行

```bash
node server/server.js        # 或 npm start；PORT 环境变量可改端口，默认 4173
```

- 后端为零依赖 Node HTTP 服务：静态托管 + `/api/*`（health / state / cake / works / gallery / trivia / chat）。
- **纯静态部署同样可用**（如 GitHub Pages）：客户端探测不到 `/api/health` 时自动回落 localStorage + `data/*.seed.json`，页面右上角徽章会显示「本地模式 · 离线可用」。
- 运行时数据（蛋糕计数、服务器端收录覆盖）写在 `server/runtime/`，已 gitignore；随站种子数据在 `data/`。

## 数据与对话

- `data/works.seed.json`：二创收录种子（含旧站日报与三部视频条目）。
- `data/gallery.seed.json`：画廊条目（署名、来源链接、裁切坐标）与真人绘制承诺文案。
- `data/trivia.json`：泡泡小游戏掉落的小知识。
- `assets/js/chat-engine.js`：娅娅的规则式对话引擎（浏览器 / Node 共用），台词全部手写，无 AI 生成内容。

## 角色图来源承诺（重要）

**本站角色形象一律使用真人绘制作品，不使用 AI 生图。** 当前素材：

| 素材 | 来源 |
| --- | --- |
| 睡梦中的公主与黑猫玩偶（主视觉） | 旧站传承手绘同人图（作者署名整理中） |
| 眨眼 · 剪刀手（移动版主视觉/桌宠清醒表情） | 旧站传承手绘同人图（作者署名整理中） |
| 我们两个 · 嘘 | HiroHenuri（X @HiroHenuri），[reddit 自投](https://www.reddit.com/r/WutheringWaves/comments/1sjb5i3/denia_fanart_by_me_hirohenuri/) |
| 指尖星尘 | Bao 199839（pixiv），经 [Zerochan #4693438](https://www.zerochan.net/4693438) |
| 链条午后 | MingLu（小红书，画面带签名），经 [Zerochan #4687520](https://www.zerochan.net/4687520) |

版权归原作者，本站仅作同好展示、不作商用；作者要求下架时立即移除（提 issue 或联系站务）。
旧的「造梦者」AI 草稿合集自本版起归档，不再展出角色 AI 图。

## 目录

```
assets/art/        真人绘制素材（含旧站传承主视觉的多分辨率版本）
assets/css/        base / home / pet / petpage / gallery / fanworks / daily
assets/js/         api(数据层) ui pet chat-engine home fanworks gallery daily pet-page
data/              种子数据（works / gallery / trivia）
server/server.js   零依赖后端
daily/             日报页
```

## 许可

代码 MIT（见 LICENSE）。图片与收录内容的权利归各自作者。
