import { z } from 'zod'
import { FORMATS } from './types'

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
