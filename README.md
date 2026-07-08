# Silent Garden

Silent Garden 是一个基于 Astro 的个人博客与数字花园，用来发布文章、日记、读书记录、项目记录和少量公开笔记。

## 技术结构

- 站点框架：Astro 静态站点
- 主题依赖：运行时使用 npm 包 `astro-pure@1.3.1`
- 内容集合：`src/content/blog`、`src/content/diary`、`src/content/notes`
- 数据文件：`src/data/books`、`src/data/projects/projects.json`
- 同步入口：`scripts/sync/`
- 部署目标：Cloudflare Pages

说明：当前根项目实际依赖的是 npm 上的 `astro-pure`，不是本地 `packages/pure`。`packages/pure` 只应视为上游主题源码参考；如果后续决定维护本地主题，需要先把依赖切换为 workspace 或 `file:packages/pure`。

## 日常使用

本地开发：

```bash
npm run dev
```

内容校验：

```bash
npm run sync:validate
npm run check
```

构建验证：

```bash
npm run build
```

内容同步：

```bash
npm run sync:all
```

推荐使用方式：让同步脚本把 Notion/Obsidian 内容落到本地 Markdown 或 JSON，页面渲染只读取仓库内文件。这样部署不会依赖构建时访问外部 API。

## 内容入口

- Blog：正式文章，优先从 Notion 同步到 `src/content/blog`
- Diary：公开日记，优先从 Notion 同步到 `src/content/diary`
- Notes：公开笔记，优先从 Obsidian 同步到 `src/content/notes`
- Books：读书记录，优先同步为 `src/data/books/*.json`
- Projects：项目记录，优先同步为 `src/data/projects/projects.json`

## 部署

部署流程见 [docs/deploy-and-sync-runbook.md](./docs/deploy-and-sync-runbook.md)。

## License

This project is licensed under the [Apache 2.0 License](./LICENSE).
