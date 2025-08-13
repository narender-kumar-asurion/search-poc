/**
 * End-to-end integration tests for complete search workflows
 * These tests verify the entire search pipeline from data ingestion to search results
 */

import request from 'supertest';
import { Express } from 'express';

// Mock the search service for integration tests
jest.mock('../../../src/services/search', () => ({
  getGlobalSearchService: jest.fn().mockResolvedValue({
    adapter: {
      search: jest.fn().mockResolvedValue({
        hits: [
          {
            document: {
              id: '1',
              name: 'React',
              category: 'Frontend',
              description: 'JavaScript library for building user interfaces',
              tags: ['javascript', 'frontend', 'ui'],
              popularity_score: 95,
              document_type: 'software_stack',
            },
            text_match: 95,
            highlight: {},
          },
        ],
        found: 1,
        search_time_ms: 10,
      }),
      searchByCategory: jest.fn().mockResolvedValue({
        hits: [
          {
            document: {
              id: '2',
              name: 'Vue.js',
              category: 'Frontend',
              tags: ['javascript', 'frontend'],
            },
            text_match: 90,
          },
        ],
        found: 1,
        search_time_ms: 8,
      }),
      searchByTags: jest.fn().mockResolvedValue({
        hits: [],
        found: 0,
        search_time_ms: 5,
      }),
      getFacets: jest.fn().mockResolvedValue([
        {
          field: 'category',
          values: [
            { value: 'Frontend', count: 10 },
            { value: 'Backend', count: 8 },
          ],
        },
      ]),
      healthCheck: jest.fn().mockResolvedValue(true),
      getProviderInfo: jest.fn().mockReturnValue({
        name: 'Typesense',
        version: '0.25.0',
        features: ['full-text search', 'faceting'],
        connectionStatus: 'connected',
      }),
    },
  }),
}));

// Mock logger
jest.mock('../../../src/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Full Search Workflow Integration Tests', () => {
  let app: Express;

  beforeAll(async () => {
    // Dynamically import the app to ensure mocks are set up
    const { default: createApp } = await import('../../../src/api/server');
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete search workflow', () => {
    it('should handle full search pipeline from query to results', async () => {
      const searchQuery = 'react framework';

      const response = await request(app)
        .get('/api/search')
        .query({
          q: searchQuery,
          category: 'Frontend',
          limit: 10,
          page: 1,
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        query: searchQuery,
        found: 1,
        results: expect.arrayContaining([
          expect.objectContaining({
            id: '1',
            name: 'React',
            category: 'Frontend',
            description: expect.any(String),
            tags: expect.arrayContaining(['javascript', 'frontend']),
            score: 95,
          }),
        ]),
        searchTime: 10,
        pagination: expect.objectContaining({
          currentPage: 1,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        }),
      });
    });

    it('should handle category-based search workflow', async () => {
      const response = await request(app)
        .get('/api/search/category/Frontend')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        query: '*',
        found: 1,
        results: expect.arrayContaining([
          expect.objectContaining({
            id: '2',
            name: 'Vue.js',
            category: 'Frontend',
          }),
        ]),
        searchTime: 8,
      });
    });

    it('should handle tag-based search workflow', async () => {
      const response = await request(app)
        .post('/api/search/tags')
        .send({
          tags: ['javascript', 'frontend'],
          limit: 20,
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        query: '*',
        found: 0,
        results: [],
        searchTime: 5,
      });
    });

    it('should handle faceted search workflow', async () => {
      const response = await request(app)
        .get('/api/facets')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        facets: expect.arrayContaining([
          expect.objectContaining({
            field: 'category',
            values: expect.arrayContaining([
              { value: 'Frontend', count: 10 },
              { value: 'Backend', count: 8 },
            ]),
          }),
        ]),
      });
    });
  });

  describe('Error handling workflows', () => {
    it('should handle search service errors gracefully', async () => {
      const { getGlobalSearchService } = require('../../../src/services/search');
      const mockService = await getGlobalSearchService();
      
      mockService.adapter.search.mockRejectedValue(new Error('Search service unavailable'));

      const response = await request(app)
        .get('/api/search')
        .query({ q: 'test query' })
        .expect(200);

      expect(response.body).toEqual({
        success: false,
        query: 'test query',
        found: 0,
        results: [],
      });
    });

    it('should handle validation errors in search workflow', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({
          q: '', // Empty query should fail validation
          page: 0, // Invalid page
          limit: 1000, // Invalid limit
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: expect.any(String),
      });
    });

    it('should handle malformed tag search requests', async () => {
      const response = await request(app)
        .post('/api/search/tags')
        .send({
          tags: 'not-an-array', // Should be array
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: expect.any(String),
      });
    });
  });

  describe('Performance and reliability workflows', () => {
    it('should handle concurrent search requests', async () => {
      const concurrentRequests = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .get('/api/search')
          .query({ q: `query-${i}` })
      );

      const responses = await Promise.all(concurrentRequests);

      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.query).toBe(`query-${index}`);
      });
    });

    it('should handle large result sets with pagination', async () => {
      const { getGlobalSearchService } = require('../../../src/services/search');
      const mockService = await getGlobalSearchService();
      
      // Mock large result set
      mockService.adapter.search.mockResolvedValue({
        hits: new Array(50).fill(null).map((_, i) => ({
          document: {
            id: `item-${i}`,
            name: `Item ${i}`,
            category: 'Test',
          },
          text_match: 80,
        })),
        found: 1000,
        search_time_ms: 25,
      });

      const response = await request(app)
        .get('/api/search')
        .query({
          q: 'test',
          page: 2,
          limit: 50,
        })
        .expect(200);

      expect(response.body.found).toBe(1000);
      expect(response.body.results).toHaveLength(50);
      expect(response.body.pagination).toEqual({
        currentPage: 2,
        totalPages: 20,
        hasNext: true,
        hasPrevious: true,
      });
    });

    it('should handle search timeouts gracefully', async () => {
      const { getGlobalSearchService } = require('../../../src/services/search');
      const mockService = await getGlobalSearchService();
      
      // Simulate timeout
      mockService.adapter.search.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      const response = await request(app)
        .get('/api/search')
        .query({ q: 'timeout test' })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.found).toBe(0);
    });
  });

  describe('Health check and monitoring workflows', () => {
    it('should provide comprehensive health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        services: expect.objectContaining({
          search: expect.objectContaining({
            status: 'healthy',
            provider: expect.objectContaining({
              name: 'Typesense',
              version: '0.25.0',
              connectionStatus: 'connected',
            }),
          }),
        }),
        uptime: expect.any(Number),
      });
    });

    it('should detect unhealthy search service', async () => {
      const { getGlobalSearchService } = require('../../../src/services/search');
      const mockService = await getGlobalSearchService();
      
      mockService.adapter.healthCheck.mockResolvedValue(false);

      const response = await request(app)
        .get('/api/health')
        .expect(503);

      expect(response.body.status).toBe('unhealthy');
      expect(response.body.services.search.status).toBe('unhealthy');
    });
  });

  describe('Cross-collection search workflows', () => {
    it('should handle claims search workflow', async () => {
      const { getGlobalSearchService } = require('../../../src/services/search');
      const mockService = await getGlobalSearchService();
      
      mockService.adapter.search.mockResolvedValue({
        hits: [
          {
            document: {
              id: 'claim-123',
              claimNumber: 'CLM001',
              claimType: 'warranty',
              claimStatus: 'approved',
              consumerName: 'John Doe',
              consumerAddState: 'ON',
              document_type: 'claim',
            },
            text_match: 85,
          },
        ],
        found: 1,
        search_time_ms: 12,
      });

      const response = await request(app)
        .get('/api/search/claims')
        .query({
          q: 'warranty claim',
          claimType: 'warranty',
          province: 'ON',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results[0]).toEqual(
        expect.objectContaining({
          id: 'claim-123',
          name: 'Claim CLM001',
          description: expect.stringContaining('John Doe'),
          category: 'claim',
          claimNumber: 'CLM001',
          claimType: 'warranty',
          claimStatus: 'approved',
        })
      );
    });

    it('should handle locations search workflow', async () => {
      const { getGlobalSearchService } = require('../../../src/services/search');
      const mockService = await getGlobalSearchService();
      
      mockService.adapter.search.mockResolvedValue({
        hits: [
          {
            document: {
              id: 'loc-123',
              postalCode: 'K1A0A6',
              provinceId: 'ON',
              postalCodeGroup: 'K1A',
              location: [45.4215, -75.6972],
              document_type: 'location',
            },
            text_match: 90,
          },
        ],
        found: 1,
        search_time_ms: 8,
      });

      const response = await request(app)
        .get('/api/search/locations')
        .query({
          q: 'ottawa postal code',
          province: 'ON',
          postalCode: 'K1A',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results[0]).toEqual(
        expect.objectContaining({
          id: 'loc-123',
          name: 'Location K1A0A6',
          description: 'K1A0A6, ON',
          category: 'location',
          postalCode: 'K1A0A6',
          provinceId: 'ON',
          latitude: 45.4215,
          longitude: -75.6972,
        })
      );
    });
  });

  describe('Data consistency workflows', () => {
    it('should maintain result format consistency across all endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/api/search', query: { q: 'test' } },
        { method: 'get', path: '/api/search/category/Frontend' },
        { method: 'post', path: '/api/search/tags', body: { tags: ['javascript'] } },
      ];

      for (const endpoint of endpoints) {
        const req = request(app)[endpoint.method](endpoint.path);
        
        if (endpoint.query) {
          req.query(endpoint.query);
        }
        
        if (endpoint.body) {
          req.send(endpoint.body);
        }

        const response = await req.expect(200);

        expect(response.body).toEqual(
          expect.objectContaining({
            success: expect.any(Boolean),
            query: expect.any(String),
            found: expect.any(Number),
            results: expect.any(Array),
          })
        );

        if (response.body.results.length > 0) {
          expect(response.body.results[0]).toEqual(
            expect.objectContaining({
              id: expect.any(String),
              name: expect.any(String),
              category: expect.any(String),
            })
          );
        }
      }
    });
  });
});
