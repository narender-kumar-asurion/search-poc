/**
 * Search Service
 *
 * Updated to use the new SearchAdapter system.
 * Provides a clean API layer between the adapters and the application.
 */

import {
  SearchAdapter,
  SearchQuery,
  SearchResult,
  SearchFacet,
  getGlobalAdapter,
  SearchAdapterError,
} from './adapters';
import { logger } from '../../lib/logger';

/**
 * Simplified search parameters for API usage
 */
export interface ApiSearchParams {
  query: string;
  category?: string;
  tags?: string[];
  limit?: number;
  page?: number;
}

/**
 * Simplified search response for API
 */
export interface ApiSearchResponse {
  success: boolean;
  query: string;
  found: number;
  results: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    tags: string[];
    score?: number;
    highlights?: any[];
    [key: string]: any; // Allow additional fields
  }>;
  facets?: SearchFacet[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  searchTime?: number;
}

/**
 * Main search service class
 */
export class SearchService {
  private adapter?: SearchAdapter;

  /**
   * Initialize the search service
   */
  async initialize(): Promise<void> {
    if (!this.adapter) {
      try {
        this.adapter = await getGlobalAdapter();
        logger.info('Search service initialized with adapter');
      } catch (error) {
        logger.error('Failed to initialize search service', error as Error);
        throw error;
      }
    }
  }

  /**
   * Perform a search with API-friendly parameters
   */
  async search(params: ApiSearchParams): Promise<ApiSearchResponse> {
    await this.initialize();

    const query: SearchQuery = {
      query: params.query,
      filters: {
        category: params.category,
        tags: params.tags,
      },
      pagination: {
        limit: Math.min(Math.max(params.limit || 10, 1), 100),
        page: Math.min(Math.max(params.page || 1, 1), 1000),
      },
    };

    try {
      const result = await this.adapter!.search(query);

      return {
        success: true,
        query: params.query,
        found: result.totalFound,
        results: result.documents.map(doc => this.mapDocumentToResult(doc)),
        facets: result.facets || [],
        pagination: result.pagination,
        searchTime: result.searchTime,
      };
    } catch (error) {
      logger.error('Search operation failed', error as Error);

      return {
        success: false,
        query: params.query,
        found: 0,
        results: [],
      };
    }
  }

  /**
   * Search by category
   */
  async searchByCategory(category: string): Promise<ApiSearchResponse> {
    await this.initialize();

    try {
      const result = await this.adapter!.searchByCategory(category);

      return {
        success: true,
        query: '*',
        found: result.totalFound,
        results: result.documents.map(doc => this.mapDocumentToResult(doc)),
        searchTime: result.searchTime,
      };
    } catch (error) {
      logger.error(`Category search failed for category: ${category}`, error as Error);

      return {
        success: false,
        query: '*',
        found: 0,
        results: [],
      };
    }
  }

  /**
   * Search by tags
   */
  async searchByTags(tags: string[]): Promise<ApiSearchResponse> {
    await this.initialize();

    try {
      const result = await this.adapter!.searchByTags(tags);

      return {
        success: true,
        query: '*',
        found: result.totalFound,
        results: result.documents.map(doc => this.mapDocumentToResult(doc)),
        searchTime: result.searchTime,
      };
    } catch (error) {
      logger.error(`Tag search failed for tags: ${tags.join(', ')}`, error as Error);

      return {
        success: false,
        query: '*',
        found: 0,
        results: [],
      };
    }
  }

  /**
   * Get available facets
   */
  async getFacets(): Promise<{ success: boolean; facets: SearchFacet[] }> {
    await this.initialize();

    try {
      const facets = await this.adapter!.getFacets();

      return {
        success: true,
        facets,
      };
    } catch (error) {
      logger.error('Failed to retrieve facets', error as Error);

      return {
        success: false,
        facets: [],
      };
    }
  }

  /**
   * Search claims collection directly
   */
  async searchClaimsCollection(query: string, filters?: {
    claimType?: string;
    claimStatus?: string;
    province?: string;
    limit?: number;
    page?: number;
  }): Promise<ApiSearchResponse> {
    await this.initialize();

    try {
      const searchQuery: SearchQuery = {
        query,
        filters: {
          claimType: filters?.claimType,
          claimStatus: filters?.claimStatus,
          province: filters?.province,
        },
        pagination: {
          limit: filters?.limit || 10,
          page: filters?.page || 1,
        },
      };

      const result = await this.adapter!.searchCollection('claims', searchQuery);

      return {
        success: true,
        query,
        found: result.totalFound,
        results: result.documents.map(doc => this.mapDocumentToResult(doc)),
        pagination: result.pagination,
        searchTime: result.searchTime,
      };
    } catch (error) {
      logger.error('Claims collection search failed', error as Error);

      return {
        success: false,
        query,
        found: 0,
        results: [],
      };
    }
  }

  /**
   * Search locations collection directly
   */
  async searchLocationsCollection(query: string, filters?: {
    province?: string;
    postalCode?: string;
    limit?: number;
    page?: number;
  }): Promise<ApiSearchResponse> {
    await this.initialize();

    try {
      const searchQuery: SearchQuery = {
        query,
        filters: {
          provinceId: filters?.province,
          postalCode: filters?.postalCode,
        },
        pagination: {
          limit: filters?.limit || 10,
          page: filters?.page || 1,
        },
      };

      const result = await this.adapter!.searchCollection('locations', searchQuery);

      return {
        success: true,
        query,
        found: result.totalFound,
        results: result.documents.map(doc => this.mapDocumentToResult(doc)),
        pagination: result.pagination,
        searchTime: result.searchTime,
      };
    } catch (error) {
      logger.error('Locations collection search failed', error as Error);

      return {
        success: false,
        query,
        found: 0,
        results: [],
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.initialize();
      return await this.adapter!.healthCheck();
    } catch (error) {
      logger.error('Health check failed', error as Error);
      return false;
    }
  }

  /**
   * Get provider information
   */
  async getProviderInfo() {
    await this.initialize();
    return this.adapter!.getProviderInfo();
  }

  /**
   * Get the adapter instance for advanced usage
   */
  async getAdapter(): Promise<SearchAdapter> {
    await this.initialize();
    return this.adapter!;
  }

  /**
   * Map document to API result format based on document type
   */
  private mapDocumentToResult(doc: any): any {
    // Base result structure
    const baseResult = {
      id: doc.id,
      score: doc.score,
      highlights: doc.highlights,
    };

    // Map based on document type
    switch (doc.document_type) {
      case 'claim':
        return {
          ...baseResult,
          name: `Claim ${doc.claimNumber}`,
          description: `${doc.consumerNameFirst || ''} ${doc.consumerName || ''} - ${doc.claimType || ''}`.trim(),
          category: 'claim',
          tags: [doc.claimType, doc.claimStatus, doc.consumerAddState].filter(Boolean),
          // Include claim-specific fields
          claimId: doc.claimId,
          claimNumber: doc.claimNumber,
          claimType: doc.claimType,
          claimStatus: doc.claimStatus,
          consumerName: doc.consumerName,
          consumerNameFirst: doc.consumerNameFirst,
          consumerCompanyName: doc.consumerCompanyName,
          consumerAddCity: doc.consumerAddCity,
          consumerAddState: doc.consumerAddState,
          consumerPostalCode: doc.consumerPostalCode,
          province: doc.consumerAddState,
          serialNumber: doc.serialNumber,
          modelNumber: doc.modelNumber,
          productBrandCode: doc.productBrandCode,
          amountRequested: doc.amountRequested,
          amountApproved: doc.amountApproved,
          claimDate: doc.claimDate,
          dateSubmitted: doc.dateSubmitted,
        };

      case 'location':
        return {
          ...baseResult,
          name: `Location ${doc.postalCode}`,
          description: `${doc.postalCode}, ${doc.provinceId}`,
          category: 'location',
          tags: [doc.provinceId, doc.postalCodeGroup].filter(Boolean),
          // Include location-specific fields
          postalCode: doc.postalCode,
          postalCodeGroup: doc.postalCodeGroup,
          provinceId: doc.provinceId,
          province: doc.provinceId,
          countryId: doc.countryId,
          location: doc.location,
          postalCodeCenterPoint: doc.postalCodeCenterPoint,
          latitude: doc.location ? doc.location[0] : null,
          longitude: doc.location ? doc.location[1] : null,
        };

      case 'software_stack':
      default:
        return {
          ...baseResult,
          name: doc.title || doc.name || 'Untitled',
          description: doc.description || '',
          category: doc.category || 'unknown',
          tags: doc.tags || [],
        };
    }
  }
}

// Export singleton instance
export const searchService = new SearchService();
