export function paginateCollection(items, pageSize) {
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 1
  const totalPages = Math.max(1, Math.ceil(items.length / safePageSize))

  return Array.from({ length: totalPages }, (_, index) => {
    const pageNum = index + 1
    const start = index * safePageSize

    return {
      pageNum,
      totalPages,
      pageData: items.slice(start, start + safePageSize),
      collectionsCount: items.length
    }
  })
}

function stripMarkdownExtension(fileName) {
  return String(fileName || '').replace(/\.(md|mdx)$/i, '')
}

function encodePath(pathname) {
  return stripMarkdownExtension(pathname)
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

export function buildInternalContentUrl(type, year, fileName) {
  const cleanType = String(type || 'notes').trim()
  const encodedName = encodePath(fileName || 'untitled')

  if (cleanType === 'blog') {
    const safeYear = /^\d{4}$/.test(String(year)) ? String(year) : String(new Date().getFullYear())
    return `/blog/${safeYear}/${encodedName}`
  }

  if (cleanType === 'diary') {
    return `/diary/${encodedName}`
  }

  return `/notes/${encodedName}`
}
