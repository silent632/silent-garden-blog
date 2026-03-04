import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {
  NOTION_BOOK_FILTER,
  NOTION_BOOK_PROPERTY_MAP,
  NOTION_BOOK_SORT
} from './contracts.js'

const NOTION_API_VERSION = '2022-06-28'

function parseArgs(argv) {
  const options = {
    year: new Date().getFullYear(),
    dryRun: false,
    allowMissingEnv: false,
    verbose: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--year' && argv[i + 1]) {
      const raw = argv[i + 1].trim().toLowerCase()
      if (raw === 'all') {
        options.year = 'all'
      } else if (raw === 'current') {
        options.year = new Date().getFullYear()
      } else {
        const parsed = Number(raw)
        if (Number.isFinite(parsed) && parsed > 1900) {
          options.year = parsed
        }
      }
      i += 1
      continue
    }
    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }
    if (arg === '--allow-missing-env') {
      options.allowMissingEnv = true
      continue
    }
    if (arg === '--verbose') {
      options.verbose = true
      continue
    }
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

function extractFormulaNumber(property) {
  if (!property || property.type !== 'formula') return 0
  if (property.formula?.type === 'number' && Number.isFinite(property.formula.number)) {
    return property.formula.number
  }
  if (property.formula?.type === 'string') {
    const parsed = Number(property.formula.string)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function extractDate(property) {
  if (!property || property.type !== 'date' || !property.date?.start) return ''
  return property.date.start
}

function extractRichText(property) {
  if (!property || property.type !== 'rich_text' || !Array.isArray(property.rich_text)) return ''
  return property.rich_text.map((item) => item.plain_text || item.text?.content || '').join('').trim()
}

function extractFileUrl(property) {
  if (!property || property.type !== 'files' || !Array.isArray(property.files) || property.files.length === 0) {
    return ''
  }
  const first = property.files[0]
  if (first.type === 'external') return first.external?.url || ''
  if (first.type === 'file') return first.file?.url || ''
  return ''
}

function extractUrl(property) {
  if (!property || property.type !== 'url') return ''
  return property.url || ''
}

function extractCheckbox(property) {
  if (!property || property.type !== 'checkbox') return false
  return property.checkbox === true
}

function findProperty(properties, mapping) {
  const direct = properties[mapping.notionProperty]
  if (direct) return direct
  if (!mapping.fallbackProperties) return undefined

  for (const candidate of mapping.fallbackProperties) {
    if (properties[candidate]) return properties[candidate]
  }
  return undefined
}

function extractValueByType(property, notionType) {
  switch (notionType) {
    case 'title':
      return extractTitle(property)
    case 'formula':
      return extractFormulaNumber(property)
    case 'date':
      return extractDate(property)
    case 'rich_text':
      return extractRichText(property)
    case 'files':
      return extractFileUrl(property)
    case 'url':
      return extractUrl(property)
    case 'checkbox':
      return extractCheckbox(property)
    default:
      return ''
  }
}

function parseBookPage(page, verbose) {
  const properties = page.properties || {}
  const row = {}

  for (const mapping of NOTION_BOOK_PROPERTY_MAP) {
    const property = findProperty(properties, mapping)
    const value = extractValueByType(property, mapping.notionType)

    if (mapping.required) {
      if (value === '' || value === 0 || value === null || value === undefined) {
        if (verbose) {
          console.warn(
            `[sync:notion:books] Skip page ${page.id} because required property "${mapping.notionProperty}" is empty.`
          )
        }
        return null
      }
    }

    row[mapping.localField] = value
  }

  const year = Number(row.year || 0)
  if (!Number.isFinite(year) || year <= 1900) {
    if (verbose) {
      console.warn(`[sync:notion:books] Skip page ${page.id} because year is invalid.`)
    }
    return null
  }

  if (!row.title) {
    if (verbose) {
      console.warn(`[sync:notion:books] Skip page ${page.id} because title is empty.`)
    }
    return null
  }

  return {
    year,
    data: {
      title: String(row.title),
      score: Number(row.score || 0),
      date: String(row.date || ''),
      comment: String(row.comment || ''),
      quote: String(row.quote || ''),
      cover: String(row.cover || ''),
      link: String(row.link || ''),
      recommend: Boolean(row.recommend)
    }
  }
}

function sortBooksByDateDesc(books) {
  return [...books].sort((a, b) => {
    if (!a.date) return 1
    if (!b.date) return -1
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })
}

async function fetchBooks(token, databaseId, yearFilter, verbose) {
  const filter = {
    and: [
      {
        property: NOTION_BOOK_FILTER.notionProperty,
        checkbox: { equals: true }
      }
    ]
  }

  const groups = new Map()
  let hasMore = true
  let nextCursor

  while (hasMore) {
    const payload = {
      filter,
      sorts: [
        {
          property: NOTION_BOOK_SORT.notionProperty,
          direction: NOTION_BOOK_SORT.direction
        }
      ],
      page_size: 100
    }
    if (nextCursor) payload.start_cursor = nextCursor

    const response = await notionApiCall(token, `/databases/${databaseId}/query`, 'POST', payload)

    for (const page of response.results || []) {
      const parsed = parseBookPage(page, verbose)
      if (!parsed) continue
      if (yearFilter !== 'all' && parsed.year !== yearFilter) continue
      if (!groups.has(parsed.year)) groups.set(parsed.year, [])
      groups.get(parsed.year).push(parsed.data)
    }

    hasMore = Boolean(response.has_more)
    nextCursor = response.next_cursor || undefined
  }

  return groups
}

function ensureBooksDir(projectRoot, dryRun) {
  const dataDir = path.join(projectRoot, 'src', 'data', 'books')
  if (!dryRun) mkdirSync(dataDir, { recursive: true })
  return dataDir
}

function writeYearFile(dataDir, year, books, dryRun) {
  const filePath = path.join(dataDir, `${year}.json`)
  const payload = { year, books: sortBooksByDateDesc(books) }
  if (!dryRun) {
    writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  }
}

function loadYearCounts(dataDir) {
  if (!existsSync(dataDir)) return []
  const files = readdirSync(dataDir).filter((file) => /^\d{4}\.json$/.test(file))
  const years = []

  for (const file of files) {
    const year = Number(file.replace('.json', ''))
    if (!Number.isFinite(year)) continue
    try {
      const parsed = JSON.parse(readFileSync(path.join(dataDir, file), 'utf8'))
      years.push({
        year,
        count: Array.isArray(parsed.books) ? parsed.books.length : 0
      })
    } catch {
      years.push({ year, count: 0 })
    }
  }

  return years.sort((a, b) => b.year - a.year)
}

function writeIndexFile(dataDir, dryRun) {
  const years = loadYearCounts(dataDir)
  const payload = {
    years,
    updatedAt: new Date().toISOString()
  }
  if (!dryRun) {
    writeFileSync(path.join(dataDir, 'index.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  }
}

async function run() {
  const options = parseArgs(process.argv.slice(2))
  const projectRoot = process.cwd()
  const fallbackEnv = loadDevVars(projectRoot)
  const token = getEnvValue('NOTION_TOKEN', fallbackEnv)
  const databaseId = getEnvValue('NOTION_DATABASE_ID', fallbackEnv)

  if (isPlaceholderValue(token) || isPlaceholderValue(databaseId)) {
    const message =
      '[sync:notion:books] Missing NOTION_TOKEN or NOTION_DATABASE_ID (env or .dev.vars).'
    if (options.allowMissingEnv) {
      console.warn(`${message} Skip sync.`)
      return 0
    }
    console.error(message)
    return 1
  }

  const groups = await fetchBooks(token, databaseId, options.year, options.verbose)
  const dataDir = ensureBooksDir(projectRoot, options.dryRun)

  if (options.year !== 'all' && !groups.has(options.year)) {
    groups.set(options.year, [])
  }

  const years = [...groups.keys()].sort((a, b) => b - a)
  for (const year of years) {
    const books = groups.get(year) || []
    writeYearFile(dataDir, year, books, options.dryRun)
    console.log(`[sync:notion:books] ${options.dryRun ? 'would write' : 'wrote'} ${year}.json (${books.length})`)
  }

  writeIndexFile(dataDir, options.dryRun)
  console.log(
    `[sync:notion:books] ${options.dryRun ? 'would write' : 'wrote'} index.json (years=${years.length})`
  )

  return 0
}

run()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error('[sync:notion:books] Failed:', error)
    process.exit(1)
  })
