export const CONTENT_COLLECTION_DIRS = {
  blog: 'src/content/blog',
  notes: 'src/content/notes',
  diary: 'src/content/diary'
}

export const COLLECTION_CONTRACTS = {
  blog: {
    collection: 'blog',
    source: 'obsidian',
    contentDir: CONTENT_COLLECTION_DIRS.blog,
    fields: {
      title: {
        required: true,
        normalizer: 'string',
        allowEmpty: false,
        description: 'Post title shown in list/detail pages.'
      },
      description: {
        normalizer: 'string',
        allowEmpty: false,
        description: 'Meta description for SEO and previews.'
      },
      tags: {
        required: true,
        normalizer: 'string-array',
        minItems: 1,
        description: 'Tag list used by tag pages.'
      },
      publishDate: {
        required: true,
        normalizer: 'date',
        description: 'Primary chronological field for posts.'
      },
      updated: {
        normalizer: 'date',
        description: 'Optional update timestamp.'
      },
      draft: {
        normalizer: 'boolean',
        description: 'Draft switch used in production filtering.'
      },
      comment: {
        normalizer: 'boolean',
        description: 'Comment widget switch.'
      },
      language: {
        normalizer: 'string',
        allowEmpty: false,
        description: 'Language marker for multilingual content.'
      }
    },
    passthroughFields: ['aliases', 'author', 'created', 'dg-path', 'permalink', 'pub-blog', 'type']
  },
  notes: {
    collection: 'notes',
    source: 'obsidian',
    contentDir: CONTENT_COLLECTION_DIRS.notes,
    fields: {
      updated: {
        required: true,
        normalizer: 'date',
        description: 'Notes collection requires updated in schema.'
      },
      tags: {
        required: true,
        normalizer: 'string-array',
        minItems: 1,
        description: 'Non-empty tags required by schema.'
      },
      title: {
        normalizer: 'string',
        allowEmpty: false,
        description: 'Optional note title.'
      },
      description: {
        normalizer: 'string',
        allowEmpty: false,
        description: 'Optional note description.'
      },
      publishDate: {
        normalizer: 'date',
        description: 'Optional publish date.'
      },
      aliases: {
        normalizer: 'string-array',
        description: 'Obsidian aliases support.'
      },
      author: {
        normalizer: 'string',
        allowEmpty: false,
        description: 'Optional author name.'
      },
      created: {
        normalizer: 'date',
        description: 'Creation timestamp.'
      },
      draft: {
        normalizer: 'boolean',
        description: 'Draft switch.'
      },
      comment: {
        normalizer: 'boolean',
        description: 'Comment widget switch.'
      },
      language: {
        normalizer: 'string',
        allowEmpty: false,
        description: 'Language marker.'
      }
    },
    passthroughFields: ['dg-path', 'permalink', 'pub-blog', 'type']
  },
  diary: {
    collection: 'diary',
    source: 'obsidian',
    contentDir: CONTENT_COLLECTION_DIRS.diary,
    fields: {
      publishDate: {
        required: true,
        normalizer: 'date',
        description: 'Diary entry date.'
      },
      title: {
        normalizer: 'string',
        allowEmpty: false,
        description: 'Optional diary title.'
      },
      mood: {
        normalizer: 'string',
        allowEmpty: false,
        description: 'Mood marker.'
      },
      tags: {
        normalizer: 'string-array',
        description: 'Optional tags.'
      },
      draft: {
        normalizer: 'boolean',
        description: 'Draft switch.'
      }
    },
    passthroughFields: []
  }
}

export const NOTION_BOOK_FILTER = {
  notionProperty: 'show',
  notionType: 'checkbox',
  expected: true
}

export const NOTION_BOOK_SORT = {
  notionProperty: 'end-date',
  direction: 'descending'
}

export const NOTION_BOOK_PROPERTY_MAP = [
  {
    notionProperty: 'title',
    notionType: 'title',
    localField: 'title',
    required: true,
    description: 'Book title.'
  },
  {
    notionProperty: 'score',
    notionType: 'formula',
    localField: 'score',
    description: 'Rating score from formula.'
  },
  {
    notionProperty: 'end-date',
    notionType: 'date',
    localField: 'date',
    description: 'Reading finished date.'
  },
  {
    notionProperty: 'year',
    notionType: 'formula',
    localField: 'year',
    required: true,
    description: 'Grouping year.'
  },
  {
    notionProperty: 'comment',
    notionType: 'rich_text',
    localField: 'comment',
    fallbackProperties: ['涔﹁瘎'],
    description: 'Book comment/review.'
  },
  {
    notionProperty: 'quote',
    notionType: 'rich_text',
    localField: 'quote',
    description: 'Quote excerpt.'
  },
  {
    notionProperty: 'cover',
    notionType: 'files',
    localField: 'cover',
    description: 'Book cover URL.'
  },
  {
    notionProperty: 'URL',
    notionType: 'url',
    localField: 'link',
    description: 'Reference link.'
  },
  {
    notionProperty: 'star',
    notionType: 'checkbox',
    localField: 'recommend',
    description: 'Recommendation flag.'
  }
]

export const PROJECT_SYNC_CONTRACT = {
  source: 'notion',
  target: 'src/pages/projects/index.astro',
  requiredFields: ['name', 'description', 'links'],
  optionalFields: ['image'],
  linkTypes: ['github', 'site', 'link', 'doc', 'release']
}

export const NOTION_DIARY_CONTRACT = {
  source: 'notion',
  targetDir: CONTENT_COLLECTION_DIRS.diary,
  filePrefix: 'notion-',
  showProperty: 'show',
  propertyCandidates: {
    title: ['title', 'Title', 'name', 'Name'],
    publishDate: ['publishDate', 'publish date', 'date', 'Date'],
    mood: ['mood', 'Mood', 'emotion', 'Emotion'],
    tags: ['tags', 'Tags', 'tag', 'Tag'],
    draft: ['draft', 'Draft'],
    show: ['show', 'Show', 'public', 'Public']
  }
}

export const NOTION_BLOG_CONTRACT = {
  source: 'notion',
  targetDir: CONTENT_COLLECTION_DIRS.blog,
  filePrefix: 'notion-',
  showProperty: 'show',
  propertyCandidates: {
    title: ['title', 'Title', 'name', 'Name', '标题', '標題', '题目'],
    description: ['description', 'Description', 'summary', 'Summary', '摘要', '简介', '簡介'],
    publishDate: ['publishDate', 'publish date', 'date', 'Date', '发布时间', '發布時間', '发布日', '發布日'],
    updated: ['updated', 'Updated', 'lastEdited', 'last edited', '更新时间', '更新時間'],
    tags: ['tags', 'Tags', 'tag', 'Tag', '标签', '標籤'],
    draft: ['draft', 'Draft'],
    show: ['show', 'Show', 'public', 'Public', 'publish', 'Publish', 'visible', 'Visible', '公开', '公開'],
    language: ['language', 'Language', 'lang', 'Lang', '语言', '語言'],
    comment: ['comment', 'Comment', 'comments', 'Comments', '评论', '評論']
  }
}

export function resolveFieldName(contract, inputKey) {
  if (Object.hasOwn(contract.fields, inputKey)) return inputKey
  for (const [canonical, field] of Object.entries(contract.fields)) {
    if (field.aliases?.includes(inputKey)) return canonical
  }
  return undefined
}

export function isKnownField(contract, inputKey) {
  return Boolean(resolveFieldName(contract, inputKey) || contract.passthroughFields.includes(inputKey))
}

function stripOuterQuotes(input) {
  const trimmed = input.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

function parseLooseArrayFromString(input) {
  const trimmed = input.trim()
  if (!trimmed) return []

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const body = trimmed.slice(1, -1).trim()
    if (!body) return []
    return body
      .split(',')
      .map((part) => stripOuterQuotes(part))
      .filter(Boolean)
  }

  return trimmed
    .split(',')
    .map((part) => stripOuterQuotes(part))
    .filter(Boolean)
}

export function normalizeByRule(normalizer, value) {
  if (!normalizer) return value

  switch (normalizer) {
    case 'string': {
      if (typeof value === 'string') return stripOuterQuotes(value)
      return null
    }
    case 'string-array': {
      let values = []

      if (Array.isArray(value)) {
        values = value
          .map((item) => (typeof item === 'string' ? stripOuterQuotes(item) : ''))
          .filter(Boolean)
      } else if (typeof value === 'string') {
        values = parseLooseArrayFromString(value)
      } else {
        return null
      }

      const deduped = [...new Set(values.map((item) => item.trim().toLowerCase()).filter(Boolean))]
      return deduped
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value
      if (typeof value === 'string') {
        const lowered = value.trim().toLowerCase()
        if (lowered === 'true') return true
        if (lowered === 'false') return false
      }
      return null
    }
    case 'date': {
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString()
      }
      if (typeof value === 'string') {
        const raw = stripOuterQuotes(value)
        if (!raw) return null
        const normalized = raw.includes(' ') && !raw.includes('T') ? raw.replace(' ', 'T') : raw
        const date = new Date(normalized)
        if (Number.isNaN(date.getTime())) return null
        return date.toISOString()
      }
      return null
    }
    case 'number': {
      if (typeof value === 'number' && Number.isFinite(value)) return value
      if (typeof value === 'string') {
        const parsed = Number(value.trim())
        return Number.isFinite(parsed) ? parsed : null
      }
      return null
    }
    case 'url': {
      if (typeof value !== 'string') return null
      const trimmed = stripOuterQuotes(value)
      if (!trimmed) return null
      try {
        return new URL(trimmed).toString()
      } catch {
        return null
      }
    }
    default:
      return null
  }
}

