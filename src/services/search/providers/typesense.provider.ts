import Typesense, { Client } from 'typesense';
import {
  ISearchService,
  SearchQuery,
  SearchResult,
  SearchDocument,
  SearchFacet,
  SearchProviderConfig,
  SearchProviderInfo,
  SearchProviderCapabilities,
  BulkOperationResult,
  CollectionStats,
  SearchError,
  SearchConnectionError,
  SearchQueryError,
  SearchIndexError,
  GeoSearchFilter,
} from '../interfaces';

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

/**
 * Typesense implementation of the search service interface
 * Handles all Typesense-specific logic while providing a clean abstraction
 */
export class TypesenseSearchProvider implements ISearchService {
  private client?: Client;
  private config?: SearchProviderConfig;
  private defaultCollectionName?: string;

  async initialize(config: SearchProviderConfig): Promise<void> {
    try {
      this.config = config;
      this.defaultCollectionName = config.connection.indexName || 'software_stack_components';

      this.client = new Typesense.Client({
        nodes: [
          {
            host: config.connection.host!,
            port: config.connection.port!,
            protocol: config.connection.protocol!,
          },
        ],
        apiKey: config.connection.apiKey!,
        connectionTimeoutSeconds: config.options?.typesense?.connectionTimeoutSeconds || config.options?.timeout || 2,
        numRetries: config.options?.typesense?.numRetries || config.options?.retries || 3,
        retryIntervalSeconds: config.options?.typesense?.retryIntervalSeconds || 1,
        healthcheckIntervalSeconds: config.options?.typesense?.healthcheckIntervalSeconds || 60,
        logLevel: config.options?.typesense?.logLevel || 'info',
      });

      // Test connection
      await this.healthCheck();
    } catch (error) {
      throw new SearchConnectionError(
        'Failed to initialize Typesense client',
        'typesense',
        error as Error,
      );
    }
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    if (!this.client) {
      throw new SearchError('Search service not initialized', 'NOT_INITIALIZED', 'typesense');
    }

    try {
      // If specific collections are specified, search those; otherwise use default
      const collectionsToSearch = query.collections || [this.defaultCollectionName!];

      if (collectionsToSearch.length === 1 && collectionsToSearch[0]) {
        return await this.searchCollection(collectionsToSearch[0], query);
      } else {
        // Multi-collection search
        const results = await this.multiSearch(
          collectionsToSearch.map(collection => ({ collection, query })),
        );
        return this.mergeSearchResults(results);
      }
    } catch (error) {
      throw new SearchQueryError(
        `Typesense search failed: ${(error as Error).message}`,
        'typesense',
        error as Error,
      );
    }
  }

  async searchCollection(collectionName: string, query: SearchQuery): Promise<SearchResult> {
    if (!this.client) {
      throw new SearchError('Search service not initialized', 'NOT_INITIALIZED', 'typesense');
    }

    try {
      const searchParams = this.buildSearchParams(query, collectionName);

      const result = await this.client
        .collections(collectionName)
        .documents()
        .search(searchParams);

      return this.transformSearchResult(result as any, query);
    } catch (error) {
      throw new SearchQueryError(
        `Typesense collection search failed: ${(error as Error).message}`,
        'typesense',
        error as Error,
      );
    }
  }

  async multiSearch(queries: Array<{ collection: string; query: SearchQuery }>): Promise<SearchResult[]> {
    if (!this.client) {
      throw new SearchError('Search service not initialized', 'NOT_INITIALIZED', 'typesense');
    }

    try {
      const searchPromises = queries.map(({ collection, query }) =>
        this.searchCollection(collection, query),
      );

      return await Promise.all(searchPromises);
    } catch (error) {
      throw new SearchQueryError(
        `Typesense multi-search failed: ${(error as Error).message}`,
        'typesense',
        error as Error,
      );
    }
  }

  async geoSearch(geoFilter: GeoSearchFilter, query?: SearchQuery): Promise<SearchResult> {
    if (!this.client) {
      throw new SearchError('Search service not initialized', 'NOT_INITIALIZED', 'typesense');
    }

    try {
      const searchQuery: SearchQuery = {
        ...query,
        query: query?.query || '*',
        geoSearch: geoFilter,
      };

      // Assume locations collection for geo-search
      const collectionName = 'locations';
      return await this.searchCollection(collectionName, searchQuery);
    } catch (error) {
      throw new SearchQueryError(
        `Typesense geo-search failed: ${(error as Error).message}`,
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

  async searchByDocumentType(documentType: string, query?: string): Promise<SearchResult> {
    return this.search({
      query: query || '*',
      filters: { document_type: documentType },
    });
  }

  async getFacets(fields?: string[], collectionName?: string): Promise<SearchFacet[]> {
    if (!this.client) {
      throw new SearchError('Search service not initialized', 'NOT_INITIALIZED', 'typesense');
    }

    const targetCollection = collectionName || this.defaultCollectionName!;

    try {
      const facetFields = fields || ['category', 'tags', 'document_type'];
      const searchParams: TypesenseSearchParams = {
        q: '*',
        query_by: 'name',
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
      throw new SearchQueryError(
        `Typesense facets request failed: ${(error as Error).message}`,
        'typesense',
        error as Error,
      );
    }
  }

  async getSuggestions(query: string, limit: number = 5, collectionName?: string): Promise<string[]> {
    if (!this.client) {
      throw new SearchError('Search service not initialized', 'NOT_INITIALIZED', 'typesense');
    }

    const targetCollection = collectionName || this.defaultCollectionName!;

    try {
      const searchParams: TypesenseSearchParams = {
        q: query,
        query_by: 'name,tags',
        per_page: limit,
        prefix: true,
      };

      const result = await this.client
        .collections(targetCollection)
        .documents()
        .search(searchParams);

      return (result as any).hits?.map((hit: any) => hit.document.name) || [];
    } catch (error) {
      throw new SearchQueryError(
        `Typesense suggestions failed: ${(error as Error).message}`,
        'typesense',
        error as Error,
      );
    }
  }

  async createCollection(collectionName: string, schema: any): Promise<void> {
    if (!this.client) {
      throw new SearchError('Search service not initialized', 'NOT_INITIALIZED', 'typesense');
    }

    try {
      await this.client.collections().create(schema);
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        // Collection already exists, which is fine
        return;
      }
      throw new SearchIndexError(
        `Failed to create collection ${collectionName}: ${error.message}`,
        'typesense',
        error,
      );
    }
  }

  async indexDocuments(collectionName: string, documents: any[]): Promise<void> {
    if (!this.client) {
      throw new SearchError('Search service not initialized', 'NOT_INITIALIZED', 'typesense');
    }

    try {
      for (const document of documents) {
        try {
          // Try to create the document first
          await this.client
            .collections(collectionName)
            .documents()
            .create(document);
        } catch (error: any) {
          if (error.httpStatus === 409) {
            // Document already exists, update it instead
            await this.client
              .collections(collectionName)
              .documents(document.id)
              .update(document);
          } else {
            throw error;
          }
        }
      }
    } catch (error: any) {
      throw new SearchIndexError(
        `Failed to index documents in ${collectionName}: ${error.message}`,
        'typesense',
        error,
      );
    }
  }

  async deleteCollection(collectionName: string): Promise<void> {
    if (!this.client) {
      throw new SearchError('Search service not initialized', 'NOT_INITIALIZED', 'typesense');
    }

    try {
      await this.client.collections(collectionName).delete();
    } catch (error: any) {
      throw new SearchIndexError(
        `Failed to delete collection ${collectionName}: ${error.message}`,
        'typesense',
        error,
      );
    }
  }

  async deleteDocument(collectionName: string, documentId: string): Promise<void> {
    if (!this.client) {
      throw new SearchError('Search service not initialized', 'NOT_INITIALIZED', 'typesense');
    }

    try {
      await this.client.collections(collectionName).documents(documentId).delete();
    } catch (error: any) {
      throw new SearchIndexError(
        `Failed to delete document ${documentId} from ${collectionName}: ${error.message}`,
        'typesense',
        error,
      );
    }
  }

  async deleteDocuments(collectionName: string, documentIds: string[]): Promise<BulkOperationResult> {
    if (!this.client) {
      throw new SearchError('Search service not initialized', 'NOT_INITIALIZED', 'typesense');
    }

    const startTime = Date.now();
    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ documentId: string; error: string }> = [];

    try {
      // Process deletions in parallel with controlled concurrency
      const batchSize = this.config?.options?.batchSize || 10;
      const batches: string[][] = [];

      for (let i = 0; i < documentIds.length; i += batchSize) {
        batches.push(documentIds.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        const deletePromises = batch.map(async (docId) => {
          try {
            await this.client!.collections(collectionName).documents(docId).delete();
            return { success: true, documentId: docId };
          } catch (error: any) {
            return {
              success: false,
              documentId: docId,
              error: error.message || 'Unknown error',
            };
          }
        });

        const results = await Promise.all(deletePromises);

        for (const result of results) {
          if (result.success) {
            succeeded++;
          } else {
            failed++;
            errors.push({ documentId: result.documentId, error: result.error });
          }
        }
      }

      const duration = Date.now() - startTime;

      return {
        success: failed === 0,
        total: documentIds.length,
        succeeded,
        failed,
        errors: errors.length > 0 ? errors : undefined,
        duration,
      };

    } catch (error: any) {
      throw new SearchIndexError(
        `Bulk delete operation failed: ${error.message}`,
        'typesense',
        error,
      );
    }
  }

  async bulkUpdateDocuments(collectionName: string, documents: any[]): Promise<BulkOperationResult> {
    return this.upsertDocuments(collectionName, documents);
  }

  async upsertDocuments(collectionName: string, documents: any[]): Promise<BulkOperationResult> {
    if (!this.client) {
      throw new SearchError('Search service not initialized', 'NOT_INITIALIZED', 'typesense');
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
          const line = lines[i];
          if (!line) continue;
          const lineResult = JSON.parse(line);

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
      throw new SearchIndexError(
        `Bulk upsert operation failed: ${error.message}`,
        'typesense',
        error,
      );
    }
  }

  async clearCollection(collectionName: string): Promise<void> {
    if (!this.client) {
      throw new SearchError('Search service not initialized', 'NOT_INITIALIZED', 'typesense');
    }

    try {
      // Typesense doesn't have a direct "clear all" method
      // We need to delete and recreate the collection

      // First, get the collection schema
      const collection = await this.client.collections(collectionName).retrieve();

      // Delete the collection
      await this.client.collections(collectionName).delete();

      // Recreate with the same schema
      await this.client.collections().create(collection);

    } catch (error: any) {
      throw new SearchIndexError(
        `Failed to clear collection ${collectionName}: ${error.message}`,
        'typesense',
        error,
      );
    }
  }

  async getCollectionStats(collectionName: string): Promise<CollectionStats> {
    if (!this.client) {
      throw new SearchError('Search service not initialized', 'NOT_INITIALIZED', 'typesense');
    }

    try {
      const collection = await this.client.collections(collectionName).retrieve();

      // Get document count via a search query
      const searchResult = await this.client.collections(collectionName).documents().search({
        q: '*',
        query_by: Object.keys(collection.fields?.[0] || {}).join(',') || 'id',
        per_page: 0, // We only want the count
      });

      return {
        name: collectionName,
        documentCount: (searchResult as any).found || 0,
        memoryUsage: (collection as any).memory_usage || 0,
        diskUsage: (collection as any).disk_usage || 0,
        lastUpdated: collection.created_at ? new Date(collection.created_at * 1000).getTime() : undefined,
        schema: collection,
      };

    } catch (error: any) {
      throw new SearchIndexError(
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

  getProviderInfo(): SearchProviderInfo {
    const capabilities: SearchProviderCapabilities = {
      fullTextSearch: true,
      facetedSearch: true,
      geoSearch: true,
      autocomplete: true,
      highlighting: true,
      synonyms: true,
      analytics: false,
      multiLanguage: true,
      realTimeIndex: true,
      bulkOperations: true,
      clustering: true,
      backup: false,
      customScoring: true,
      typoTolerance: true,
    };

    return {
      name: 'Typesense',
      version: '0.25.0',
      features: [
        'full-text-search',
        'faceted-search',
        'typo-tolerance',
        'geo-search',
        'highlighting',
        'facets',
        'sorting',
        'filtering',
        'bulk-operations',
        'clustering',
        'real-time-indexing',
      ],
      capabilities,
      connectionStatus: this.client ? 'connected' : 'disconnected',
      clusterInfo: {
        nodes: 1, // Would need to query Typesense for actual cluster info
        health: 'green',
      },
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
      if (query.filters.customFilters) {
        Object.entries(query.filters.customFilters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            filters.push(`${key}:=${value}`);
          }
        });
      }

      if (filters.length > 0) {
        params.filter_by = filters.join(' && ');
      }
    }

    // Handle geo-search for location queries
    if (query.geoSearch && collectionName === 'locations') {
      const { lat, lng, radius = 1000, unit = 'm' } = query.geoSearch;
      const radiusInMeters = this.convertToMeters(radius, unit);

      params.filter_by = params.filter_by
        ? `${params.filter_by} && location:(${lat}, ${lng}, ${radiusInMeters}m)`
        : `location:(${lat}, ${lng}, ${radiusInMeters}m)`;

      // Sort by distance for geo-search
      params.sort_by = `location(${lat}, ${lng}):asc`;
    } else {
      // Handle sorting
      if (query.sorting && query.sorting.length > 0) {
        params.sort_by = query.sorting
          .map(sort => `${sort.field}:${sort.direction}`)
          .join(',');
      } else {
        params.sort_by = this.getDefaultSort(collectionName);
      }
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
        return 'postalCode,postalCodeGroup,provinceId,countryId,postalCodeCenterPoint';
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
        return 'claimNumber,consumerName,consumerCompanyName,productBrandCode,modelNumber';
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
        return 'popularity_score:desc';
    }
  }

  /**
   * Convert radius to meters for geo-search
   */
  private convertToMeters(radius: number, unit: 'km' | 'mi' | 'm'): number {
    switch (unit) {
      case 'km':
        return radius * 1000;
      case 'mi':
        return radius * 1609.34;
      case 'm':
      default:
        return radius;
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

      // Return raw document data for proper transformation by search service
      return {
        id: doc.id,
        title: doc.name || doc.claimNumber || doc.postalCode,
        description: doc.description || doc.consumerName || doc.provinceId,
        category: doc.category || doc.document_type,
        tags: doc.tags || [],
        score: hit.text_match,
        highlights: this.transformHighlights(hit.highlights),
        metadata: {
          popularityScore: doc.popularity_score,
        },
        // Include all raw document fields for proper mapping
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
