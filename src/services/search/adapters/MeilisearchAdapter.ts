/**
 * Meilisearch Adapter Implementation
 *
 * Full implementation of SearchAdapter interface for Meilisearch.
 * Provides production-ready search functionality with Meilisearch.
 */

import { MeiliSearch, Index } from 'meilisearch';
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

interface MeilisearchSearchParams {
  q?: string;
  limit?: number;
  offset?: number;
  filter?: string | string[];
  sort?: string[];
  facets?: string[];
  attributesToHighlight?: string[];
  attributesToRetrieve?: string[];
  highlightPreTag?: string;
  highlightPostTag?: string;
}

export class MeilisearchAdapter implements SearchAdapter {
  private client?: MeiliSearch;
  private config?: SearchConfig;
  private defaultCollectionName?: string;

  async initialize(config: SearchConfig): Promise<void> {
    try {
      this.config = config;
      this.defaultCollectionName = config.connection.indexName || 'software_stack_components';

      const url = `${config.connection.protocol}://${config.connection.host}:${config.connection.port}`;

      this.client = new MeiliSearch({
        host: url,
        apiKey: config.connection.masterKey || config.connection.apiKey,
        timeout: config.options?.timeout ? config.options.timeout * 1000 : 5000, // Convert to ms
      });

      // Test connection
      await this.healthCheck();
      logger.info('Meilisearch adapter initialized successfully');
    } catch (error) {
      throw new ConnectionError(
        'Failed to initialize Meilisearch client',
        'meilisearch',
        error as Error,
      );
    }
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    if (!this.client) {
      throw new ConnectionError('Adapter not initialized', 'meilisearch');
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
        `Meilisearch search failed: ${(error as Error).message}`,
        'meilisearch',
        error as Error,
      );
    }
  }

  async searchCollection(collectionName: string, query: SearchQuery): Promise<SearchResult> {
    if (!this.client) {
      throw new ConnectionError('Adapter not initialized', 'meilisearch');
    }

    try {
      const index = this.client.index(collectionName);
      const searchParams = this.buildSearchParams(query, collectionName);

      const result = await index.search(searchParams.q || '', {
        limit: searchParams.limit,
        offset: searchParams.offset,
        filter: searchParams.filter,
        sort: searchParams.sort,
        facets: searchParams.facets,
        attributesToHighlight: searchParams.attributesToHighlight,
        attributesToRetrieve: searchParams.attributesToRetrieve,
        highlightPreTag: searchParams.highlightPreTag,
        highlightPostTag: searchParams.highlightPostTag,
      });

      return this.transformSearchResult(result, query);
    } catch (error) {
      throw new QueryError(
        `Meilisearch collection search failed: ${(error as Error).message}`,
        'meilisearch',
        error as Error,
      );
    }
  }

  async searchByCategory(category: string, query?: string): Promise<SearchResult> {
    return this.search({
      query: query || '',
      filters: { category },
    });
  }

  async searchByTags(tags: string[], query?: string): Promise<SearchResult> {
    return this.search({
      query: query || '',
      filters: { tags },
    });
  }

  async getFacets(fields?: string[], collectionName?: string): Promise<SearchFacet[]> {
    if (!this.client) {
      throw new ConnectionError('Adapter not initialized', 'meilisearch');
    }

    const targetCollection = collectionName || this.defaultCollectionName!;

    try {
      const index = this.client.index(targetCollection);
      const facetFields = fields || ['category', 'tags', 'document_type'];

      const result = await index.search('', {
        facets: facetFields,
        limit: 0, // We only want facets
      });

      return this.transformFacets(result.facetDistribution || {});
    } catch (error) {
      throw new QueryError(
        `Meilisearch facets request failed: ${(error as Error).message}`,
        'meilisearch',
        error as Error,
      );
    }
  }

  async getSuggestions(query: string, limit: number = 5, collectionName?: string): Promise<string[]> {
    if (!this.client) {
      throw new ConnectionError('Adapter not initialized', 'meilisearch');
    }

    const targetCollection = collectionName || this.defaultCollectionName!;

    try {
      const index = this.client.index(targetCollection);

      const result = await index.search(query, {
        limit,
        attributesToRetrieve: ['name', 'title'],
      });

      return result.hits.map((hit: any) => hit.name || hit.title).filter(Boolean);
    } catch (error) {
      throw new QueryError(
        `Meilisearch suggestions failed: ${(error as Error).message}`,
        'meilisearch',
        error as Error,
      );
    }
  }

  async createCollection(collectionName: string, schema: any): Promise<void> {
    if (!this.client) {
      throw new ConnectionError('Adapter not initialized', 'meilisearch');
    }

    try {
      // Create index
      const task = await this.client.createIndex(collectionName, {
        primaryKey: schema.primaryKey || 'id',
      });

      // Wait for task completion
      await this.client.waitForTask(task.taskUid);

      // Convert Typesense schema to Meilisearch format
      const meilisearchSchema = this.convertTypesenseSchemaToMeilisearch(schema);

      // Set up searchable attributes, filterable attributes, and sortable attributes
      const index = this.client.index(collectionName);

      if (meilisearchSchema.searchableAttributes && meilisearchSchema.searchableAttributes.length > 0) {
        const searchTask = await index.updateSearchableAttributes(meilisearchSchema.searchableAttributes);
        await this.client.waitForTask(searchTask.taskUid);
      }

      if (meilisearchSchema.filterableAttributes && meilisearchSchema.filterableAttributes.length > 0) {
        const filterTask = await index.updateFilterableAttributes(meilisearchSchema.filterableAttributes);
        await this.client.waitForTask(filterTask.taskUid);
      }

      if (meilisearchSchema.sortableAttributes && meilisearchSchema.sortableAttributes.length > 0) {
        const sortTask = await index.updateSortableAttributes(meilisearchSchema.sortableAttributes);
        await this.client.waitForTask(sortTask.taskUid);
      }

      logger.info(`Created collection: ${collectionName}`);
    } catch (error: any) {
      if (error.code === 'index_already_exists') {
        // Index already exists, which is fine
        return;
      }
      throw new IndexError(
        `Failed to create collection ${collectionName}: ${error.message}`,
        'meilisearch',
        error,
      );
    }
  }

  /**
   * Convert Typesense schema format to Meilisearch format
   */
  private convertTypesenseSchemaToMeilisearch(typesenseSchema: any): {
    searchableAttributes: string[];
    filterableAttributes: string[];
    sortableAttributes: string[];
  } {
    const searchableAttributes: string[] = [];
    const filterableAttributes: string[] = [];
    const sortableAttributes: string[] = [];

    // If schema has fields array (Typesense format)
    if (typesenseSchema.fields && Array.isArray(typesenseSchema.fields)) {
      typesenseSchema.fields.forEach((field: any) => {
        if (field.index) {
          searchableAttributes.push(field.name);
        }
        if (field.facet) {
          filterableAttributes.push(field.name);
        }
        // Add common sortable fields
        if (['popularity_score', 'created_at', 'updated_at', 'dateAdded'].includes(field.name)) {
          sortableAttributes.push(field.name);
        }
      });
    } else {
      // If schema is already in Meilisearch format, use as-is
      return {
        searchableAttributes: typesenseSchema.searchableAttributes || [],
        filterableAttributes: typesenseSchema.filterableAttributes || [],
        sortableAttributes: typesenseSchema.sortableAttributes || [],
      };
    }

    return {
      searchableAttributes,
      filterableAttributes,
      sortableAttributes,
    };
  }

  async indexDocuments(collectionName: string, documents: any[]): Promise<void> {
    if (!this.client) {
      throw new ConnectionError('Adapter not initialized', 'meilisearch');
    }

    try {
      // Use upsert behavior by default
      const result = await this.upsertDocuments(collectionName, documents);

      if (!result.success && result.errors && result.errors.length > 0) {
        logger.warn(`Some documents failed to index: ${result.failed}/${result.total}`);
        // Don't throw error for partial failures in indexing
      }

      logger.info(`Indexed ${result.succeeded}/${result.total} documents in ${collectionName}`);
    } catch (error: any) {
      throw new IndexError(
        `Failed to index documents in ${collectionName}: ${error.message}`,
        'meilisearch',
        error,
      );
    }
  }

  async upsertDocuments(collectionName: string, documents: any[]): Promise<BulkOperationResult> {
    if (!this.client) {
      throw new ConnectionError('Adapter not initialized', 'meilisearch');
    }

    const startTime = Date.now();

    try {
      const index = this.client.index(collectionName);

      // Use addDocuments which performs upsert by default in Meilisearch
      const task = await index.addDocuments(documents);

      // Wait for task completion
      const taskResult = await this.client.waitForTask(task.taskUid);

      const duration = Date.now() - startTime;

      if (taskResult.status === 'succeeded') {
        return {
          success: true,
          total: documents.length,
          succeeded: documents.length,
          failed: 0,
          duration,
        };
      } else {
        return {
          success: false,
          total: documents.length,
          succeeded: 0,
          failed: documents.length,
          errors: [{
            documentId: 'bulk_operation',
            error: taskResult.error?.message || 'Unknown error',
          }],
          duration,
        };
      }

    } catch (error: any) {
      throw new IndexError(
        `Bulk upsert operation failed: ${error.message}`,
        'meilisearch',
        error,
      );
    }
  }

  async deleteCollection(collectionName: string): Promise<void> {
    if (!this.client) {
      throw new ConnectionError('Adapter not initialized', 'meilisearch');
    }

    try {
      const task = await this.client.deleteIndex(collectionName);
      await this.client.waitForTask(task.taskUid);
      logger.info(`Deleted collection: ${collectionName}`);
    } catch (error: any) {
      throw new IndexError(
        `Failed to delete collection ${collectionName}: ${error.message}`,
        'meilisearch',
        error,
      );
    }
  }

  async deleteDocument(collectionName: string, documentId: string): Promise<void> {
    if (!this.client) {
      throw new ConnectionError('Adapter not initialized', 'meilisearch');
    }

    try {
      const index = this.client.index(collectionName);
      const task = await index.deleteDocument(documentId);
      await this.client.waitForTask(task.taskUid);
    } catch (error: any) {
      throw new IndexError(
        `Failed to delete document ${documentId} from ${collectionName}: ${error.message}`,
        'meilisearch',
        error,
      );
    }
  }

  async clearCollection(collectionName: string): Promise<void> {
    if (!this.client) {
      throw new ConnectionError('Adapter not initialized', 'meilisearch');
    }

    try {
      const index = this.client.index(collectionName);
      const task = await index.deleteAllDocuments();
      await this.client.waitForTask(task.taskUid);

      logger.info(`Cleared collection: ${collectionName}`);
    } catch (error: any) {
      throw new IndexError(
        `Failed to clear collection ${collectionName}: ${error.message}`,
        'meilisearch',
        error,
      );
    }
  }

  async getCollectionStats(collectionName: string): Promise<CollectionStats> {
    if (!this.client) {
      throw new ConnectionError('Adapter not initialized', 'meilisearch');
    }

    try {
      const index = this.client.index(collectionName);
      const stats = await index.getStats();

      return {
        name: collectionName,
        documentCount: stats.numberOfDocuments,
        lastUpdated: (stats as any).updatedAt ? new Date((stats as any).updatedAt).getTime() : undefined,
      };

    } catch (error: any) {
      throw new IndexError(
        `Failed to get stats for collection ${collectionName}: ${error.message}`,
        'meilisearch',
        error,
      );
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      await this.client.health();
      return true;
    } catch (error) {
      return false;
    }
  }

  getProviderInfo(): ProviderInfo {
    return {
      name: 'Meilisearch',
      version: '1.5.0',
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
   * Build Meilisearch-specific search parameters from generic query
   */
  private buildSearchParams(query: SearchQuery, collectionName?: string): MeilisearchSearchParams {
    const params: MeilisearchSearchParams = {
      q: query.query,
      limit: query.pagination?.limit || 10,
      attributesToHighlight: this.getHighlightFields(collectionName),
      attributesToRetrieve: ['*'], // Retrieve all fields
      highlightPreTag: '<mark>',
      highlightPostTag: '</mark>',
    };

    // Handle pagination
    if (query.pagination?.page && query.pagination.page > 1) {
      const limit = query.pagination.limit || 10;
      params.offset = (query.pagination.page - 1) * limit;
    }

    // Handle filters
    if (query.filters) {
      const filters: string[] = [];

      if (query.filters.category) {
        filters.push(`category = "${query.filters.category}"`);
      }

      if (query.filters.document_type) {
        filters.push(`document_type = "${query.filters.document_type}"`);
      }

      if (query.filters.tags && query.filters.tags.length > 0) {
        const tagFilters = query.filters.tags.map(tag => `tags = "${tag}"`);
        filters.push(`(${tagFilters.join(' OR ')})`);
      }

      // Handle custom filters
      Object.entries(query.filters).forEach(([key, value]) => {
        if (key !== 'category' && key !== 'document_type' && key !== 'tags' && value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            const arrayFilters = value.map(v => `${key} = "${v}"`);
            filters.push(`(${arrayFilters.join(' OR ')})`);
          } else {
            filters.push(`${key} = "${value}"`);
          }
        }
      });

      if (filters.length > 0) {
        params.filter = filters;
      }
    }

    // Handle sorting
    if (query.sorting && query.sorting.length > 0) {
      params.sort = query.sorting.map(sort => `${sort.field}:${sort.direction}`);
    }

    return params;
  }

  /**
   * Get appropriate highlight fields based on collection type
   */
  private getHighlightFields(collectionName?: string): string[] {
    switch (collectionName) {
      case 'claims':
        return ['claimNumber', 'consumerName', 'consumerCompanyName', 'productBrandCode'];
      case 'locations':
        return ['postalCode', 'postalCodeGroup', 'provinceId'];
      case 'software_stack_components':
      default:
        return ['name', 'description'];
    }
  }

  /**
   * Merge multiple search results into a single result
   */
  private mergeSearchResults(results: SearchResult[]): SearchResult {
    const allDocuments = results.flatMap(result => result.documents);
    const totalFound = results.reduce((sum, result) => sum + result.totalFound, 0);

    // Sort merged results by score (Meilisearch doesn't provide scores by default)
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
   * Transform Meilisearch results to generic format
   */
  private transformSearchResult(result: any, originalQuery: SearchQuery): SearchResult {
    const documents: SearchDocument[] = result.hits?.map((hit: any, index: number) => {
      return {
        id: hit.id,
        title: hit.name || hit.title || hit.claimNumber || hit.postalCode || 'Untitled',
        description: hit.description || hit.consumerName || hit.provinceId || '',
        category: hit.category || hit.document_type || 'unknown',
        tags: hit.tags || [],
        score: result.hits.length - index, // Simple scoring based on position
        highlights: this.transformHighlights(hit._formatted),
        // Include all document fields for the service layer
        ...hit,
      };
    }) || [];

    const totalFound = result.estimatedTotalHits || result.nbHits || 0;
    const limit = originalQuery.pagination?.limit || 10;
    const currentPage = originalQuery.pagination?.page || 1;

    return {
      documents,
      totalFound,
      searchTime: result.processingTimeMs,
      pagination: {
        currentPage,
        totalPages: Math.ceil(totalFound / limit),
        hasNext: currentPage * limit < totalFound,
        hasPrevious: currentPage > 1,
      },
    };
  }

  /**
   * Transform Meilisearch highlights to generic format
   */
  private transformHighlights(formatted?: any): any[] {
    if (!formatted) return [];

    const highlights: any[] = [];

    Object.entries(formatted).forEach(([field, value]) => {
      if (typeof value === 'string' && value.includes('<mark>')) {
        const matches = value.match(/<mark>(.*?)<\/mark>/g)?.map(match =>
          match.replace(/<\/?mark>/g, ''),
        ) || [];

        if (matches.length > 0) {
          highlights.push({
            field,
            matches,
          });
        }
      }
    });

    return highlights;
  }

  /**
   * Transform Meilisearch facets to generic format
   */
  private transformFacets(facetDistribution: Record<string, Record<string, number>>): SearchFacet[] {
    return Object.entries(facetDistribution).map(([field, values]) => ({
      field,
      values: Object.entries(values).map(([value, count]) => ({
        value,
        count,
      })),
    }));
  }
}
