import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { NOTION_BLOG_CONTRACT } from './contracts.js'
import { buildFrontmatterText } from './frontmatter.js'

const NOTION_API_VERSION = '2022-06-28'

function parseArgs(argv) {
  const options = {
    dryRun: false,
    allowMissingEnv: false,
    clean: false,
    verbose: false,
    checkOnly: false,
    strictPublish: false,
    minBodyChars: 120
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--dry-run') options.dryRun = true
    if (arg === '--allow-missing-env') options.allowMissingEnv = true
    if (arg === '--clean') options.clean = true
    if (arg === '--verbose') options.verbose = true
    if (arg === '--check-only') options.checkOnly = true
    if (arg === '--strict-publish') options.strictPublish = true
    if (arg.startsWith('--min-body-chars=')) {
      const raw = Number(arg.split('=', 2)[1])
      if (Number.isFinite(raw) && raw >= 0) options.minBodyChars = Math.floor(raw)
    }
    if (arg === '--min-body-chars') {
      const raw = Number(argv[index + 1])
      if (Number.isFinite(raw) && raw >= 0) {
        options.minBodyChars = Math.floor(raw)
        index += 1
      }
    }
  }

  if (options.checkOnly) {
    options.dryRun = true
  }

  return options
}

function loadDevVars(projectRoot) {
  const envFile = path.join(projectRoot, '.dev.vars')
  if (!existsSync(envFile)) return {}

  const output = {}
  const text = readFileSync(envFile, 'utf8')
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const index = line.indexOf('=')
    if (index <= 0) continue
    const key = line.slice(0, index).trim()
    const value = line.slice(index + 1).trim()
    output[key] = value
  }

  return output
}

function getEnvValue(key, fallback) {
  return process.env[key] || fallback[key] || ''
}

function isPlaceholderValue(value) {
  if (!value) return true
  const lowered = String(value).trim().toLowerCase()
  return (
    lowered.startsWith('your_') ||
    lowered.includes('your_notion_integration_token') ||
    lowered.includes('your_blog_database_id')
  )
}

async function notionApiCall(token, endpoint, method = 'GET', body = undefined) {
  const response = await fetch(`https://api.notion.com/v1${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_API_VERSION
    },
    body: body ? JSON.stringify(body) : undefined
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Notion API ${response.status}: ${text}`)
  }

  return response.json()
}

function normalizeKey(input) {
  return String(input || '').trim().toLowerCase()
}

function findPropertyByCandidates(properties, candidates) {
  const direct = candidates.find((candidate) => properties[candidate])
  if (direct) return properties[direct]

  const index = new Map(
    Object.entries(properties || {}).map(([key, value]) => [normalizeKey(key), value])
  )

  for (const candidate of candidates) {
    const matched = index.get(normalizeKey(candidate))
    if (matched) return matched
  }

  return undefined
}

function extractTitle(property) {
  if (!property || property.type !== 'title' || !Array.isArray(property.title)) return ''
  return property.title.map((item) => item.plain_text || item.text?.content || '').join('').trim()
}

function extractRichText(property) {
  if (!property || property.type !== 'rich_text' || !Array.isArray(property.rich_text)) return ''
  return property.rich_text
    .map((item) => item.plain_text || item.text?.content || '')
    .join('')
    .trim()
}

function extractDate(property) {
  if (!property || property.type !== 'date') return ''
  return property.date?.start || ''
}

function extractMultiSelect(property) {
  if (!property || property.type !== 'multi_select' || !Array.isArray(property.multi_select)) return []
  return property.multi_select.map((item) => item.name || '').filter(Boolean)
}

function extractCheckbox(property) {
  if (!property || property.type !== 'checkbox') return null
  return property.checkbox === true
}

function extractSelect(property) {
  if (!property || property.type !== 'select') return ''
  return property.select?.name || ''
}

function extractStatus(property) {
  if (!property || property.type !== 'status') return ''
  return property.status?.name || ''
}

function extractTextValue(property) {
  if (!property) return ''
  if (property.type === 'title') return extractTitle(property)
  if (property.type === 'rich_text') return extractRichText(property)
  if (property.type === 'select') return extractSelect(property)
  if (property.type === 'status') return extractStatus(property)
  return ''
}

function splitTagsFromText(input) {
  return String(input)
    .split(/[,\uFF0C;/|]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeTags(input) {
  const output = []
  for (const item of input) {
    const normalized = String(item || '').trim().toLowerCase()
    if (!normalized) continue
    if (!output.includes(normalized)) output.push(normalized)
  }
  return output
}

function normalizeDate(rawDate, fallbackDate = '') {
  const value = String(rawDate || fallbackDate || '').trim()
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString()
}

function truncateText(input, maxLength) {
  const value = String(input || '').trim()
  if (!value) return ''
  if (value.length <= maxLength) return value
  return value.slice(0, maxLength)
}

function extractPlainText(item) {
  return item?.plain_text || item?.text?.content || ''
}

function wrapByAnnotations(text, annotations) {
  if (!text) return ''
  let output = text
  if (annotations?.code) output = `\`${output}\``
  if (annotations?.bold) output = `**${output}**`
  if (annotations?.italic) output = `*${output}*`
  if (annotations?.strikethrough) output = `~~${output}~~`
  return output
}

function richTextToMarkdown(richText) {
  if (!Array.isArray(richText) || richText.length === 0) return ''
  return richText
    .map((item) => {
      const content = extractPlainText(item)
      const linked = item?.href ? `[${content}](${item.href})` : content
      return wrapByAnnotations(linked, item?.annotations)
    })
    .join('')
}

function blockTypeData(block, type) {
  return block?.[type] || {}
}

function indentByDepth(depth) {
  if (depth <= 0) return ''
  return '  '.repeat(depth)
}

function blockToMarkdown(block, depth = 0) {
  const type = block?.type
  if (!type) return ''

  const prefix = indentByDepth(depth)

  if (type === 'paragraph') {
    return richTextToMarkdown(blockTypeData(block, 'paragraph').rich_text)
  }
  if (type === 'heading_1') {
    return `${prefix}# ${richTextToMarkdown(blockTypeData(block, 'heading_1').rich_text)}`
  }
  if (type === 'heading_2') {
    return `${prefix}## ${richTextToMarkdown(blockTypeData(block, 'heading_2').rich_text)}`
  }
  if (type === 'heading_3') {
    return `${prefix}### ${richTextToMarkdown(blockTypeData(block, 'heading_3').rich_text)}`
  }
  if (type === 'quote') {
    return `${prefix}> ${richTextToMarkdown(blockTypeData(block, 'quote').rich_text)}`
  }
  if (type === 'bulleted_list_item') {
    return `${prefix}- ${richTextToMarkdown(blockTypeData(block, 'bulleted_list_item').rich_text)}`
  }
  if (type === 'numbered_list_item') {
    return `${prefix}1. ${richTextToMarkdown(blockTypeData(block, 'numbered_list_item').rich_text)}`
  }
  if (type === 'to_do') {
    const data = blockTypeData(block, 'to_do')
    const mark = data.checked ? 'x' : ' '
    return `${prefix}- [${mark}] ${richTextToMarkdown(data.rich_text)}`
  }
  if (type === 'code') {
    const data = blockTypeData(block, 'code')
    const language = data.language || ''
    const content = richTextToMarkdown(data.rich_text)
    return `${prefix}\`\`\`${language}\n${content}\n\`\`\``
  }
  if (type === 'divider') {
    return `${prefix}---`
  }
  if (type === 'callout') {
    const data = blockTypeData(block, 'callout')
    const icon = data.icon?.emoji || ''
    const text = richTextToMarkdown(data.rich_text)
    const content = [icon, text].filter(Boolean).join(' ')
    return `${prefix}> ${content}`
  }
  if (type === 'toggle') {
    const title = richTextToMarkdown(blockTypeData(block, 'toggle').rich_text)
    return `${prefix}> ${title}`
  }
  if (type === 'image') {
    const data = blockTypeData(block, 'image')
    const url = data.type === 'external' ? data.external?.url || '' : data.file?.url || ''
    if (!url) return ''
    const caption = richTextToMarkdown(data.caption) || 'image'
    return `${prefix}![${caption}](${url})`
  }
  if (type === 'file') {
    const data = blockTypeData(block, 'file')
    const url = data.type === 'external' ? data.external?.url || '' : data.file?.url || ''
    if (!url) return ''
    const caption = richTextToMarkdown(data.caption) || 'file'
    return `${prefix}[${caption}](${url})`
  }
  if (type === 'bookmark') {
    const url = blockTypeData(block, 'bookmark').url || ''
    return url ? `${prefix}${url}` : ''
  }
  if (type === 'embed') {
    const url = blockTypeData(block, 'embed').url || ''
    return url ? `${prefix}${url}` : ''
  }

  return ''
}

function tidyMarkdown(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function queryAllPages(token, databaseId, verbose) {
  const rows = []
  let hasMore = true
  let nextCursor = undefined
  let useShowFilter = true

  while (hasMore) {
    const payload = {
      page_size: 100,
      sorts: [{ timestamp: 'created_time', direction: 'descending' }]
    }
    if (nextCursor) payload.start_cursor = nextCursor
    if (useShowFilter) {
      payload.filter = {
        property: NOTION_BLOG_CONTRACT.showProperty,
        checkbox: { equals: true }
      }
    }

    try {
      const response = await notionApiCall(token, `/databases/${databaseId}/query`, 'POST', payload)
      rows.push(...(response.results || []))
      hasMore = Boolean(response.has_more)
      nextCursor = response.next_cursor || undefined
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (useShowFilter && message.includes('Could not find property with name or id')) {
        if (verbose) {
          console.warn('[sync:notion:blog] "show" property not found, retry without filter.')
        }
        useShowFilter = false
        hasMore = true
        nextCursor = undefined
        rows.length = 0
        continue
      }
      throw error
    }
  }

  return rows
}

async function fetchBlockChildren(token, blockId) {
  const rows = []
  let hasMore = true
  let nextCursor = undefined

  while (hasMore) {
    const params = new URLSearchParams()
    params.set('page_size', '100')
    if (nextCursor) params.set('start_cursor', nextCursor)

    const response = await notionApiCall(token, `/blocks/${blockId}/children?${params.toString()}`)
    rows.push(...(response.results || []))
    hasMore = Boolean(response.has_more)
    nextCursor = response.next_cursor || undefined
  }

  return rows
}

async function blocksToMarkdown(token, blocks, depth = 0) {
  const lines = []

  for (const block of blocks) {
    const line = blockToMarkdown(block, depth)
    if (line) lines.push(line)

    if (block.has_children) {
      const children = await fetchBlockChildren(token, block.id)
      const childBody = await blocksToMarkdown(token, children, depth + 1)
      if (childBody) lines.push(childBody)
    }
  }

  return tidyMarkdown(lines.join('\n\n'))
}

function parseBlogPage(page, verbose) {
  const properties = page.properties || {}

  const titleProperty = findPropertyByCandidates(
    properties,
    NOTION_BLOG_CONTRACT.propertyCandidates.title
  )
  const descProperty = findPropertyByCandidates(
    properties,
    NOTION_BLOG_CONTRACT.propertyCandidates.description
  )
  const dateProperty = findPropertyByCandidates(
    properties,
    NOTION_BLOG_CONTRACT.propertyCandidates.publishDate
  )
  const updatedProperty = findPropertyByCandidates(
    properties,
    NOTION_BLOG_CONTRACT.propertyCandidates.updated
  )
  const tagsProperty = findPropertyByCandidates(
    properties,
    NOTION_BLOG_CONTRACT.propertyCandidates.tags
  )
  const draftProperty = findPropertyByCandidates(
    properties,
    NOTION_BLOG_CONTRACT.propertyCandidates.draft
  )
  const showProperty = findPropertyByCandidates(
    properties,
    NOTION_BLOG_CONTRACT.propertyCandidates.show
  )
  const languageProperty = findPropertyByCandidates(
    properties,
    NOTION_BLOG_CONTRACT.propertyCandidates.language
  )
  const commentProperty = findPropertyByCandidates(
    properties,
    NOTION_BLOG_CONTRACT.propertyCandidates.comment
  )

  const titleRaw = truncateText(extractTextValue(titleProperty), 60)
  const title = titleRaw || 'Untitled'
  const description = truncateText(extractTextValue(descProperty), 160)
  const explicitPublishDate = normalizeDate(extractDate(dateProperty), '')
  const publishDate = explicitPublishDate || normalizeDate(page.created_time, '')
  const updated = normalizeDate(extractDate(updatedProperty), page.last_edited_time)
  const language = truncateText(extractTextValue(languageProperty), 24) || 'zh-CN'

  let tags = extractMultiSelect(tagsProperty)
  if (tags.length === 0) {
    const text = extractRichText(tagsProperty)
    if (text) tags = splitTagsFromText(text)
  }
  tags = normalizeTags(tags)

  let draft = extractCheckbox(draftProperty)
  const show = extractCheckbox(showProperty)
  if (draft === null) {
    draft = show === null ? false : !show
  }

  const comment = extractCheckbox(commentProperty) === true

  if (!publishDate) {
    if (verbose) {
      console.warn(`[sync:notion:blog] Skip page ${page.id} due to invalid/missing publishDate.`)
    }
    return null
  }

  return {
    id: page.id,
    title,
    description,
    publishDate,
    updated,
    tags,
    draft: Boolean(draft),
    language,
    comment,
    checklist: {
      hasExplicitTitle: Boolean(titleRaw),
      hasDescription: Boolean(description),
      descriptionLength: description.length,
      hasExplicitPublishDate: Boolean(explicitPublishDate),
      hasTags: tags.length > 0,
      hasShowProperty: Boolean(showProperty),
      showEnabled: show === true
    }
  }
}

function countBodyChars(markdown) {
  if (!markdown) return 0
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#>*_\-\[\]()!|]/g, ' ')
    .replace(/\s+/g, '')
  return plain.length
}

function validatePublishChecklist(entry, markdown, options) {
  const issues = []
  const checklist = entry.checklist || {}

  if (!checklist.hasShowProperty) {
    issues.push('missing-show-property')
  } else if (!checklist.showEnabled) {
    issues.push('show-not-enabled')
  }

  if (!checklist.hasExplicitTitle || entry.title === 'Untitled') {
    issues.push('missing-title')
  }
  if (!checklist.hasExplicitPublishDate) {
    issues.push('missing-publish-date')
  }
  if (!checklist.hasDescription) {
    issues.push('missing-description')
  } else if (checklist.descriptionLength < 40 || checklist.descriptionLength > 160) {
    issues.push('description-length-out-of-range')
  }
  if (!checklist.hasTags) {
    issues.push('missing-tags')
  }
  if (entry.draft) {
    issues.push('draft-is-true')
  }

  const language = String(entry.language || '').toLowerCase()
  if (language && language !== 'zh-cn' && language !== 'en-us') {
    issues.push('invalid-language')
  }

  const bodyChars = countBodyChars(markdown)
  if (bodyChars < options.minBodyChars) {
    issues.push(`body-too-short(<${options.minBodyChars})`)
  }

  return { issues, bodyChars }
}

function formatChecklistIssue(issueCode) {
  switch (issueCode) {
    case 'missing-show-property':
      return '缺少 show 字段（Checkbox）'
    case 'show-not-enabled':
      return 'show 未勾选'
    case 'missing-title':
      return 'title 为空'
    case 'missing-publish-date':
      return 'publishDate 未填写'
    case 'missing-description':
      return 'description 未填写'
    case 'description-length-out-of-range':
      return 'description 长度需要在 40-160 字符'
    case 'missing-tags':
      return 'tags 未填写'
    case 'draft-is-true':
      return 'draft 被勾选'
    case 'invalid-language':
      return 'language 仅支持 zh-CN 或 en-US'
    default:
      if (issueCode.startsWith('body-too-short')) {
        return `正文内容过短，未达到最小字符数要求（${issueCode.slice('body-too-short'.length)})`
      }
      return issueCode
  }
}

function buildBlogDocument(entry, markdownBody) {
  const fields = [
    ['title', entry.title],
    ['tags', entry.tags],
    ['publishDate', entry.publishDate]
  ]
  if (entry.description) fields.push(['description', entry.description])
  if (entry.updated) fields.push(['updated', entry.updated])
  if (entry.language) fields.push(['language', entry.language])
  if (entry.draft) fields.push(['draft', true])
  if (entry.comment) fields.push(['comment', true])

  const body = tidyMarkdown(markdownBody || '')
  const safeBody = body ? `${body}\n` : ''
  return `${buildFrontmatterText(fields)}\n${safeBody}`
}

function notionBlogFileName(pageId) {
  const shortId = pageId.replace(/-/g, '').slice(0, 12)
  return `${NOTION_BLOG_CONTRACT.filePrefix}${shortId}.md`
}

function blogYearFromDate(dateText) {
  const date = new Date(dateText)
  if (Number.isNaN(date.getTime())) {
    return String(new Date().getUTCFullYear())
  }
  return String(date.getUTCFullYear())
}

function ensureBlogDir(projectRoot, dryRun) {
  const targetDir = path.join(projectRoot, NOTION_BLOG_CONTRACT.targetDir)
  if (!dryRun) mkdirSync(targetDir, { recursive: true })
  return targetDir
}

function ensureBlogYearDir(rootDir, year, dryRun) {
  const targetDir = path.join(rootDir, year)
  if (!dryRun) mkdirSync(targetDir, { recursive: true })
  return targetDir
}

function collectGeneratedBlogFiles(rootDir) {
  const files = []
  if (!existsSync(rootDir)) return files

  const walk = (dirPath) => {
    for (const name of readdirSync(dirPath)) {
      const absolutePath = path.join(dirPath, name)
      const stat = statSync(absolutePath)
      if (stat.isDirectory()) {
        walk(absolutePath)
        continue
      }
      if (!stat.isFile()) continue
      if (!name.startsWith(NOTION_BLOG_CONTRACT.filePrefix)) continue
      if (!name.endsWith('.md') && !name.endsWith('.mdx')) continue
      files.push(absolutePath)
    }
  }

  walk(rootDir)
  return files
}

function pruneRemovedFiles(targetDir, seenFiles, dryRun) {
  let deleted = 0
  const files = collectGeneratedBlogFiles(targetDir)
  for (const absolutePath of files) {
    if (seenFiles.has(absolutePath)) continue
    if (!dryRun) rmSync(absolutePath, { force: true })
    deleted += 1
  }
  return deleted
}

async function run() {
  const options = parseArgs(process.argv.slice(2))
  const projectRoot = process.cwd()
  const fallbackEnv = loadDevVars(projectRoot)
  const token = getEnvValue('NOTION_TOKEN', fallbackEnv)
  const databaseId = getEnvValue('NOTION_BLOG_DATABASE_ID', fallbackEnv)

  if (isPlaceholderValue(token) || isPlaceholderValue(databaseId)) {
    const message =
      '[sync:notion:blog] Missing NOTION_TOKEN or NOTION_BLOG_DATABASE_ID (env or .dev.vars).'
    if (options.allowMissingEnv) {
      console.warn(`${message} Skip sync.`)
      return 0
    }
    console.error(message)
    return 1
  }

  const pages = await queryAllPages(token, databaseId, options.verbose)
  const writeEnabled = !options.dryRun && !options.checkOnly
  const targetRoot = ensureBlogDir(projectRoot, !writeEnabled)
  const seenFiles = new Set()

  let checked = 0
  let created = 0
  let updated = 0
  let unchanged = 0
  let skipped = 0
  const failedChecklist = []

  for (const page of pages) {
    const entry = parseBlogPage(page, options.verbose)
    if (!entry) {
      skipped += 1
      continue
    }

    const blocks = await fetchBlockChildren(token, page.id)
    const markdown = await blocksToMarkdown(token, blocks)
    const { issues, bodyChars } = validatePublishChecklist(entry, markdown, options)
    checked += 1

    if (issues.length > 0) {
      const issueText = issues.map((item) => formatChecklistIssue(item)).join('; ')
      if (options.strictPublish) {
        failedChecklist.push({
          id: entry.id,
          title: entry.title,
          issues,
          issueText,
          bodyChars
        })
        skipped += 1
        continue
      }
      if (options.verbose) {
        console.warn(`[sync:notion:blog] Checklist warning page=${entry.id} "${entry.title}": ${issueText}`)
      }
    }

    const nextText = buildBlogDocument(entry, markdown)
    const yearDir = ensureBlogYearDir(targetRoot, blogYearFromDate(entry.publishDate), !writeEnabled)
    const filePath = path.join(yearDir, notionBlogFileName(entry.id))

    seenFiles.add(filePath)

    if (existsSync(filePath)) {
      const current = readFileSync(filePath, 'utf8')
      if (current === nextText) {
        unchanged += 1
        continue
      }
      if (writeEnabled) writeFileSync(filePath, nextText, 'utf8')
      updated += 1
      continue
    }

    if (writeEnabled) writeFileSync(filePath, nextText, 'utf8')
    created += 1
  }

  if (options.strictPublish && failedChecklist.length > 0) {
    console.error(`[sync:notion:blog] Checklist failed for ${failedChecklist.length} page(s):`)
    for (const item of failedChecklist) {
      console.error(`  - ${item.title} (${item.id}): ${item.issueText}; bodyChars=${item.bodyChars}`)
    }
    return 2
  }

  const deleted = options.clean && !options.checkOnly ? pruneRemovedFiles(targetRoot, seenFiles, !writeEnabled) : 0
  const mode = options.checkOnly ? 'checked' : options.dryRun ? 'would write' : 'wrote'
  console.log(
    `[sync:notion:blog] ${mode} files checked=${checked} created=${created} updated=${updated} unchanged=${unchanged} skipped=${skipped} deleted=${deleted}`
  )

  return 0
}

run()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error('[sync:notion:blog] Failed:', error)
    process.exit(1)
  })
