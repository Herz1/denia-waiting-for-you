# 2026-10-27 网站导入说明

## 来源与完整性

- 附件：`preview-daniya-production-cbdc5b8d-20261027(1).zip`。
- 71 个原始文件，共 19,236,169 字节；导入时逐文件比对压缩包字节一致。
- 全部路径、字节数、SHA-256 与 Git blob SHA 记录在 `import-manifest.json`。
- 网站内容、原图、编译脚本、样式、旧构建资源、Cloudflare 路由与代理文件均按原样保留，没有为了减小体积删除旧资源或重新压缩图片。
- 原仓库已有 `LICENSE`；本次新增网站文件与交接/运行辅助文件，保留原提交历史。

## 已知边界

附件为生产发布目录。没有源码目录、开发期组件文件、原构建依赖及配置、source map、服务端数据库、服务密钥或图库归档服务工程。本仓库新增的 `package.json` 和 `scripts/` 是为交接提供的预览与复制打包工具，不代表找回了原始工程。

`_worker.js` 是 Cloudflare 风格的只读图库归档代理：

- `/api/gallery/archive`、归档条目与分组等路由转发给 `GALLERY_ARCHIVE_ORIGIN`。
- 该变量需要已有服务的 HTTPS 根地址；附件未提供，不能从网页推断或捏造。
- 本地 Node 预览支持该代理；不设置变量时返回原代理定义的 503 响应。
- 图片缩略图的 Cloudflare 缓存依赖生产环境，Node 预览不提供 `caches.default`。
- 静态托管平台若不执行该 Worker，图库 API 需要单独接入。

日报和审核页中的 B 站封面、视频与社交外链仍依赖网络。浏览器 `localStorage` 中的个人进度不随 ZIP 或 Git 传递。

## 文件结构

```text
index.html                  首页（含首屏预渲染和等待天数启动逻辑）
gallery.html                相册画廊入口
dreamer.html                造梦者入口
fanworks.html               二创区入口
interactive.html            互动区入口
friends.html                友情链接入口
daily/index.html            独立日报页面（含内嵌内容）
review.html                 独立二创候选审核页面
assets/                     已编译的 JS/CSS、响应式图片和旧构建资源
backgrounds/                原始背景图
gallery-examples/           画廊分类示例素材
_worker.js                  只读图库归档代理
_routes.json                Cloudflare Worker 路由
_headers                    Cloudflare 静态资源缓存头
scripts/                    本次补充的零依赖预览/打包工具
docs/import-manifest.json   原始 71 个文件的完整性基线
```

仓库用于源码/发布内容交接。没有启用 GitHub Pages、创建新网站部署或修改已有网站的托管设置。由于页面包含 `/assets/` 绝对路径，部署到 GitHub Pages 项目子路径前需要额外处理资源基址。
