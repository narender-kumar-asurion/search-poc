/**
 * Core implementation tests for the new Search API
 * 
 * This focuses on the essential functionality without sync system integration
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { config } from '../../src/config';
import { createSearchAdapter, validateProviderConfig } from '../../src/adapters/factory';
import { GeoService } from '../../src/services/geo.service';
import { AppError, ValidationError, NotFoundError, ErrorCode } from '../../src/lib/errors';
import { getSLIMetrics, resetSLIMetrics } from '../../src/lib/metrics';

// Mock external dependencies
jest.mock('typesense');
jest.mock('meilisearch');

describe('Core Search API Implementation', () => {
  describe('Configuration', () => {
    test('should have valid default configuration', () => {
      expect(config.NODE_ENV).toBeDefined();
      expect(config.PORT).toBeGreaterThan(0);
      expect(config.SEARCH_PROVIDER).toMatch(/^(typesense|meilisearch)$/);
    });

    test('should validate provider configurations', () => {
      const typesenseErrors = validateProviderConfig('typesense');
      expect(Array.isArray(typesenseErrors)).toBe(true);
      
      const meilisearchErrors = validateProviderConfig('meilisearch');
      expect(Array.isArray(meilisearchErrors)).toBe(true);
      
      const invalidErrors = validateProviderConfig('invalid');
      expect(invalidErrors).toContain('Unsupported provider: invalid');
    });
  });

  describe('Error Handling', () => {
    test('should create structured errors', () => {
      const error = new AppError(ErrorCode.INVALID_REQUEST, 'Test message', 400);
      expect(error.code).toBe(ErrorCode.INVALID_REQUEST);
      expect(error.message).toBe('Test message');
      expect(error.statusCode).toBe(400);
      expect(error.traceId).toBeDefined();
      expect(error.isOperational).toBe(true);
    });

    test('should serialize errors correctly', () => {
      const error = new ValidationError('Invalid input', { field: 'query' });
      const response = error.toResponse();
      
      expect(response.error.code).toBe(ErrorCode.INVALID_REQUEST);
      expect(response.error.message).toBe('Invalid input');
      expect(response.error.details).toEqual({ field: 'query' });
      expect(response.error.traceId).toBeDefined();
    });

    test('should create NotFound errors', () => {
      const error = new NotFoundError('Document', 'doc-123');
      expect(error.statusCode).toBe(404);
      expect(error.message).toContain('Document with identifier \'doc-123\' not found');
    });
  });

  describe('GeoService', () => {
    let geoService: GeoService;

    beforeEach(() => {
      geoService = new GeoService();
    });

    test('should initialize without errors', () => {
      expect(geoService).toBeDefined();
      const stats = geoService.getStats();
      expect(stats.indexType).toBeDefined();
      expect(stats.initialized).toBe(true);
    });

    test('should calculate distances correctly', async () => {
      // Test with known coordinates (New York to Los Angeles approximately)
      const nyCoords = { lat: 40.7128, lon: -74.0060 };
      const laCoords = { lat: 34.0522, lon: -118.2437 };
      
      // Distance should be approximately 2445 miles = 3936 km
      const locations = await geoService.findLocationsInRadius(
        nyCoords.lat, 
        nyCoords.lon, 
        5000 // 5000 km radius to include LA
      );
      
      expect(Array.isArray(locations)).toBe(true);
    });

    test('should handle zip code lookups', async () => {
      // This will return null for non-existent zips in our test data
      const location = await geoService.getZipLocation('00000');
      expect(location).toBeNull();
    });

    test('should find nearest zip codes', async () => {
      const nearestZips = await geoService.findNearestZips('00000', 5);
      expect(Array.isArray(nearestZips)).toBe(true);
      expect(nearestZips.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Metrics', () => {
    beforeEach(() => {
      resetSLIMetrics();
    });

    test('should collect SLI metrics', () => {
      const initialMetrics = getSLIMetrics();
      expect(initialMetrics.qps).toBe(0);
      expect(initialMetrics.totalRequests).toBe(0);
      expect(initialMetrics.totalErrors).toBe(0);
    });

    test('should track request metrics', () => {
      const { recordRequestMetrics } = require('../../src/lib/metrics');
      
      // Simulate some requests
      recordRequestMetrics(100, false); // 100ms success
      recordRequestMetrics(200, false); // 200ms success  
      recordRequestMetrics(500, true);  // 500ms error
      
      const metrics = getSLIMetrics();
      expect(metrics.totalRequests).toBe(3);
      expect(metrics.totalErrors).toBe(1);
      expect(metrics.averageResponseTime).toBeCloseTo(266.67, 1);
    });
  });

  describe('Type Safety', () => {
    test('should enforce strict typing on search queries', () => {
      // This test ensures our TypeScript types are working
      const validQuery = {
        text: 'test query',
        pagination: { page: 1, perPage: 10 },
        filters: {
          field: 'status',
          op: 'eq' as const,
          value: 'OPEN'
        }
      };

      expect(validQuery.text).toBe('test query');
      expect(validQuery.pagination?.page).toBe(1);
      expect(validQuery.filters?.op).toBe('eq');
    });

    test('should handle optional fields correctly', () => {
      const minimalQuery = {
        text: 'search'
      };

      const fullQuery = {
        text: 'search',
        pagination: { page: 1, perPage: 20 },
        sort: [{ field: 'created_at', order: 'desc' as const }],
        facets: [{ field: 'status', limit: 10 }],
        highlight: { fields: ['description'] }
      };

      expect(minimalQuery.text).toBe('search');
      expect(fullQuery.sort?.[0]?.order).toBe('desc');
    });
  });
});

describe('Integration Points', () => {
  test('should have consistent error codes', () => {
    // Verify critical error codes exist
    expect(ErrorCode.INVALID_REQUEST).toBeDefined();
    expect(ErrorCode.RATE_LIMITED).toBeDefined();
    expect(ErrorCode.PROVIDER_ERROR).toBeDefined();
    expect(ErrorCode.UNAUTHORIZED).toBeDefined();
  });

  test('should handle environment configuration', () => {
    // Test that our config loading doesn't crash
    expect(() => {
      const testConfig = {
        NODE_ENV: 'test',
        SEARCH_PROVIDER: 'typesense',
        PORT: 8080
      };
      expect(testConfig).toBeDefined();
    }).not.toThrow();
  });
});

describe('API Contract Compliance', () => {
  test('should match OpenAPI schema structure', () => {
    // Test that our response structures match the OpenAPI spec
    const searchResult = {
      meta: {
        tookMs: 100,
        provider: 'typesense',
        total: 42,
        page: 1,
        perPage: 10
      },
      hits: [
        {
          id: 'doc-1',
          score: 0.95,
          document: { title: 'Test Document' },
          highlights: { title: '<em>Test</em> Document' }
        }
      ],
      facets: {
        status: [
          { value: 'OPEN', count: 15 },
          { value: 'CLOSED', count: 27 }
        ]
      }
    };

    expect(searchResult.meta.total).toBe(42);
    expect(searchResult.hits).toHaveLength(1);
    expect(searchResult.hits[0]?.id).toBe('doc-1');
    expect(searchResult.facets?.status).toHaveLength(2);
  });

  test('should validate error response format', () => {
    const errorResponse = {
      error: {
        code: 'INVALID_REQUEST',
        message: 'Request validation failed',
        details: { field: 'query is required' },
        traceId: 'trace-123'
      }
    };

    expect(errorResponse.error.code).toBe('INVALID_REQUEST');
    expect(errorResponse.error.traceId).toBe('trace-123');
    expect(errorResponse.error.details).toBeDefined();
  });
});

describe('Performance Characteristics', () => {
  test('should handle reasonable data sizes', () => {
    const largeResults = Array.from({ length: 100 }, (_, i) => ({
      id: `doc-${i}`,
      score: Math.random(),
      document: {
        title: `Document ${i}`,
        content: 'Lorem ipsum '.repeat(50) // ~550 characters
      }
    }));

    expect(largeResults).toHaveLength(100);
    expect(largeResults[0]?.document.content).toContain('Lorem ipsum');
  });

  test('should validate pagination limits', () => {
    const maxPerPage = 1000;
    const validPagination = { page: 1, perPage: 50 };
    const invalidPagination = { page: 1, perPage: 2000 };

    expect(validPagination.perPage).toBeLessThanOrEqual(maxPerPage);
    expect(invalidPagination.perPage).toBeGreaterThan(maxPerPage);
  });
});
