import { AdapterFactory, resetGlobalAdapter } from '../../../src/services/search/adapters/AdapterFactory';
import { SearchConfig } from '../../../src/services/search/adapters/SearchAdapter';
import { TypesenseAdapter } from '../../../src/services/search/adapters/TypesenseAdapter';
import { MeilisearchAdapter } from '../../../src/services/search/adapters/MeilisearchAdapter';

// Mock the adapters
jest.mock('../../../src/services/search/adapters/TypesenseAdapter');
jest.mock('../../../src/services/search/adapters/MeilisearchAdapter');

describe('AdapterFactory', () => {
  beforeEach(() => {
    // Clear cache before each test
    AdapterFactory.clearCache();
    resetGlobalAdapter();
    jest.clearAllMocks();
  });

  describe('createAdapter', () => {
    it('should create a Typesense adapter with valid config', async () => {
      const config: SearchConfig = {
        provider: 'typesense',
        connection: {
          host: 'localhost',
          port: 8108,
          protocol: 'http',
          apiKey: 'test-key',
          indexName: 'test-collection',
        },
      };

      const mockAdapter = {
        initialize: jest.fn(),
        healthCheck: jest.fn().mockResolvedValue(true),
      };

      jest.mocked(TypesenseAdapter).mockReturnValue(mockAdapter as any);

      const adapter = await AdapterFactory.createAdapter(config);

      expect(TypesenseAdapter).toHaveBeenCalledTimes(1);
      expect(mockAdapter.initialize).toHaveBeenCalledWith(config);
      expect(adapter).toBe(mockAdapter);
    });

    it('should create a Meilisearch adapter with valid config', async () => {
      const config: SearchConfig = {
        provider: 'meilisearch',
        connection: {
          host: 'localhost',
          port: 7700,
          protocol: 'http',
          apiKey: 'test-key',
          indexName: 'test-index',
        },
      };

      const mockAdapter = {
        initialize: jest.fn(),
        healthCheck: jest.fn().mockResolvedValue(true),
      };

      jest.mocked(MeilisearchAdapter).mockReturnValue(mockAdapter as any);

      const adapter = await AdapterFactory.createAdapter(config);

      expect(MeilisearchAdapter).toHaveBeenCalledTimes(1);
      expect(mockAdapter.initialize).toHaveBeenCalledWith(config);
      expect(adapter).toBe(mockAdapter);
    });

    it('should throw error for unsupported provider', async () => {
      const config: SearchConfig = {
        provider: 'elasticsearch' as any, // Invalid provider
        connection: {
          host: 'localhost',
          port: 9200,
          protocol: 'http',
          apiKey: 'test-key',
        },
      };

      await expect(AdapterFactory.createAdapter(config)).rejects.toThrow(
        'Unsupported search provider: elasticsearch'
      );
    });

    it('should validate required configuration fields', async () => {
      const invalidConfig: SearchConfig = {
        provider: 'typesense',
        connection: {
          host: '',
          port: 8108,
          protocol: 'http',
          apiKey: '', // Missing API key
        },
      };

      await expect(AdapterFactory.createAdapter(invalidConfig)).rejects.toThrow(
        'Typesense requires host and apiKey in connection config'
      );
    });
  });

  describe('caching', () => {
    it('should cache and reuse healthy adapters', async () => {
      const config: SearchConfig = {
        provider: 'typesense',
        connection: {
          host: 'localhost',
          port: 8108,
          protocol: 'http',
          apiKey: 'test-key',
          indexName: 'test-collection',
        },
      };

      const mockAdapter = {
        initialize: jest.fn(),
        healthCheck: jest.fn().mockResolvedValue(true),
      };

      jest.mocked(TypesenseAdapter).mockReturnValue(mockAdapter as any);

      // First call should create adapter
      const adapter1 = await AdapterFactory.createAdapter(config);
      
      // Second call should return cached adapter
      const adapter2 = await AdapterFactory.createAdapter(config);

      expect(TypesenseAdapter).toHaveBeenCalledTimes(1); // Only created once
      expect(adapter1).toBe(adapter2); // Same instance
      expect(mockAdapter.healthCheck).toHaveBeenCalledTimes(1); // Health check on cache hit
    });

    it('should recreate adapter if health check fails', async () => {
      const config: SearchConfig = {
        provider: 'typesense',
        connection: {
          host: 'localhost',
          port: 8108,
          protocol: 'http',
          apiKey: 'test-key',
          indexName: 'test-collection',
        },
      };

      const mockAdapter1 = {
        initialize: jest.fn(),
        healthCheck: jest.fn().mockResolvedValue(true),
      };

      const mockAdapter2 = {
        initialize: jest.fn(),
        healthCheck: jest.fn().mockResolvedValue(false), // Unhealthy
      };

      const mockAdapter3 = {
        initialize: jest.fn(),
        healthCheck: jest.fn().mockResolvedValue(true),
      };

      jest.mocked(TypesenseAdapter)
        .mockReturnValueOnce(mockAdapter1 as any)
        .mockReturnValueOnce(mockAdapter2 as any)
        .mockReturnValueOnce(mockAdapter3 as any);

      // First call creates and caches adapter
      await AdapterFactory.createAdapter(config);

      // Second call should detect unhealthy adapter and recreate
      mockAdapter1.healthCheck.mockResolvedValue(false);
      await AdapterFactory.createAdapter(config);

      expect(TypesenseAdapter).toHaveBeenCalledTimes(2); // Created twice
    });
  });

  describe('createFromEnvironment', () => {
    beforeEach(() => {
      // Reset environment variables
      delete process.env.SEARCH_PROVIDER;
      delete process.env.TYPESENSE_HOST;
      delete process.env.TYPESENSE_API_KEY;
      delete process.env.MEILISEARCH_HOST;
      // Also clear mocks again within this describe block
      resetGlobalAdapter();
      jest.clearAllMocks();
    });

    afterEach(() => {
      // Clean up environment variables after each test
      delete process.env.SEARCH_PROVIDER;
      delete process.env.TYPESENSE_HOST;
      delete process.env.TYPESENSE_PORT;
      delete process.env.TYPESENSE_API_KEY;
      delete process.env.MEILISEARCH_HOST;
      resetGlobalAdapter();
      jest.clearAllMocks();
    });

    it('should create adapter from environment variables', async () => {
      process.env.SEARCH_PROVIDER = 'typesense';
      process.env.TYPESENSE_HOST = 'localhost';
      process.env.TYPESENSE_PORT = '8108';
      process.env.TYPESENSE_API_KEY = 'env-key';

      const mockAdapter = {
        initialize: jest.fn(),
        healthCheck: jest.fn().mockResolvedValue(true),
      };

      // Completely restore and re-mock
      jest.mocked(TypesenseAdapter).mockRestore();
      jest.mocked(TypesenseAdapter).mockReturnValue(mockAdapter as any);

      const adapter = await AdapterFactory.createFromEnvironment();

      expect(adapter).toBeDefined();
      expect(TypesenseAdapter).toHaveBeenCalledTimes(1);
      expect(TypesenseAdapter).toHaveBeenCalledWith(); // No constructor arguments
      expect(mockAdapter.initialize).toHaveBeenCalledTimes(1);
      expect(mockAdapter.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'typesense',
          connection: expect.objectContaining({
            host: 'localhost',
            port: 8108,
            apiKey: 'env-key',
          }),
        })
      );
    });

    it('should default to typesense if no provider specified', async () => {
      process.env.TYPESENSE_HOST = 'localhost';
      process.env.TYPESENSE_API_KEY = 'default-key';

      const mockAdapter = {
        initialize: jest.fn(),
        healthCheck: jest.fn().mockResolvedValue(true),
      };

      jest.mocked(TypesenseAdapter).mockClear();
      jest.mocked(TypesenseAdapter).mockReturnValue(mockAdapter as any);

      await AdapterFactory.createFromEnvironment();

      expect(TypesenseAdapter).toHaveBeenCalledTimes(1);
    });
  });

  describe('provider recommendations', () => {
    it('should recommend typesense for real-time and typo tolerance', () => {
      const recommendation = AdapterFactory.getProviderRecommendation({
        realTime: true,
        typoTolerance: true,
      });

      expect(recommendation).toBe('typesense');
    });

    it('should recommend meilisearch for open source requirement', () => {
      const recommendation = AdapterFactory.getProviderRecommendation({
        openSource: true,
      });

      expect(recommendation).toBe('meilisearch');
    });

    it('should default to typesense for general use', () => {
      const recommendation = AdapterFactory.getProviderRecommendation({});

      expect(recommendation).toBe('typesense');
    });
  });

  describe('cache management', () => {
    it('should clear all cached adapters', () => {
      // This is more of a smoke test since we can't easily verify internal state
      expect(() => AdapterFactory.clearCache()).not.toThrow();
    });

    it('should clear cache for specific provider', () => {
      expect(() => AdapterFactory.clearProviderCache('typesense')).not.toThrow();
    });
  });

  describe('utility methods', () => {
    it('should return supported providers', () => {
      const providers = AdapterFactory.getSupportedProviders();
      expect(providers).toContain('typesense');
      expect(providers).toContain('meilisearch');
    });

    it('should validate provider support', () => {
      expect(AdapterFactory.isProviderSupported('typesense')).toBe(true);
      expect(AdapterFactory.isProviderSupported('meilisearch')).toBe(true);
      expect(AdapterFactory.isProviderSupported('elasticsearch')).toBe(false);
    });

    it('should return provider information', () => {
      const info = AdapterFactory.getProviderInfo('typesense');
      expect(info).toMatchObject({
        name: 'Typesense',
        strengths: expect.arrayContaining(['typo-tolerance', 'real-time']),
      });
    });
  });
});
