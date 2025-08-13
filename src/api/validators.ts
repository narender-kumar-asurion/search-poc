import { z } from 'zod';

// Common coercions and bounds
const pageSchema = z.coerce.number().int().min(1).max(1000);
const limitSchema = z.coerce.number().int().min(1).max(100);

// Convert query param tags (string|string[]) to string[]
const tagsPreprocess = z.preprocess((val) => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') return [val];
  return undefined;
}, z.array(z.string()).min(1).optional());

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(256),
  category: z.string().min(1).max(128).optional(),
  tags: tagsPreprocess,
  page: pageSchema.default(1),
  limit: limitSchema.default(10),
});

export const categoryParamSchema = z.object({
  category: z.string().min(1).max(128),
});

export const tagsBodySchema = z.object({
  tags: z.array(z.string()).min(1),
});

export const claimsSearchSchema = z.object({
  q: z.string().min(1).max(256),
  claimType: z.string().min(1).max(64).optional(),
  claimStatus: z.string().min(1).max(64).optional(),
  province: z.string().min(1).max(32).optional(),
  page: pageSchema.default(1),
  limit: limitSchema.default(10),
});

export const locationsSearchSchema = z.object({
  q: z.string().min(1).max(256),
  province: z.string().min(1).max(32).optional(),
  postalCode: z.string().min(1).max(32).optional(),
  page: pageSchema.default(1),
  limit: limitSchema.default(10),
});

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
export type ClaimsSearchInput = z.infer<typeof claimsSearchSchema>;
export type LocationsSearchInput = z.infer<typeof locationsSearchSchema>;



