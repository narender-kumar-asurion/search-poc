/**
 * Core search interfaces for Typesense search functionality
 * These interfaces define the contract for the search service
 */

// Common search parameters
export interface SearchQuery {
  query: string;
  filters?: SearchFilters;
  pagination?: SearchPagination;
  sorting?: SearchSort[];
  geoSearch?: GeoSearchFilter;
  collections?: string[]; // Specify which collections to search
}

export interface SearchFilters {
  category?: string;
  tags?: string[];
  document_type?: string; // Filter by document type
  customFilters?: Record<string, any>;
}

export interface GeoSearchFilter {
  lat: number;
  lng: number;
  radius?: number; // radius in meters, default 1000
  unit?: 'km' | 'mi' | 'm'; // default 'm'
}

export interface SearchPagination {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface SearchSort {
  field: string;
  direction: 'asc' | 'desc';
}

// Normalized search result format
export interface SearchDocument {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  score?: number;
  highlights?: SearchHighlight[];
  metadata?: Record<string, any>;
}

export interface SearchHighlight {
  field: string;
  matches: string[];
}

export interface SearchResult {
  documents: SearchDocument[];
  totalFound: number;
  facets?: SearchFacet[];
  searchTime?: number;
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

// Bulk operation result
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

// Collection statistics
export interface CollectionStats {
  name: string;
  documentCount: number;
  memoryUsage?: number;
  diskUsage?: number;
  lastUpdated?: number;
  schema?: any;
}

// Enhanced provider information
export interface SearchProviderInfo {
  name: string;
  version?: string;
  features: string[];
  capabilities: SearchProviderCapabilities;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  clusterInfo?: {
    nodes: number;
    health: 'green' | 'yellow' | 'red';
  };
}

// Provider capabilities
export interface SearchProviderCapabilities {
  fullTextSearch: boolean;
  facetedSearch: boolean;
  geoSearch: boolean;
  autocomplete: boolean;
  highlighting: boolean;
  synonyms: boolean;
  analytics: boolean;
  multiLanguage: boolean;
  realTimeIndex: boolean;
  bulkOperations: boolean;
  clustering: boolean;
  backup: boolean;
  customScoring: boolean;
  typoTolerance: boolean;
}

// Generic search provider configuration
export interface SearchProviderConfig {
  provider: SearchProviderType;
  connection: SearchConnectionConfig;
  options?: SearchProviderOptions;
}

export type SearchProviderType = 'typesense' | 'meilisearch';

// Generic connection configuration
export interface SearchConnectionConfig {
  // Common fields
  host?: string;
  port?: number;
  protocol?: string;
  apiKey?: string;
  indexName?: string;

  // Provider-specific fields
  url?: string; // For hosted services
  appId?: string; // For Algolia
  adminKey?: string; // For Algolia
  searchKey?: string; // For Algolia read operations
  masterKey?: string; // For Meilisearch
  nodes?: Array<{ // For Elasticsearch cluster
    host: string;
    port: number;
    protocol?: string;
  }>;

  // Cloud/hosted configuration
  cloudProvider?: 'aws' | 'gcp' | 'azure';
  region?: string;

  // SSL/TLS configuration
  ssl?: boolean;
  certificatePath?: string;

  // Authentication
  username?: string;
  password?: string;
}

// Provider-specific options
export interface SearchProviderOptions {
  timeout?: number;
  retries?: number;
  batchSize?: number;
  maxConcurrentRequests?: number;

  // Provider-specific settings
  typesense?: TypesenseOptions;
  meilisearch?: MeilisearchOptions;
}

export interface TypesenseOptions {
  connectionTimeoutSeconds?: number;
  healthcheckIntervalSeconds?: number;
  numRetries?: number;
  retryIntervalSeconds?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface MeilisearchOptions {
  timeout?: number;
  requestConfig?: Record<string, any>;
  httpClientOptions?: Record<string, any>;
}



// Main search service interface
export interface ISearchService {
  /**
   * Initialize the search service with configuration
   */
  initialize(config: SearchProviderConfig): Promise<void>;

  /**
   * Perform a text search with optional filters and pagination
   */
  search(query: SearchQuery): Promise<SearchResult>;

  /**
   * Search within a specific collection
   */
  searchCollection(collectionName: string, query: SearchQuery): Promise<SearchResult>;

  /**
   * Search multiple collections simultaneously
   */
  multiSearch(queries: Array<{ collection: string; query: SearchQuery }>): Promise<SearchResult[]>;

  /**
   * Perform a geo-spatial search for locations
   */
  geoSearch(geoFilter: GeoSearchFilter, query?: SearchQuery): Promise<SearchResult>;

  /**
   * Search within a specific category
   */
  searchByCategory(category: string, query?: string): Promise<SearchResult>;

  /**
   * Search by multiple tags
   */
  searchByTags(tags: string[], query?: string): Promise<SearchResult>;

  /**
   * Search by document type
   */
  searchByDocumentType(documentType: string, query?: string): Promise<SearchResult>;

  /**
   * Get available facets for filtering
   */
  getFacets(field?: string[], collectionName?: string): Promise<SearchFacet[]>;

  /**
   * Get search suggestions/autocomplete
   */
  getSuggestions(query: string, limit?: number, collectionName?: string): Promise<string[]>;

  /**
   * Create a collection with schema
   */
  createCollection(collectionName: string, schema: any): Promise<void>;

  /**
   * Index documents into a collection
   */
  indexDocuments(collectionName: string, documents: any[]): Promise<void>;

  /**
   * Delete a collection
   */
  deleteCollection(collectionName: string): Promise<void>;

  /**
   * Delete a single document from a collection
   */
  deleteDocument(collectionName: string, documentId: string): Promise<void>;

  /**
   * Delete multiple documents from a collection
   */
  deleteDocuments(collectionName: string, documentIds: string[]): Promise<BulkOperationResult>;

  /**
   * Update multiple documents in a collection
   */
  bulkUpdateDocuments(collectionName: string, documents: any[]): Promise<BulkOperationResult>;

  /**
   * Upsert multiple documents (insert or update)
   */
  upsertDocuments(collectionName: string, documents: any[]): Promise<BulkOperationResult>;

  /**
   * Clear all documents from a collection (but keep the collection)
   */
  clearCollection(collectionName: string): Promise<void>;

  /**
   * Get collection statistics
   */
  getCollectionStats(collectionName: string): Promise<CollectionStats>;

  /**
   * Health check for the search service
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get provider-specific information
   */
  getProviderInfo(): SearchProviderInfo;
}

// Error types for search operations
export class SearchError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider?: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = 'SearchError';
  }
}

export class SearchConnectionError extends SearchError {
  constructor(message: string, provider?: string, originalError?: Error) {
    super(message, 'CONNECTION_ERROR', provider, originalError);
    this.name = 'SearchConnectionError';
  }
}

export class SearchQueryError extends SearchError {
  constructor(message: string, provider?: string, originalError?: Error) {
    super(message, 'QUERY_ERROR', provider, originalError);
    this.name = 'SearchQueryError';
  }
}

export class SearchIndexError extends SearchError {
  constructor(message: string, provider?: string, originalError?: Error) {
    super(message, 'INDEX_ERROR', provider, originalError);
    this.name = 'SearchIndexError';
  }
}
