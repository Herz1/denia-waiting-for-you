# 达妮娅 · 直到下次再见

《鸣潮》达妮娅个人粉丝站，仓库地址：<https://github.com/Herz1/denia-waiting-for-you>。

2026-10-27 从用户提供的 `preview-daniya-production-cbdc5b8d-20261027(1).zip` 导入，共 **71 个原始文件、19,236,169 字节**。网站原始文件按原路径完整保留；另补充本说明、Agent 交接文档和零依赖运行脚本。

**这是可运行的发布包。压缩包没有 `src/`、原始 React/TypeScript 工程、构建配置或 source map。`assets/*.js` 是编译后的代码，不能视为原始源码。**

## 启动与打包

需要 Node.js 20 或更高版本。无第三方依赖，无需先安装包。

```bash
git clone https://github.com/Herz1/denia-waiting-for-you.git
cd denia-waiting-for-you
npm run dev -- --host 0.0.0.0 --port 5173
```

打开 `http://localhost:5173/`。预览时必须从站点根路径提供服务，因为页面使用 `/assets/...` 绝对路径。

```bash
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

`build` 将网站文件复制到 `dist/`；它不会编译或还原不存在的原始工程。`npm start` 等同于 `npm run dev`。

## 页面入口

| 页面 | 路径 |
| --- | --- |
| 首页：等待天数、蛋糕互动、导航 | `/index.html` |
| 相册画廊 | `/gallery.html` |
| 造梦者 | `/dreamer.html` |
| 二创区 | `/fanworks.html` |
| 互动区 | `/interactive.html` |
| 友情链接 | `/friends.html` |
| 达妮娅日报 | `/daily/index.html` |
| 二创候选审核、导出反馈 | `/review.html` |

## 给 Arena Agent

先读 [AGENTS.md](AGENTS.md) 和 [docs/IMPORT.md](docs/IMPORT.md)，启动现有网站并查看全部页面，再根据用户要求改进。网站已直接展开在仓库中，不需要额外下载 ZIP。

可直接把下列文字连同仓库链接交给 Agent：

> 读取 https://github.com/Herz1/denia-waiting-for-you 的 main 分支，先看 README.md、AGENTS.md 和 docs/IMPORT.md，运行现有网站并检查全部页面。在现有达妮娅粉丝站基础上继续改进，保留已有内容、素材、页面及互动。这里是发布包，缺少原始 React/TypeScript 源码；若需要重建可维护工程，应先核对现状并分阶段迁移。请结合我接下来给出的具体要求实施，并验证桌面和手机页面。

## 图库服务与外链

`_worker.js` 为 `/api/gallery/...` 提供只读代理，需要 `GALLERY_ARCHIVE_ORIGIN` 指向已有归档服务的 HTTPS 根地址。当前附件不含该环境值、归档服务代码或数据库。未配置时，相应接口会返回 503，页面本身仍可预览；这不是导入时漏传了图片。预览脚本会运行原有代理逻辑。

日报封面、原视频和部分链接依赖外部网站；用户在浏览器中保存的审核进度等本地数据不在 ZIP 内。详见 [导入说明](docs/IMPORT.md)。

原仓库 `LICENSE` 保留。第三方角色、图片、视频和音乐的权利及授权仍以相应权利人的声明为准。
