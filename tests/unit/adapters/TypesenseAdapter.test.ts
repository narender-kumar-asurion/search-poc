import { TypesenseAdapter } from '../../../src/services/search/adapters/TypesenseAdapter';
import { SearchConfig, SearchQuery, SearchAdapterError } from '../../../src/services/search/adapters/SearchAdapter';

// Mock Typesense
jest.mock('typesense', () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      collections: jest.fn().mockReturnValue({
        create: jest.fn(),
        delete: jest.fn(),
      }),
      collection: jest.fn().mockReturnValue({
        documents: jest.fn().mockReturnValue({
          search: jest.fn(),
          import: jest.fn(),
          upsert: jest.fn(),
          delete: jest.fn(),
        }),
        retrieve: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      }),
      health: jest.fn(),
      debug: jest.fn(),
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

describe('TypesenseAdapter', () => {
  let adapter: TypesenseAdapter;
  let mockTypesenseClient: any;
  let mockCollection: any;
  let mockDocuments: any;
  
  const testConfig: SearchConfig = {
    provider: 'typesense',
    connection: {
      host: 'localhost',
      port: 8108,
      protocol: 'http',
      apiKey: 'test-api-key',
    },
    options: {
      timeout: 5000,
      retries: 3,
    },
  };

  beforeEach(() => {
    adapter = new TypesenseAdapter();
    
    // Setup mocks
    const { Client } = require('typesense');
    mockTypesenseClient = new Client();
    
    mockDocuments = {
      search: jest.fn(),
      import: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    };
    
    mockCollection = {
      documents: jest.fn().mockReturnValue(mockDocuments),
      retrieve: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    };
    
    mockTypesenseClient.collection.mockReturnValue(mockCollection);
    mockTypesenseClient.collections.mockReturnValue({
      create: jest.fn(),
      delete: jest.fn(),
    });
    
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize successfully with valid config', async () => {
      mockTypesenseClient.health.mockResolvedValue({ ok: true });
      
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
      mockTypesenseClient.health.mockRejectedValue(new Error('Connection refused'));
      
      await expect(adapter.initialize(testConfig)).rejects.toThrow('Connection refused');
    });

    it('should validate required configuration fields', async () => {
      const invalidConfig = {
        ...testConfig,
        connection: { ...testConfig.connection, apiKey: '' },
      };

      await expect(adapter.initialize(invalidConfig)).rejects.toThrow('API key is required');
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      mockTypesenseClient.health.mockResolvedValue({ ok: true });
      await adapter.initialize(testConfig);
    });

    it('should perform basic search successfully', async () => {
      const mockSearchResults = {
        hits: [
          {
            document: {
              id: '1',
              title: 'Test Document',
              description: 'Test description',
              category: 'test',
              tags: ['tag1', 'tag2'],
            },
            highlight: {},
            text_match: 95,
          },
        ],
        found: 1,
        search_time_ms: 15,
        facet_counts: [],
      };

      mockDocuments.search.mockResolvedValue(mockSearchResults);

      const query: SearchQuery = {
        query: 'test search',
        pagination: { page: 1, limit: 10 },
      };

      const result = await adapter.search(query);

      expect(result.documents).toHaveLength(1);
      expect(result.totalFound).toBe(1);
      expect(result.searchTime).toBe(15);
      expect(result.documents[0].score).toBe(95);
    });

    it('should handle search with filters', async () => {
      const mockSearchResults = {
        hits: [],
        found: 0,
        search_time_ms: 8,
        facet_counts: [],
      };

      mockDocuments.search.mockResolvedValue(mockSearchResults);

      const query: SearchQuery = {
        query: 'filtered search',
        filters: {
          category: 'frontend',
          tags: ['react', 'typescript'],
        },
        pagination: { page: 1, limit: 20 },
      };

      await adapter.search(query);

      expect(mockDocuments.search).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'filtered search',
          filter_by: expect.stringContaining('category:=frontend'),
          per_page: 20,
          page: 1,
        })
      );
    });

    it('should handle search with sorting', async () => {
      const mockSearchResults = {
        hits: [],
        found: 0,
        search_time_ms: 5,
      };

      mockDocuments.search.mockResolvedValue(mockSearchResults);

      const query: SearchQuery = {
        query: 'sorted search',
        sorting: [
          { field: 'popularity_score', direction: 'desc' },
          { field: 'created_at', direction: 'asc' },
        ],
      };

      await adapter.search(query);

      expect(mockDocuments.search).toHaveBeenCalledWith(
        expect.objectContaining({
          sort_by: 'popularity_score:desc,created_at:asc',
        })
      );
    });

    it('should handle search errors gracefully', async () => {
      mockDocuments.search.mockRejectedValue(new Error('Search operation failed'));

      const query: SearchQuery = { query: 'test' };

      await expect(adapter.search(query)).rejects.toThrow('Search operation failed');
    });

    it('should handle typo tolerance', async () => {
      const mockSearchResults = {
        hits: [
          {
            document: { id: '1', title: 'JavaScript' },
            highlight: {},
            text_match: 85,
          },
        ],
        found: 1,
        search_time_ms: 12,
      };

      mockDocuments.search.mockResolvedValue(mockSearchResults);

      const query: SearchQuery = { query: 'javascritp' }; // Typo
      await adapter.search(query);

      expect(mockDocuments.search).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'javascritp',
          num_typos: 2,
        })
      );
    });
  });

  describe('searchCollection', () => {
    beforeEach(async () => {
      mockTypesenseClient.health.mockResolvedValue({ ok: true });
      await adapter.initialize(testConfig);
    });

    it('should search specific collection', async () => {
      const mockSearchResults = {
        hits: [
          {
            document: { id: '1', title: 'Collection Document' },
            highlight: {},
            text_match: 90,
          },
        ],
        found: 1,
        search_time_ms: 10,
      };

      mockDocuments.search.mockResolvedValue(mockSearchResults);

      const query: SearchQuery = { query: 'collection test' };
      const result = await adapter.searchCollection('test-collection', query);

      expect(mockTypesenseClient.collection).toHaveBeenCalledWith('test-collection');
      expect(result.documents).toHaveLength(1);
    });

    it('should handle collection not found', async () => {
      mockTypesenseClient.collection.mockReturnValue({
        documents: jest.fn().mockReturnValue({
          search: jest.fn().mockRejectedValue(new Error('Collection not found')),
        }),
      });

      const query: SearchQuery = { query: 'test' };

      await expect(adapter.searchCollection('nonexistent', query)).rejects.toThrow('Collection not found');
    });
  });

  describe('searchByCategory', () => {
    beforeEach(async () => {
      mockTypesenseClient.health.mockResolvedValue({ ok: true });
      await adapter.initialize(testConfig);
    });

    it('should search by category filter', async () => {
      const mockSearchResults = {
        hits: [{ document: { id: '1', category: 'frontend' }, text_match: 100 }],
        found: 1,
        search_time_ms: 8,
      };

      mockDocuments.search.mockResolvedValue(mockSearchResults);

      const result = await adapter.searchByCategory('frontend');

      expect(mockDocuments.search).toHaveBeenCalledWith(
        expect.objectContaining({
          q: '*',
          filter_by: 'category:=frontend',
        })
      );
      expect(result.documents).toHaveLength(1);
    });

    it('should search by category with additional query', async () => {
      const mockSearchResults = {
        hits: [],
        found: 0,
        search_time_ms: 5,
      };

      mockDocuments.search.mockResolvedValue(mockSearchResults);

      await adapter.searchByCategory('backend', 'nodejs');

      expect(mockDocuments.search).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'nodejs',
          filter_by: 'category:=backend',
        })
      );
    });
  });

  describe('searchByTags', () => {
    beforeEach(async () => {
      mockTypesenseClient.health.mockResolvedValue({ ok: true });
      await adapter.initialize(testConfig);
    });

    it('should search by single tag', async () => {
      const mockSearchResults = {
        hits: [{ document: { id: '1', tags: ['react'] }, text_match: 95 }],
        found: 1,
        search_time_ms: 6,
      };

      mockDocuments.search.mockResolvedValue(mockSearchResults);

      await adapter.searchByTags(['react']);

      expect(mockDocuments.search).toHaveBeenCalledWith(
        expect.objectContaining({
          filter_by: 'tags:=react',
        })
      );
    });

    it('should search by multiple tags', async () => {
      const mockSearchResults = {
        hits: [],
        found: 0,
        search_time_ms: 4,
      };

      mockDocuments.search.mockResolvedValue(mockSearchResults);

      await adapter.searchByTags(['react', 'typescript', 'frontend']);

      expect(mockDocuments.search).toHaveBeenCalledWith(
        expect.objectContaining({
          filter_by: 'tags:=[react,typescript,frontend]',
        })
      );
    });
  });

  describe('getFacets', () => {
    beforeEach(async () => {
      mockTypesenseClient.health.mockResolvedValue({ ok: true });
      await adapter.initialize(testConfig);
    });

    it('should get facets successfully', async () => {
      const mockSearchResults = {
        hits: [],
        found: 0,
        facet_counts: [
          {
            field_name: 'category',
            counts: [
              { value: 'frontend', count: 10 },
              { value: 'backend', count: 5 },
            ],
          },
          {
            field_name: 'tags',
            counts: [
              { value: 'react', count: 8 },
              { value: 'typescript', count: 6 },
            ],
          },
        ],
      };

      mockDocuments.search.mockResolvedValue(mockSearchResults);

      const facets = await adapter.getFacets(['category', 'tags']);

      expect(facets).toHaveLength(2);
      expect(facets[0]).toEqual({
        field: 'category',
        values: [
          { value: 'frontend', count: 10 },
          { value: 'backend', count: 5 },
        ],
      });

      expect(mockDocuments.search).toHaveBeenCalledWith(
        expect.objectContaining({
          facet_by: 'category,tags',
          max_facet_values: 100,
        })
      );
    });

    it('should handle empty facets', async () => {
      const mockSearchResults = {
        hits: [],
        found: 0,
        facet_counts: [],
      };

      mockDocuments.search.mockResolvedValue(mockSearchResults);

      const facets = await adapter.getFacets(['category']);

      expect(facets).toEqual([]);
    });
  });

  describe('getSuggestions', () => {
    beforeEach(async () => {
      mockTypesenseClient.health.mockResolvedValue({ ok: true });
      await adapter.initialize(testConfig);
    });

    it('should get search suggestions', async () => {
      const mockSearchResults = {
        hits: [
          { document: { title: 'JavaScript Tutorial' } },
          { document: { title: 'JavaScript Framework' } },
          { document: { title: 'Java Programming' } },
        ],
        found: 3,
      };

      mockDocuments.search.mockResolvedValue(mockSearchResults);

      const suggestions = await adapter.getSuggestions('java', 5);

      expect(suggestions).toContain('JavaScript Tutorial');
      expect(suggestions).toContain('JavaScript Framework');
      expect(suggestions.length).toBeLessThanOrEqual(5);
    });
  });

  describe('createCollection', () => {
    beforeEach(async () => {
      mockTypesenseClient.health.mockResolvedValue({ ok: true });
      await adapter.initialize(testConfig);
    });

    it('should create collection successfully', async () => {
      const collectionsApi = mockTypesenseClient.collections();
      collectionsApi.create.mockResolvedValue({ name: 'test-collection' });

      const schema = {
        name: 'test-collection',
        fields: [
          { name: 'id', type: 'string', facet: false },
          { name: 'title', type: 'string', facet: false },
          { name: 'category', type: 'string', facet: true },
        ],
        default_sorting_field: 'id',
      };

      await expect(adapter.createCollection('test-collection', schema)).resolves.not.toThrow();
      expect(collectionsApi.create).toHaveBeenCalledWith(schema);
    });

    it('should handle collection already exists', async () => {
      const collectionsApi = mockTypesenseClient.collections();
      collectionsApi.create.mockRejectedValue(new Error('Collection already exists'));

      const schema = { name: 'existing-collection', fields: [] };

      await expect(adapter.createCollection('existing-collection', schema)).rejects.toThrow(
        'Collection already exists'
      );
    });

    it('should validate schema before creation', async () => {
      const invalidSchema = {
        name: '',
        fields: [],
      };

      await expect(adapter.createCollection('', invalidSchema)).rejects.toThrow(SearchAdapterError);
    });
  });

  describe('indexDocuments', () => {
    beforeEach(async () => {
      mockTypesenseClient.health.mockResolvedValue({ ok: true });
      await adapter.initialize(testConfig);
    });

    it('should index documents successfully', async () => {
      mockDocuments.import.mockResolvedValue([
        { success: true },
        { success: true },
      ]);

      const documents = [
        { id: '1', title: 'Document 1' },
        { id: '2', title: 'Document 2' },
      ];

      await expect(adapter.indexDocuments('test-collection', documents)).resolves.not.toThrow();
      expect(mockDocuments.import).toHaveBeenCalledWith(documents, { action: 'upsert' });
    });

    it('should handle indexing errors', async () => {
      mockDocuments.import.mockRejectedValue(new Error('Import failed'));

      const documents = [{ id: '1', title: 'Document 1' }];

      await expect(adapter.indexDocuments('test-collection', documents)).rejects.toThrow('Import failed');
    });

    it('should handle empty documents array', async () => {
      await expect(adapter.indexDocuments('test-collection', [])).resolves.not.toThrow();
      expect(mockDocuments.import).not.toHaveBeenCalled();
    });

    it('should batch large document sets', async () => {
      mockDocuments.import.mockResolvedValue(new Array(1000).fill({ success: true }));

      const documents = new Array(1000).fill(null).map((_, i) => ({
        id: `${i}`,
        title: `Document ${i}`,
      }));

      await adapter.indexDocuments('test-collection', documents);

      // Should be called in batches
      expect(mockDocuments.import).toHaveBeenCalled();
    });
  });

  describe('deleteCollection', () => {
    beforeEach(async () => {
      mockTypesenseClient.health.mockResolvedValue({ ok: true });
      await adapter.initialize(testConfig);
    });

    it('should delete collection successfully', async () => {
      mockCollection.delete.mockResolvedValue({});

      await expect(adapter.deleteCollection('test-collection')).resolves.not.toThrow();
      expect(mockTypesenseClient.collection).toHaveBeenCalledWith('test-collection');
      expect(mockCollection.delete).toHaveBeenCalled();
    });

    it('should handle collection not found', async () => {
      mockCollection.delete.mockRejectedValue(new Error('Collection not found'));

      await expect(adapter.deleteCollection('nonexistent')).rejects.toThrow('Collection not found');
    });
  });

  describe('healthCheck', () => {
    beforeEach(async () => {
      mockTypesenseClient.health.mockResolvedValue({ ok: true });
      await adapter.initialize(testConfig);
    });

    it('should return true when healthy', async () => {
      mockTypesenseClient.health.mockResolvedValue({ ok: true });

      const isHealthy = await adapter.healthCheck();

      expect(isHealthy).toBe(true);
      expect(mockTypesenseClient.health).toHaveBeenCalled();
    });

    it('should return false when unhealthy', async () => {
      mockTypesenseClient.health.mockRejectedValue(new Error('Service unavailable'));

      const isHealthy = await adapter.healthCheck();

      expect(isHealthy).toBe(false);
    });

    it('should return false when response is not ok', async () => {
      mockTypesenseClient.health.mockResolvedValue({ ok: false });

      const isHealthy = await adapter.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });

  describe('getProviderInfo', () => {
    beforeEach(async () => {
      mockTypesenseClient.health.mockResolvedValue({ ok: true });
      await adapter.initialize(testConfig);
    });

    it('should return provider information', async () => {
      mockTypesenseClient.debug.mockResolvedValue({ version: '0.25.0' });

      const info = await adapter.getProviderInfo();

      expect(info.name).toBe('Typesense');
      expect(info.connectionStatus).toBe('connected');
      expect(info.features).toContain('full-text search');
      expect(info.features).toContain('typo tolerance');
      expect(info.features).toContain('faceting');
      expect(info.features).toContain('geo search');
    });
  });

  describe('edge cases and error handling', () => {
    beforeEach(async () => {
      mockTypesenseClient.health.mockResolvedValue({ ok: true });
      await adapter.initialize(testConfig);
    });

    it('should handle malformed search results', async () => {
      mockDocuments.search.mockResolvedValue({
        hits: null, // Malformed response
        found: 0,
      });

      const query: SearchQuery = { query: 'test' };
      const result = await adapter.search(query);

      expect(result.documents).toEqual([]);
      expect(result.totalFound).toBe(0);
    });

    it('should handle network timeout', async () => {
      mockDocuments.search.mockRejectedValue(new Error('Request timeout'));

      const query: SearchQuery = { query: 'test' };

      await expect(adapter.search(query)).rejects.toThrow('Request timeout');
    });

    it('should escape special characters in filters', async () => {
      const mockSearchResults = {
        hits: [],
        found: 0,
        search_time_ms: 1,
      };

      mockDocuments.search.mockResolvedValue(mockSearchResults);

      const query: SearchQuery = {
        query: 'test',
        filters: {
          category: 'test:category', // Contains colon
          tags: ['tag"with"quotes'], // Contains quotes
        },
      };

      await adapter.search(query);

      const searchCall = mockDocuments.search.mock.calls[0][0];
      expect(searchCall.filter_by).not.toContain('test:category');
      expect(searchCall.filter_by).not.toContain('tag"with"quotes');
    });

    it('should handle concurrent search requests', async () => {
      const mockSearchResults = {
        hits: [{ document: { id: '1' }, text_match: 90 }],
        found: 1,
        search_time_ms: 10,
      };

      mockDocuments.search.mockResolvedValue(mockSearchResults);

      const promises = Array.from({ length: 10 }, (_, i) =>
        adapter.search({ query: `query ${i}` })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(mockDocuments.search).toHaveBeenCalledTimes(10);
    });

    it('should handle very long search queries', async () => {
      const longQuery = 'word '.repeat(1000); // Very long query
      const mockSearchResults = {
        hits: [],
        found: 0,
        search_time_ms: 1,
      };

      mockDocuments.search.mockResolvedValue(mockSearchResults);

      const query: SearchQuery = { query: longQuery };
      await adapter.search(query);

      const searchCall = mockDocuments.search.mock.calls[0][0];
      expect(searchCall.q.length).toBeLessThanOrEqual(500); // Should be truncated
    });
  });
});
