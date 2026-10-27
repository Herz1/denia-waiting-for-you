# 星光收藏室 · 分支审阅说明

仓库：`Herz1/denia-waiting-for-you`  
分支：`feat/site-polish-20261028`  
基线：`e8ee06df9e248533e0946f59c597075dbaaee78a`

## 本轮改动

在原站粉紫色、纸张、星光与角色插画的视觉体系中增加独立的「星光收藏室」：`/daily/library.html`。

- 直接读取原有 `daily/index.html` 的 49 部作品，不另造数据源。保留作者署名、标签、时长、原视频链接和原日报快照的播放数。
- 支持标题、作者、类型、标签的组合关键词搜索；类型、播放数/原顺序/名称排序与「我的收藏」可组合使用。
- 筛选状态写入 URL，可分享筛选视图并使用前进/后退。收藏保存在当前浏览器，其他标签页修改会同步。
- 支持版本化 JSON 收藏导出与合并导入。100 KB 文件大小、版本、类型、数量、字符串长度、作品 ID 都先校验；重复去重，未收录作品跳过，拒绝错误文件时保留原收藏。
- 存储不可用时保留本次访问的收藏并给出备份提示。收藏筛选中删除卡片时焦点回到收藏按钮。
- 首页新增收藏室入口，等待原 React 包的 `denia:hydrated` 信号后再插入，避免破坏预渲染水合。原日报入口、等待天数和蛋糕互动继续使用原有实现。
- 新增 `daily/collection-core.js`、`library.js`、`library.css`、`entry.js`，以及独立行为测试。没有新增运行依赖。

## 保留范围

本仓库仍是已有网站的发布包，没有原 React/TypeScript 源工程。本次不声称恢复了原始源码。既有编译 JS/CSS、图片、其他页面、71 个原文件的导入清单和图库代理均保留；对原有页面只增加首页模块入口。

首页、画廊、造梦者、二创区、互动区、友情链接、日报与审核页已在本轮修改前观察。占位内容没有伪装成已上线的服务。

## 实际验证

- `npm test`：10 组行为检查通过，包括 NFKC 搜索、跨字段多词、分类+收藏组合、稳定排序、坏 JSON、错误版本、错误类型、数量与大小边界、去重和存储往返。
- `node --check daily/library.js` 与 `node --check daily/entry.js` 通过。
- `npm run build` 通过：复制 14 项公开目录/文件到 `dist/`，这不是原始 React 源码编译。
- `git diff --check` 通过。
- 恢复工作区后重新完成浏览器检查：原有 49 项读取成功；搜索「莓莓纱」得到 2/49；收藏一项后收藏筛选得到 1/49；刷新保留收藏和筛选状态。
- 首页新入口可见，蛋糕弹窗打开成功；本次首页检查未出现 React 水合错误。
- 桌面检查无横向溢出。390px iframe（内容区 375px）检查 `clientWidth = scrollWidth = 375`，搜索栏、两列选项与单列卡片布局正常。
- [收藏室审阅图](review-20261028/collection.jpg) 来自上述浏览器检查。

## 追加的键盘焦点与分支验证

收藏卡片切换状态后会重建列表；已补回新卡片收藏按钮的焦点。收藏筛选中移除条目仍返回收藏筛选按钮。此两行焦点补丁经代码复核，运行环境离线后未重新完成浏览器交互验收。

新增只读权限的 `Verify collection` 工作流，在本功能分支和 PR 中执行三个模块语法检查、10 组行为测试、复制构建与新页面打包检查。没有部署步骤。远端运行结果以本 PR 最新 Checks 为准。

## 尚需外部条件的部分

- 云浏览器的文件选择器/下载适配器不稳定，真实文件选择与落盘流程没有完成端到端验收。导入数据校验与导出序列化已通过行为检查。
- 图库仍需要原有 `GALLERY_ARCHIVE_ORIGIN`，缺失时继续如实显示不可用。新收藏室读取同源日报，不依赖该服务。
- B 站外链与第三方媒体的可用性不由本分支控制；原日报内容日期与播放数采集快照已在页面明确标注。
- 本轮没有改变生产托管、部署设置、主干或仓库可见性。

## 参考与取舍

- [Europeana Collections 的检索与筛选设计](https://www.dataspace-culturalheritage.eu/en/news/introducing-the-new-europeana-collections-website)：借鉴组合筛选与即时结果反馈，视觉仍使用原站主题。
- [MDN localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)：存储异常处理。
- [MDN storage event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event)：多窗口收藏同步。
- [MDN Blob URL](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/blob)：本地备份导出与对象 URL 清理。

没有复制第三方网站美术或引入额外图库插件；当前 49 项内容可以由独立原生模块可靠处理。

## 预览与回退

```sh
git fetch origin
git switch --track origin/feat/site-polish-20261028
npm test
npm run build
npm run dev
```

从站点根路径打开 `/daily/library.html`，保留原站 `/assets/` 绝对资源路径。新增文件均放在已有公开 `daily/` 目录，无需改复制清单。

未合并的分支不会改变主干。结束本地预览后可切回 `main`；要撤销此次分支改动，运行 `git revert <本次提交 SHA>` 后正常推送。无需强推、删除历史或更改主干。
