import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('error_rate');
const searchLatency = new Trend('search_latency', true);
const searchSuccess = new Rate('search_success');
const requestsPerSecond = new Rate('requests_per_second');
const searchErrors = new Rate('search_errors');
const responseSize = new Trend('response_size_bytes');

// Test configuration
export const options = {
  stages: [
    // Warm-up phase
    { duration: '15s', target: 2 },   // Gentle warm-up
    { duration: '30s', target: 4 },   // Ramp up to 4 users over 30s
    { duration: '1m', target: 4 },    // Stay at 4 users for 1m
    
    // Load testing phase
    { duration: '30s', target: 8 },   // Ramp up to 8 users over 30s
    { duration: '2m', target: 8 },    // Stay at 8 users for 2m
    { duration: '30s', target: 16 },  // Ramp up to 16 users over 30s
    { duration: '2m', target: 16 },   // Stay at 16 users for 2m
    
    // Stress testing phase
    { duration: '30s', target: 32 },  // Ramp up to 32 users over 30s
    { duration: '1m', target: 32 },   // Stay at 32 users for 1m
    
    // Cool down
    { duration: '30s', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<120'], // 95% of requests must complete below 120ms
    'http_req_duration{expected_response:true}': ['p(99)<300'], // 99% below 300ms
    http_req_failed: ['rate<0.01'],   // Less than 1% of requests should fail
    error_rate: ['rate<0.01'],        // Less than 1% error rate
    search_success: ['rate>0.98'],    // More than 98% search success rate
    search_latency: ['p(95)<150'],    // 95% of searches complete below 150ms
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// Configuration
const BASE_URL = __ENV.API_URL || 'http://localhost:3001';
const API_KEY = __ENV.API_KEY || '';

// Test data sets
const searchQueries = [
  // Software stack queries (70% of traffic)
  'javascript', 'react', 'typescript', 'node', 'express', 'vue', 'angular',
  'python', 'django', 'flask', 'fastapi', 'java', 'spring', 'go', 'rust',
  'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'docker',
  'kubernetes', 'aws', 'terraform', 'jenkins', 'github', 'git',
  
  // Claims queries (20% of traffic)
  'warranty', 'claim', 'extended', 'repair', 'replacement', 'refund',
  'CLM', 'WRN', 'EXT', 'approved', 'pending', 'rejected',
  
  // Location queries (10% of traffic)
  'toronto', 'vancouver', 'montreal', 'calgary', 'ottawa', 'edmonton',
  'M5V', 'V6B', 'H3B', 'T2P', 'K1A', 'T5J', 'ON', 'BC', 'QC', 'AB'
];

const categories = ['frontend', 'backend', 'database', 'devops', 'mobile', 'ai'];
const tags = ['javascript', 'typescript', 'react', 'vue', 'angular', 'node', 'python'];
const claimTypes = ['warranty', 'extended', 'service', 'replacement'];
const claimStatuses = ['approved', 'pending', 'rejected', 'processing'];
const provinces = ['ON', 'BC', 'QC', 'AB', 'MB', 'SK', 'NS', 'NB'];

// Headers
const headers = {
  'Content-Type': 'application/json',
};

if (API_KEY) {
  headers['x-api-key'] = API_KEY;
}

export default function () {
  const testType = Math.random();
  
  if (testType < 0.7) {
    // 70% - Software stack search (prefix search)
    performSoftwareSearch();
  } else if (testType < 0.9) {
    // 20% - Filtered/faceted search
    performFilteredSearch();
  } else {
    // 10% - Claims and locations search
    performSpecializedSearch();
  }
  
  // Small delay between requests to simulate real user behavior
  sleep(Math.random() * 2 + 0.5); // 0.5-2.5 seconds
}

function performSoftwareSearch() {
  const query = searchQueries[Math.floor(Math.random() * searchQueries.length)];
  const limit = Math.random() < 0.8 ? 10 : 20; // Most users use default page size
  
  const url = `${BASE_URL}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  
  const response = http.get(url, { headers });
  
  const success = check(response, {
    'search status is 200': (r) => r.status === 200,
    'search response has results': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true;
      } catch {
        return false;
      }
    },
    'search response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  searchLatency.add(response.timings.duration);
  searchSuccess.add(success ? 1 : 0);
  errorRate.add(response.status !== 200 ? 1 : 0);
}

function performFilteredSearch() {
  const query = searchQueries[Math.floor(Math.random() * searchQueries.length)];
  const category = Math.random() < 0.5 ? categories[Math.floor(Math.random() * categories.length)] : null;
  const tagCount = Math.floor(Math.random() * 3) + 1;
  const selectedTags = [];
  
  for (let i = 0; i < tagCount; i++) {
    const tag = tags[Math.floor(Math.random() * tags.length)];
    if (!selectedTags.includes(tag)) {
      selectedTags.push(tag);
    }
  }
  
  let url = `${BASE_URL}/api/search?q=${encodeURIComponent(query)}`;
  if (category) {
    url += `&category=${encodeURIComponent(category)}`;
  }
  selectedTags.forEach(tag => {
    url += `&tags=${encodeURIComponent(tag)}`;
  });
  
  const response = http.get(url, { headers });
  
  const success = check(response, {
    'filtered search status is 200': (r) => r.status === 200,
    'filtered search has results': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true;
      } catch {
        return false;
      }
    },
  });
  
  searchLatency.add(response.timings.duration);
  searchSuccess.add(success ? 1 : 0);
  errorRate.add(response.status !== 200 ? 1 : 0);
}

function performSpecializedSearch() {
  const searchType = Math.random();
  
  if (searchType < 0.5) {
    // Claims search
    const query = searchQueries[Math.floor(Math.random() * searchQueries.length)];
    const claimType = Math.random() < 0.3 ? claimTypes[Math.floor(Math.random() * claimTypes.length)] : null;
    const claimStatus = Math.random() < 0.3 ? claimStatuses[Math.floor(Math.random() * claimStatuses.length)] : null;
    const province = Math.random() < 0.3 ? provinces[Math.floor(Math.random() * provinces.length)] : null;
    
    let url = `${BASE_URL}/api/search/claims?q=${encodeURIComponent(query)}`;
    if (claimType) url += `&claimType=${encodeURIComponent(claimType)}`;
    if (claimStatus) url += `&claimStatus=${encodeURIComponent(claimStatus)}`;
    if (province) url += `&province=${encodeURIComponent(province)}`;
    
    const response = http.get(url, { headers });
    
    const success = check(response, {
      'claims search status is 200': (r) => r.status === 200,
    });
    
    searchLatency.add(response.timings.duration);
    searchSuccess.add(success ? 1 : 0);
    errorRate.add(response.status !== 200 ? 1 : 0);
    
  } else {
    // Locations search
    const query = searchQueries[Math.floor(Math.random() * searchQueries.length)];
    const province = Math.random() < 0.5 ? provinces[Math.floor(Math.random() * provinces.length)] : null;
    
    let url = `${BASE_URL}/api/search/locations?q=${encodeURIComponent(query)}`;
    if (province) url += `&province=${encodeURIComponent(province)}`;
    
    const response = http.get(url, { headers });
    
    const success = check(response, {
      'locations search status is 200': (r) => r.status === 200,
    });
    
    searchLatency.add(response.timings.duration);
    searchSuccess.add(success ? 1 : 0);
    errorRate.add(response.status !== 200 ? 1 : 0);
  }
}

// Test other endpoints occasionally
export function facetsTest() {
  const response = http.get(`${BASE_URL}/api/facets`, { headers });
  
  check(response, {
    'facets status is 200': (r) => r.status === 200,
    'facets response is valid': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true && Array.isArray(body.facets);
      } catch {
        return false;
      }
    },
  });
}

export function categoryTest() {
  const category = categories[Math.floor(Math.random() * categories.length)];
  const response = http.get(`${BASE_URL}/api/search/category/${encodeURIComponent(category)}`, { headers });
  
  check(response, {
    'category search status is 200': (r) => r.status === 200,
  });
}

export function tagsTest() {
  const selectedTags = tags.slice(0, Math.floor(Math.random() * 3) + 1);
  
  const response = http.post(`${BASE_URL}/api/search/tags`, 
    JSON.stringify({ tags: selectedTags }), 
    { headers }
  );
  
  check(response, {
    'tags search status is 200': (r) => r.status === 200,
  });
}

// Health check test
export function healthTest() {
  const response = http.get(`${BASE_URL}/api/health`);
  
  check(response, {
    'health check status is 200': (r) => r.status === 200,
    'health check response is valid': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === 'OK';
      } catch {
        return false;
      }
    },
  });
}
