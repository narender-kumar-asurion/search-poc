# Performance Benchmarking

This directory contains performance benchmarking tools for the FS-Search application.

## Overview

The benchmarking suite includes:

- **Load Testing**: HTTP load testing with k6 to measure API performance under concurrent load
- **Index Performance**: Benchmarking of search provider indexing capabilities
- **Query Performance**: Measuring search query response times and throughput

## Prerequisites

### k6 Installation

**macOS:**
```bash
brew install k6
```

**Ubuntu/Debian:**
```bash
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### Environment Setup

1. Start search providers:
```bash
npm run docker:dev
```

2. Seed test data:
```bash
npm run seed
```

3. Start the API server:
```bash
npm run api
```

## Running Benchmarks

### Load Testing

Basic load test:
```bash
npm run bench:load
```

Custom load test:
```bash
k6 run --vus 8 --duration 2m scripts/benchmarks/load-test.js
```

With environment variables:
```bash
API_URL=http://localhost:3001 API_KEY=your-key k6 run scripts/benchmarks/load-test.js
```

### Index Performance

Run index performance benchmark:
```bash
npm run bench:index
```

### Combined Benchmarking

Run all benchmarks:
```bash
npm run bench:all
```

## Benchmark Configuration

### Load Test Configuration

The load test simulates realistic user behavior with:

- **70%** Software stack queries (prefix search)
- **20%** Filtered/faceted search
- **10%** Claims and locations search

**Load Pattern:**
- Ramp up to 4 users over 30s
- Stay at 4 users for 1m
- Ramp up to 8 users over 30s
- Stay at 8 users for 1m
- Ramp up to 16 users over 30s
- Stay at 16 users for 2m
- Ramp down to 0 users

**Performance Thresholds:**
- 95th percentile response time < 200ms
- Error rate < 5%
- Success rate > 95%

### Index Performance Configuration

Tests indexing performance for:
- Software stack documents (1,000 docs)
- Claims documents (500 docs)
- Location documents (300 docs)

Measures:
- Documents per second
- Memory usage
- Error rates
- Peak memory consumption

## Understanding Results

### Load Test Metrics

Key metrics to monitor:

- **http_req_duration**: Response time percentiles
- **http_req_failed**: Failed request rate
- **search_latency**: Custom search latency metric
- **search_success**: Search success rate
- **error_rate**: Overall error rate

### Index Performance Metrics

Results include:
- Indexing rate (documents/second)
- Memory usage (before/after/peak)
- Error count
- Total processing time

## Performance Targets

### API Performance Targets

| Metric | Target | Acceptable |
|--------|--------|------------|
| P95 Response Time | < 120ms | < 200ms |
| P99 Response Time | < 300ms | < 500ms |
| Error Rate | < 1% | < 5% |
| Throughput | > 100 RPS | > 50 RPS |

### Index Performance Targets

| Document Type | Target Rate | Acceptable Rate |
|---------------|-------------|-----------------|
| Software Stack | > 500 docs/sec | > 200 docs/sec |
| Claims | > 300 docs/sec | > 150 docs/sec |
| Locations | > 400 docs/sec | > 200 docs/sec |

## Continuous Performance Monitoring

### CI/CD Integration

Performance tests run automatically:
- On main branch pushes
- Weekly scheduled runs
- Before releases

### Alerts and Monitoring

Set up alerts for:
- Response time degradation (> 200ms P95)
- Error rate increase (> 5%)
- Throughput decrease (< 50 RPS)

## Troubleshooting Performance Issues

### High Response Times

1. Check search provider health
2. Monitor memory usage
3. Review index size and complexity
4. Check network latency

### Low Throughput

1. Verify connection pooling
2. Check rate limiting configuration
3. Monitor CPU and memory usage
4. Review concurrent request handling

### Index Performance Issues

1. Check available memory
2. Monitor disk I/O
3. Review document complexity
4. Verify search provider configuration

## Custom Benchmarks

### Creating Custom Load Tests

Copy and modify `load-test.js`:

```javascript
export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '2m', target: 10 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<150'],
    http_req_failed: ['rate<0.01'],
  },
};
```

### Creating Custom Index Benchmarks

Extend `index-performance.ts` with new document types or test scenarios.

## Results Analysis

### Comparing Providers

Use the benchmark results to compare:
- Typesense vs Meilisearch performance
- Index build times
- Memory usage patterns
- Query performance characteristics

### Performance Trends

Track performance over time:
- Index growth impact
- Configuration changes
- Provider version updates
- Infrastructure changes

## Best Practices

1. **Consistent Environment**: Always run benchmarks in the same environment
2. **Warm-up Period**: Allow search providers to warm up before testing
3. **Multiple Runs**: Run tests multiple times and average results
4. **Resource Monitoring**: Monitor CPU, memory, and disk during tests
5. **Baseline Establishment**: Establish performance baselines for comparison

## Integration with Monitoring

Results can be integrated with:
- Prometheus metrics
- Grafana dashboards
- Application Performance Monitoring (APM) tools
- Log aggregation systems
