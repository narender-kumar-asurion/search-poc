import { SearchService } from '../../../src/services/search/SearchService';
import * as adapters from '../../../src/services/search/adapters';
import { SearchAdapter, SearchResult } from '../../../src/services/search/adapters/SearchAdapter';

// Mock the adapters module
jest.mock('../../../src/services/search/adapters', () => ({
  ...jest.requireActual('../../../src/services/search/adapters'),
  getGlobalAdapter: jest.fn(),
}));

describe('SearchService', () => {
  let searchService: SearchService;
  let mockAdapter: jest.Mocked<SearchAdapter>;

  beforeEach(() => {
    mockAdapter = {
      initialize: jest.fn(),
      search: jest.fn(),
      searchCollection: jest.fn(),
      searchByCategory: jest.fn(),
      searchByTags: jest.fn(),
      getFacets: jest.fn(),
      getSuggestions: jest.fn(),
      createCollection: jest.fn(),
      indexDocuments: jest.fn(),
      upsertDocuments: jest.fn(),
      deleteCollection: jest.fn(),
      deleteDocument: jest.fn(),
      clearCollection: jest.fn(),
      getCollectionStats: jest.fn(),
      healthCheck: jest.fn(),
      getProviderInfo: jest.fn(),
    };

    // Mock the getGlobalAdapter to return our mock adapter
    (adapters.getGlobalAdapter as jest.Mock).mockResolvedValue(mockAdapter);

    searchService = new SearchService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize the adapter on first use', async () => {
      const mockResult: SearchResult = {
        documents: [],
        totalFound: 0,
        searchTime: 10,
      };
      
      mockAdapter.search.mockResolvedValue(mockResult);

      await searchService.search({ query: 'test' });

      expect(adapters.getGlobalAdapter).toHaveBeenCalledTimes(1);
    });

    it('should not reinitialize adapter on subsequent calls', async () => {
      const mockResult: SearchResult = {
        documents: [],
        totalFound: 0,
        searchTime: 10,
      };
      
      mockAdapter.search.mockResolvedValue(mockResult);

      await searchService.search({ query: 'test1' });
      await searchService.search({ query: 'test2' });

      expect(adapters.getGlobalAdapter).toHaveBeenCalledTimes(1);
    });
  });

  describe('search', () => {
    it('should return successful search results', async () => {
      const mockResult: SearchResult = {
        documents: [
          {
            id: '1',
            title: 'Test Document',
            description: 'Test description',
            category: 'test',
            tags: ['tag1'],
            score: 0.95,
          }
        ],
        totalFound: 1,
        searchTime: 15,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        }
      };

      mockAdapter.search.mockResolvedValue(mockResult);

      const result = await searchService.search({ query: 'javascript' });

      expect(result.success).toBe(true);
      expect(result.found).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(result.searchTime).toBe(15);
    });

    it('should handle search errors gracefully', async () => {
      mockAdapter.search.mockRejectedValue(new Error('Search failed'));

      const result = await searchService.search({ query: 'javascript' });

      expect(result.success).toBe(false);
      expect(result.found).toBe(0);
      expect(result.results).toHaveLength(0);
    });

    it('should enforce pagination limits', async () => {
      const mockResult: SearchResult = {
        documents: [],
        totalFound: 0,
        searchTime: 10,
      };

      mockAdapter.search.mockResolvedValue(mockResult);

      // Test limit enforcement (max 100)
      await searchService.search({ query: 'test', limit: 150 });

      expect(mockAdapter.search).toHaveBeenCalledWith(
        expect.objectContaining({
          pagination: expect.objectContaining({
            limit: 100, // Should be clamped to max
          })
        })
      );

      // Test page enforcement (max 1000)
      await searchService.search({ query: 'test', page: 2000 });

      expect(mockAdapter.search).toHaveBeenCalledWith(
        expect.objectContaining({
          pagination: expect.objectContaining({
            page: 1000, // Should be clamped to max
          })
        })
      );
    });
  });

  describe('searchByCategory', () => {
    it('should search by category successfully', async () => {
      const mockResult: SearchResult = {
        documents: [
          {
            id: '1',
            title: 'Frontend Framework',
            description: 'A frontend framework',
            category: 'frontend',
            tags: ['react'],
          }
        ],
        totalFound: 1,
        searchTime: 12,
      };

      mockAdapter.searchByCategory.mockResolvedValue(mockResult);

      const result = await searchService.searchByCategory('frontend');

      expect(result.success).toBe(true);
      expect(result.found).toBe(1);
      expect(mockAdapter.searchByCategory).toHaveBeenCalledWith('frontend');
    });
  });

  describe('searchByTags', () => {
    it('should search by tags successfully', async () => {
      const mockResult: SearchResult = {
        documents: [
          {
            id: '1',
            title: 'React Library',
            description: 'React framework',
            category: 'frontend',
            tags: ['react', 'javascript'],
          }
        ],
        totalFound: 1,
        searchTime: 8,
      };

      mockAdapter.searchByTags.mockResolvedValue(mockResult);

      const result = await searchService.searchByTags(['react', 'javascript']);

      expect(result.success).toBe(true);
      expect(result.found).toBe(1);
      expect(mockAdapter.searchByTags).toHaveBeenCalledWith(['react', 'javascript']);
    });
  });

  describe('healthCheck', () => {
    it('should return true when adapter is healthy', async () => {
      mockAdapter.healthCheck.mockResolvedValue(true);

      const result = await searchService.healthCheck();

      expect(result).toBe(true);
      expect(mockAdapter.healthCheck).toHaveBeenCalled();
    });

    it('should return false when adapter check fails', async () => {
      mockAdapter.healthCheck.mockRejectedValue(new Error('Health check failed'));

      const result = await searchService.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('document mapping', () => {
    it('should map claim documents correctly', async () => {
      const mockResult: SearchResult = {
        documents: [
          {
            id: 'claim-1',
            title: 'Claim Document',
            description: 'Test claim',
            category: 'claim',
            tags: [],
            document_type: 'claim',
            claimNumber: 'CLM-001',
            claimType: 'Warranty',
            claimStatus: 'Approved',
            consumerName: 'John Doe',
            consumerNameFirst: 'John',
            consumerAddState: 'ON',
          }
        ],
        totalFound: 1,
        searchTime: 10,
      };

      mockAdapter.searchCollection.mockResolvedValue(mockResult);

      const result = await searchService.searchClaimsCollection('test');

      expect(result.success).toBe(true);
      expect(result.results[0]).toMatchObject({
        claimNumber: 'CLM-001',
        claimType: 'Warranty',
        claimStatus: 'Approved',
        name: 'Claim CLM-001',
      });
    });

    it('should map location documents correctly', async () => {
      const mockResult: SearchResult = {
        documents: [
          {
            id: 'location-1',
            title: 'Location Document',
            description: 'Test location',
            category: 'location',
            tags: [],
            document_type: 'location',
            postalCode: 'M5V 1A1',
            provinceId: 'ON',
            location: [43.6426, -79.3871],
          }
        ],
        totalFound: 1,
        searchTime: 8,
      };

      mockAdapter.searchCollection.mockResolvedValue(mockResult);

      const result = await searchService.searchLocationsCollection('M5V');

      expect(result.success).toBe(true);
      expect(result.results[0]).toMatchObject({
        postalCode: 'M5V 1A1',
        provinceId: 'ON',
        latitude: 43.6426,
        longitude: -79.3871,
        name: 'Location M5V 1A1',
      });
    });
  });
});
