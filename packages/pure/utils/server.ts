import { getCollection, type CollectionEntry, type CollectionKey } from 'astro:content'

export const prod = import.meta.env.PROD

async function hasMarkdownContent(collection: string): Promise<boolean> {
  // Build-time/server-side guard only.
  if (typeof process === 'undefined') return true
  try {
    const { existsSync, readdirSync, statSync } = await import('node:fs')
    const path = await import('node:path')
    const contentDir = path.join(process.cwd(), 'src', 'content', collection)
    if (!existsSync(contentDir)) return false

    const stack = [contentDir]
    while (stack.length > 0) {
      const current = stack.pop()
      if (!current) break
      const entries = readdirSync(current)
      for (const entry of entries) {
        const fullPath = path.join(current, entry)
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
          stack.push(fullPath)
        } else if (fullPath.endsWith('.md') || fullPath.endsWith('.mdx')) {
          return true
        }
      }
    }
    return false
  } catch {
    // In uncertain environments keep previous behavior.
    return true
  }
}

/** Note: this function filters out draft posts based on the environment */
export async function getBlogCollection<T extends CollectionKey = 'blog'>(
  contentType: T = 'blog' as T
): Promise<CollectionEntry<T>[]> {
  // Avoid calling getCollection on empty optional collections (e.g., notes in early setup).
  if ((contentType as string) === 'notes' && !(await hasMarkdownContent('notes'))) {
    return [] as CollectionEntry<T>[]
  }

  try {
    const collections = await getCollection(contentType, ({ data }: CollectionEntry<T>) => {
      // 对博客集合根据环境过滤草稿，对笔记集合不进行草稿过滤
      if (contentType === 'blog') {
        return prod ? !data.draft : true
      }
      // 对于笔记集合，始终返回 true
      return true
    })
    return collections as CollectionEntry<T>[]
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // Allow optional collections to be empty/missing without blocking build.
    if (message.includes('does not exist or is empty')) {
      return [] as CollectionEntry<T>[]
    }
    throw error
  }
}

function getCollectionDateValue(data: CollectionEntry<CollectionKey>['data']): number {
  if ('updated' in data && data.updated) {
    return new Date(data.updated).valueOf()
  }
  if ('publishDate' in data && data.publishDate) {
    return new Date(data.publishDate).valueOf()
  }
  return 0
}

function getYearFromCollection<T extends CollectionKey>(
  collection: CollectionEntry<T>
): number | undefined {
  const dateValue = getCollectionDateValue(collection.data)
  return dateValue ? new Date(dateValue).getFullYear() : undefined
}

export function groupCollectionsByYear<T extends CollectionKey>(
  collections: CollectionEntry<T>[]
): [number, CollectionEntry<T>[]][] {
  const collectionsByYear = collections.reduce((acc, collection) => {
    const year = getYearFromCollection(collection)
    if (year !== undefined) {
      if (!acc.has(year)) {
        acc.set(year, [])
      }
      acc.get(year)!.push(collection)
    }
    return acc
  }, new Map<number, CollectionEntry<T>[]>())

  return Array.from(collectionsByYear.entries()).sort((a, b) => b[0] - a[0])
}

export function sortMDByDate<T extends CollectionKey>(
  collections: CollectionEntry<T>[]
): CollectionEntry<T>[] {
  return collections.sort((a, b) => {
    const aDate = getCollectionDateValue(a.data)
    const bDate = getCollectionDateValue(b.data)
    return bDate - aDate
  })
}

/** Note: This function doesn't filter draft posts, pass it the result of getAllPosts above to do so. */
export function getAllTags<T extends CollectionKey>(collections: CollectionEntry<T>[]) {
  return collections.flatMap((collection) => [...collection.data.tags])
}

/** Note: This function doesn't filter draft posts, pass it the result of getAllPosts above to do so. */
export function getUniqueTags<T extends CollectionKey>(collections: CollectionEntry<T>[]) {
  return [...new Set(getAllTags(collections))]
}

/** Note: This function doesn't filter draft posts, pass it the result of getAllPosts above to do so. */
export function getUniqueTagsWithCount<T extends CollectionKey>(
  collections: CollectionEntry<T>[]
): [string, number][] {
  return [
    ...getAllTags(collections).reduce(
      (acc, t) => acc.set(t, (acc.get(t) || 0) + 1),
      new Map<string, number>()
    )
  ].sort((a, b) => b[1] - a[1])
}
