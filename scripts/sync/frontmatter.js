import { normalizeByRule } from './contracts.js'

function stripOuterQuotes(input) {
  const trimmed = String(input).trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

function parseInlineArray(input) {
  const trimmed = input.trim()
  if (!(trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    return [stripOuterQuotes(trimmed)].filter(Boolean)
  }

  const body = trimmed.slice(1, -1).trim()
  if (!body) return []

  return body
    .split(',')
    .map((part) => stripOuterQuotes(part))
    .filter(Boolean)
}

function parseFrontmatterValue(lines) {
  const cleanedLines = lines.map((line) => line.replace(/\t/g, '    '))
  const trimmedNonEmpty = cleanedLines.map((line) => line.trim()).filter(Boolean)
  if (trimmedNonEmpty.length === 0) return ''

  const listItems = trimmedNonEmpty
    .filter((line) => line.startsWith('- '))
    .map((line) => stripOuterQuotes(line.slice(2).trim()))
    .filter(Boolean)
  if (listItems.length > 0) return listItems

  const scalar = stripOuterQuotes(trimmedNonEmpty.join('\n'))
  if (!scalar) return ''
  if (/^(true|false)$/i.test(scalar)) return scalar.toLowerCase() === 'true'
  if (/^-?\d+(\.\d+)?$/.test(scalar)) return Number(scalar)
  if (scalar.startsWith('[') && scalar.endsWith(']')) return parseInlineArray(scalar)
  return scalar
}

export function parseFrontmatterFields(block) {
  const map = new Map()
  const lines = block.split(/\r?\n/)
  let activeKey = null
  let activeBuffer = []

  const flush = () => {
    if (!activeKey) return
    map.set(activeKey, parseFrontmatterValue(activeBuffer))
    activeKey = null
    activeBuffer = []
  }

  for (const line of lines) {
    const keyMatch = line.match(/^([A-Za-z0-9_-]+):(.*)$/)
    if (keyMatch) {
      flush()
      activeKey = keyMatch[1]
      activeBuffer = [keyMatch[2]]
      continue
    }

    if (activeKey && (/^\s+/.test(line) || /^-\s+/.test(line) || line.trim() === '')) {
      activeBuffer.push(line)
      continue
    }

    flush()
  }

  flush()
  return map
}

export function splitFrontmatterDocument(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) {
    return {
      hasFrontmatter: false,
      fields: new Map(),
      body: text
    }
  }

  return {
    hasFrontmatter: true,
    fields: parseFrontmatterFields(match[1]),
    body: text.slice(match[0].length)
  }
}

function needsQuotes(value) {
  return (
    value === '' ||
    /^\s|\s$/.test(value) ||
    /[:#{}\[\],&*!?|<>=%@`]/.test(value) ||
    /^(true|false|null|yes|no|on|off)$/i.test(value) ||
    /^-?\d+(\.\d+)?$/.test(value)
  )
}

function formatDateForFrontmatter(value) {
  if (typeof value !== 'string') return value
  if (!value.includes('T')) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const iso = date.toISOString()
  if (iso.endsWith('T00:00:00.000Z')) {
    return iso.slice(0, 10)
  }
  return iso.replace('.000Z', 'Z')
}

function stringifyScalar(value) {
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value)
  }

  const asText = String(value ?? '')
  if (!needsQuotes(asText)) return asText
  return JSON.stringify(asText)
}

function stringifyFieldValue(value) {
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    return `\n${value.map((item) => `  - ${stringifyScalar(item)}`).join('\n')}`
  }
  return stringifyScalar(value)
}

export function buildFrontmatterText(fields) {
  const lines = []
  for (const [key, rawValue] of fields) {
    const value = formatDateForFrontmatter(rawValue)
    lines.push(`${key}: ${stringifyFieldValue(value)}`)
  }
  return `---\n${lines.join('\n')}\n---\n`
}

export function normalizeFieldValue(rule, value) {
  const normalized = normalizeByRule(rule?.normalizer, value)
  if (normalized === null) return null
  return normalized
}
