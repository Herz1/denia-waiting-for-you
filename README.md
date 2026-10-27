# До свидания · 达妮娅纪念馆

《鸣潮》达妮娅个人粉丝站重构版。延续原站「直到下次再见」、粉紫封面、Dear Denia、等待天数、蛋糕与相册，加入学院档案、作品放映、心愿、封存页和历史素材册。

原站：[preview.daniya.cc](https://preview.daniya.cc/) · 仓库：[Herz1/denia-waiting-for-you](https://github.com/Herz1/denia-waiting-for-you)

## 打开与运行

完整解压后，直接用浏览器打开根目录 **index.html**。新版无需安装依赖、构建或付费服务；保留全部文件夹的相对位置。远程图库、原视频与桌宠精灵图需要联网，`file://` 的存储和下载权限由浏览器决定。

需要稳定同源预览时，使用 **Node.js 20+**：

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

打开 `http://127.0.0.1:5173/`。不需要先运行 `npm install`。

## 页面与功能

| 入口 | 内容 |
| --- | --- |
| `index.html` | 原封面、等待计数、蛋糕、相册选页 |
| `gallery.html` / `dreamer.html` | 原站图库与AI分类、筛选、收藏、组图灯箱 |
| `profile.html` / `story.html` | 学院档案、官方出处、留声卡、默认封存的剧情 |
| `fanworks.html` / `daily/index.html` | 原49条视频、作者/原帖、筛选、排序、本地收藏 |
| `interactive.html` | 本地心愿、泡泡、蛋糕、原桌宠与兼容显示 |
| `friends.html` | 署名说明、下架联系、友邻占位 |
| `archive.html` | 原字面文案与42个原媒体的门控历史素材册 |
| `review.html` | 原176条候选审核及JSON导入导出，经确认后载入 |

心愿支持JSON下载、文件导入、**复制备份文本/粘贴备份文本**；PNG留声卡先显示预览，可下载或长按/右键另存。收藏与心愿属于当前设备，不是公共留言。

桌宠在原域优先使用原组件；新域或本地打开时直接启用兼容层，原组件加载失败时同样回退，，本地 `memorial/pet.js` 使用原站同一精灵图运行九种动作。聊天、选图、表情包和朗读仍在[原桌宠页面](https://preview.daniya.cc/pet-preview.html)，原聊天的离线状态没有被伪装恢复。

## 原素材保留

- 原导入基线 **71文件、19,236,169字节**：63个非HTML仍在原路径，8个原HTML逐字节保存在 `legacy/`，原公共入口由新版接续。
- **42个原媒体**都有展示或历史入口，首页保留全部 **24个响应式候选**；原图、重复版本与旧编译资源不删除。
- **49条日报**保留原data URI封面、标题、作者、主页、原帖、简介与历史数据；**87图/67组**保留线上元数据、原路径及组成员关系。
- **246条去重字面文案**、原5栏目、原4条二创初始记录、176候选审核原页均保留。原开发期React/TypeScript源码不在导入包中，新版没有宣称已恢复原工程。

离线核对完整项目：

```bash
npm run verify:preservation
# 机器可读结果
node scripts/verify-preservation.mjs --json
```

此检查验证原文件与指定数据，不代替浏览器交互、远程服务、署名真实性或视觉验收。详细映射见 [MATERIAL-MAP.txt](docs/MATERIAL-MAP.txt)，字节证据见 [ASSET-AUDIT.txt](docs/ASSET-AUDIT.txt)。

## 构建与部署

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

`build` 只复制公开文件到 `dist/`。**部署只上传 dist/**；完整源包另保留 `legacy/` 与维护文档。不要直接公开仓库根目录中的旧HTML，以免绕过新版剧情保护。Node命令不会自动上线或更改仓库/网站的可见性。

原 `_worker.js` 代理仍需要真实 `GALLERY_ARCHIVE_ORIGIN`；当前相册可继续引用原站媒体。静态托管不自动创建图库后端，项目子路径与目标域应分别验证。

## 内容与验证边界

图库67组和3个本地示例的作者/原帖仍待补录；49条视频保留原署名。87个成员缩略图与原可见标题已由主代理目检，不确定组封存，高清细字未逐字转写。视频元信息审校不等于原片逐帧无剧透。

线上原图和桌宠精灵图仍依赖原域，不是完整离线备份；独立官方音频、私密联系邮箱及部分友邻信息保留明确占位。5月21日为沿用的相遇纪念日，不擅自记为角色生日。文件校验或构建成功不意味着全部功能在所有环境通过。

维护前阅读 [AGENTS.md](AGENTS.md)、[IMPORT.md](docs/IMPORT.md)、[OPERATIONS.txt](docs/OPERATIONS.txt)。实施选择见 [ASSUMPTIONS.txt](docs/ASSUMPTIONS.txt)，剩余资料边界见 [GAPS.txt](docs/GAPS.txt)。

本站为非官方粉丝站，与库洛游戏无隶属关系；《鸣潮》相关名称、角色及官方素材版权归原权利人，二创版权归各自作者。原仓库许可证保留，不替代第三方素材的权利与授权说明。

## 2026-10-27 多版本归并

正式维护入口沿用 denia-memorial-album（当前仅所有者可访问）。新增 `collection.html` 保存三个旧站的173条资料与72份媒体，剧情内容默认封存；`records.html` 支持全量本机记录备份、预览冲突与显式导入。两个v0工程与全部旧源码保留在恢复包，旧站不删除。具体映射、验收与边界见 `docs/CONSOLIDATION-20261027.txt`。余温的中日两份角色介绍MP3已恢复，可在旧站收藏册试听；此前文档中的独立音频缺口据此更新。
