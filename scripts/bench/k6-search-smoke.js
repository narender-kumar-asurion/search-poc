import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
export const errorRate = new Rate('errors');
export const searchDuration = new Trend('search_duration');
export const requestCounter = new Counter('requests_total');

// Test configuration
export const options = {
  stages: [
    { duration: '10s', target: 2 }, // Ramp up to 2 users over 10s
    { duration: '30s', target: 2 }, // Stay at 2 users for 30s
    { duration: '10s', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must be below 500ms
    http_req_failed: ['rate<0.05'],   // Error rate must be below 5%
    errors: ['rate<0.05'],
  },
};

// Configuration
const BASE_URL = __ENV.API_URL || 'http://localhost:8080';
const API_KEY = __ENV.API_KEY || 'dev-api-key-12345';
const API_VERSION = 'v1';

// Test data
const searchQueries = [
  'water damage',
  'fire',
  'collision',
  'theft',
  'storm',
  'medical',
  'property',
  'vehicle',
];

const statusFilters = ['OPEN', 'PENDING', 'CLOSED', 'INVESTIGATING'];
const priorities = ['LOW', 'MEDIUM', 'HIGH'];

// Helper functions
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function makeRequest(method, url, payload = null, params = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
  };

  const config = { headers, ...params };
  
  let response;
  if (method === 'GET') {
    response = http.get(url, config);
  } else if (method === 'POST') {
    response = http.post(url, payload ? JSON.stringify(payload) : null, config);
  }

  requestCounter.add(1);
  
  // Track errors
  const isError = response.status >= 400;
  errorRate.add(isError);
  
  if (isError) {
    console.error(`Request failed: ${method} ${url} - Status: ${response.status}`);
    console.error(`Response: ${response.body}`);
  }

  return response;
}

// Test scenarios
export default function () {
  const scenario = Math.random();
  
  if (scenario < 0.4) {
    // 40% - Basic text search
    textSearch();
  } else if (scenario < 0.7) {
    // 30% - Filtered search
    filteredSearch();
  } else if (scenario < 0.85) {
    // 15% - Claims-specific search
    claimsSearch();
  } else if (scenario < 0.95) {
    // 10% - Suggestions
    suggestions();
  } else {
    // 5% - Other endpoints
    otherEndpoints();
  }

  sleep(1 + Math.random() * 2); // Wait 1-3 seconds between requests
}

function textSearch() {
  const query = getRandomElement(searchQueries);
  
  const payload = {
    index: 'claims',
    query: {
      text: query,
      pagination: {
        page: 1,
        perPage: 10,
      },
    },
  };

  const response = makeRequest('POST', `${BASE_URL}/${API_VERSION}/search`, payload);
  
  const isSuccess = check(response, {
    'text search status is 200': (r) => r.status === 200,
    'text search has results': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.hits && Array.isArray(body.hits);
      } catch {
        return false;
      }
    },
  });

  if (isSuccess) {
    searchDuration.add(response.timings.duration);
  }
}

function filteredSearch() {
  const query = getRandomElement(searchQueries);
  const status = getRandomElement(statusFilters);
  const priority = getRandomElement(priorities);
  
  const payload = {
    index: 'claims',
    query: {
      text: query,
      filters: {
        and: [
          { field: 'status', op: 'eq', value: status },
          { field: 'priority', op: 'eq', value: priority },
        ],
      },
      facets: [
        { field: 'status', limit: 5 },
        { field: 'priority', limit: 3 },
      ],
      pagination: {
        page: 1,
        perPage: 20,
      },
    },
  };

  const response = makeRequest('POST', `${BASE_URL}/${API_VERSION}/search`, payload);
  
  const isSuccess = check(response, {
    'filtered search status is 200': (r) => r.status === 200,
    'filtered search has facets': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.facets && typeof body.facets === 'object';
      } catch {
        return false;
      }
    },
  });

  if (isSuccess) {
    searchDuration.add(response.timings.duration);
  }
}

function claimsSearch() {
  const query = getRandomElement(searchQueries);
  
  const payload = {
    query: {
      text: query,
      sort: [{ field: 'created_at', order: 'desc' }],
      pagination: {
        page: 1,
        perPage: 15,
      },
    },
  };

  const response = makeRequest('POST', `${BASE_URL}/${API_VERSION}/claims/search`, payload);
  
  const isSuccess = check(response, {
    'claims search status is 200': (r) => r.status === 200,
    'claims search response format': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.meta && body.hits;
      } catch {
        return false;
      }
    },
  });

  if (isSuccess) {
    searchDuration.add(response.timings.duration);
  }
}

function suggestions() {
  const partial = getRandomElement(searchQueries).substring(0, 3);
  
  const payload = {
    index: 'claims',
    q: partial,
    fields: ['customer_name', 'description'],
    limit: 8,
  };

  const response = makeRequest('POST', `${BASE_URL}/${API_VERSION}/suggest`, payload);
  
  check(response, {
    'suggestions status is 200': (r) => r.status === 200,
    'suggestions has results': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.suggestions && Array.isArray(body.suggestions);
      } catch {
        return false;
      }
    },
  });
}

function otherEndpoints() {
  const endpoint = Math.random() < 0.5 ? 'health' : 'ready';
  
  const response = makeRequest('GET', `${BASE_URL}/${endpoint}`);
  
  check(response, {
    [`${endpoint} status is 200`]: (r) => r.status === 200,
  });
}

// Setup function - runs once at the start
export function setup() {
  console.log('Starting smoke test...');
  console.log(`Target: ${BASE_URL}`);
  
  // Test basic connectivity
  const healthResponse = makeRequest('GET', `${BASE_URL}/health`);
  if (healthResponse.status !== 200) {
    console.error('Health check failed - aborting test');
    return null;
  }
  
  console.log('Health check passed, starting load test');
  return {};
}

// Teardown function - runs once at the end
export function teardown(data) {
  console.log('Smoke test completed');
}
