/**
 * Search Adapters - Public API
 *
 * Clean exports for the search adapter system.
 */

// Core interfaces and types
export type {
  SearchAdapter,
  SearchQuery,
  SearchResult,
  SearchDocument,
  SearchFacet,
  SearchConfig,
  SearchProvider,
  ProviderInfo,
  BulkOperationResult,
  CollectionStats,
  ConnectionConfig,
  ProviderOptions,
  SearchFilters,
  SearchPagination,
  SearchSort,
  SearchHighlight,
} from './SearchAdapter';

// Error types
export {
  SearchAdapterError,
  ConnectionError,
  QueryError,
  IndexError,
} from './SearchAdapter';

// Adapter implementations
export { TypesenseAdapter } from './TypesenseAdapter';
export { MeilisearchAdapter } from './MeilisearchAdapter';

// Factory and utilities
export {
  AdapterFactory,
  createSearchAdapter,
  getGlobalAdapter,
  resetGlobalAdapter,
  SUPPORTED_PROVIDERS,
  PROVIDER_FEATURES,
} from './AdapterFactory';

// Re-export for backward compatibility
export { getGlobalAdapter as getGlobalSearchService } from './AdapterFactory';
