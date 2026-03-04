import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { PROJECT_SYNC_CONTRACT } from './contracts.js'

const NOTION_API_VERSION = '2022-06-28'

function parseArgs(argv) {
  const options = {
    dryRun: false,
    allowMissingEnv: false,
    verbose: false
  }

  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true
    if (arg === '--allow-missing-env') options.allowMissingEnv = true
    if (arg === '--verbose') options.verbose = true
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
  const v = String(value).trim().toLowerCase()
  return (
    v.startsWith('your_') ||
    v.includes('your_books_database_id') ||
    v.includes('your_projects_database_id') ||
    v.includes('your_notion_integration_token')
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

function extractTitle(property) {
  if (!property || property.type !== 'title' || !Array.isArray(property.title)) return ''
  return property.title.map((item) => item.plain_text || item.text?.content || '').join('').trim()
}

function extractRichText(property) {
  if (!property || property.type !== 'rich_text' || !Array.isArray(property.rich_text)) return ''
  return property.rich_text.map((item) => item.plain_text || item.text?.content || '').join('').trim()
}

function extractUrl(property) {
  if (!property || property.type !== 'url') return ''
  return property.url || ''
}

function extractFormulaString(property) {
  if (!property || property.type !== 'formula') return ''
  if (property.formula?.type === 'string') return property.formula.string || ''
  if (property.formula?.type === 'number') {
    return Number.isFinite(property.formula.number) ? String(property.formula.number) : ''
  }
  return ''
}

function extractFilesUrl(property) {
  if (!property || property.type !== 'files' || !Array.isArray(property.files) || property.files.length === 0) {
    return ''
  }
  const first = property.files[0]
  if (first.type === 'external') return first.external?.url || ''
  if (first.type === 'file') return first.file?.url || ''
  return ''
}

function extractPlainText(property) {
  if (!property) return ''

  if (property.type === 'title') return extractTitle(property)
  if (property.type === 'rich_text') return extractRichText(property)
  if (property.type === 'url') return extractUrl(property)
  if (property.type === 'formula') return extractFormulaString(property)
  if (property.type === 'files') return extractFilesUrl(property)
  if (property.type === 'select') return property.select?.name || ''
  if (property.type === 'status') return property.status?.name || ''
  if (property.type === 'number') return Number.isFinite(property.number) ? String(property.number) : ''
  return ''
}

function findPropertyByCandidates(properties, candidates) {
  for (const candidate of candidates) {
    if (properties[candidate]) return properties[candidate]
  }
  return undefined
}

function normalizeProjectFromPage(page, verbose) {
  const properties = page.properties || {}

  const nameProperty = findPropertyByCandidates(properties, ['name', 'title', '项目', '项目名'])
  const descProperty = findPropertyByCandidates(properties, ['description', 'desc', '简介'])
  const imageProperty = findPropertyByCandidates(properties, ['image', 'cover', '封面'])
  const orderProperty = findPropertyByCandidates(properties, ['order', '排序'])

  const name = extractPlainText(nameProperty)
  const description = extractPlainText(descProperty)
  const imageRaw = extractPlainText(imageProperty)
  const order = Number(extractPlainText(orderProperty) || 0)

  const links = []
  for (const linkType of PROJECT_SYNC_CONTRACT.linkTypes) {
    const property = findPropertyByCandidates(properties, [linkType, linkType.toUpperCase()])
    const href = extractPlainText(property)
    if (href) links.push({ type: linkType, href })
  }

  if (links.length === 0) {
    const fallback = findPropertyByCandidates(properties, ['url', 'URL', 'link'])
    const href = extractPlainText(fallback)
    if (href) links.push({ type: 'link', href })
  }

  if (!name || !description || links.length === 0) {
    if (verbose) {
      console.warn(`[sync:notion:projects] Skip page ${page.id} due to missing required project fields.`)
    }
    return null
  }

  // ProjectSection expects local file names for images. Keep only a plain file name value.
  const image =
    imageRaw && !imageRaw.includes('://') && !imageRaw.includes('/') ? imageRaw : ''

  return {
    order: Number.isFinite(order) ? order : 0,
    item: {
      name,
      description,
      image,
      links
    }
  }
}

function ensureValidProjectImages(projectRoot, projects, verbose) {
  const assetsDir = path.join(projectRoot, 'src', 'assets', 'projects')
  if (!existsSync(assetsDir)) return projects.map((item) => ({ ...item, image: '' }))

  return projects.map((item) => {
    if (!item.image) return item
    const candidate = path.join(assetsDir, item.image)
    if (existsSync(candidate)) return item
    if (verbose) {
      console.warn(
        `[sync:notion:projects] image "${item.image}" not found in src/assets/projects, reset to empty.`
      )
    }
    return { ...item, image: '' }
  })
}

async function queryAllPages(token, databaseId, verbose) {
  const results = []
  let hasMore = true
  let nextCursor = undefined
  let useFilter = true

  while (hasMore) {
    const payload = {
      page_size: 100
    }
    if (nextCursor) payload.start_cursor = nextCursor
    if (useFilter) {
      payload.filter = {
        property: 'show',
        checkbox: {
          equals: true
        }
      }
    }

    try {
      const response = await notionApiCall(token, `/databases/${databaseId}/query`, 'POST', payload)
      results.push(...(response.results || []))
      hasMore = Boolean(response.has_more)
      nextCursor = response.next_cursor || undefined
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (useFilter && message.includes('Could not find property with name or id: show')) {
        if (verbose) {
          console.warn('[sync:notion:projects] "show" property not found, retry without filter.')
        }
        useFilter = false
        hasMore = true
        nextCursor = undefined
        results.length = 0
        continue
      }
      throw error
    }
  }

  return results
}

function writeProjectsFile(projectRoot, projects, dryRun) {
  const outputDir = path.join(projectRoot, 'src', 'data', 'projects')
  const outputPath = path.join(outputDir, 'projects.json')

  if (!dryRun) {
    mkdirSync(outputDir, { recursive: true })
    writeFileSync(outputPath, `${JSON.stringify(projects, null, 2)}\n`, 'utf8')
  }

  return outputPath
}

async function run() {
  const options = parseArgs(process.argv.slice(2))
  const projectRoot = process.cwd()
  const fallbackEnv = loadDevVars(projectRoot)
  const token = getEnvValue('NOTION_TOKEN', fallbackEnv)
  const databaseId = getEnvValue('NOTION_PROJECTS_DATABASE_ID', fallbackEnv)

  if (isPlaceholderValue(token) || isPlaceholderValue(databaseId)) {
    const message =
      '[sync:notion:projects] Missing NOTION_TOKEN or NOTION_PROJECTS_DATABASE_ID (env or .dev.vars).'
    if (options.allowMissingEnv) {
      console.warn(`${message} Skip sync.`)
      return 0
    }
    console.error(message)
    return 1
  }

  const pages = await queryAllPages(token, databaseId, options.verbose)
  const normalized = []

  for (const page of pages) {
    const row = normalizeProjectFromPage(page, options.verbose)
    if (!row) continue
    normalized.push(row)
  }

  normalized.sort((a, b) => a.order - b.order || a.item.name.localeCompare(b.item.name))
  const projects = ensureValidProjectImages(
    projectRoot,
    normalized.map((row) => row.item),
    options.verbose
  )
  const outputPath = writeProjectsFile(projectRoot, projects, options.dryRun)

  console.log(
    `[sync:notion:projects] ${options.dryRun ? 'would write' : 'wrote'} ${outputPath} (${projects.length} projects)`
  )
  return 0
}

run()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error('[sync:notion:projects] Failed:', error)
    process.exit(1)
  })
