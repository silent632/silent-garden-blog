const DEFAULT_SITE_URL = 'https://silent-garden-blog.pages.dev'

export const DEFAULT_SOCIAL_IMAGE = '/images/wormhole.png'

function normalizeSiteUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed.replace(/^\/+/, '')}`

  return withProtocol.replace(/\/+$/, '')
}

export function getSiteUrlFromEnv(): string {
  const candidates = [
    process.env.SITE_URL,
    process.env.PUBLIC_SITE_URL,
    process.env.CF_PAGES_URL
  ]

  for (const candidate of candidates) {
    const normalized = normalizeSiteUrl(String(candidate || ''))
    if (normalized) return normalized
  }

  return ''
}

export function getSiteUrlOrFallback(): string {
  return getSiteUrlFromEnv() || DEFAULT_SITE_URL
}

export function buildAbsoluteUrl(pathname: string, base = getSiteUrlOrFallback()): string {
  return new URL(pathname, `${base}/`).toString()
}
