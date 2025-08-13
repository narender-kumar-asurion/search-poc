import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
export const errorRate = new Rate('errors');
export const searchDuration = new Trend('search_duration');
export const facetDuration = new Trend('facet_duration');
export const suggestDuration = new Trend('suggest_duration');
export const requestCounter = new Counter('requests_total');

// Test configuration - staged load test
export const options = {
  stages: [
    { duration: '2m', target: 4 },   // Ramp up to 4 users
    { duration: '5m', target: 4 },   // Stay at 4 users
    { duration: '2m', target: 16 },  // Ramp up to 16 users  
    { duration: '5m', target: 16 },  // Stay at 16 users
    { duration: '2m', target: 64 },  // Ramp up to 64 users
    { duration: '5m', target: 64 },  // Stay at 64 users
    { duration: '3m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'], 
    http_req_failed: ['rate<0.1'],
    errors: ['rate<0.1'],
    search_duration: ['p(95)<800'],
    facet_duration: ['p(95)<400'],
    suggest_duration: ['p(95)<200'],
  },
};

// Configuration
const BASE_URL = __ENV.API_URL || 'http://localhost:8080';
const API_KEY = __ENV.API_KEY || 'dev-api-key-12345';
const API_VERSION = 'v1';

// Realistic test data
const searchTerms = {
  common: ['water', 'fire', 'auto', 'home', 'damage', 'claim', 'accident', 'theft'],
  specific: ['water damage', 'fire damage', 'car accident', 'home insurance', 'medical claim'],
  typos: ['watr damage', 'fir damage', 'accidnt', 'thft'],
  phrases: ['vehicle collision damage', 'home water damage basement', 'storm damage roof'],
};

const filters = {
  status: ['OPEN', 'PENDING', 'CLOSED', 'INVESTIGATING', 'APPROVED', 'DENIED'],
  priority: ['LOW', 'MEDIUM', 'HIGH'],
  adjuster: ['ADJ-001', 'ADJ-002', 'ADJ-003', 'ADJ-004'],
  amounts: [
    { gte: 1000, lte: 5000 },
    { gte: 5000, lte: 15000 },
    { gte: 15000, lte: 50000 },
  ],
};

const facetFields = ['status', 'priority', 'customer_zip', 'adjuster_id', 'tags'];

// Helper functions
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomSearchTerm() {
  const category = Math.random();
  if (category < 0.5) return getRandomElement(searchTerms.common);
  if (category < 0.8) return getRandomElement(searchTerms.specific);
  if (category < 0.9) return getRandomElement(searchTerms.typos);
  return getRandomElement(searchTerms.phrases);
}

function makeRequest(method, url, payload = null, params = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
  };

  const config = { headers, ...params };
  const startTime = Date.now();
  
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
  }

  return response;
}

// Main load test scenarios
export default function () {
  const userType = Math.random();
  
  if (userType < 0.4) {
    // 40% - Power users (complex searches)
    powerUserFlow();
  } else if (userType < 0.7) {
    // 30% - Regular users (simple searches)
    regularUserFlow();
  } else if (userType < 0.85) {
    // 15% - Quick lookups
    quickLookupFlow();
  } else {
    // 15% - API integrations (bulk operations)
    apiIntegrationFlow();
  }

  sleep(0.5 + Math.random() * 2); // Think time between requests
}

function powerUserFlow() {
  // Complex search with multiple filters and facets
  const query = getRandomSearchTerm();
  const status = getRandomElement(filters.status);
  const priority = getRandomElement(filters.priority);
  const amountRange = getRandomElement(filters.amounts);
  
  const payload = {
    index: 'claims',
    query: {
      text: query,
      filters: {
        and: [
          { field: 'status', op: 'eq', value: status },
          { field: 'priority', op: 'eq', value: priority },
          { range: { field: 'amount', ...amountRange } },
        ],
      },
      facets: facetFields.map(field => ({ field, limit: 10 })),
      sort: [{ field: 'created_at', order: 'desc' }],
      pagination: { page: 1, perPage: 25 },
      highlight: { fields: ['description', 'customer_name'] },
    },
  };

  const response = makeRequest('POST', `${BASE_URL}/${API_VERSION}/search`, payload);
  
  const isSuccess = check(response, {
    'power user search status is 200': (r) => r.status === 200,
    'power user search has results': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.hits !== undefined && body.facets !== undefined;
      } catch {
        return false;
      }
    },
  });

  if (isSuccess) {
    searchDuration.add(response.timings.duration);
  }

  sleep(1); // Review results

  // Follow up with facet-only query
  facetOnlyQuery();
}

function regularUserFlow() {
  // Simple text search
  const query = getRandomSearchTerm();
  
  const payload = {
    query: {
      text: query,
      pagination: { page: 1, perPage: 20 },
    },
  };

  const response = makeRequest('POST', `${BASE_URL}/${API_VERSION}/claims/search`, payload);
  
  const isSuccess = check(response, {
    'regular user search status is 200': (r) => r.status === 200,
    'regular user search response valid': (r) => {
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

  sleep(0.5);

  // Sometimes get suggestions
  if (Math.random() < 0.3) {
    getSuggestions(query.substring(0, 3));
  }
}

function quickLookupFlow() {
  // Quick status-based lookup
  const status = getRandomElement(filters.status);
  
  const payload = {
    index: 'claims',
    query: {
      filters: { field: 'status', op: 'eq', value: status },
      sort: [{ field: 'updated_at', order: 'desc' }],
      pagination: { page: 1, perPage: 10 },
    },
  };

  const response = makeRequest('POST', `${BASE_URL}/${API_VERSION}/search`, payload);
  
  check(response, {
    'quick lookup status is 200': (r) => r.status === 200,
  });

  if (response.status === 200) {
    searchDuration.add(response.timings.duration);
  }
}

function apiIntegrationFlow() {
  // Simulate API client doing bulk operations
  
  // 1. Health check
  const healthResponse = makeRequest('GET', `${BASE_URL}/ready`);
  check(healthResponse, {
    'api integration health check': (r) => r.status === 200,
  });

  sleep(0.1);

  // 2. Get index info
  const indexResponse = makeRequest('GET', `${BASE_URL}/${API_VERSION}/indexes`);
  check(indexResponse, {
    'api integration index list': (r) => r.status === 200,
  });

  sleep(0.1);

  // 3. Batch search
  for (let i = 0; i < 3; i++) {
    const query = getRandomElement(searchTerms.common);
    const payload = {
      index: 'claims',
      query: {
        text: query,
        pagination: { page: i + 1, perPage: 50 },
      },
    };

    const response = makeRequest('POST', `${BASE_URL}/${API_VERSION}/search`, payload);
    if (response.status === 200) {
      searchDuration.add(response.timings.duration);
    }
    
    sleep(0.1);
  }
}

function facetOnlyQuery() {
  const payload = {
    index: 'claims',
    facets: ['status', 'priority', 'adjuster_id'],
    limit: 20,
  };

  const response = makeRequest('POST', `${BASE_URL}/${API_VERSION}/facets`, payload);
  
  check(response, {
    'facet-only query status is 200': (r) => r.status === 200,
    'facet-only query has facets': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.facets && Object.keys(body.facets).length > 0;
      } catch {
        return false;
      }
    },
  });

  if (response.status === 200) {
    facetDuration.add(response.timings.duration);
  }
}

function getSuggestions(prefix) {
  const payload = {
    index: 'claims',
    q: prefix,
    fields: ['customer_name', 'description'],
    limit: 8,
  };

  const response = makeRequest('POST', `${BASE_URL}/${API_VERSION}/suggest`, payload);
  
  check(response, {
    'suggestions status is 200': (r) => r.status === 200,
  });

  if (response.status === 200) {
    suggestDuration.add(response.timings.duration);
  }
}

// Setup function
export function setup() {
  console.log('Starting load test...');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Stages: ${JSON.stringify(options.stages)}`);
  
  // Verify API is accessible
  const healthResponse = makeRequest('GET', `${BASE_URL}/health`);
  if (healthResponse.status !== 200) {
    console.error('Health check failed - aborting test');
    return null;
  }
  
  // Check if data is seeded
  const searchResponse = makeRequest('POST', `${BASE_URL}/${API_VERSION}/search`, {
    index: 'claims',
    query: { text: '*', pagination: { page: 1, perPage: 1 } },
  });
  
  if (searchResponse.status === 200) {
    const body = JSON.parse(searchResponse.body);
    console.log(`Found ${body.meta.total} claims in index`);
    if (body.meta.total === 0) {
      console.warn('No data found - make sure to run seed script first');
    }
  }
  
  console.log('Load test starting...');
  return {};
}

// Teardown function
export function teardown(data) {
  console.log('Load test completed');
  console.log('Check the results above for performance metrics');
}
