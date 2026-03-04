import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {
  COLLECTION_CONTRACTS,
  CONTENT_COLLECTION_DIRS,
  isKnownField,
  resolveFieldName
} from './contracts.js'
import { normalizeFieldValue, splitFrontmatterDocument } from './frontmatter.js'

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

function pushIssue(issues, issue) {
  issues.push(issue)
}

function validateFile(collection, absolutePath, projectRoot, issues) {
  const contract = COLLECTION_CONTRACTS[collection]
  const relativePath = path.relative(projectRoot, absolutePath)
  const text = readFileSync(absolutePath, 'utf8')
  const parsed = splitFrontmatterDocument(text)

  if (!parsed.hasFrontmatter) {
    pushIssue(issues, {
      severity: 'error',
      collection,
      file: relativePath,
      message: 'Missing frontmatter block.'
    })
    return
  }

  const fields = parsed.fields

  for (const [canonicalField, rule] of Object.entries(contract.fields)) {
    const candidateKeys = [canonicalField, ...(rule.aliases ?? [])]
    const matchedKey = candidateKeys.find((key) => fields.has(key))

    if (rule.required && !matchedKey) {
      pushIssue(issues, {
        severity: 'error',
        collection,
        file: relativePath,
        message: `Missing required field "${canonicalField}".`
      })
      continue
    }

    if (!matchedKey) continue

    const value = fields.get(matchedKey)
    const normalized = normalizeFieldValue(rule, value)
    if (rule.normalizer && normalized === null) {
      pushIssue(issues, {
        severity: rule.required ? 'error' : 'warning',
        collection,
        file: relativePath,
        message: `Field "${matchedKey}" failed "${rule.normalizer}" normalization.`
      })
      continue
    }

    if (
      typeof normalized === 'string' &&
      rule.allowEmpty === false &&
      normalized.trim().length === 0
    ) {
      pushIssue(issues, {
        severity: rule.required ? 'error' : 'warning',
        collection,
        file: relativePath,
        message: `Field "${matchedKey}" cannot be empty.`
      })
      continue
    }

    if (Array.isArray(normalized) && typeof rule.minItems === 'number' && normalized.length < rule.minItems) {
      pushIssue(issues, {
        severity: rule.required ? 'error' : 'warning',
        collection,
        file: relativePath,
        message: `Field "${matchedKey}" requires at least ${rule.minItems} item(s).`
      })
    }
  }

  for (const key of fields.keys()) {
    if (isKnownField(contract, key)) continue
    const resolved = resolveFieldName(contract, key)
    if (resolved) continue

    pushIssue(issues, {
      severity: 'warning',
      collection,
      file: relativePath,
      message: `Unknown field "${key}".`
    })
  }
}

function printIssues(issues) {
  if (issues.length === 0) {
    console.log('No validation issues found.')
    return
  }

  const ordered = [...issues].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1
    if (a.collection !== b.collection) return a.collection.localeCompare(b.collection)
    return a.file.localeCompare(b.file)
  })

  for (const issue of ordered) {
    const tag = issue.severity.toUpperCase().padEnd(7, ' ')
    console.log(`${tag} [${issue.collection}] ${issue.file} - ${issue.message}`)
  }
}

function run() {
  const projectRoot = process.cwd()
  const issues = []
  const collectionStats = {
    blog: { files: 0, errors: 0, warnings: 0 },
    notes: { files: 0, errors: 0, warnings: 0 },
    diary: { files: 0, errors: 0, warnings: 0 }
  }

  for (const collection of Object.keys(COLLECTION_CONTRACTS)) {
    const dir = path.join(projectRoot, CONTENT_COLLECTION_DIRS[collection])
    const files = walkMarkdownFiles(dir)
    collectionStats[collection].files = files.length

    if (files.length === 0) {
      pushIssue(issues, {
        severity: 'warning',
        collection,
        file: CONTENT_COLLECTION_DIRS[collection],
        message: 'No markdown files found; validation skipped for this collection.'
      })
      collectionStats[collection].warnings += 1
      continue
    }

    for (const file of files) {
      const before = issues.length
      validateFile(collection, file, projectRoot, issues)
      const added = issues.slice(before)
      for (const issue of added) {
        if (issue.severity === 'error') collectionStats[collection].errors += 1
        else collectionStats[collection].warnings += 1
      }
    }
  }

  for (const collection of Object.keys(collectionStats)) {
    const stats = collectionStats[collection]
    console.log(
      `[${collection}] files=${stats.files} errors=${stats.errors} warnings=${stats.warnings}`
    )
  }

  printIssues(issues)

  const totalErrors = issues.filter((issue) => issue.severity === 'error').length
  const totalWarnings = issues.filter((issue) => issue.severity === 'warning').length
  console.log(`Validation summary: errors=${totalErrors} warnings=${totalWarnings}`)

  return totalErrors > 0 ? 1 : 0
}

process.exit(run())
