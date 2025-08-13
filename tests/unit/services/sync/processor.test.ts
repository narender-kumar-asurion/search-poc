import { SearchSyncProcessor } from '../../../../src/services/sync/processor';
import { DatabaseChangeEvent, DocumentType, ChangeEventType } from '../../../../src/services/sync/interfaces';

// Mock dependencies
jest.mock('../../../../src/services/search', () => ({
  getGlobalSearchService: jest.fn(),
}));

jest.mock('../../../../src/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../../src/schema', () => ({
  COLLECTION_SCHEMAS: {
    software_stack: { name: 'software_stack_components' },
    claims: { name: 'claims' },
    locations: { name: 'locations' },
  },
}));

import { getGlobalSearchService } from '../../../../src/services/search';

describe('SearchSyncProcessor', () => {
  let processor: SearchSyncProcessor;
  let mockSearchService: any;

  beforeEach(() => {
    processor = new SearchSyncProcessor();
    
    mockSearchService = {
      indexDocuments: jest.fn().mockResolvedValue(undefined),
      deleteDocument: jest.fn().mockResolvedValue(undefined),
      deleteDocuments: jest.fn().mockResolvedValue(undefined),
    };

    (getGlobalSearchService as jest.Mock).mockResolvedValue(mockSearchService);
    
    jest.clearAllMocks();
  });

  describe('processChange', () => {
    describe('INSERT events', () => {
      it('should process INSERT event successfully', async () => {
        const event: DatabaseChangeEvent = {
          id: 'evt-1',
          eventType: 'INSERT',
          documentType: 'software_stack',
          timestamp: Date.now(),
          data: {
            id: 'react',
            name: 'React',
            category: 'Frontend',
            description: 'JavaScript library',
            tags: ['javascript', 'frontend'],
          },
        };

        const result = await processor.processChange(event);

        expect(result).toBe(true);
        expect(mockSearchService.indexDocuments).toHaveBeenCalledWith(
          'software_stack_components',
          [expect.objectContaining({
            id: 'react',
            name: 'React',
            document_type: 'software_stack',
            popularity_score: 0, // Default value
          })]
        );
      });

      it('should handle INSERT event without ID', async () => {
        const event: DatabaseChangeEvent = {
          id: 'evt-2',
          eventType: 'INSERT',
          documentType: 'software_stack',
          timestamp: Date.now(),
          data: {
            name: 'Vue.js',
            category: 'Frontend',
          },
        };

        const result = await processor.processChange(event);

        expect(result).toBe(true);
        expect(mockSearchService.indexDocuments).toHaveBeenCalledWith(
          'software_stack_components',
          [expect.objectContaining({
            id: 'vue.js', // Generated from name
            name: 'Vue.js',
            document_type: 'software_stack',
          })]
        );
      });

      it('should fail INSERT event without data', async () => {
        const event: DatabaseChangeEvent = {
          id: 'evt-3',
          eventType: 'INSERT',
          documentType: 'software_stack',
          timestamp: Date.now(),
          // Missing data
        };

        const result = await processor.processChange(event);

        expect(result).toBe(false);
        expect(mockSearchService.indexDocuments).not.toHaveBeenCalled();
      });
    });

    describe('UPDATE events', () => {
      it('should process UPDATE event successfully', async () => {
        const event: DatabaseChangeEvent = {
          id: 'evt-4',
          eventType: 'UPDATE',
          documentType: 'claims',
          timestamp: Date.now(),
          data: {
            claimId: 'claim-123',
            claimNumber: 'CLM001',
            claimStatus: 'approved',
            lastModifiedDate: '2023-01-01T00:00:00Z',
          },
          oldData: {
            claimId: 'claim-123',
            claimStatus: 'pending',
          },
        };

        const result = await processor.processChange(event);

        expect(result).toBe(true);
        expect(mockSearchService.indexDocuments).toHaveBeenCalledWith(
          'claims',
          [expect.objectContaining({
            id: 'claim-123',
            claimId: 'claim-123',
            claimStatus: 'approved',
            document_type: 'claims',
            created_at: expect.any(Number),
          })]
        );
      });

      it('should handle UPDATE for locations with coordinate parsing', async () => {
        const event: DatabaseChangeEvent = {
          id: 'evt-5',
          eventType: 'UPDATE',
          documentType: 'locations',
          timestamp: Date.now(),
          data: {
            id: 'loc-1',
            postalCode: 'K1A0A6',
            postalCodeCenterPoint: '45.4215,-75.6972',
            provinceId: 'ON',
          },
        };

        const result = await processor.processChange(event);

        expect(result).toBe(true);
        expect(mockSearchService.indexDocuments).toHaveBeenCalledWith(
          'locations',
          [expect.objectContaining({
            id: 'loc-1',
            postalCode: 'K1A0A6',
            location: [45.4215, -75.6972],
            document_type: 'locations',
          })]
        );
      });
    });

    describe('DELETE events', () => {
      it('should warn about DELETE not being implemented', async () => {
        const event: DatabaseChangeEvent = {
          id: 'evt-6',
          eventType: 'DELETE',
          documentType: 'software_stack',
          timestamp: Date.now(),
          data: { id: 'react' },
        };

        const result = await processor.processChange(event);

        expect(result).toBe(true); // Returns true but logs warning
        expect(mockSearchService.indexDocuments).not.toHaveBeenCalled();
      });

      it('should fail DELETE event without document ID', async () => {
        const event: DatabaseChangeEvent = {
          id: 'evt-7',
          eventType: 'DELETE',
          documentType: 'software_stack',
          timestamp: Date.now(),
          data: {}, // Missing id
        };

        const result = await processor.processChange(event);

        expect(result).toBe(false);
      });
    });

    describe('BULK operations', () => {
      it('should process BULK_UPDATE event successfully', async () => {
        const event: DatabaseChangeEvent = {
          id: 'evt-8',
          eventType: 'BULK_UPDATE',
          documentType: 'software_stack',
          timestamp: Date.now(),
          data: {
            documents: [
              { id: '1', name: 'React', category: 'Frontend' },
              { id: '2', name: 'Vue', category: 'Frontend' },
              { id: '3', name: 'Angular', category: 'Frontend' },
            ],
          },
        };

        const result = await processor.processChange(event);

        expect(result).toBe(true);
        expect(mockSearchService.indexDocuments).toHaveBeenCalledWith(
          'software_stack_components',
          expect.arrayContaining([
            expect.objectContaining({ id: '1', name: 'React', document_type: 'software_stack' }),
            expect.objectContaining({ id: '2', name: 'Vue', document_type: 'software_stack' }),
            expect.objectContaining({ id: '3', name: 'Angular', document_type: 'software_stack' }),
          ])
        );
      });

      it('should warn about BULK_DELETE not being implemented', async () => {
        const event: DatabaseChangeEvent = {
          id: 'evt-9',
          eventType: 'BULK_DELETE',
          documentType: 'claims',
          timestamp: Date.now(),
          data: {
            documentIds: ['claim-1', 'claim-2', 'claim-3'],
          },
        };

        const result = await processor.processChange(event);

        expect(result).toBe(true); // Returns true but logs warning
        expect(mockSearchService.indexDocuments).not.toHaveBeenCalled();
      });

      it('should fail BULK_UPDATE without documents array', async () => {
        const event: DatabaseChangeEvent = {
          id: 'evt-10',
          eventType: 'BULK_UPDATE',
          documentType: 'software_stack',
          timestamp: Date.now(),
          data: {}, // Missing documents array
        };

        const result = await processor.processChange(event);

        expect(result).toBe(false);
      });
    });

    describe('error handling', () => {
      it('should handle unknown event types', async () => {
        const event: DatabaseChangeEvent = {
          id: 'evt-11',
          eventType: 'UNKNOWN' as ChangeEventType,
          documentType: 'software_stack',
          timestamp: Date.now(),
          data: { id: '1' },
        };

        const result = await processor.processChange(event);

        expect(result).toBe(false);
        expect(mockSearchService.indexDocuments).not.toHaveBeenCalled();
      });

      it('should handle search service errors', async () => {
        mockSearchService.indexDocuments.mockRejectedValue(new Error('Index error'));

        const event: DatabaseChangeEvent = {
          id: 'evt-12',
          eventType: 'INSERT',
          documentType: 'software_stack',
          timestamp: Date.now(),
          data: { id: '1', name: 'Test' },
        };

        const result = await processor.processChange(event);

        expect(result).toBe(false);
      });

      it('should handle search service unavailability', async () => {
        (getGlobalSearchService as jest.Mock).mockRejectedValue(new Error('Service unavailable'));

        const event: DatabaseChangeEvent = {
          id: 'evt-13',
          eventType: 'INSERT',
          documentType: 'software_stack',
          timestamp: Date.now(),
          data: { id: '1', name: 'Test' },
        };

        const result = await processor.processChange(event);

        expect(result).toBe(false);
      });
    });
  });

  describe('processBatch', () => {
    it('should process batch of mixed events successfully', async () => {
      const events: DatabaseChangeEvent[] = [
        {
          id: 'evt-1',
          eventType: 'INSERT',
          documentType: 'software_stack',
          timestamp: Date.now(),
          data: { id: '1', name: 'React' },
        },
        {
          id: 'evt-2',
          eventType: 'UPDATE',
          documentType: 'software_stack',
          timestamp: Date.now(),
          data: { id: '2', name: 'Vue' },
        },
        {
          id: 'evt-3',
          eventType: 'INSERT',
          documentType: 'claims',
          timestamp: Date.now(),
          data: { claimId: 'claim-1', claimStatus: 'pending' },
        },
      ];

      const result = await processor.processBatch(events);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.errors).toBeUndefined();
    });

    it('should handle batch with bulk operations', async () => {
      const events: DatabaseChangeEvent[] = [
        {
          id: 'evt-1',
          eventType: 'BULK_UPDATE',
          documentType: 'software_stack',
          timestamp: Date.now(),
          data: {
            documents: [
              { id: '1', name: 'React' },
              { id: '2', name: 'Vue' },
            ],
          },
        },
        {
          id: 'evt-2',
          eventType: 'BULK_UPDATE',
          documentType: 'software_stack',
          timestamp: Date.now(),
          data: {
            documents: [
              { id: '3', name: 'Angular' },
            ],
          },
        },
      ];

      const result = await processor.processBatch(events);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
      expect(mockSearchService.indexDocuments).toHaveBeenCalledWith(
        'software_stack_components',
        expect.arrayContaining([
          expect.objectContaining({ id: '1', name: 'React' }),
          expect.objectContaining({ id: '2', name: 'Vue' }),
          expect.objectContaining({ id: '3', name: 'Angular' }),
        ])
      );
    });

    it('should handle partial batch failures', async () => {
      // First event will succeed, second will fail
      mockSearchService.indexDocuments
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Index error'));

      const events: DatabaseChangeEvent[] = [
        {
          id: 'evt-1',
          eventType: 'INSERT',
          documentType: 'software_stack',
          timestamp: Date.now(),
          data: { id: '1', name: 'React' },
        },
        {
          id: 'evt-2',
          eventType: 'INSERT',
          documentType: 'software_stack',
          timestamp: Date.now(),
          data: { id: '2', name: 'Vue' },
        },
      ];

      const result = await processor.processBatch(events);

      expect(result.success).toBe(false);
      expect(result.processed).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toContain('Failed to process event evt-2');
    });

    it('should handle empty batch', async () => {
      const result = await processor.processBatch([]);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should group events efficiently', async () => {
      const events: DatabaseChangeEvent[] = [
        {
          id: 'evt-1',
          eventType: 'INSERT',
          documentType: 'software_stack',
          timestamp: Date.now(),
          data: { id: '1', name: 'React' },
        },
        {
          id: 'evt-2',
          eventType: 'INSERT',
          documentType: 'software_stack',
          timestamp: Date.now(),
          data: { id: '2', name: 'Vue' },
        },
        {
          id: 'evt-3',
          eventType: 'UPDATE',
          documentType: 'claims',
          timestamp: Date.now(),
          data: { claimId: 'claim-1' },
        },
      ];

      await processor.processBatch(events);

      // Should group by document type and event type
      expect(mockSearchService.indexDocuments).toHaveBeenCalledTimes(3);
    });
  });

  describe('getStatus', () => {
    it('should return healthy status initially', async () => {
      const status = await processor.getStatus();

      expect(status.isHealthy).toBe(true);
      expect(status.lastProcessed).toBeUndefined();
      expect(status.queueDepth).toBe(0);
      expect(status.errorRate).toBe(0);
    });

    it('should track processing status', async () => {
      // Process a successful event
      const successEvent: DatabaseChangeEvent = {
        id: 'evt-1',
        eventType: 'INSERT',
        documentType: 'software_stack',
        timestamp: Date.now(),
        data: { id: '1', name: 'React' },
      };

      await processor.processChange(successEvent);

      const status = await processor.getStatus();

      expect(status.isHealthy).toBe(true);
      expect(status.lastProcessed).toBeDefined();
      expect(status.errorRate).toBe(0);
    });

    it('should track error rate', async () => {
      // Process some failed events
      mockSearchService.indexDocuments.mockRejectedValue(new Error('Test error'));

      const failEvent: DatabaseChangeEvent = {
        id: 'evt-fail',
        eventType: 'INSERT',
        documentType: 'software_stack',
        timestamp: Date.now(),
        data: { id: '1', name: 'React' },
      };

      for (let i = 0; i < 5; i++) {
        await processor.processChange(failEvent);
      }

      const status = await processor.getStatus();

      expect(status.isHealthy).toBe(true); // Still healthy (< 10 errors)
      expect(status.errorRate).toBe(1.0); // 100% error rate
    });

    it('should become unhealthy with too many errors', async () => {
      // Process many failed events
      mockSearchService.indexDocuments.mockRejectedValue(new Error('Test error'));

      const failEvent: DatabaseChangeEvent = {
        id: 'evt-fail',
        eventType: 'INSERT',
        documentType: 'software_stack',
        timestamp: Date.now(),
        data: { id: '1', name: 'React' },
      };

      for (let i = 0; i < 15; i++) {
        await processor.processChange(failEvent);
      }

      const status = await processor.getStatus();

      expect(status.isHealthy).toBe(false); // Unhealthy (>= 10 errors)
      expect(status.errorRate).toBe(1.0);
    });
  });

  describe('document transformation', () => {
    it('should transform software_stack documents correctly', async () => {
      const event: DatabaseChangeEvent = {
        id: 'evt-1',
        eventType: 'INSERT',
        documentType: 'software_stack',
        timestamp: Date.now(),
        data: {
          name: 'React',
          category: 'Frontend',
          description: 'JavaScript library',
          tags: ['javascript', 'frontend'],
          popularity_score: 95,
        },
      };

      await processor.processChange(event);

      expect(mockSearchService.indexDocuments).toHaveBeenCalledWith(
        'software_stack_components',
        [expect.objectContaining({
          id: 'react', // Generated from name
          name: 'React',
          document_type: 'software_stack',
          popularity_score: 95,
        })]
      );
    });

    it('should transform claims documents correctly', async () => {
      const event: DatabaseChangeEvent = {
        id: 'evt-2',
        eventType: 'INSERT',
        documentType: 'claims',
        timestamp: Date.now(),
        data: {
          claimId: 'claim-123',
          claimNumber: 'CLM001',
          claimStatus: 'approved',
          lastModifiedDate: '2023-01-01T00:00:00Z',
        },
      };

      await processor.processChange(event);

      expect(mockSearchService.indexDocuments).toHaveBeenCalledWith(
        'claims',
        [expect.objectContaining({
          id: 'claim-123',
          claimId: 'claim-123',
          document_type: 'claims',
          created_at: new Date('2023-01-01T00:00:00Z').getTime(),
        })]
      );
    });

    it('should transform locations documents correctly', async () => {
      const event: DatabaseChangeEvent = {
        id: 'evt-3',
        eventType: 'INSERT',
        documentType: 'locations',
        timestamp: Date.now(),
        data: {
          id: 'loc-1',
          postalCode: 'K1A0A6',
          postalCodeCenterPoint: '45.4215,-75.6972',
          provinceId: 'ON',
          lastModifiedDate: '2023-01-01T12:00:00Z',
        },
      };

      await processor.processChange(event);

      expect(mockSearchService.indexDocuments).toHaveBeenCalledWith(
        'locations',
        [expect.objectContaining({
          id: 'loc-1',
          postalCode: 'K1A0A6',
          location: [45.4215, -75.6972],
          document_type: 'locations',
          created_at: new Date('2023-01-01T12:00:00Z').getTime(),
        })]
      );
    });

    it('should handle invalid coordinate strings', async () => {
      const event: DatabaseChangeEvent = {
        id: 'evt-4',
        eventType: 'INSERT',
        documentType: 'locations',
        timestamp: Date.now(),
        data: {
          id: 'loc-2',
          postalCode: 'V5K0A1',
          postalCodeCenterPoint: 'invalid,coordinates',
        },
      };

      await processor.processChange(event);

      expect(mockSearchService.indexDocuments).toHaveBeenCalledWith(
        'locations',
        [expect.objectContaining({
          id: 'loc-2',
          location: undefined, // Should be undefined for invalid coords
        })]
      );
    });

    it('should handle missing coordinate data', async () => {
      const event: DatabaseChangeEvent = {
        id: 'evt-5',
        eventType: 'INSERT',
        documentType: 'locations',
        timestamp: Date.now(),
        data: {
          id: 'loc-3',
          postalCode: 'T2X1A1',
          // No postalCodeCenterPoint
        },
      };

      await processor.processChange(event);

      expect(mockSearchService.indexDocuments).toHaveBeenCalledWith(
        'locations',
        [expect.objectContaining({
          id: 'loc-3',
          location: undefined,
        })]
      );
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle unknown document types', async () => {
      const event: DatabaseChangeEvent = {
        id: 'evt-unknown',
        eventType: 'INSERT',
        documentType: 'unknown_type' as DocumentType,
        timestamp: Date.now(),
        data: { id: '1' },
      };

      const result = await processor.processChange(event);

      expect(result).toBe(false);
    });

    it('should handle malformed location coordinates', async () => {
      const testCases = [
        '', // Empty string
        'single_value', // Single value
        '45.4215', // Only one coordinate
        'not,numbers', // Non-numeric values
        'NaN,NaN', // NaN values
        '45.4215,-75.6972,extra', // Too many values
      ];

      for (const centerPoint of testCases) {
        const event: DatabaseChangeEvent = {
          id: `evt-coord-${centerPoint}`,
          eventType: 'INSERT',
          documentType: 'locations',
          timestamp: Date.now(),
          data: {
            id: 'loc-test',
            postalCodeCenterPoint: centerPoint,
          },
        };

        await processor.processChange(event);

        expect(mockSearchService.indexDocuments).toHaveBeenCalledWith(
          'locations',
          [expect.objectContaining({
            location: undefined,
          })]
        );

        mockSearchService.indexDocuments.mockClear();
      }
    });

    it('should handle batch processing with mixed success/failure', async () => {
      let callCount = 0;
      mockSearchService.indexDocuments.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Middle event failed');
        }
        return Promise.resolve();
      });

      const events: DatabaseChangeEvent[] = [
        {
          id: 'evt-1',
          eventType: 'INSERT',
          documentType: 'software_stack',
          timestamp: Date.now(),
          data: { id: '1', name: 'React' },
        },
        {
          id: 'evt-2',
          eventType: 'INSERT',
          documentType: 'software_stack',
          timestamp: Date.now(),
          data: { id: '2', name: 'Vue' },
        },
        {
          id: 'evt-3',
          eventType: 'INSERT',
          documentType: 'software_stack',
          timestamp: Date.now(),
          data: { id: '3', name: 'Angular' },
        },
      ];

      const result = await processor.processBatch(events);

      expect(result.success).toBe(false);
      expect(result.processed).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toContain('Failed to process event evt-2');
    });
  });
});
