/**
 * Search Service - Main Entry Point
 *
 * Updated to use the new SearchAdapter system.
 * Provides backward compatibility while using the improved architecture.
 */

// Export the main search service
export { searchService } from './SearchService';
export type { ApiSearchParams, ApiSearchResponse } from './SearchService';

// Export adapters and utilities
export * from './adapters';

// Backward compatibility exports
export { getGlobalAdapter as getGlobalSearchService } from './adapters';
export type { SearchAdapter as ISearchService } from './adapters';

// Re-export common types for convenience
export type {
  SearchQuery,
  SearchResult,
  SearchDocument,
  SearchFacet,
  SearchConfig,
  SearchProvider,
} from './adapters';
