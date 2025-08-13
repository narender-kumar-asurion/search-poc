import { DatabaseEventTransformer } from '../../../../src/services/sync/event-transformer';
import { DatabaseChangeEvent, DocumentType, ChangeEventType } from '../../../../src/services/sync/interfaces';

// Mock logger
jest.mock('../../../../src/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('DatabaseEventTransformer', () => {
  let transformer: DatabaseEventTransformer;

  beforeEach(() => {
    transformer = new DatabaseEventTransformer();
    jest.clearAllMocks();
  });

  describe('transformEvent', () => {
    describe('SQS event transformation', () => {
      it('should transform basic SQS event', () => {
        const rawEvent = {
          id: 'evt-123',
          eventType: 'INSERT',
          documentType: 'software_stack',
          timestamp: 1234567890000,
          data: { id: '1', name: 'React', category: 'Frontend' },
        };

        const result = transformer.transformEvent(rawEvent, 'sqs');

        expect(result).toEqual({
          id: 'evt-123',
          eventType: 'INSERT',
          documentType: 'software_stack',
          timestamp: 1234567890000,
          data: { id: '1', name: 'React', category: 'Frontend' },
          oldData: undefined,
          metadata: {
            source: 'sqs',
            correlationId: undefined,
            user: undefined,
            batchId: undefined,
          },
        });
      });

      it('should transform AWS DMS event format', () => {
        const dmsEvent = {
          eventName: 'INSERT',
          eventID: 'dms-123',
          eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789012:table/software_components',
          dynamodb: {
            ApproximateCreationDateTime: '2023-01-01T00:00:00Z',
            NewImage: {
              id: { S: '1' },
              name: { S: 'React' },
              category: { S: 'Frontend' },
              popularity: { N: '95' },
            },
          },
        };

        const result = transformer.transformEvent(dmsEvent, 'sqs');

        expect(result.eventType).toBe('INSERT');
        expect(result.documentType).toBe('software_stack');
        expect(result.data).toEqual({
          id: '1',
          name: 'React',
          category: 'Frontend',
          popularity: 95,
        });
      });

      it('should handle UPDATE events with old and new data', () => {
        const rawEvent = {
          eventType: 'UPDATE',
          documentType: 'claims',
          data: { id: 'claim-1', status: 'approved' },
          oldData: { id: 'claim-1', status: 'pending' },
          correlationId: 'corr-123',
        };

        const result = transformer.transformEvent(rawEvent, 'sqs');

        expect(result.eventType).toBe('UPDATE');
        expect(result.data).toEqual({ id: 'claim-1', status: 'approved' });
        expect(result.oldData).toEqual({ id: 'claim-1', status: 'pending' });
        expect(result.metadata?.correlationId).toBe('corr-123');
      });
    });

    describe('Database trigger event transformation', () => {
      it('should transform database trigger event', () => {
        const triggerEvent = {
          operation: 'UPDATE',
          table: 'claims',
          timestamp: '2023-01-01T12:00:00Z',
          new: { id: 'claim-1', status: 'processed' },
          old: { id: 'claim-1', status: 'pending' },
          user: 'system',
        };

        const result = transformer.transformEvent(triggerEvent, 'database-trigger');

        expect(result.eventType).toBe('UPDATE');
        expect(result.documentType).toBe('claims');
        expect(result.timestamp).toBe(new Date('2023-01-01T12:00:00Z').getTime());
        expect(result.data).toEqual({ id: 'claim-1', status: 'processed' });
        expect(result.oldData).toEqual({ id: 'claim-1', status: 'pending' });
        expect(result.metadata?.user).toBe('system');
      });
    });

    describe('API event transformation', () => {
      it('should transform API event', () => {
        const apiEvent = {
          id: 'api-evt-123',
          eventType: 'INSERT',
          documentType: 'locations',
          data: { id: 'loc-1', postalCode: 'K1A0A6' },
          userId: 'user-123',
        };

        const result = transformer.transformEvent(apiEvent, 'api');

        expect(result.id).toBe('api-evt-123');
        expect(result.eventType).toBe('INSERT');
        expect(result.documentType).toBe('locations');
        expect(result.metadata?.user).toBe('user-123');
        expect(result.metadata?.source).toBe('api');
      });
    });

    describe('Generic event transformation', () => {
      it('should transform generic event with fallbacks', () => {
        const genericEvent = {
          action: 'CREATE',
          payload: { id: '1', name: 'Vue.js' },
          ts: 1234567890,
          traceId: 'trace-123',
        };

        const result = transformer.transformEvent(genericEvent, 'webhook');

        expect(result.eventType).toBe('INSERT');
        expect(result.data).toEqual({ id: '1', name: 'Vue.js' });
        expect(result.timestamp).toBe(1234567890000); // Converted to milliseconds
        expect(result.metadata?.correlationId).toBe('trace-123');
        expect(result.metadata?.source).toBe('webhook');
      });

      it('should generate event ID when missing', () => {
        const eventWithoutId = {
          eventType: 'UPDATE',
          data: { name: 'Test' },
        };

        const result = transformer.transformEvent(eventWithoutId, 'test');

        expect(result.id).toBeDefined();
        expect(result.id).toMatch(/^evt_/);
      });
    });

    describe('error handling', () => {
      it('should throw error when transformation fails', () => {
        const invalidEvent = {
          data: null,
        };
        
        // Mock a transformation error by creating a circular reference
        const circularEvent: any = { eventType: 'INSERT' };
        circularEvent.self = circularEvent;

        expect(() => {
          transformer.transformEvent(circularEvent, 'test');
        }).toThrow('Event transformation failed');
      });
    });
  });

  describe('validateEvent', () => {
    describe('valid events', () => {
      it('should validate complete INSERT event', () => {
        const event: DatabaseChangeEvent = {
          id: 'evt-123',
          eventType: 'INSERT',
          documentType: 'software_stack',
          timestamp: Date.now(),
          data: { id: '1', name: 'React' },
        };

        expect(transformer.validateEvent(event)).toBe(true);
      });

      it('should validate UPDATE event with old data', () => {
        const event: DatabaseChangeEvent = {
          id: 'evt-124',
          eventType: 'UPDATE',
          documentType: 'claims',
          timestamp: Date.now(),
          data: { id: 'claim-1', status: 'approved' },
          oldData: { id: 'claim-1', status: 'pending' },
        };

        expect(transformer.validateEvent(event)).toBe(true);
      });

      it('should validate DELETE event', () => {
        const event: DatabaseChangeEvent = {
          id: 'evt-125',
          eventType: 'DELETE',
          documentType: 'locations',
          timestamp: Date.now(),
          data: { id: 'loc-1' },
        };

        expect(transformer.validateEvent(event)).toBe(true);
      });

      it('should validate BULK_UPDATE event', () => {
        const event: DatabaseChangeEvent = {
          id: 'evt-126',
          eventType: 'BULK_UPDATE',
          documentType: 'software_stack',
          timestamp: Date.now(),
          data: {
            documents: [
              { id: '1', name: 'React' },
              { id: '2', name: 'Vue' },
            ],
          },
        };

        expect(transformer.validateEvent(event)).toBe(true);
      });

      it('should validate BULK_DELETE event', () => {
        const event: DatabaseChangeEvent = {
          id: 'evt-127',
          eventType: 'BULK_DELETE',
          documentType: 'claims',
          timestamp: Date.now(),
          data: {
            documentIds: ['claim-1', 'claim-2', 'claim-3'],
          },
        };

        expect(transformer.validateEvent(event)).toBe(true);
      });
    });

    describe('invalid events', () => {
      it('should reject event without required fields', () => {
        const incompleteEvent = {
          eventType: 'INSERT',
          // Missing id, documentType, timestamp
        } as DatabaseChangeEvent;

        expect(transformer.validateEvent(incompleteEvent)).toBe(false);
      });

      it('should reject event with invalid event type', () => {
        const event: DatabaseChangeEvent = {
          id: 'evt-123',
          eventType: 'INVALID_TYPE' as ChangeEventType,
          documentType: 'software_stack',
          timestamp: Date.now(),
        };

        expect(transformer.validateEvent(event)).toBe(false);
      });

      it('should reject event with invalid document type', () => {
        const event: DatabaseChangeEvent = {
          id: 'evt-123',
          eventType: 'INSERT',
          documentType: 'invalid_type' as DocumentType,
          timestamp: Date.now(),
          data: { id: '1' },
        };

        expect(transformer.validateEvent(event)).toBe(false);
      });

      it('should reject INSERT/UPDATE event without data', () => {
        const event: DatabaseChangeEvent = {
          id: 'evt-123',
          eventType: 'INSERT',
          documentType: 'software_stack',
          timestamp: Date.now(),
          // Missing data
        };

        expect(transformer.validateEvent(event)).toBe(false);
      });

      it('should reject DELETE event without document ID', () => {
        const event: DatabaseChangeEvent = {
          id: 'evt-123',
          eventType: 'DELETE',
          documentType: 'software_stack',
          timestamp: Date.now(),
          data: {}, // Missing id
        };

        expect(transformer.validateEvent(event)).toBe(false);
      });

      it('should reject BULK_UPDATE event without documents array', () => {
        const event: DatabaseChangeEvent = {
          id: 'evt-123',
          eventType: 'BULK_UPDATE',
          documentType: 'software_stack',
          timestamp: Date.now(),
          data: {}, // Missing documents array
        };

        expect(transformer.validateEvent(event)).toBe(false);
      });

      it('should reject BULK_DELETE event without documentIds array', () => {
        const event: DatabaseChangeEvent = {
          id: 'evt-123',
          eventType: 'BULK_DELETE',
          documentType: 'software_stack',
          timestamp: Date.now(),
          data: {}, // Missing documentIds array
        };

        expect(transformer.validateEvent(event)).toBe(false);
      });

      it('should reject events that are too old', () => {
        const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
        const event: DatabaseChangeEvent = {
          id: 'evt-123',
          eventType: 'INSERT',
          documentType: 'software_stack',
          timestamp: oldTimestamp,
          data: { id: '1' },
        };

        expect(transformer.validateEvent(event)).toBe(false);
      });

      it('should reject events with future timestamps', () => {
        const futureTimestamp = Date.now() + (2 * 60 * 1000); // 2 minutes in future
        const event: DatabaseChangeEvent = {
          id: 'evt-123',
          eventType: 'INSERT',
          documentType: 'software_stack',
          timestamp: futureTimestamp,
          data: { id: '1' },
        };

        expect(transformer.validateEvent(event)).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle validation errors gracefully', () => {
        const problematicEvent = {
          id: 'evt-123',
          get eventType() {
            throw new Error('Property access error');
          },
          documentType: 'software_stack',
          timestamp: Date.now(),
        } as DatabaseChangeEvent;

        expect(transformer.validateEvent(problematicEvent)).toBe(false);
      });
    });
  });

  describe('extractDocumentType', () => {
    it('should extract from direct documentType field', () => {
      const event = { documentType: 'claims' };
      expect(transformer.extractDocumentType(event)).toBe('claims');
    });

    it('should extract from document_type field', () => {
      const event = { document_type: 'locations' };
      expect(transformer.extractDocumentType(event)).toBe('locations');
    });

    it('should extract from table name', () => {
      const event = { tableName: 'warranty_claims' };
      expect(transformer.extractDocumentType(event)).toBe('claims');
    });

    it('should extract from collection name', () => {
      const event = { collection: 'software_stack_components' };
      expect(transformer.extractDocumentType(event)).toBe('software_stack');
    });

    it('should infer from data structure - claims', () => {
      const event = {
        data: {
          claimId: 'claim-123',
          claimNumber: 'CLM001',
          claimType: 'warranty',
        },
      };
      expect(transformer.extractDocumentType(event)).toBe('claims');
    });

    it('should infer from data structure - locations', () => {
      const event = {
        data: {
          postalCode: 'K1A0A6',
          location: [45.4215, -75.6972],
        },
      };
      expect(transformer.extractDocumentType(event)).toBe('locations');
    });

    it('should infer from data structure - software_stack', () => {
      const event = {
        data: {
          category: 'Frontend',
          tags: ['react', 'javascript'],
          popularity_score: 95,
        },
      };
      expect(transformer.extractDocumentType(event)).toBe('software_stack');
    });

    it('should handle ARN table names', () => {
      const event = {
        tableName: 'arn:aws:dynamodb:us-east-1:123456789012:table/postal_codes',
      };
      expect(transformer.extractDocumentType(event)).toBe('locations');
    });

    it('should return null for unrecognizable events', () => {
      const event = {
        someField: 'value',
        data: { unknownField: 'value' },
      };
      expect(transformer.extractDocumentType(event)).toBe(null);
    });

    it('should handle empty or invalid data', () => {
      expect(transformer.extractDocumentType({})).toBe(null);
      expect(transformer.extractDocumentType(null)).toBe(null);
      expect(transformer.extractDocumentType({ data: null })).toBe(null);
      expect(transformer.extractDocumentType({ data: 'string' })).toBe(null);
    });

    it('should handle extraction errors gracefully', () => {
      const problematicEvent = {
        get data() {
          throw new Error('Data access error');
        },
      };

      expect(transformer.extractDocumentType(problematicEvent)).toBe(null);
    });
  });

  describe('DynamoDB unmarshal', () => {
    it('should unmarshal complex DynamoDB items', () => {
      const dmsEvent = {
        eventName: 'INSERT',
        dynamodb: {
          NewImage: {
            id: { S: 'comp-1' },
            name: { S: 'React' },
            version: { N: '18' },
            isActive: { BOOL: true },
            tags: { SS: ['frontend', 'javascript'] },
            metrics: {
              M: {
                downloads: { N: '1000000' },
                stars: { N: '100000' },
              },
            },
            features: {
              L: [
                { S: 'hooks' },
                { S: 'context' },
                { M: { name: { S: 'jsx' }, stable: { BOOL: true } } },
              ],
            },
          },
        },
      };

      const result = transformer.transformEvent(dmsEvent, 'sqs');

      expect(result.data).toEqual({
        id: 'comp-1',
        name: 'React',
        version: 18,
        isActive: true,
        tags: ['frontend', 'javascript'],
        metrics: {
          downloads: 1000000,
          stars: 100000,
        },
        features: [
          'hooks',
          'context',
          { name: 'jsx', stable: true },
        ],
      });
    });
  });

  describe('event ID generation', () => {
    it('should generate unique event IDs', () => {
      const event1 = { eventType: 'INSERT', data: { id: '1' } };
      const event2 = { eventType: 'INSERT', data: { id: '2' } };

      const result1 = transformer.transformEvent(event1, 'test');
      const result2 = transformer.transformEvent(event2, 'test');

      expect(result1.id).toBeDefined();
      expect(result2.id).toBeDefined();
      expect(result1.id).not.toBe(result2.id);
      expect(result1.id).toMatch(/^evt_\d+_[a-z0-9]+_[a-z0-9]+$/);
    });
  });

  describe('timestamp parsing', () => {
    it('should handle various timestamp formats', () => {
      const testCases = [
        { input: { timestamp: 1234567890 }, expected: 1234567890000 }, // seconds
        { input: { timestamp: 1234567890000 }, expected: 1234567890000 }, // milliseconds
        { input: { timestamp: '2023-01-01T00:00:00Z' }, expected: new Date('2023-01-01T00:00:00Z').getTime() },
        { input: { ts: 1234567890 }, expected: 1234567890000 },
        { input: { time: '2023-01-01' }, expected: new Date('2023-01-01').getTime() },
        { input: {}, expected: expect.any(Number) }, // should default to current time
      ];

      testCases.forEach(({ input, expected }) => {
        const result = transformer.transformEvent(input, 'test');
        if (typeof expected === 'number') {
          expect(result.timestamp).toBe(expected);
        } else {
          expect(result.timestamp).toEqual(expected);
        }
      });
    });

    it('should handle invalid timestamp strings', () => {
      const event = { timestamp: 'invalid-date' };
      const result = transformer.transformEvent(event, 'test');
      
      expect(result.timestamp).toBeGreaterThan(Date.now() - 1000);
      expect(result.timestamp).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('event type mapping', () => {
    it('should map various event type formats', () => {
      const mappings = [
        { input: 'INSERT', expected: 'INSERT' },
        { input: 'CREATE', expected: 'INSERT' },
        { input: 'ADD', expected: 'INSERT' },
        { input: 'UPDATE', expected: 'UPDATE' },
        { input: 'MODIFY', expected: 'UPDATE' },
        { input: 'CHANGE', expected: 'UPDATE' },
        { input: 'DELETE', expected: 'DELETE' },
        { input: 'REMOVE', expected: 'DELETE' },
        { input: 'BULK_UPDATE', expected: 'BULK_UPDATE' },
        { input: 'BULK_DELETE', expected: 'BULK_DELETE' },
        { input: 'unknown', expected: 'UPDATE' }, // default
        { input: '', expected: 'UPDATE' }, // default
      ];

      mappings.forEach(({ input, expected }) => {
        const event = { eventType: input };
        const result = transformer.transformEvent(event, 'test');
        expect(result.eventType).toBe(expected);
      });
    });
  });
});
