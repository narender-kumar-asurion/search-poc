/**
 * SearchAdapter Interface
 *
 * Simplified, clean interface for search providers.
 * Supports Typesense and Meilisearch with a focus on real-world usage.
 */

export type SearchProvider = 'typesense' | 'meilisearch';

// Core search types
export interface SearchQuery {
  query: string;
  filters?: SearchFilters;
  pagination?: SearchPagination;
  sorting?: SearchSort[];
  collections?: string[];
}

export interface SearchFilters {
  category?: string;
  tags?: string[];
  document_type?: string;
  [key: string]: any; // Allow custom filters
}

export interface SearchPagination {
  page?: number;
  limit?: number;
}

export interface SearchSort {
  field: string;
  direction: 'asc' | 'desc';
}

// Search results
export interface SearchDocument {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  score?: number;
  highlights?: SearchHighlight[];
  [key: string]: any; // Allow additional fields
}

export interface SearchHighlight {
  field: string;
  matches: string[];
}

export interface SearchResult {
  documents: SearchDocument[];
  totalFound: number;
  searchTime?: number;
  facets?: SearchFacet[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface SearchFacet {
  field: string;
  values: Array<{
    value: string;
    count: number;
  }>;
}

// Provider configuration
export interface SearchConfig {
  provider: SearchProvider;
  connection: ConnectionConfig;
  options?: ProviderOptions;
}

export interface ConnectionConfig {
  host: string;
  port: number;
  protocol: 'http' | 'https';
  apiKey: string;
  indexName?: string;

  // Meilisearch specific
  masterKey?: string;
}

export interface ProviderOptions {
  timeout?: number;
  retries?: number;
  batchSize?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

// Bulk operations
export interface BulkOperationResult {
  success: boolean;
  total: number;
  succeeded: number;
  failed: number;
  errors?: Array<{
    documentId: string;
    error: string;
  }>;
  duration: number;
}

// Collection stats
export interface CollectionStats {
  name: string;
  documentCount: number;
  memoryUsage?: number;
  lastUpdated?: number;
}

// Provider info
export interface ProviderInfo {
  name: string;
  version?: string;
  features: string[];
  connectionStatus: 'connected' | 'disconnected' | 'error';
}

// Error types
export class SearchAdapterError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider?: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = 'SearchAdapterError';
  }
}

export class ConnectionError extends SearchAdapterError {
  constructor(message: string, provider?: string, originalError?: Error) {
    super(message, 'CONNECTION_ERROR', provider, originalError);
    this.name = 'ConnectionError';
  }
}

export class QueryError extends SearchAdapterError {
  constructor(message: string, provider?: string, originalError?: Error) {
    super(message, 'QUERY_ERROR', provider, originalError);
    this.name = 'QueryError';
  }
}

export class IndexError extends SearchAdapterError {
  constructor(message: string, provider?: string, originalError?: Error) {
    super(message, 'INDEX_ERROR', provider, originalError);
    this.name = 'IndexError';
  }
}

/**
 * Main SearchAdapter interface
 *
 * Focused on essential operations that both providers can support well.
 */
export interface SearchAdapter {
  /**
   * Initialize the adapter with configuration
   */
  initialize(config: SearchConfig): Promise<void>;

  /**
   * Perform a text search
   */
  search(query: SearchQuery): Promise<SearchResult>;

  /**
   * Search within a specific collection
   */
  searchCollection(collectionName: string, query: SearchQuery): Promise<SearchResult>;

  /**
   * Search by category (convenience method)
   */
  searchByCategory(category: string, query?: string): Promise<SearchResult>;

  /**
   * Search by tags (convenience method)
   */
  searchByTags(tags: string[], query?: string): Promise<SearchResult>;

  /**
   * Get available facets for filtering
   */
  getFacets(fields?: string[], collectionName?: string): Promise<SearchFacet[]>;

  /**
   * Get search suggestions/autocomplete
   */
  getSuggestions(query: string, limit?: number, collectionName?: string): Promise<string[]>;

  /**
   * Create a collection with schema
   */
  createCollection(collectionName: string, schema: any): Promise<void>;

  /**
   * Index documents into a collection (upsert behavior)
   */
  indexDocuments(collectionName: string, documents: any[]): Promise<void>;

  /**
   * Bulk upsert documents
   */
  upsertDocuments(collectionName: string, documents: any[]): Promise<BulkOperationResult>;

  /**
   * Delete a collection
   */
  deleteCollection(collectionName: string): Promise<void>;

  /**
   * Delete a single document
   */
  deleteDocument(collectionName: string, documentId: string): Promise<void>;

  /**
   * Clear all documents from a collection
   */
  clearCollection(collectionName: string): Promise<void>;

  /**
   * Get collection statistics
   */
  getCollectionStats(collectionName: string): Promise<CollectionStats>;

  /**
   * Health check
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get provider information
   */
  getProviderInfo(): ProviderInfo;
}
