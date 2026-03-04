# Phase B Content Sync Mapping

Last updated: 2026-03-02

## Objective
Phase B defines a stable data contract for content synchronization without changing the current site information architecture. It prepares Phase C automation scripts (Obsidian/Notion to site) while preserving existing behavior.

## Scope
- Obsidian markdown to Astro content collections: `blog`, `notes`, `diary`
- Notion database to local books data: `src/data/books/*.json`
- Notion database to local projects data: `src/data/projects/projects.json`
- Notion database to Astro diary entries: `src/content/diary/notion-*.md`

## Source of truth
- Human-readable mapping: this document
- Machine-readable mapping: `scripts/sync/contracts.js`
- Gate validation script: `scripts/sync/validate-frontmatter.js`

## Current content snapshot
- `blog`: 3 markdown files detected in `src/content/blog`
- `notes`: 0 markdown files detected in `src/content/notes`
- `diary`: 1 markdown file detected in `src/content/diary`
- Existing `blog` extra metadata in use: `pub-blog`, `dg-path`, `permalink`, `type`, `aliases`, `author`, `created`

## Obsidian to Astro Mapping

### Blog collection
- Target directory: `src/content/blog`
- Sync required fields:
  - `title` (string, non-empty)
  - `publishDate` (date/date-time string)
  - `tags` (string array, at least 1 item)
- Sync optional fields:
  - `description`, `updated`, `draft`, `comment`, `language`
- Passthrough metadata (preserve, do not fail validation):
  - `aliases`, `author`, `created`, `dg-path`, `permalink`, `pub-blog`, `type`

### Notes collection
- Target directory: `src/content/notes`
- Sync required fields:
  - `updated` (date/date-time string)
  - `tags` (non-empty string array)
- Sync optional fields:
  - `title`, `description`, `publishDate`, `aliases`, `author`, `created`, `draft`, `comment`, `language`
- Passthrough metadata:
  - `dg-path`, `permalink`, `pub-blog`, `type`

### Diary collection
- Target directory: `src/content/diary`
- Sync required fields:
  - `publishDate` (date/date-time string)
- Sync optional fields:
  - `title`, `mood`, `tags`, `draft`
- Passthrough metadata:
  - none

## Normalization rules
- `string`: trim and strip outer quotes
- `string-array`:
  - supports YAML list and inline list syntax
  - trim items, lowercase, remove duplicates
- `boolean`: accepts `true`/`false` as boolean or string
- `date`:
  - accepts date (`YYYY-MM-DD`) and date-time (`YYYY-MM-DD HH:mm`)
  - date-time with space is normalized as ISO (`T` separator)
- `number`: numeric string to number
- `url`: normalized with URL parser

## Notion Books to Local JSON Mapping

### Query behavior
- Filter: `show == true`
- Sort: `end-date` descending

### Property mapping
- `title` (`title`) to `title` (required)
- `score` (`formula`) to `score`
- `end-date` (`date`) to `date`
- `year` (`formula`) to `year` (required)
- `comment` (`rich_text`) to `comment` (fallback property: `书评`)
- `quote` (`rich_text`) to `quote`
- `cover` (`files`) to `cover`
- `URL` (`url`) to `link`
- `star` (`checkbox`) to `recommend`

### Fallback strategy
- If Notion env vars are missing, skip Notion API and use local JSON fallback.
- If Notion API fails at runtime, fallback to local year JSON.

## Notion Projects to Local JSON Mapping
Current rendering stays in `src/pages/projects/index.astro`; sync only updates data source:
- Target shape:
  - `name` (required)
  - `description` (required)
  - `links` (required array)
  - `image` (optional)
- Allowed link types:
  - `github`, `site`, `link`, `doc`, `release`

## Notion Diary to Astro Markdown Mapping

### Query behavior
- Default filter: `show == true` (if `show` property exists)
- Fallback: if `show` does not exist, query all rows
- Sort: `created_time` descending (API-level), then local updates by page id

### Property mapping
- `title`/`name` to `title` (optional)
- `publishDate`/`date` to `publishDate` (required)
- `mood` to `mood` (optional)
- `tags` (multi-select or rich text) to `tags` (optional, normalized lowercase array)
- `draft` (checkbox) to `draft` (optional)
- Fallback when `draft` missing: if `show` exists, `draft = !show`

### Content mapping
- Notion page blocks are converted to markdown body.
- Supported common blocks:
  - paragraph, heading 1/2/3
  - bulleted/numbered list, todo
  - quote, code, divider, callout
  - image/file/bookmark/embed link output
- Output file naming:
  - `src/content/diary/notion-<pageId12>.md`
  - stable id-based filename to avoid duplicates on title/date change

### Cleanup strategy
- `--clean` only removes generated files matching `notion-*.md` that are no longer in Notion.
- Manual diary files are preserved.

## Validation and workflow
- Run validation:
  - `npm run sync:validate`
- CI gate recommendation for Phase C:
  - run `npm run sync:validate` before `npm run build`
- Blocking rule:
  - any validation `error` should fail sync/build pipeline
- Non-blocking rule:
  - validation `warning` should be logged and tracked

## Phase C commands
- Obsidian sync to content collections:
  - `npm run sync:obsidian`
- Obsidian sync + contract validation:
  - `npm run sync:phase-c`
- Notion books sync (skip when env missing):
  - `npm run sync:notion:books`
- Notion projects sync (skip when env missing):
  - `npm run sync:notion:projects`
- Notion diary sync (skip when env missing):
  - `npm run sync:notion:diary`
- End-to-end Phase C run:
  - `npm run sync:phase-c:full`
- One-click full sync (with diary cleanup):
  - `npm run sync:all`

### Optional flags
- Obsidian:
  - `node scripts/sync/sync-obsidian.js --source <obsidian-export-root> --collection blog,notes,diary --dry-run --clean`
- Notion books:
  - `node scripts/sync/sync-notion-books.js --year current --dry-run`
- Notion projects:
  - `node scripts/sync/sync-notion-projects.js --dry-run`
- Notion diary:
  - `node scripts/sync/sync-notion-diary.js --dry-run --clean`

### Environment variables
- Books sync:
  - `NOTION_TOKEN`
  - `NOTION_DATABASE_ID`
- Projects sync:
  - `NOTION_TOKEN`
  - `NOTION_PROJECTS_DATABASE_ID`
- Diary sync:
  - `NOTION_TOKEN`
  - `NOTION_DIARY_DATABASE_ID`
