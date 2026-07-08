import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildInternalContentUrl,
  paginateCollection
} from '../../src/utils/contentRouting.mjs'

test('paginateCollection creates as many pages as needed', () => {
  const items = Array.from({ length: 145 }, (_, index) => index)
  const pages = paginateCollection(items, 60)

  assert.equal(pages.length, 3)
  assert.equal(pages[0].pageNum, 1)
  assert.equal(pages[0].pageData.length, 60)
  assert.equal(pages[2].pageNum, 3)
  assert.equal(pages[2].pageData.length, 25)
})

test('paginateCollection keeps an empty first page for empty collections', () => {
  const pages = paginateCollection([], 60)

  assert.equal(pages.length, 1)
  assert.deepEqual(pages[0].pageData, [])
})

test('buildInternalContentUrl maps notes to the actual notes route', () => {
  assert.equal(
    buildInternalContentUrl('notes', '2026', '第一条笔记'),
    '/notes/%E7%AC%AC%E4%B8%80%E6%9D%A1%E7%AC%94%E8%AE%B0'
  )
})

test('buildInternalContentUrl preserves year-based blog routes', () => {
  assert.equal(
    buildInternalContentUrl('blog', '2026', 'when-robots-enter-daily-life'),
    '/blog/2026/when-robots-enter-daily-life'
  )
})
