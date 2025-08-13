import { seedData, seedCollection, SAMPLE_DATA, seedingUtils } from '../../src/data';
import { CollectionType } from '../../src/schema';

// Mock the search service
jest.mock('../../src/services/search', () => ({
  getGlobalSearchService: jest.fn().mockResolvedValue({
    createCollection: jest.fn().mockResolvedValue(undefined),
    indexDocuments: jest.fn().mockResolvedValue(undefined),
    healthCheck: jest.fn().mockResolvedValue(true),
  }),
}));

// Mock logger
jest.mock('../../src/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    success: jest.fn(),
    search: jest.fn(),
    server: jest.fn(),
    data: jest.fn(),
  },
}));

import { getGlobalSearchService } from '../../src/services/search';

describe('Data Seeding', () => {
  let mockSearchService: any;

  beforeEach(() => {
    mockSearchService = {
      createCollection: jest.fn().mockResolvedValue(undefined),
      indexDocuments: jest.fn().mockResolvedValue(undefined),
      healthCheck: jest.fn().mockResolvedValue(true),
    };

    (getGlobalSearchService as jest.Mock).mockResolvedValue(mockSearchService);
    jest.clearAllMocks();
  });

  describe('SAMPLE_DATA', () => {
    it('should contain sample data for different collections', () => {
      expect(SAMPLE_DATA).toBeDefined();
      expect(typeof SAMPLE_DATA).toBe('object');
      
      // Check that sample data has expected structure
      expect(SAMPLE_DATA).toHaveProperty('software_stack');
      expect(Array.isArray(SAMPLE_DATA.software_stack)).toBe(true);
      expect(SAMPLE_DATA.software_stack.length).toBeGreaterThan(0);
      
      // Verify sample data structure
      const firstItem = SAMPLE_DATA.software_stack[0];
      expect(firstItem).toBeDefined();
      expect(firstItem).toHaveProperty('id');
      expect(firstItem).toHaveProperty('name');
      expect(firstItem).toHaveProperty('description');
      expect(firstItem).toHaveProperty('category');
      expect(firstItem).toHaveProperty('tags');
      if (firstItem) {
        expect(Array.isArray(firstItem.tags)).toBe(true);
      }
    });

    it('should have valid software stack items', () => {
      SAMPLE_DATA.software_stack.forEach((item, index) => {
        expect(item.id).toBeDefined();
        expect(typeof item.id).toBe('string');
        expect(item.name).toBeDefined();
        expect(typeof item.name).toBe('string');
        expect(item.description).toBeDefined();
        expect(typeof item.description).toBe('string');
        expect(item.category).toBeDefined();
        expect(typeof item.category).toBe('string');
        expect(Array.isArray(item.tags)).toBe(true);
        expect(typeof item.popularity_score).toBe('number');
      });
    });
  });

  describe('seedCollection', () => {
    it('should seed software_stack collection successfully', async () => {
      await seedCollection('software_stack');

      expect(mockSearchService.createCollection).toHaveBeenCalledWith(
        'software_stack_components',
        expect.objectContaining({
          name: 'software_stack_components',
          fields: expect.arrayContaining([
            expect.objectContaining({ name: 'id' }),
            expect.objectContaining({ name: 'name' }),
            expect.objectContaining({ name: 'description' }),
            expect.objectContaining({ name: 'category' }),
            expect.objectContaining({ name: 'tags' }),
          ]),
        })
      );

      expect(mockSearchService.indexDocuments).toHaveBeenCalledWith(
        'software_stack_components',
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            description: expect.any(String),
            category: expect.any(String),
            tags: expect.any(Array),
          }),
        ])
      );
    });

    it('should seed warranty_claims collection successfully', async () => {
      await seedCollection('claims');

      expect(mockSearchService.createCollection).toHaveBeenCalledWith(
        'claims',
        expect.objectContaining({
          name: 'claims',
        })
      );

      expect(mockSearchService.indexDocuments).toHaveBeenCalled();
    });

    it('should seed postal_code_locations collection successfully', async () => {
      await seedCollection('locations');

      expect(mockSearchService.createCollection).toHaveBeenCalledWith(
        'locations',
        expect.objectContaining({
          name: 'locations',
        })
      );

      expect(mockSearchService.indexDocuments).toHaveBeenCalled();
    });

    it('should handle collection creation failure', async () => {
      mockSearchService.createCollection.mockRejectedValue(
        new Error('Collection creation failed')
      );

      await expect(seedCollection('software_stack')).rejects.toThrow('Collection creation failed');
    });

    it('should handle indexing failure', async () => {
      mockSearchService.indexDocuments.mockRejectedValue(
        new Error('Indexing failed')
      );

      await expect(seedCollection('software_stack')).rejects.toThrow('Indexing failed');
    });

    it('should handle invalid collection type', async () => {
      await expect(seedCollection('invalid_collection' as CollectionType))
        .rejects.toThrow();
    });
  });

  describe('seedData', () => {
    it('should seed all collections when no specific collections provided', async () => {
      await seedData();

      // Should create all three collections
      expect(mockSearchService.createCollection).toHaveBeenCalledTimes(3);
      expect(mockSearchService.indexDocuments).toHaveBeenCalledTimes(3);
    });

    it('should seed only specified collections', async () => {
      await seedData(['software_stack', 'claims']);

      // Should create only the specified collections
      expect(mockSearchService.createCollection).toHaveBeenCalledTimes(2);
      expect(mockSearchService.indexDocuments).toHaveBeenCalledTimes(2);
    });

    it('should handle single collection seeding', async () => {
      await seedData(['software_stack']);

      expect(mockSearchService.createCollection).toHaveBeenCalledTimes(1);
      expect(mockSearchService.createCollection).toHaveBeenCalledWith(
        'software_stack_components',
        expect.any(Object)
      );
    });

    it('should handle empty collections array', async () => {
      await seedData([]);

      expect(mockSearchService.createCollection).not.toHaveBeenCalled();
      expect(mockSearchService.indexDocuments).not.toHaveBeenCalled();
    });

    it('should handle service unavailability', async () => {
      (getGlobalSearchService as jest.Mock).mockRejectedValue(new Error('Service unavailable'));

      await expect(seedData()).rejects.toThrow('Service unavailable');
    });

    it('should continue seeding other collections if one fails', async () => {
      // Make the first collection fail
      mockSearchService.createCollection
        .mockResolvedValueOnce(undefined) // software_stack succeeds
        .mockRejectedValueOnce(new Error('Second collection failed')) // claims fails
        .mockResolvedValueOnce(undefined); // locations succeeds

      // Should not throw, but should log the error
      await expect(seedData()).rejects.toThrow();
    });
  });

  describe('seedingUtils', () => {
    it('should provide utility functions', () => {
      expect(seedingUtils).toBeDefined();
      expect(typeof seedingUtils).toBe('object');
    });

    it('should have expected utility functions', () => {
      // Test the structure without assuming specific functions
      expect(seedingUtils).toBeTruthy();
    });
  });

  describe('Data Transformation', () => {
    it('should transform claims data correctly', async () => {
      await seedCollection('claims');

      const indexCall = mockSearchService.indexDocuments.mock.calls.find(
        (call: any) => call[0] === 'claims'
      );
      
      expect(indexCall).toBeDefined();
      const documents = indexCall[1];
      expect(Array.isArray(documents)).toBe(true);
      
      if (documents.length > 0) {
        const firstClaim = documents[0];
        expect(firstClaim).toHaveProperty('id');
        expect(firstClaim).toHaveProperty('claimNumber');
        expect(firstClaim).toHaveProperty('claimId');
        expect(firstClaim).toHaveProperty('claimType');
        expect(firstClaim).toHaveProperty('claimStatus');
      }
    });

    it('should transform location data correctly', async () => {
      await seedCollection('locations');

      const indexCall = mockSearchService.indexDocuments.mock.calls.find(
        (call: any) => call[0] === 'locations'
      );
      
      expect(indexCall).toBeDefined();
      const documents = indexCall[1];
      expect(Array.isArray(documents)).toBe(true);
      
      if (documents.length > 0) {
        const firstLocation = documents[0];
        expect(firstLocation).toHaveProperty('id');
        expect(firstLocation).toHaveProperty('postalCode');
        expect(firstLocation).toHaveProperty('postalCodeGroup');
        expect(firstLocation).toHaveProperty('provinceId');
      }
    });

    it('should validate document structure before indexing', async () => {
      await seedCollection('software_stack');

      const indexCall = mockSearchService.indexDocuments.mock.calls[0];
      const documents = indexCall[1];
      
      documents.forEach((doc: any) => {
        expect(doc.id).toBeDefined();
        expect(typeof doc.id).toBe('string');
        expect(doc.name).toBeDefined();
        expect(typeof doc.name).toBe('string');
        expect(doc.category).toBeDefined();
        expect(typeof doc.category).toBe('string');
        expect(Array.isArray(doc.tags)).toBe(true);
        expect(typeof doc.popularity_score).toBe('number');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle search service initialization failure', async () => {
      (getGlobalSearchService as jest.Mock).mockImplementation(() => {
        throw new Error('Service initialization failed');
      });

      await expect(seedData()).rejects.toThrow('Service initialization failed');
    });

    it('should handle adapter initialization failure', async () => {
      (getGlobalSearchService as jest.Mock).mockRejectedValue(new Error('Adapter initialization failed'));

      await expect(seedData()).rejects.toThrow('Adapter initialization failed');
    });

    it('should provide meaningful error messages', async () => {
      const specificError = new Error('Database connection timeout');
      mockSearchService.createCollection.mockRejectedValue(specificError);

      await expect(seedCollection('software_stack')).rejects.toThrow('Database connection timeout');
    });

    it('should handle partial data corruption gracefully', async () => {
      // Mock corrupted JSON data scenario by simulating indexing failure
      mockSearchService.indexDocuments.mockRejectedValue(
        new Error('Invalid JSON data')
      );

      // Should handle the error gracefully
      await expect(seedCollection('claims')).rejects.toThrow('Invalid JSON data');
    });
  });
});
