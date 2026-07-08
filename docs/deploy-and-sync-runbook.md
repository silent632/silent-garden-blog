# Deploy And Sync Runbook

Last updated: 2026-03-29

## Goal

Bring the site to a state where:

- local content sync can run on macOS
- Notion content can sync through GitHub Actions
- Cloudflare Pages can build and serve the site from the repository
- page rendering reads local Markdown/JSON files instead of calling Notion during the build

## Recommended order

1. Prepare local environment variables
2. Validate local sync inputs
3. Validate local build
4. Connect Notion to GitHub Actions
5. Connect repository to Cloudflare Pages
6. Bind the production domain
7. Enable scheduled local sync on macOS

## Step 1. Prepare local environment variables

Create `.dev.vars` from `.dev.vars.example`.

Required for deployment metadata:

- `SITE_URL`

Optional:

- `WALINE_SERVER_URL`
- `OBSIDIAN_SYNC_ROOT`
- `NOTION_TOKEN`
- `NOTION_DATABASE_ID`
- `NOTION_PROJECTS_DATABASE_ID`
- `NOTION_BLOG_DATABASE_ID`
- `NOTION_DIARY_DATABASE_ID`

## Step 2. Validate local sync inputs

Run:

```bash
npm run sync:obsidian
npm run sync:validate
npm run sync:notion:books -- --dry-run
npm run sync:notion:projects -- --dry-run
npm run sync:notion:blog -- --dry-run
npm run sync:notion:diary -- --dry-run
```

Expected result:

- Obsidian sync completes or skips cleanly when `OBSIDIAN_SYNC_ROOT` is unset
- validation returns no blocking errors
- Notion dry-runs can read databases once env vars are configured

## Step 3. Validate local build

Run:

```bash
npm run build
```

Expected result:

- static build completes
- `dist/` is generated

## Step 4. Connect Notion to GitHub Actions

Add these GitHub repository secrets:

- `NOTION_TOKEN`
- `NOTION_DATABASE_ID`
- `NOTION_PROJECTS_DATABASE_ID`
- `NOTION_BLOG_DATABASE_ID`
- `NOTION_DIARY_DATABASE_ID`

Then run the existing workflow manually:

- GitHub Actions
- `Notion Sync`
- `Run workflow`

Expected result:

- workflow completes successfully
- synced content is committed back to the repo if data changed
- generated Markdown/JSON becomes the only input used by site pages during deployment

## Step 5. Connect repository to Cloudflare Pages

Create a Pages project, or reuse the existing `silent-garden` Pages project if it is already connected to this GitHub repository.

Use:

- Framework preset: `Astro`
- Build command: `npm run build`
- Build output directory: `dist`
- Node.js version: `24`

Prefer pinning Node.js with the repository file `.node-version` and keep Pages `NODE_VERSION` aligned if you override it in the dashboard.

Set Pages environment variables:

- `SITE_URL`
- optional `WALINE_SERVER_URL`

Expected result:

- first deployment succeeds
- generated `sitemap`, `rss`, and canonical links use the production URL

## Step 6. Bind the production domain

In Cloudflare Pages:

- add the custom domain
- verify DNS is proxied through Cloudflare as required

Expected result:

- `SITE_URL` matches the final domain
- opening the domain serves the Pages deployment

## Step 7. Enable scheduled local sync on macOS

One-off run:

```bash
bash scripts/macos/run-sync-and-push.sh
```

Install a daily LaunchAgent at 08:00:

```bash
bash scripts/macos/install-sync-launchagent.sh 08:00
```

Notes:

- the sync script aborts if sync-managed paths already contain local changes
- by default it runs `npm run sync:all`, then `npm run build`, then commits and pushes content changes
- logs are written to `.codex/sync-logs/`
- use either GitHub Actions or the local LaunchAgent as the primary sync path; keeping both enabled can create confusing commit timing

## Acceptance checklist

- local `npm run build` passes
- GitHub `Notion Sync` workflow passes
- Cloudflare Pages deployment passes
- production domain is reachable
- local macOS scheduled sync can run without manual intervention
