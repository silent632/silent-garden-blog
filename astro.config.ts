// import cloudflare from '@astrojs/cloudflare'
import sitemap from '@astrojs/sitemap'
import AstroPureIntegration from 'astro-pure'
import { defineConfig } from 'astro/config'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'

import rehypeAutolinkHeadings from './src/plugins/rehype-auto-link-headings.ts'
import remarkSimpleCallout from './src/plugins/remark-simple-callout'
import remarkLinkpreview from './src/plugins/remark-linkpreview'
import remarkHighlight from './src/plugins/remark-highlight'
import remarkObsidianLinks from './src/plugins/remark-obsidian-links.ts'

import {
  addCopyButton,
  addLanguage,
  addTitle,
  transformerNotationDiff,
  transformerNotationHighlight,
  updateStyle
} from './src/plugins/shiki-transformers.ts'
import config from './src/site.config.ts'

export default defineConfig({
  site: process.env.SITE_URL || 'https://example.com',
  trailingSlash: 'never',

  // adapter: cloudflare(),
  output: 'static',

  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
      config: {
        limitInputPixels: false
      }
    }
  },

  integrations: [
    sitemap(),
    AstroPureIntegration(config)
  ],
  prefetch: true,

  server: { host: true },

  markdown: {
    remarkPlugins: [remarkMath, remarkSimpleCallout, remarkLinkpreview, remarkHighlight, remarkObsidianLinks],
    rehypePlugins: [
      [rehypeKatex, {}],
      [
        rehypeAutolinkHeadings,
        {
          behavior: 'append',
          properties: { className: ['anchor'] },
          content: { type: 'text', value: '#' }
        }
      ]
    ],

    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark'
      },
      transformers: [
        transformerNotationDiff(),
        transformerNotationHighlight(),
        updateStyle(),
        addTitle(),
        addLanguage(),
        addCopyButton(2000)
      ]
    }
  }
})


