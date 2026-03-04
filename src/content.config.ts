import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

function removeDupsAndLowerCase(array: string[]) {
  if (!array.length) return array
  const lowercaseItems = array.map((str) => str.toLowerCase())
  const distinctItems = new Set(lowercaseItems)
  return Array.from(distinctItems)
}

const blog = defineCollection({
  // Load Markdown and MDX files in the `src/content/blog/` directory.
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  // Required
  schema: ({ image }) =>
    z.object({
      // Required
      tags: z.array(z.string()).default([]).transform(removeDupsAndLowerCase),
      // Optional
      title: z.string().max(60),
      description: z.string().max(160).optional(),
      publishDate: z.coerce.date().optional(),
      updated: z.coerce.date().optional(),
      heroImage: z
        .object({
          src: image(),
          alt: z.string().optional(),
          inferSize: z.boolean().optional(),
          width: z.number().optional(),
          height: z.number().optional(),
          color: z.string().optional()
        })
        .optional(),
      
      language: z.string().optional(),
      draft: z.boolean().default(false),
      // Special fields
      comment: z.boolean().default(false)
    })
})

const notes = defineCollection({
  // Load Markdown and MDX files in the `src/content/notes/` directory.
  loader: glob({ base: './src/content/notes', pattern: '**/*.{md,mdx}' }),
  // Schema definition
  schema: ({ image }) =>
    z.object({
      // Required - Support date with time format like "2025-09-10 12:12"
      updated: z.preprocess(val => {
        if (typeof val === 'string') {
          // Handle date strings with or without time
          return new Date(val);
        }
        return val;
      }, z.date()),
      tags: z.array(z.string()).nonempty().transform(removeDupsAndLowerCase),
      
      // Optional - Core fields
      title: z.string().max(60).optional(),
      description: z.string().max(160).optional(),
      publishDate: z.coerce.date().optional(),
      
      // Recognized optional fields
      aliases: z.union([z.string(), z.array(z.string())]).transform(val => Array.isArray(val) ? val : [val]).default([]),
      author: z.string().optional(),
      created: z.coerce.date().optional(),
      
      // Additional optional fields (compatible with existing content)
      heroImage: z
        .object({
          src: image(),
          alt: z.string().optional(),
          inferSize: z.boolean().optional(),
          width: z.number().optional(),
          height: z.number().optional(),
          color: z.string().optional()
        })
        .optional(),
      
      language: z.string().optional(),
      draft: z.boolean().default(false),
      comment: z.boolean().default(false)
    })
})

const diary = defineCollection({
  loader: glob({ base: './src/content/diary', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    publishDate: z.coerce.date(),
    title: z.string().optional(),
    mood: z.string().optional(),
    tags: z.array(z.string()).default([]).transform(removeDupsAndLowerCase),
    draft: z.boolean().default(false)
  })
})

export const collections = { blog, notes, diary }
