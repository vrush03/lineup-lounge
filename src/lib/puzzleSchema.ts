import { z } from 'zod'
import { ESTIMATE_FAMILIES, FORMATS, SHOWDOWN_FORMATS } from './types'

const itemSchema = z.object({
  label: z.string(),
  value: z.number(),
  display: z.string().optional(),
  note: z.string(),
  team: z.string().optional(),
  country: z.string().optional(),
})

export const puzzleSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  format: z.enum(FORMATS).optional(),
  direction: z.enum(['asc', 'desc']),
  unit: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  tags: z.array(z.string()).optional(),
  items: z
    .array(itemSchema)
    .length(5)
    .refine((items) => new Set(items.map((i) => i.label)).size === 5, 'labels must be unique'),
  source: z.object({ name: z.string(), url: z.string(), license: z.string() }).optional(),
  asOf: z.string().nullable().optional(),
})

const questionBase = {
  id: z.string(),
  prompt: z.string(),
  hint: z.string().min(1),
  fact: z.string().optional(),
  format: z.enum(FORMATS).optional(),
  source: z.object({ name: z.string(), url: z.string(), license: z.string() }).optional(),
}

export const questionSchema = z.union([
  z.strictObject({
    ...questionBase,
    kind: z.literal('number'),
    answer: z.number(),
    margin: z.number().nonnegative(),
    unit: z.string().optional(),
    plain: z.boolean().optional(),
  }),
  z.strictObject({
    ...questionBase,
    kind: z.literal('name').optional(),
    answer: z.string().min(1),
    accept: z.array(z.string().min(1)).optional(),
  }),
])

const sourceSchema = z.object({ name: z.string().min(1), url: z.string().url(), license: z.string().min(1) })

/** A question built only from figures in its own prompt has no source, but must show its working. */
export const estimateSchema = z
  .strictObject({
    id: z.string().min(1),
    prompt: z.string().min(1),
    answer: z.number().positive(),
    unit: z.string().optional(),
    family: z.enum(ESTIMATE_FAMILIES),
    format: z.enum(FORMATS).optional(),
    working: z.string().optional(),
    fact: z.string().optional(),
    sources: z.array(sourceSchema),
  })
  .refine((q) => q.sources.length > 0 || !!q.working, 'needs a source or its working')

const cardSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  team: z.string().min(1),
  photo: z.string().regex(/^\/players\/[a-z0-9-]+\.(jpg|webp)$/).optional(),
  stats: z.record(z.string(), z.number().nonnegative()),
  hsNotOut: z.boolean().optional(),
})

export const deckSchema = z.strictObject({
  format: z.enum(SHOWDOWN_FORMATS),
  asOf: z.string(),
  source: z.object({ name: z.string(), url: z.string(), license: z.string() }),
  stats: z.array(z.strictObject({ key: z.string(), label: z.string(), short: z.string(), decimals: z.number().optional() })).min(5),
  cards: z.array(cardSchema),
})
