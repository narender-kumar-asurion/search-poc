import { z } from 'zod'

export const SearchHighlightSchema = z.object({
  field: z.string(),
  matches: z.array(z.string())
})

export const SearchFacetSchema = z.object({
  field: z.string(),
  values: z.array(z.object({ value: z.string(), count: z.number() }))
})

export const SearchResultSchema = z.object({
  id: z.string(),
  name: z.string().default(''),
  description: z.string().default(''),
  category: z.string().default(''),
  tags: z.array(z.string()).default([]),
  score: z.number().optional(),
  highlights: z.array(SearchHighlightSchema).optional(),
})

export const SearchPaginationSchema = z.object({
  currentPage: z.number(),
  totalPages: z.number(),
  hasNext: z.boolean(),
  hasPrevious: z.boolean(),
}).optional()

export const SearchResponseSchema = z.object({
  success: z.boolean(),
  query: z.string(),
  found: z.number(),
  results: z.array(SearchResultSchema),
  facets: z.array(SearchFacetSchema).optional(),
  pagination: SearchPaginationSchema,
  searchTime: z.number().optional(),
  message: z.string().optional(),
})



