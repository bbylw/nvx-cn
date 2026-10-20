# NVX 中文站

[NVX](https://github.com/microsoft/nvx) 超轻量级微虚拟机沙箱的**非官方中文文档站**。落地页与中文文档站各自独立成页，使用 Astro + Tailwind CSS 构建为纯静态站点。

文档站把上游 `microsoft/nvx` 的 16 篇主文档、31 篇架构章节以及宿主准备脚本与安全策略完整翻译为中文（共 49 篇，正文、表格、命令与说明均已翻译，代码与 API 名称保持原样），不再是链接地图。

> 本站与 Microsoft 无隶属关系，也不代表 Microsoft 官方立场。产品名称、命令与文档内容以 [`microsoft/nvx`](https://github.com/microsoft/nvx) 仓库原文为准；许可与字体归属见 [`public/NOTICE.txt`](public/NOTICE.txt)。

## 技术栈

- Astro 7（静态输出）
- Tailwind CSS 4（通过 `@tailwindcss/vite`）
- TypeScript 6（`astro check`）
- Bun 1.4+（也可以使用 Node.js 20+ 与 npm/pnpm）

## 本地开发

```bash
bun install
bun run dev        # http://localhost:4321
bun run check      # Astro + TypeScript 检查
bun run build      # 输出到 dist/
bun run preview    # 预览构建结果
```

## 部署与站点地址

站点默认按**域名根路径**构建。部署到子路径（例如 GitHub Pages 项目页）时，需要同时设置站点地址与基础路径：

```bash
# 域名根路径
SITE_URL=https://nvx.example.com bun run build

# 子路径：https://example.github.io/nvx/
SITE_URL=https://example.github.io BASE_PATH=/nvx bun run build
```

PowerShell：

```powershell
$env:SITE_URL = "https://example.github.io"
$env:BASE_PATH = "/nvx"
bun run build
```

- `SITE_URL` 未设置时，构建会省略 `canonical`、`og:url`，避免生成错误域名；Netlify、Cloudflare Pages、Vercel 会自动读取其平台环境变量作为回退。
- `BASE_PATH` 用于子路径部署，站内链接会通过 `src/lib/site.ts` 自动加上前缀。
- `dist/` 可直接部署到任意静态托管；没有服务端依赖。

## 目录

```text
src/
  pages/index.astro       落地页
  pages/docs/index.astro  文档首页（概览与快速启动）
  pages/docs/[...slug].astro  文档页（按内容集合生成）
  pages/404.astro         404
  content/docs/           中文文档正文（Markdown + frontmatter）
  content.config.ts       文档内容集合与 frontmatter 校验
  layouts/Base.astro      字体、元信息、skip link、入场动效回退
  layouts/DocsLayout.astro 文档页外壳：目录 / 正文 / 本页目录
  components/TopRow.astro 顶部拼板导航
  components/DocsNav.astro 文档目录（侧栏与移动端共用）
  components/BootConsole.astro 客户机切换控制台
  styles/global.css       设计令牌、文档排版与全局样式
  lib/site.ts             BASE_URL 前缀与 canonical 规范化
  lib/docs.ts             文档分组、排序、路由与上下篇
public/
  favicon.svg            站点图标
  NOTICE.txt             内容来源、翻译范围、MIT 许可与字体归属
  robots.txt             爬虫规则
```

## 内容与交互约定

- 文档正文是上游英文文档的完整中文翻译：命令、代码、路径与 API 名称保持原样，说明文字与表格已翻译；未翻译的上游文件（如 `scripts/setup/README.md`）在正文中链接到 GitHub 原文。
- 文档内容存放在 `src/content/docs/`，由内容集合统一校验 frontmatter（`title` / `description` / `group` / `order` / `source`），页面按 `entry.id` 生成 `/docs/<id>/` 路由。
- 站内文档链接统一写成 `/docs/...` 绝对路径；构建后由 `astro.config.mjs` 的集成统一补上 `BASE_PATH` 前缀。
- 终端示例使用 `scripts/nvx.py` 支持的命令面；需要 `--output` 的 `build-guest-binaries` 已显式给出输出目录。
- `BootConsole` 的客户机切换使用真实按钮与 `aria-pressed`，结果行通过 `aria-live` 播报。
- 入场动效在脚本不可用时自动回退为可见内容；脚本可用但元素始终未进入视口时，4 秒后强制显示，避免锚点跳转、打印或截图时内容永久隐藏；`prefers-reduced-motion` 下关闭位移与动画。
- 拉丁字体（Syne、Familjen Grotesk）通过 Fontsource 自托管；中文使用系统 CJK 字体，避免额外下载数百 KB 的网页字体。

## 可访问性

- 每页包含 `header`、`main`、`footer` 地标与“跳到主要内容”链接。
- 焦点样式使用深色内环 + 亮色外环，在深色、白色与 lime 背景上都可辨认。
- 文档目录使用真实链接与 `aria-current="page"` 标记当前页；窄屏时折叠为原生 `details`，键盘可用。
- 右侧“本页目录”由正文标题生成，滚动时保持可见。
- 正文表格与代码块在窄屏下横向滚动，不撑破页面。

## 许可与归属

- 站点文案与文档索引改编自 [`microsoft/nvx`](https://github.com/microsoft/nvx)，遵循 MIT License，版权归 Microsoft Corporation 所有。
- Syne 与 Familjen Grotesk 遵循 SIL Open Font License 1.1。
- 完整声明见 [`public/NOTICE.txt`](public/NOTICE.txt)。

## 本地工作目录

`.frontend-studio/`、`.workbuddy/`、`.wbapp_*` 是本地设计与工具产物，已加入 `.gitignore`，不应发布到站点。
