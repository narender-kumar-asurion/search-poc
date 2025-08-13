import '@testing-library/jest-dom/vitest'
import { expect, afterEach, beforeAll, afterAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import * as matchers from '@testing-library/jest-dom/matchers'

// Extend expect with jest-dom matchers
expect.extend(matchers)

// Setup MSW server for API mocking
export const server = setupServer(
  // Default handlers for common API endpoints
  http.get('/api/health', () => {
    return HttpResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      provider: 'typesense',
      version: '1.0.0',
    })
  }),

  http.get('/api/search', () => {
    return HttpResponse.json({
      success: true,
      query: 'test',
      found: 1,
      results: [
        {
          id: '1',
          name: 'Test Result',
          description: 'Test description',
          category: 'test',
          tags: ['test'],
        },
      ],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      },
      searchTime: 15,
    })
  }),

  http.get('/api/search/claims', () => {
    return HttpResponse.json({
      success: true,
      query: 'claim',
      found: 1,
      results: [
        {
          id: 'claim-1',
          name: 'Claim CLM-001',
          description: 'Test claim',
          category: 'claim',
          tags: ['warranty'],
          claimNumber: 'CLM-001',
          claimType: 'warranty',
          claimStatus: 'approved',
        },
      ],
    })
  }),

  http.get('/api/search/locations', () => {
    return HttpResponse.json({
      success: true,
      query: 'toronto',
      found: 1,
      results: [
        {
          id: 'location-1',
          name: 'Toronto Location',
          description: 'Toronto location',
          category: 'location',
          tags: ['ON'],
          postalCode: 'M5V 1A1',
          provinceId: 'ON',
        },
      ],
    })
  }),
)

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})

// Global test utilities
export const createMockSearchResponse = (query: string, results: any[] = []) => ({
  success: true,
  query,
  found: results.length,
  results,
  pagination: {
    currentPage: 1,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  },
  searchTime: 15,
})

// Mock IntersectionObserver (commonly needed for components with animations)
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {
    return null
  }
  disconnect() {
    return null
  }
  unobserve() {
    return null
  }
}

// Mock matchMedia (needed for responsive components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vitest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vitest.fn(), // deprecated
    removeListener: vitest.fn(), // deprecated
    addEventListener: vitest.fn(),
    removeEventListener: vitest.fn(),
    dispatchEvent: vitest.fn(),
  })),
})
