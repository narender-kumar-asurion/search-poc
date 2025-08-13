import { MeilisearchAdapter } from '../../../src/services/search/adapters/MeilisearchAdapter';
import { SearchConfig, SearchQuery, SearchAdapterError } from '../../../src/services/search/adapters/SearchAdapter';

// Mock Meilisearch
jest.mock('meilisearch', () => {
  return {
    MeiliSearch: jest.fn().mockImplementation(() => ({
      index: jest.fn().mockReturnValue({
        search: jest.fn(),
        addDocuments: jest.fn(),
        updateDocuments: jest.fn(),
        deleteDocument: jest.fn(),
        deleteAllDocuments: jest.fn(),
        getStats: jest.fn(),
        getFacetDistribution: jest.fn(),
      }),
      createIndex: jest.fn(),
      deleteIndex: jest.fn(),
      health: jest.fn(),
      version: jest.fn().mockResolvedValue({ pkgVersion: '1.5.0' }),
    })),
  };
});

// Mock logger
jest.mock('../../../src/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('MeilisearchAdapter', () => {
  let adapter: MeilisearchAdapter;
  let mockMeiliClient: any;
  let mockIndex: any;
  
  const testConfig: SearchConfig = {
    provider: 'meilisearch',
    connection: {
      host: 'localhost',
      port: 7700,
      protocol: 'http',
      apiKey: 'test-api-key',
      masterKey: 'test-master-key',
    },
    options: {
      timeout: 5000,
      retries: 3,
    },
  };

  beforeEach(() => {
    adapter = new MeilisearchAdapter();
    
    // Setup mocks
    const { MeiliSearch } = require('meilisearch');
    mockMeiliClient = new MeiliSearch();
    mockIndex = {
      search: jest.fn(),
      addDocuments: jest.fn(),
      updateDocuments: jest.fn(),
      deleteDocument: jest.fn(),
      deleteAllDocuments: jest.fn(),
      getStats: jest.fn(),
      getFacetDistribution: jest.fn(),
    };
    mockMeiliClient.index.mockReturnValue(mockIndex);
    
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize successfully with valid config', async () => {
      mockMeiliClient.health.mockResolvedValue({});
      
      await expect(adapter.initialize(testConfig)).resolves.not.toThrow();
    });

    it('should throw error with invalid config', async () => {
      const invalidConfig = {
        ...testConfig,
        connection: { ...testConfig.connection, host: '' },
      };

      await expect(adapter.initialize(invalidConfig)).rejects.toThrow(SearchAdapterError);
    });

    it('should handle connection failure', async () => {
      mockMeiliClient.health.mockRejectedValue(new Error('Connection failed'));
      
      await expect(adapter.initialize(testConfig)).rejects.toThrow('Connection failed');
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      mockMeiliClient.health.mockResolvedValue({});
      await adapter.initialize(testConfig);
    });

    it('should perform basic search successfully', async () => {
      const mockSearchResults = {
        hits: [
          {
            id: '1',
            title: 'Test Document',
            description: 'Test description',
            category: 'test',
            tags: ['tag1', 'tag2'],
          },
        ],
        estimatedTotalHits: 1,
        processingTimeMs: 10,
        facetDistribution: {},
      };

      mockIndex.search.mockResolvedValue(mockSearchResults);

      const query: SearchQuery = {
        query: 'test search',
        pagination: { page: 1, limit: 10 },
      };

      const result = await adapter.search(query);

      expect(result.documents).toHaveLength(1);
      expect(result.totalFound).toBe(1);
      expect(result.searchTime).toBe(10);
      expect(mockIndex.search).toHaveBeenCalledWith('test search', expect.any(Object));
    });

    it('should handle search with filters', async () => {
      const mockSearchResults = {
        hits: [],
        estimatedTotalHits: 0,
        processingTimeMs: 5,
      };

      mockIndex.search.mockResolvedValue(mockSearchResults);

      const query: SearchQuery = {
        query: 'filtered search',
        filters: {
          category: 'frontend',
          tags: ['react', 'typescript'],
        },
        pagination: { page: 1, limit: 20 },
      };

      await adapter.search(query);

      expect(mockIndex.search).toHaveBeenCalledWith(
        'filtered search',
        expect.objectContaining({
          filter: expect.any(Array),
          limit: 20,
          offset: 0,
        })
      );
    });

    it('should handle search errors gracefully', async () => {
      mockIndex.search.mockRejectedValue(new Error('Search failed'));

      const query: SearchQuery = { query: 'test' };

      await expect(adapter.search(query)).rejects.toThrow('Search failed');
    });

    it('should handle empty query', async () => {
      const mockSearchResults = {
        hits: [],
        estimatedTotalHits: 0,
        processingTimeMs: 1,
      };

      mockIndex.search.mockResolvedValue(mockSearchResults);

      const query: SearchQuery = { query: '' };
      const result = await adapter.search(query);

      expect(result.documents).toEqual([]);
      expect(result.totalFound).toBe(0);
    });
  });

  describe('searchCollection', () => {
    beforeEach(async () => {
      mockMeiliClient.health.mockResolvedValue({});
      await adapter.initialize(testConfig);
    });

    it('should search specific collection', async () => {
      const mockSearchResults = {
        hits: [{ id: '1', title: 'Collection Document' }],
        estimatedTotalHits: 1,
        processingTimeMs: 8,
      };

      mockIndex.search.mockResolvedValue(mockSearchResults);

      const query: SearchQuery = { query: 'collection test' };
      const result = await adapter.searchCollection('test-collection', query);

      expect(mockMeiliClient.index).toHaveBeenCalledWith('test-collection');
      expect(result.documents).toHaveLength(1);
    });
  });

  describe('searchByCategory', () => {
    beforeEach(async () => {
      mockMeiliClient.health.mockResolvedValue({});
      await adapter.initialize(testConfig);
    });

    it('should search by category filter', async () => {
      const mockSearchResults = {
        hits: [{ id: '1', category: 'frontend' }],
        estimatedTotalHits: 1,
        processingTimeMs: 6,
      };

      mockIndex.search.mockResolvedValue(mockSearchResults);

      const result = await adapter.searchByCategory('frontend');

      expect(mockIndex.search).toHaveBeenCalledWith(
        '*',
        expect.objectContaining({
          filter: ['category = "frontend"'],
        })
      );
      expect(result.documents).toHaveLength(1);
    });
  });

  describe('searchByTags', () => {
    beforeEach(async () => {
      mockMeiliClient.health.mockResolvedValue({});
      await adapter.initialize(testConfig);
    });

    it('should search by tags filter', async () => {
      const mockSearchResults = {
        hits: [{ id: '1', tags: ['react', 'typescript'] }],
        estimatedTotalHits: 1,
        processingTimeMs: 7,
      };

      mockIndex.search.mockResolvedValue(mockSearchResults);

      const result = await adapter.searchByTags(['react', 'typescript']);

      expect(mockIndex.search).toHaveBeenCalledWith(
        '*',
        expect.objectContaining({
          filter: expect.arrayContaining([
            expect.stringContaining('tags'),
          ]),
        })
      );
      expect(result.documents).toHaveLength(1);
    });
  });

  describe('getFacets', () => {
    beforeEach(async () => {
      mockMeiliClient.health.mockResolvedValue({});
      await adapter.initialize(testConfig);
    });

    it('should get facets successfully', async () => {
      const mockFacetDistribution = {
        category: { frontend: 10, backend: 5 },
        tags: { react: 8, typescript: 6 },
      };

      mockIndex.getFacetDistribution.mockResolvedValue(mockFacetDistribution);

      const facets = await adapter.getFacets(['category', 'tags']);

      expect(facets).toHaveLength(2);
      expect(facets[0]).toEqual({
        field: 'category',
        values: [
          { value: 'frontend', count: 10 },
          { value: 'backend', count: 5 },
        ],
      });
    });

    it('should handle facet errors', async () => {
      mockIndex.getFacetDistribution.mockRejectedValue(new Error('Facet error'));

      await expect(adapter.getFacets(['category'])).rejects.toThrow('Facet error');
    });
  });

  describe('createCollection', () => {
    beforeEach(async () => {
      mockMeiliClient.health.mockResolvedValue({});
      await adapter.initialize(testConfig);
    });

    it('should create collection successfully', async () => {
      mockMeiliClient.createIndex.mockResolvedValue({ uid: 'test-collection' });

      const schema = {
        name: 'test-collection',
        fields: [
          { name: 'id', type: 'string' },
          { name: 'title', type: 'string' },
        ],
      };

      await expect(adapter.createCollection('test-collection', schema)).resolves.not.toThrow();
      expect(mockMeiliClient.createIndex).toHaveBeenCalledWith('test-collection', { primaryKey: 'id' });
    });

    it('should handle collection creation errors', async () => {
      mockMeiliClient.createIndex.mockRejectedValue(new Error('Creation failed'));

      const schema = { name: 'test-collection', fields: [] };

      await expect(adapter.createCollection('test-collection', schema)).rejects.toThrow('Creation failed');
    });
  });

  describe('indexDocuments', () => {
    beforeEach(async () => {
      mockMeiliClient.health.mockResolvedValue({});
      await adapter.initialize(testConfig);
    });

    it('should index documents successfully', async () => {
      mockIndex.addDocuments.mockResolvedValue({ taskUid: 123 });

      const documents = [
        { id: '1', title: 'Document 1' },
        { id: '2', title: 'Document 2' },
      ];

      await expect(adapter.indexDocuments('test-collection', documents)).resolves.not.toThrow();
      expect(mockIndex.addDocuments).toHaveBeenCalledWith(documents);
    });

    it('should handle indexing errors', async () => {
      mockIndex.addDocuments.mockRejectedValue(new Error('Indexing failed'));

      const documents = [{ id: '1', title: 'Document 1' }];

      await expect(adapter.indexDocuments('test-collection', documents)).rejects.toThrow('Indexing failed');
    });

    it('should handle empty documents array', async () => {
      await expect(adapter.indexDocuments('test-collection', [])).resolves.not.toThrow();
      expect(mockIndex.addDocuments).not.toHaveBeenCalled();
    });
  });

  describe('deleteCollection', () => {
    beforeEach(async () => {
      mockMeiliClient.health.mockResolvedValue({});
      await adapter.initialize(testConfig);
    });

    it('should delete collection successfully', async () => {
      mockMeiliClient.deleteIndex.mockResolvedValue({ taskUid: 456 });

      await expect(adapter.deleteCollection('test-collection')).resolves.not.toThrow();
      expect(mockMeiliClient.deleteIndex).toHaveBeenCalledWith('test-collection');
    });

    it('should handle deletion errors', async () => {
      mockMeiliClient.deleteIndex.mockRejectedValue(new Error('Deletion failed'));

      await expect(adapter.deleteCollection('test-collection')).rejects.toThrow('Deletion failed');
    });
  });

  describe('healthCheck', () => {
    beforeEach(async () => {
      mockMeiliClient.health.mockResolvedValue({});
      await adapter.initialize(testConfig);
    });

    it('should return true when healthy', async () => {
      mockMeiliClient.health.mockResolvedValue({});

      const isHealthy = await adapter.healthCheck();

      expect(isHealthy).toBe(true);
      expect(mockMeiliClient.health).toHaveBeenCalled();
    });

    it('should return false when unhealthy', async () => {
      mockMeiliClient.health.mockRejectedValue(new Error('Health check failed'));

      const isHealthy = await adapter.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });

  describe('getProviderInfo', () => {
    beforeEach(async () => {
      mockMeiliClient.health.mockResolvedValue({});
      await adapter.initialize(testConfig);
    });

    it('should return provider information', async () => {
      const info = await adapter.getProviderInfo();

      expect(info.name).toBe('Meilisearch');
      expect(info.connectionStatus).toBe('connected');
      expect(info.features).toContain('full-text search');
      expect(info.features).toContain('faceting');
    });
  });

  describe('edge cases and error handling', () => {
    beforeEach(async () => {
      mockMeiliClient.health.mockResolvedValue({});
      await adapter.initialize(testConfig);
    });

    it('should handle malformed search results', async () => {
      mockIndex.search.mockResolvedValue({
        hits: null, // Malformed response
        estimatedTotalHits: 0,
      });

      const query: SearchQuery = { query: 'test' };
      const result = await adapter.search(query);

      expect(result.documents).toEqual([]);
      expect(result.totalFound).toBe(0);
    });

    it('should handle very large pagination requests', async () => {
      const mockSearchResults = {
        hits: [],
        estimatedTotalHits: 0,
        processingTimeMs: 1,
      };

      mockIndex.search.mockResolvedValue(mockSearchResults);

      const query: SearchQuery = {
        query: 'test',
        pagination: { page: 1000, limit: 1000 }, // Very large pagination
      };

      await adapter.search(query);

      expect(mockIndex.search).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          limit: 100, // Should be capped
          offset: expect.any(Number),
        })
      );
    });

    it('should sanitize special characters in filters', async () => {
      const mockSearchResults = {
        hits: [],
        estimatedTotalHits: 0,
        processingTimeMs: 1,
      };

      mockIndex.search.mockResolvedValue(mockSearchResults);

      const query: SearchQuery = {
        query: 'test',
        filters: {
          category: 'frontend"OR"1=1', // SQL injection attempt
        },
      };

      await adapter.search(query);

      expect(mockIndex.search).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          filter: expect.arrayContaining([
            expect.not.stringMatching(/OR.*1=1/),
          ]),
        })
      );
    });
  });
});
