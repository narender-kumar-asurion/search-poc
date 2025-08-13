#!/usr/bin/env ts-node

import { performance } from 'perf_hooks';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { initializeAdapter } from '../../src/adapters/factory';
import { createModuleLogger } from '../../src/lib/logger';

const logger = createModuleLogger('CustomBench');

interface BenchmarkResult {
  operation: string;
  duration: number;
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  metadata?: Record<string, any>;
}

interface BenchmarkSuite {
  name: string;
  provider: string;
  timestamp: string;
  results: BenchmarkResult[];
  summary: {
    totalDuration: number;
    averageDuration: number;
    peakMemory: number;
    operations: number;
  };
}

class SearchBenchmark {
  private adapter: any;
  private results: BenchmarkResult[] = [];
  private startTime: number = 0;

  async initialize() {
    logger.info('Initializing search benchmark...');
    this.adapter = await initializeAdapter();
    logger.info({ provider: this.adapter.getProviderName() }, 'Adapter initialized');
  }

  async runBenchmarks(): Promise<BenchmarkSuite> {
    const suiteStartTime = performance.now();
    
    logger.info('Starting benchmark suite...');

    // Index performance tests
    await this.benchmarkIndexing();

    // Search performance tests
    await this.benchmarkSearches();

    // Facet performance tests
    await this.benchmarkFacets();

    // Suggestion performance tests
    await this.benchmarkSuggestions();

    const totalDuration = performance.now() - suiteStartTime;

    const suite: BenchmarkSuite = {
      name: 'Search API Benchmark',
      provider: this.adapter.getProviderName(),
      timestamp: new Date().toISOString(),
      results: this.results,
      summary: {
        totalDuration,
        averageDuration: this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length,
        peakMemory: Math.max(...this.results.map(r => r.memory.heapUsed)),
        operations: this.results.length,
      },
    };

    logger.info(suite.summary, 'Benchmark suite completed');
    return suite;
  }

  private async benchmarkIndexing() {
    logger.info('Benchmarking indexing operations...');

    // Load test data
    const claimsData = this.loadTestData('claims');
    const locationsData = this.loadTestData('locations');

    // Test schema creation
    await this.measureOperation('schema_creation_claims', async () => {
      await this.adapter.upsertSchema('bench_claims', {
        version: 1,
        fields: [
          { name: 'id', type: 'keyword', required: true },
          { name: 'claim_id', type: 'keyword', required: true, facet: true },
          { name: 'customer_name', type: 'text', required: true },
          { name: 'status', type: 'keyword', required: true, facet: true },
          { name: 'amount', type: 'number', required: true },
          { name: 'description', type: 'text', required: false },
        ],
        settings: {
          searchable: ['customer_name', 'description'],
          filterable: ['status', 'claim_id'],
          sortable: ['amount', 'claim_id'],
        },
      });
    });

    // Test bulk indexing - small batch
    await this.measureOperation('bulk_index_small_batch', async () => {
      const smallBatch = claimsData.slice(0, 10);
      await this.adapter.indexDocuments('bench_claims', {
        op: 'upsert',
        idField: 'id',
        documents: smallBatch,
      });
    }, { batchSize: 10 });

    // Test bulk indexing - medium batch
    await this.measureOperation('bulk_index_medium_batch', async () => {
      const mediumBatch = claimsData.slice(0, 25);
      await this.adapter.indexDocuments('bench_claims', {
        op: 'upsert',
        idField: 'id',
        documents: mediumBatch,
      });
    }, { batchSize: 25 });

    // Test bulk indexing - full dataset
    await this.measureOperation('bulk_index_full_dataset', async () => {
      await this.adapter.indexDocuments('bench_claims', {
        op: 'upsert',
        idField: 'id',
        documents: claimsData,
      });
    }, { batchSize: claimsData.length });

    // Wait for indexing to complete
    await this.sleep(2000);

    // Test locations indexing
    await this.measureOperation('bulk_index_locations', async () => {
      await this.adapter.upsertSchema('bench_locations', {
        version: 1,
        fields: [
          { name: 'zip', type: 'keyword', required: true, facet: true },
          { name: 'lat', type: 'number', required: true },
          { name: 'lon', type: 'number', required: true },
          { name: 'city', type: 'text', required: false },
          { name: 'state', type: 'keyword', required: false, facet: true },
        ],
      });

      await this.adapter.indexDocuments('bench_locations', {
        op: 'upsert',
        idField: 'zip',
        documents: locationsData,
      });
    }, { documentCount: locationsData.length });

    await this.sleep(1000);
  }

  private async benchmarkSearches() {
    logger.info('Benchmarking search operations...');

    const searchTerms = ['water', 'fire', 'collision', 'water damage', 'vehicle'];
    
    // Cold searches (first time)
    for (const term of searchTerms) {
      await this.measureOperation(`search_cold_${term.replace(' ', '_')}`, async () => {
        await this.adapter.search('bench_claims', {
          text: term,
          pagination: { page: 1, perPage: 10 },
        });
      }, { query: term, type: 'cold' });
    }

    // Warm searches (repeated)
    for (const term of searchTerms) {
      await this.measureOperation(`search_warm_${term.replace(' ', '_')}`, async () => {
        await this.adapter.search('bench_claims', {
          text: term,
          pagination: { page: 1, perPage: 10 },
        });
      }, { query: term, type: 'warm' });
    }

    // Complex filtered searches
    await this.measureOperation('search_filtered_complex', async () => {
      await this.adapter.search('bench_claims', {
        text: 'damage',
        filters: {
          and: [
            { field: 'status', op: 'in', value: ['OPEN', 'PENDING'] },
            { range: { field: 'amount', gte: 1000, lte: 50000 } },
          ],
        },
        sort: [{ field: 'amount', order: 'desc' }],
        pagination: { page: 1, perPage: 20 },
      });
    });

    // Large result set
    await this.measureOperation('search_large_results', async () => {
      await this.adapter.search('bench_claims', {
        text: '*',
        pagination: { page: 1, perPage: 100 },
      });
    }, { resultLimit: 100 });

    // Pagination performance
    for (let page = 1; page <= 3; page++) {
      await this.measureOperation(`search_pagination_page_${page}`, async () => {
        await this.adapter.search('bench_claims', {
          text: 'claim',
          pagination: { page, perPage: 10 },
        });
      }, { page });
    }
  }

  private async benchmarkFacets() {
    logger.info('Benchmarking facet operations...');

    // Single facet
    await this.measureOperation('facets_single', async () => {
      await this.adapter.search('bench_claims', {
        text: '*',
        facets: [{ field: 'status', limit: 10 }],
        pagination: { page: 1, perPage: 0 },
      });
    });

    // Multiple facets
    await this.measureOperation('facets_multiple', async () => {
      await this.adapter.search('bench_claims', {
        text: '*',
        facets: [
          { field: 'status', limit: 10 },
          { field: 'claim_id', limit: 20 },
        ],
        pagination: { page: 1, perPage: 0 },
      });
    });

    // Facets with search
    await this.measureOperation('facets_with_search', async () => {
      await this.adapter.search('bench_claims', {
        text: 'water damage',
        facets: [
          { field: 'status', limit: 10 },
          { field: 'claim_id', limit: 20 },
        ],
        pagination: { page: 1, perPage: 10 },
      });
    });
  }

  private async benchmarkSuggestions() {
    logger.info('Benchmarking suggestion operations...');

    const prefixes = ['wat', 'fir', 'col', 'ste', 'joh'];

    for (const prefix of prefixes) {
      await this.measureOperation(`suggest_${prefix}`, async () => {
        await this.adapter.suggest({
          index: 'bench_claims',
          q: prefix,
          fields: ['customer_name', 'description'],
          limit: 8,
        });
      }, { prefix });
    }

    // Long prefix (more specific)
    await this.measureOperation('suggest_long_prefix', async () => {
      await this.adapter.suggest({
        index: 'bench_claims',
        q: 'water dam',
        fields: ['description'],
        limit: 5,
      });
    });
  }

  private async measureOperation(
    name: string,
    operation: () => Promise<any>,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    // Clear memory and wait
    if (global.gc) {
      global.gc();
    }
    await this.sleep(100);

    const startMemory = process.memoryUsage();
    const startTime = performance.now();

    try {
      await operation();
      const endTime = performance.now();
      const endMemory = process.memoryUsage();

      const result: BenchmarkResult = {
        operation: name,
        duration: endTime - startTime,
        memory: {
          rss: endMemory.rss - startMemory.rss,
          heapUsed: endMemory.heapUsed,
          heapTotal: endMemory.heapTotal,
          external: endMemory.external,
        },
        metadata,
      };

      this.results.push(result);
      
      logger.debug({
        operation: name,
        duration: `${result.duration.toFixed(2)}ms`,
        heapUsed: `${(result.memory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      }, 'Operation completed');

    } catch (error) {
      logger.error({ error, operation: name }, 'Benchmark operation failed');
      throw error;
    }
  }

  private loadTestData(collection: string): any[] {
    try {
      const dataPath = join(process.cwd(), 'src', 'data', 'seeds', `${collection}.json`);
      return JSON.parse(readFileSync(dataPath, 'utf8'));
    } catch (error) {
      logger.warn({ error, collection }, 'Failed to load test data');
      return [];
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Report generation
function generateReport(suite: BenchmarkSuite): void {
  const reportDir = join(process.cwd(), 'artifacts');
  if (!existsSync(reportDir)) {
    mkdirSync(reportDir, { recursive: true });
  }

  // Write JSON report
  const jsonPath = join(reportDir, `benchmark-${Date.now()}.json`);
  writeFileSync(jsonPath, JSON.stringify(suite, null, 2));

  // Generate text report
  const textReport = generateTextReport(suite);
  const textPath = join(reportDir, `benchmark-report-${Date.now()}.txt`);
  writeFileSync(textPath, textReport);

  logger.info({ jsonPath, textPath }, 'Benchmark reports generated');
}

function generateTextReport(suite: BenchmarkSuite): string {
  const lines: string[] = [];
  
  lines.push('='.repeat(60));
  lines.push(`Search API Benchmark Report`);
  lines.push(`Provider: ${suite.provider}`);
  lines.push(`Timestamp: ${suite.timestamp}`);
  lines.push('='.repeat(60));
  lines.push('');

  // Summary
  lines.push('SUMMARY');
  lines.push('-'.repeat(30));
  lines.push(`Total Duration: ${suite.summary.totalDuration.toFixed(2)}ms`);
  lines.push(`Average Operation: ${suite.summary.averageDuration.toFixed(2)}ms`);
  lines.push(`Peak Memory: ${(suite.summary.peakMemory / 1024 / 1024).toFixed(2)}MB`);
  lines.push(`Operations: ${suite.summary.operations}`);
  lines.push('');

  // Group results by operation type
  const groups = groupResults(suite.results);
  
  for (const [groupName, results] of Object.entries(groups)) {
    lines.push(groupName.toUpperCase());
    lines.push('-'.repeat(30));
    
    for (const result of results) {
      const duration = result.duration.toFixed(2).padStart(8);
      const memory = (result.memory.heapUsed / 1024 / 1024).toFixed(1).padStart(6);
      lines.push(`${result.operation.padEnd(30)} ${duration}ms  ${memory}MB`);
    }
    lines.push('');
  }

  // Performance insights
  lines.push('PERFORMANCE INSIGHTS');
  lines.push('-'.repeat(30));
  
  const coldSearches = suite.results.filter(r => r.metadata?.type === 'cold');
  const warmSearches = suite.results.filter(r => r.metadata?.type === 'warm');
  
  if (coldSearches.length && warmSearches.length) {
    const avgCold = coldSearches.reduce((sum, r) => sum + r.duration, 0) / coldSearches.length;
    const avgWarm = warmSearches.reduce((sum, r) => sum + r.duration, 0) / warmSearches.length;
    const improvement = ((avgCold - avgWarm) / avgCold * 100);
    
    lines.push(`Cold vs Warm Search Performance:`);
    lines.push(`  Cold: ${avgCold.toFixed(2)}ms average`);
    lines.push(`  Warm: ${avgWarm.toFixed(2)}ms average`);
    lines.push(`  Improvement: ${improvement.toFixed(1)}% faster when warm`);
  }

  const indexOps = suite.results.filter(r => r.operation.includes('bulk_index'));
  if (indexOps.length) {
    lines.push(`\nIndexing Performance:`);
    for (const op of indexOps) {
      const docsPerSec = op.metadata?.batchSize ? 
        (op.metadata.batchSize / (op.duration / 1000)).toFixed(0) : 'N/A';
      lines.push(`  ${op.operation}: ${docsPerSec} docs/sec`);
    }
  }

  return lines.join('\n');
}

function groupResults(results: BenchmarkResult[]): Record<string, BenchmarkResult[]> {
  const groups: Record<string, BenchmarkResult[]> = {};
  
  for (const result of results) {
    const groupKey = result.operation.split('_')[0];
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(result);
  }
  
  return groups;
}

// CLI execution
async function main() {
  const benchmark = new SearchBenchmark();
  
  try {
    await benchmark.initialize();
    const suite = await benchmark.runBenchmarks();
    
    // Generate reports
    generateReport(suite);
    
    // Console summary
    console.log('\n' + '='.repeat(50));
    console.log('BENCHMARK COMPLETED');
    console.log('='.repeat(50));
    console.log(`Provider: ${suite.provider}`);
    console.log(`Total Duration: ${suite.summary.totalDuration.toFixed(2)}ms`);
    console.log(`Average Operation: ${suite.summary.averageDuration.toFixed(2)}ms`);
    console.log(`Peak Memory: ${(suite.summary.peakMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Operations: ${suite.summary.operations}`);
    console.log('\nReports saved to artifacts/ directory');

    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Benchmark failed');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { SearchBenchmark, BenchmarkResult, BenchmarkSuite };
