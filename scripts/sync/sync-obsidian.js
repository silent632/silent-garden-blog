import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {
  COLLECTION_CONTRACTS,
  CONTENT_COLLECTION_DIRS,
  resolveFieldName
} from './contracts.js'
import {
  buildFrontmatterText,
  normalizeFieldValue,
  splitFrontmatterDocument
} from './frontmatter.js'

const COLLECTIONS = Object.keys(COLLECTION_CONTRACTS)

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
    output[line.slice(0, index).trim()] = line.slice(index + 1).trim()
  }
  return output
}

function parseArgs(argv) {
  const options = {
    sourceRoot: '',
    sourceProvided: false,
    collections: [...COLLECTIONS],
    dryRun: false,
    clean: false,
    verbose: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--source' && argv[i + 1]) {
      options.sourceRoot = path.resolve(argv[i + 1])
      options.sourceProvided = true
      i += 1
      continue
    }
    if (arg === '--collection' && argv[i + 1]) {
      const requested = argv[i + 1]
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
      options.collections = requested
      i += 1
      continue
    }
    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }
    if (arg === '--clean') {
      options.clean = true
      continue
    }
    if (arg === '--verbose') {
      options.verbose = true
      continue
    }
  }

  return options
}

function walkMarkdownFiles(rootDir) {
  if (!existsSync(rootDir)) return []

  const output = []
  const stack = [rootDir]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) break

    const entries = readdirSync(current, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(fullPath)
      } else if (entry.isFile() && /\.(md|mdx)$/i.test(entry.name)) {
        output.push(fullPath)
      }
    }
  }

  return output.sort()
}

function ensureDirectory(dirPath, dryRun) {
  if (dryRun) return
  mkdirSync(dirPath, { recursive: true })
}

function toSafeDateInput(fileStat) {
  return new Date(fileStat.mtime).toISOString()
}

function normalizeCollectionFields(collection, parsedFields, filePath) {
  const contract = COLLECTION_CONTRACTS[collection]
  const normalized = new Map()
  const errors = []
  const warnings = []

  for (const [key, value] of parsedFields.entries()) {
    const canonical = resolveFieldName(contract, key)
    if (canonical) {
      const rule = contract.fields[canonical]
      const normalizedValue = normalizeFieldValue(rule, value)
      if (normalizedValue === null) {
        warnings.push(`Field "${key}" in ${filePath} failed normalization and was skipped.`)
        continue
      }
      normalized.set(canonical, normalizedValue)
      continue
    }

    if (contract.passthroughFields.includes(key)) {
      normalized.set(key, value)
      continue
    }

    // Keep unknown keys to avoid data loss.
    normalized.set(key, value)
    warnings.push(`Unknown field "${key}" in ${filePath} preserved as-is.`)
  }

  // Derive safe fallback timestamps when possible.
  const fileStat = statSync(filePath)
  if (collection === 'notes' && !normalized.has('updated')) {
    normalized.set('updated', toSafeDateInput(fileStat))
    warnings.push(`Missing "updated" in ${filePath}; used file mtime fallback.`)
  }
  if (collection === 'blog' && !normalized.has('publishDate')) {
    normalized.set('publishDate', toSafeDateInput(fileStat))
    warnings.push(`Missing "publishDate" in ${filePath}; used file mtime fallback.`)
  }
  if (collection === 'diary' && !normalized.has('publishDate')) {
    normalized.set('publishDate', toSafeDateInput(fileStat))
    warnings.push(`Missing "publishDate" in ${filePath}; used file mtime fallback.`)
  }

  // Required field checks.
  for (const [fieldName, rule] of Object.entries(contract.fields)) {
    if (!rule.required) continue
    const value = normalized.get(fieldName)
    if (value === undefined || value === null) {
      errors.push(`Missing required field "${fieldName}" in ${filePath}.`)
      continue
    }
    if (Array.isArray(value) && typeof rule.minItems === 'number' && value.length < rule.minItems) {
      errors.push(`Field "${fieldName}" in ${filePath} requires at least ${rule.minItems} item(s).`)
    }
  }

  return { normalized, errors, warnings }
}

function orderFields(collection, normalizedMap) {
  const ordered = []
  const contract = COLLECTION_CONTRACTS[collection]

  for (const key of Object.keys(contract.fields)) {
    if (normalizedMap.has(key)) {
      ordered.push([key, normalizedMap.get(key)])
    }
  }

  for (const key of contract.passthroughFields) {
    if (normalizedMap.has(key)) {
      ordered.push([key, normalizedMap.get(key)])
    }
  }

  const knownKeys = new Set(ordered.map(([key]) => key))
  const extras = [...normalizedMap.entries()]
    .filter(([key]) => !knownKeys.has(key))
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))

  return [...ordered, ...extras]
}

function collectionSourceDir(collection, sourceRoot) {
  const specificEnv = process.env[`OBSIDIAN_SYNC_${collection.toUpperCase()}_DIR`]
  if (specificEnv) return path.resolve(specificEnv)
  return path.join(sourceRoot, collection)
}

function contentTargetDir(projectRoot, collection) {
  return path.join(projectRoot, CONTENT_COLLECTION_DIRS[collection])
}

function run() {
  const options = parseArgs(process.argv.slice(2))
  const projectRoot = process.cwd()
  const devVars = loadDevVars(projectRoot)
  if (!options.sourceProvided) {
    const envRoot = process.env.OBSIDIAN_SYNC_ROOT || devVars.OBSIDIAN_SYNC_ROOT || ''
    if (envRoot) options.sourceRoot = path.resolve(envRoot)
  }
  const summary = {
    scanned: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    deleted: 0,
    skipped: 0,
    errors: 0,
    warnings: 0
  }

  const requestedCollections = options.collections.filter((item) => COLLECTIONS.includes(item))
  if (requestedCollections.length === 0) {
    console.error('No valid collections provided. Use --collection blog,notes,diary')
    return 1
  }

  if (!options.sourceRoot) {
    console.warn(
      '[sync:obsidian] Missing source root. Set OBSIDIAN_SYNC_ROOT or pass --source <obsidian-export-root>. Skip sync.'
    )
    return 0
  }

  if (!existsSync(options.sourceRoot)) {
    if (!options.sourceProvided && !process.env.OBSIDIAN_SYNC_ROOT) {
      console.warn(`[sync:obsidian] Source root does not exist (${options.sourceRoot}). Skip sync.`)
      return 0
    }
    console.error(`Source root does not exist: ${options.sourceRoot}`)
    return 1
  }

  for (const collection of requestedCollections) {
    const sourceDir = collectionSourceDir(collection, options.sourceRoot)
    const targetDir = contentTargetDir(projectRoot, collection)
    const seenTargetFiles = new Set()

    if (!existsSync(sourceDir)) {
      console.warn(`[sync:obsidian] Source directory missing, skip: ${sourceDir}`)
      summary.warnings += 1
      continue
    }

    ensureDirectory(targetDir, options.dryRun)
    const sourceFiles = walkMarkdownFiles(sourceDir)
    summary.scanned += sourceFiles.length

    if (options.verbose) {
      console.log(`[sync:obsidian] ${collection}: found ${sourceFiles.length} markdown files.`)
    }

    for (const sourceFile of sourceFiles) {
      const relativePath = path.relative(sourceDir, sourceFile)
      const targetFile = path.join(targetDir, relativePath)
      seenTargetFiles.add(targetFile)

      const sourceText = readFileSync(sourceFile, 'utf8')
      const parsed = splitFrontmatterDocument(sourceText)

      if (!parsed.hasFrontmatter) {
        console.warn(`[sync:obsidian] Missing frontmatter, skipped: ${sourceFile}`)
        summary.warnings += 1
        summary.skipped += 1
        continue
      }

      const { normalized, errors, warnings } = normalizeCollectionFields(
        collection,
        parsed.fields,
        sourceFile
      )
      summary.warnings += warnings.length
      if (options.verbose) {
        for (const message of warnings) console.warn(`[sync:obsidian] ${message}`)
      }

      if (errors.length > 0) {
        for (const message of errors) {
          console.error(`[sync:obsidian] ${message}`)
        }
        summary.errors += errors.length
        summary.skipped += 1
        continue
      }

      const ordered = orderFields(collection, normalized)
      const nextText = `${buildFrontmatterText(ordered)}${parsed.body}`

      const targetDirname = path.dirname(targetFile)
      ensureDirectory(targetDirname, options.dryRun)

      if (existsSync(targetFile)) {
        const current = readFileSync(targetFile, 'utf8')
        if (current === nextText) {
          summary.unchanged += 1
          continue
        }
        if (!options.dryRun) {
          writeFileSync(targetFile, nextText, 'utf8')
        }
        summary.updated += 1
      } else {
        if (!options.dryRun) {
          writeFileSync(targetFile, nextText, 'utf8')
        }
        summary.created += 1
      }
    }

    if (!options.clean) continue

    const existingTargetFiles = walkMarkdownFiles(targetDir)
    for (const targetFile of existingTargetFiles) {
      if (seenTargetFiles.has(targetFile)) continue
      if (!options.dryRun) rmSync(targetFile, { force: true })
      summary.deleted += 1
    }
  }

  const mode = options.dryRun ? 'DRY-RUN' : 'APPLY'
  console.log(
    `[sync:obsidian] ${mode} summary scanned=${summary.scanned} created=${summary.created} updated=${summary.updated} unchanged=${summary.unchanged} deleted=${summary.deleted} skipped=${summary.skipped} warnings=${summary.warnings} errors=${summary.errors}`
  )

  return summary.errors > 0 ? 1 : 0
}

process.exit(run())
