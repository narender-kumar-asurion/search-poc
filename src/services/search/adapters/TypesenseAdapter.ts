/**
 * Typesense Adapter Implementation
 *
 * Clean implementation of SearchAdapter interface for Typesense.
 * Based on the working Typesense provider but simplified.
 */

import Typesense, { Client } from 'typesense';
import {
  SearchAdapter,
  SearchQuery,
  SearchResult,
  SearchDocument,
  SearchFacet,
  SearchConfig,
  ProviderInfo,
  BulkOperationResult,
  CollectionStats,
  ConnectionError,
  QueryError,
  IndexError,
} from './SearchAdapter';
import { logger } from '../../../lib/logger';

interface TypesenseSearchParams {
  q: string;
  query_by: string;
  highlight_full_fields?: string;
  per_page?: number;
  page?: number;
  filter_by?: string;
  sort_by?: string;
  facet_by?: string;
  max_facet_values?: number;
  prefix?: boolean;
}

export class TypesenseAdapter implements SearchAdapter {
  private client?: Client;
  private config?: SearchConfig;
  private defaultCollectionName?: string;

  async initialize(config: SearchConfig): Promise<void> {
    try {
      this.config = config;
      this.defaultCollectionName = config.connection.indexName || 'software_stack_components';

      this.client = new Typesense.Client({
        nodes: [
          {
            host: config.connection.host,
            port: config.connection.port,
            protocol: config.connection.protocol,
          },
        ],
        apiKey: config.connection.apiKey,
        connectionTimeoutSeconds: config.options?.timeout || 2,
        numRetries: config.options?.retries || 3,
        retryIntervalSeconds: 1,
        healthcheckIntervalSeconds: 60,
        logLevel: config.options?.logLevel || 'info',
      });

      // Test connection
      await this.healthCheck();
      logger.info('Typesense adapter initialized successfully');
    } catch (error) {
      throw new ConnectionError(
        'Failed to initialize Typesense client',
        'typesense',
        error as Error,
      );
    }
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    if (!this.client) {
      throw new ConnectionError('Adapter not initialized', 'typesense');
    }

    try {
      // If specific collections are specified, search those; otherwise use default
      const collectionsToSearch = query.collections || [this.defaultCollectionName!];

      if (collectionsToSearch.length === 1) {
        return await this.searchCollection(collectionsToSearch[0]!, query);
      } else {
        // Multi-collection search - merge results
        const results = await Promise.all(
          collectionsToSearch.map(collection => this.searchCollection(collection, query)),
        );
        return this.mergeSearchResults(results);
      }
    } catch (error) {
      throw new QueryError(
        `Typesense search failed: ${(error as Error).message}`,
        'typesense',
        error as Error,
      );
    }
  }

  async searchCollection(collectionName: string, query: SearchQuery): Promise<SearchResult> {
    if (!this.client) {
      throw new ConnectionError('Adapter not initialized', 'typesense');
    }

    try {
      const searchParams = this.buildSearchParams(query, collectionName);

      const result = await this.client
        .collections(collectionName)
        .documents()
        .search(searchParams);

      return this.transformSearchResult(result as any, query);
    } catch (error) {
      throw new QueryError(
        `Typesense collection search failed: ${(error as Error).message}`,
        'typesense',
        error as Error,
      );
    }
  }

  async searchByCategory(category: string, query?: string): Promise<SearchResult> {
    return this.search({
      query: query || '*',
      filters: { category },
    });
  }

  async searchByTags(tags: string[], query?: string): Promise<SearchResult> {
    return this.search({
      query: query || '*',
      filters: { tags },
    });
  }

  async getFacets(fields?: string[], collectionName?: string): Promise<SearchFacet[]> {
    if (!this.client) {
      throw new ConnectionError('Adapter not initialized', 'typesense');
    }

    const targetCollection = collectionName || this.defaultCollectionName!;

    try {
      const facetFields = fields || ['category', 'tags', 'document_type'];
      const searchParams: TypesenseSearchParams = {
        q: '*',
        query_by: this.getQueryFields(targetCollection),
        facet_by: facetFields.join(','),
        max_facet_values: 20,
        per_page: 0,
      };

      const result = await this.client
        .collections(targetCollection)
        .documents()
        .search(searchParams);

      return this.transformFacets((result as any).facet_counts || []);
    } catch (error) {
      throw new QueryError(
        `Typesense facets request failed: ${(error as Error).message}`,
        'typesense',
        error as Error,
      );
    }
  }

  async getSuggestions(query: string, limit: number = 5, collectionName?: string): Promise<string[]> {
    if (!this.client) {
      throw new ConnectionError('Adapter not initialized', 'typesense');
    }

    const targetCollection = collectionName || this.defaultCollectionName!;

    try {
      const searchParams: TypesenseSearchParams = {
        q: query,
        query_by: this.getQueryFields(targetCollection),
        per_page: limit,
        prefix: true,
      };

      const result = await this.client
        .collections(targetCollection)
        .documents()
        .search(searchParams);

      return (result as any).hits?.map((hit: any) => hit.document.name || hit.document.title) || [];
    } catch (error) {
      throw new QueryError(
        `Typesense suggestions failed: ${(error as Error).message}`,
        'typesense',
        error as Error,
      );
    }
  }

  async createCollection(collectionName: string, schema: any): Promise<void> {
    if (!this.client) {
      throw new ConnectionError('Adapter not initialized', 'typesense');
    }

    try {
      await this.client.collections().create(schema);
      logger.info(`Created collection: ${collectionName}`);
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        // Collection already exists, which is fine
        return;
      }
      throw new IndexError(
        `Failed to create collection ${collectionName}: ${error.message}`,
        'typesense',
        error,
      );
    }
  }

  async indexDocuments(collectionName: string, documents: any[]): Promise<void> {
    if (!this.client) {
      throw new ConnectionError('Adapter not initialized', 'typesense');
    }

    try {
      // Use bulk upsert for better performance
      const result = await this.upsertDocuments(collectionName, documents);

      if (!result.success && result.errors && result.errors.length > 0) {
        logger.warn(`Some documents failed to index: ${result.failed}/${result.total}`);
        // Don't throw error for partial failures in indexing
      }

      logger.info(`Indexed ${result.succeeded}/${result.total} documents in ${collectionName}`);
    } catch (error: any) {
      throw new IndexError(
        `Failed to index documents in ${collectionName}: ${error.message}`,
        'typesense',
        error,
      );
    }
  }

  async upsertDocuments(collectionName: string, documents: any[]): Promise<BulkOperationResult> {
    if (!this.client) {
      throw new ConnectionError('Adapter not initialized', 'typesense');
    }

    const startTime = Date.now();
    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ documentId: string; error: string }> = [];

    try {
      // Use Typesense bulk import for better performance
      const importData = documents.map(doc => JSON.stringify(doc)).join('\n');

      const result = await this.client.collections(collectionName).documents().import(
        importData,
        { action: 'upsert' },
      );

      // Parse the import results
      const lines = result.split('\n').filter(line => line.trim());

      for (let i = 0; i < lines.length; i++) {
        try {
          const lineResult = JSON.parse(lines[i]!);

          if (lineResult.success === true) {
            succeeded++;
          } else {
            failed++;
            const docId = documents[i]?.id || `document_${i}`;
            errors.push({
              documentId: docId,
              error: lineResult.error || 'Import failed',
            });
          }
        } catch (parseError) {
          failed++;
          const docId = documents[i]?.id || `document_${i}`;
          errors.push({
            documentId: docId,
            error: 'Failed to parse import result',
          });
        }
      }

      const duration = Date.now() - startTime;

      return {
        success: failed === 0,
        total: documents.length,
        succeeded,
        failed,
        errors: errors.length > 0 ? errors : undefined,
        duration,
      };

    } catch (error: any) {
      throw new IndexError(
        `Bulk upsert operation failed: ${error.message}`,
        'typesense',
        error,
      );
    }
  }

  async deleteCollection(collectionName: string): Promise<void> {
    if (!this.client) {
      throw new ConnectionError('Adapter not initialized', 'typesense');
    }

    try {
      await this.client.collections(collectionName).delete();
      logger.info(`Deleted collection: ${collectionName}`);
    } catch (error: any) {
      throw new IndexError(
        `Failed to delete collection ${collectionName}: ${error.message}`,
        'typesense',
        error,
      );
    }
  }

  async deleteDocument(collectionName: string, documentId: string): Promise<void> {
    if (!this.client) {
      throw new ConnectionError('Adapter not initialized', 'typesense');
    }

    try {
      await this.client.collections(collectionName).documents(documentId).delete();
    } catch (error: any) {
      throw new IndexError(
        `Failed to delete document ${documentId} from ${collectionName}: ${error.message}`,
        'typesense',
        error,
      );
    }
  }

  async clearCollection(collectionName: string): Promise<void> {
    if (!this.client) {
      throw new ConnectionError('Adapter not initialized', 'typesense');
    }

    try {
      // Get the collection schema
      const collection = await this.client.collections(collectionName).retrieve();

      // Delete the collection
      await this.client.collections(collectionName).delete();

      // Recreate with the same schema
      await this.client.collections().create(collection);

      logger.info(`Cleared collection: ${collectionName}`);
    } catch (error: any) {
      throw new IndexError(
        `Failed to clear collection ${collectionName}: ${error.message}`,
        'typesense',
        error,
      );
    }
  }

  async getCollectionStats(collectionName: string): Promise<CollectionStats> {
    if (!this.client) {
      throw new ConnectionError('Adapter not initialized', 'typesense');
    }

    try {
      const collection = await this.client.collections(collectionName).retrieve();

      // Get document count via a search query
      const searchResult = await this.client.collections(collectionName).documents().search({
        q: '*',
        query_by: this.getQueryFields(collectionName),
        per_page: 0, // We only want the count
      });

      return {
        name: collectionName,
        documentCount: (searchResult as any).found || 0,
        memoryUsage: (collection as any).memory_usage,
        lastUpdated: collection.created_at ? new Date(collection.created_at * 1000).getTime() : undefined,
      };

    } catch (error: any) {
      throw new IndexError(
        `Failed to get stats for collection ${collectionName}: ${error.message}`,
        'typesense',
        error,
      );
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      await this.client.health.retrieve();
      return true;
    } catch (error) {
      return false;
    }
  }

  getProviderInfo(): ProviderInfo {
    return {
      name: 'Typesense',
      version: '0.25.0',
      features: [
        'full-text-search',
        'faceted-search',
        'typo-tolerance',
        'highlighting',
        'sorting',
        'filtering',
        'bulk-operations',
        'real-time-indexing',
        'autocomplete',
      ],
      connectionStatus: this.client ? 'connected' : 'disconnected',
    };
  }

  /**
   * Build Typesense-specific search parameters from generic query
   */
  private buildSearchParams(query: SearchQuery, collectionName?: string): TypesenseSearchParams {
    const params: TypesenseSearchParams = {
      q: query.query,
      query_by: this.getQueryFields(collectionName),
      highlight_full_fields: this.getHighlightFields(collectionName),
      per_page: query.pagination?.limit || 10,
    };

    // Handle pagination
    if (query.pagination?.page) {
      params.page = query.pagination.page;
    }

    // Handle filters
    if (query.filters) {
      const filters: string[] = [];

      if (query.filters.category) {
        filters.push(`category:=${query.filters.category}`);
      }

      if (query.filters.document_type) {
        filters.push(`document_type:=${query.filters.document_type}`);
      }

      if (query.filters.tags && query.filters.tags.length > 0) {
        const tagFilter = query.filters.tags.map(tag => `tags:=${tag}`).join(' && ');
        filters.push(`(${tagFilter})`);
      }

      // Handle custom filters
      Object.entries(query.filters).forEach(([key, value]) => {
        if (key !== 'category' && key !== 'document_type' && key !== 'tags' && value !== undefined && value !== null) {
          filters.push(`${key}:=${value}`);
        }
      });

      if (filters.length > 0) {
        params.filter_by = filters.join(' && ');
      }
    }

    // Handle sorting
    if (query.sorting && query.sorting.length > 0) {
      params.sort_by = query.sorting
        .map(sort => `${sort.field}:${sort.direction}`)
        .join(',');
    } else {
      params.sort_by = this.getDefaultSort(collectionName);
    }

    return params;
  }

  /**
   * Get appropriate query fields based on collection type
   */
  private getQueryFields(collectionName?: string): string {
    switch (collectionName) {
      case 'claims':
        return 'claimNumber,claimId,referenceNumber,consumerName,consumerNameFirst,consumerCompanyName,consumerAddCity,consumerAddState,productBrandCode,serialNumber,claimType,claimStatusGroup';
      case 'locations':
        return 'postalCode,postalCodeGroup,provinceId,countryId';
      case 'software_stack_components':
      default:
        return 'name,description,tags';
    }
  }

  /**
   * Get appropriate highlight fields based on collection type
   */
  private getHighlightFields(collectionName?: string): string {
    switch (collectionName) {
      case 'claims':
        return 'claimNumber,consumerName,consumerCompanyName,productBrandCode';
      case 'locations':
        return 'postalCode,postalCodeGroup,provinceId';
      case 'software_stack_components':
      default:
        return 'name,description';
    }
  }

  /**
   * Get default sort field based on collection type
   */
  private getDefaultSort(collectionName?: string): string {
    switch (collectionName) {
      case 'claims':
        return 'dateAdded:desc';
      case 'locations':
        return 'created_at:desc';
      case 'software_stack_components':
      default:
        return '_text_match:desc';
    }
  }

  /**
   * Merge multiple search results into a single result
   */
  private mergeSearchResults(results: SearchResult[]): SearchResult {
    const allDocuments = results.flatMap(result => result.documents);
    const totalFound = results.reduce((sum, result) => sum + result.totalFound, 0);

    // Sort merged results by score
    allDocuments.sort((a, b) => (b.score || 0) - (a.score || 0));

    return {
      documents: allDocuments,
      totalFound,
      searchTime: Math.max(...results.map(r => r.searchTime || 0)),
      pagination: {
        currentPage: 1,
        totalPages: Math.ceil(totalFound / 10),
        hasNext: totalFound > 10,
        hasPrevious: false,
      },
    };
  }

  /**
   * Transform Typesense results to generic format
   */
  private transformSearchResult(result: any, originalQuery: SearchQuery): SearchResult {
    const documents: SearchDocument[] = result.hits?.map((hit: any) => {
      const doc = hit.document;

      return {
        id: doc.id,
        title: doc.name || doc.title || doc.claimNumber || doc.postalCode || 'Untitled',
        description: doc.description || doc.consumerName || doc.provinceId || '',
        category: doc.category || doc.document_type || 'unknown',
        tags: doc.tags || [],
        score: hit.text_match,
        highlights: this.transformHighlights(hit.highlights),
        // Include all document fields for the service layer
        ...doc,
      };
    }) || [];

    const totalFound = result.found || 0;
    const limit = originalQuery.pagination?.limit || 10;
    const currentPage = originalQuery.pagination?.page || 1;

    return {
      documents,
      totalFound,
      searchTime: result.search_time_ms,
      pagination: {
        currentPage,
        totalPages: Math.ceil(totalFound / limit),
        hasNext: currentPage * limit < totalFound,
        hasPrevious: currentPage > 1,
      },
    };
  }

  /**
   * Transform Typesense highlights to generic format
   */
  private transformHighlights(highlights?: any[]): any[] {
    if (!highlights) return [];

    return highlights.map((highlight) => ({
      field: highlight.field,
      matches: highlight.matched_tokens || [],
    }));
  }

  /**
   * Transform Typesense facets to generic format
   */
  private transformFacets(facetCounts: any[]): SearchFacet[] {
    return facetCounts.map((facet: any) => ({
      field: facet.field_name,
      values: facet.counts.map((count: any) => ({
        value: count.value,
        count: count.count,
      })),
    }));
  }
}
