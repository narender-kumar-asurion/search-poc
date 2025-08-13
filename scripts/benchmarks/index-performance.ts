#!/usr/bin/env ts-node

/**
 * Index Performance Benchmark
 * 
 * Measures indexing performance for different search providers
 * and document types.
 */

import { performance } from 'perf_hooks';
import * as dotenv from 'dotenv';
import { AdapterFactory } from '../../src/services/search/adapters/AdapterFactory';
import { SearchAdapter } from '../../src/services/search/adapters/SearchAdapter';
import { logger } from '../../src/lib/logger';
import fs from 'fs/promises';
import path from 'path';

// Load environment
dotenv.config();

interface BenchmarkResult {
  provider: string;
  documentType: string;
  documentCount: number;
  indexingTime: number; // milliseconds
  documentsPerSecond: number;
  memoryUsage: {
    before: NodeJS.MemoryUsage;
    after: NodeJS.MemoryUsage;
    peak: NodeJS.MemoryUsage;
  };
  errors: number;
  success: boolean;
}

interface BenchmarkSuite {
  timestamp: number;
  environment: {
    nodeVersion: string;
    platform: string;
    arch: string;
  };
  results: BenchmarkResult[];
  summary: {
    totalDocuments: number;
    totalTime: number;
    averageDocsPerSecond: number;
    fastestProvider: string;
    slowestProvider: string;
  };
}

class IndexBenchmark {
  private adapter?: SearchAdapter;
  private testCollections: string[] = [];

  async initialize(provider: 'typesense' | 'meilisearch') {
    console.log(`🚀 Initializing ${provider} adapter...`);
    
    process.env.SEARCH_PROVIDER = provider;
    this.adapter = await AdapterFactory.createFromEnvironment();
    
    console.log(`✅ ${provider} adapter initialized`);
  }

  async cleanup() {
    if (this.adapter) {
      console.log('🧹 Cleaning up test collections...');
      
      for (const collection of this.testCollections) {
        try {
          await this.adapter.deleteCollection(collection);
          console.log(`   Deleted collection: ${collection}`);
        } catch (error) {
          console.warn(`   Failed to delete collection ${collection}:`, error);
        }
      }
      
      this.testCollections = [];
    }
  }

  async benchmarkSoftwareStack(documentCount: number = 1000): Promise<BenchmarkResult> {
    if (!this.adapter) throw new Error('Adapter not initialized');

    const collectionName = `benchmark_software_${Date.now()}`;
    this.testCollections.push(collectionName);

    console.log(`📊 Benchmarking software stack indexing (${documentCount} documents)...`);

    // Generate test documents
    const documents = this.generateSoftwareStackDocuments(documentCount);
    
    // Create collection schema
    const schema = {
      name: collectionName,
      fields: [
        { name: 'id', type: 'string', facet: false, index: true },
        { name: 'name', type: 'string', facet: false, index: true },
        { name: 'description', type: 'string', facet: false, index: true },
        { name: 'category', type: 'string', facet: true, index: true },
        { name: 'tags', type: 'string[]', facet: true, index: true },
        { name: 'popularity_score', type: 'int32', facet: false, index: true },
        { name: 'document_type', type: 'string', facet: true, index: true },
      ],
      default_sorting_field: 'popularity_score',
    };

    const memoryBefore = process.memoryUsage();
    let peakMemory = memoryBefore;
    
    // Monitor memory usage during indexing
    const memoryMonitor = setInterval(() => {
      const current = process.memoryUsage();
      if (current.heapUsed > peakMemory.heapUsed) {
        peakMemory = current;
      }
    }, 100);

    try {
      // Create collection
      await this.adapter.createCollection(collectionName, schema);
      
      // Measure indexing time
      const startTime = performance.now();
      const result = await this.adapter.upsertDocuments(collectionName, documents);
      const endTime = performance.now();
      
      clearInterval(memoryMonitor);
      const memoryAfter = process.memoryUsage();
      
      const indexingTime = endTime - startTime;
      const documentsPerSecond = (documentCount / indexingTime) * 1000;
      
      console.log(`   ✅ Indexed ${result.succeeded}/${documentCount} documents in ${indexingTime.toFixed(2)}ms`);
      console.log(`   📈 Rate: ${documentsPerSecond.toFixed(2)} docs/sec`);
      
      return {
        provider: process.env.SEARCH_PROVIDER!,
        documentType: 'software_stack',
        documentCount: result.succeeded,
        indexingTime,
        documentsPerSecond,
        memoryUsage: {
          before: memoryBefore,
          after: memoryAfter,
          peak: peakMemory,
        },
        errors: result.failed,
        success: result.success,
      };
      
    } catch (error) {
      clearInterval(memoryMonitor);
      console.error(`   ❌ Indexing failed:`, error);
      
      return {
        provider: process.env.SEARCH_PROVIDER!,
        documentType: 'software_stack',
        documentCount: 0,
        indexingTime: 0,
        documentsPerSecond: 0,
        memoryUsage: {
          before: memoryBefore,
          after: process.memoryUsage(),
          peak: peakMemory,
        },
        errors: documentCount,
        success: false,
      };
    }
  }

  async benchmarkClaims(documentCount: number = 500): Promise<BenchmarkResult> {
    if (!this.adapter) throw new Error('Adapter not initialized');

    const collectionName = `benchmark_claims_${Date.now()}`;
    this.testCollections.push(collectionName);

    console.log(`📊 Benchmarking claims indexing (${documentCount} documents)...`);

    const documents = this.generateClaimsDocuments(documentCount);
    
    const schema = {
      name: collectionName,
      fields: [
        { name: 'id', type: 'string', facet: false, index: true },
        { name: 'claimId', type: 'string', facet: false, index: true },
        { name: 'claimNumber', type: 'string', facet: false, index: true },
        { name: 'claimType', type: 'string', facet: true, index: true },
        { name: 'claimStatus', type: 'string', facet: true, index: true },
        { name: 'consumerName', type: 'string', facet: false, index: true },
        { name: 'consumerAddState', type: 'string', facet: true, index: true },
        { name: 'amountRequested', type: 'float', facet: false, index: true },
        { name: 'dateAdded', type: 'int64', facet: false, index: true },
        { name: 'document_type', type: 'string', facet: true, index: true },
      ],
      default_sorting_field: 'dateAdded',
    };

    return this.performIndexBenchmark(collectionName, schema, documents, 'claims');
  }

  async benchmarkLocations(documentCount: number = 300): Promise<BenchmarkResult> {
    if (!this.adapter) throw new Error('Adapter not initialized');

    const collectionName = `benchmark_locations_${Date.now()}`;
    this.testCollections.push(collectionName);

    console.log(`📊 Benchmarking locations indexing (${documentCount} documents)...`);

    const documents = this.generateLocationDocuments(documentCount);
    
    const schema = {
      name: collectionName,
      fields: [
        { name: 'id', type: 'string', facet: false, index: true },
        { name: 'postalCode', type: 'string', facet: true, index: true },
        { name: 'provinceId', type: 'string', facet: true, index: true },
        { name: 'location', type: 'geopoint', facet: false, index: true },
        { name: 'document_type', type: 'string', facet: true, index: true },
      ],
      default_sorting_field: 'created_at',
    };

    return this.performIndexBenchmark(collectionName, schema, documents, 'locations');
  }

  private async performIndexBenchmark(
    collectionName: string, 
    schema: any, 
    documents: any[], 
    documentType: string
  ): Promise<BenchmarkResult> {
    if (!this.adapter) throw new Error('Adapter not initialized');

    const memoryBefore = process.memoryUsage();
    let peakMemory = memoryBefore;
    
    const memoryMonitor = setInterval(() => {
      const current = process.memoryUsage();
      if (current.heapUsed > peakMemory.heapUsed) {
        peakMemory = current;
      }
    }, 100);

    try {
      await this.adapter.createCollection(collectionName, schema);
      
      const startTime = performance.now();
      const result = await this.adapter.upsertDocuments(collectionName, documents);
      const endTime = performance.now();
      
      clearInterval(memoryMonitor);
      const memoryAfter = process.memoryUsage();
      
      const indexingTime = endTime - startTime;
      const documentsPerSecond = (result.succeeded / indexingTime) * 1000;
      
      console.log(`   ✅ Indexed ${result.succeeded}/${documents.length} documents in ${indexingTime.toFixed(2)}ms`);
      console.log(`   📈 Rate: ${documentsPerSecond.toFixed(2)} docs/sec`);
      
      return {
        provider: process.env.SEARCH_PROVIDER!,
        documentType,
        documentCount: result.succeeded,
        indexingTime,
        documentsPerSecond,
        memoryUsage: {
          before: memoryBefore,
          after: memoryAfter,
          peak: peakMemory,
        },
        errors: result.failed,
        success: result.success,
      };
      
    } catch (error) {
      clearInterval(memoryMonitor);
      console.error(`   ❌ Indexing failed:`, error);
      
      return {
        provider: process.env.SEARCH_PROVIDER!,
        documentType,
        documentCount: 0,
        indexingTime: 0,
        documentsPerSecond: 0,
        memoryUsage: {
          before: memoryBefore,
          after: process.memoryUsage(),
          peak: peakMemory,
        },
        errors: documents.length,
        success: false,
      };
    }
  }

  private generateSoftwareStackDocuments(count: number) {
    const categories = ['frontend', 'backend', 'database', 'devops', 'mobile', 'ai'];
    const tags = ['javascript', 'typescript', 'react', 'vue', 'angular', 'node', 'python', 'go', 'rust'];
    const names = ['Framework', 'Library', 'Tool', 'Service', 'Platform', 'SDK', 'API', 'Database'];
    
    return Array.from({ length: count }, (_, i) => ({
      id: `software-${i}`,
      name: `${names[i % names.length]} ${i}`,
      description: `Test software component ${i} for benchmarking purposes`,
      category: categories[i % categories.length],
      tags: tags.slice(0, (i % 4) + 1),
      popularity_score: Math.floor(Math.random() * 100),
      document_type: 'software_stack',
      created_at: Date.now() - (i * 1000),
    }));
  }

  private generateClaimsDocuments(count: number) {
    const claimTypes = ['warranty', 'extended', 'service', 'replacement'];
    const statuses = ['approved', 'pending', 'rejected', 'processing'];
    const provinces = ['ON', 'BC', 'QC', 'AB', 'MB', 'SK'];
    
    return Array.from({ length: count }, (_, i) => ({
      id: `claim-${i}`,
      claimId: `CLM-${i.toString().padStart(6, '0')}`,
      claimNumber: `WRN${i}`,
      claimType: claimTypes[i % claimTypes.length],
      claimStatus: statuses[i % statuses.length],
      consumerName: `Test Consumer ${i}`,
      consumerAddState: provinces[i % provinces.length],
      amountRequested: Math.floor(Math.random() * 1000) + 100,
      dateAdded: Date.now() - (i * 60000), // 1 minute apart
      document_type: 'claim',
    }));
  }

  private generateLocationDocuments(count: number) {
    const provinces = ['ON', 'BC', 'QC', 'AB', 'MB', 'SK', 'NS', 'NB'];
    
    return Array.from({ length: count }, (_, i) => ({
      id: `location-${i}`,
      postalCode: `${String.fromCharCode(65 + (i % 26))}${(i % 10)}${String.fromCharCode(65 + (i % 26))} ${(i % 10)}${String.fromCharCode(65 + (i % 26))}${(i % 10)}`,
      provinceId: provinces[i % provinces.length],
      location: [
        43.6532 + (Math.random() - 0.5) * 10, // Latitude around Toronto
        -79.3832 + (Math.random() - 0.5) * 10, // Longitude around Toronto
      ],
      document_type: 'location',
      created_at: Date.now() - (i * 1000),
    }));
  }
}

async function runBenchmarkSuite(): Promise<void> {
  const suite: BenchmarkSuite = {
    timestamp: Date.now(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    results: [],
    summary: {
      totalDocuments: 0,
      totalTime: 0,
      averageDocsPerSecond: 0,
      fastestProvider: '',
      slowestProvider: '',
    },
  };

  const providers: ('typesense' | 'meilisearch')[] = ['typesense'];
  
  // Add Meilisearch if configured
  if (process.env.MEILISEARCH_HOST) {
    providers.push('meilisearch');
  }

  console.log('🚀 Starting index performance benchmark suite...');
  console.log(`📋 Testing providers: ${providers.join(', ')}`);
  console.log('');

  for (const provider of providers) {
    const benchmark = new IndexBenchmark();
    
    try {
      await benchmark.initialize(provider);
      
      // Run benchmarks for different document types
      const softwareResult = await benchmark.benchmarkSoftwareStack(1000);
      const claimsResult = await benchmark.benchmarkClaims(500);
      const locationsResult = await benchmark.benchmarkLocations(300);
      
      suite.results.push(softwareResult, claimsResult, locationsResult);
      
      // Add to totals
      suite.summary.totalDocuments += softwareResult.documentCount + claimsResult.documentCount + locationsResult.documentCount;
      suite.summary.totalTime += softwareResult.indexingTime + claimsResult.indexingTime + locationsResult.indexingTime;
      
    } catch (error) {
      console.error(`❌ Benchmark failed for ${provider}:`, error);
    } finally {
      await benchmark.cleanup();
    }
    
    console.log('');
  }

  // Calculate summary
  if (suite.summary.totalTime > 0) {
    suite.summary.averageDocsPerSecond = (suite.summary.totalDocuments / suite.summary.totalTime) * 1000;
  }

  // Find fastest and slowest providers
  const providerSpeeds = new Map<string, number>();
  for (const result of suite.results) {
    if (!providerSpeeds.has(result.provider)) {
      providerSpeeds.set(result.provider, 0);
    }
    providerSpeeds.set(result.provider, providerSpeeds.get(result.provider)! + result.documentsPerSecond);
  }

  const sortedProviders = Array.from(providerSpeeds.entries()).sort((a, b) => b[1] - a[1]);
  if (sortedProviders.length > 0) {
    suite.summary.fastestProvider = sortedProviders[0]![0];
    suite.summary.slowestProvider = sortedProviders[sortedProviders.length - 1]![0];
  }

  // Save results
  const resultsDir = path.join(__dirname, 'results');
  await fs.mkdir(resultsDir, { recursive: true });
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsFile = path.join(resultsDir, `index-benchmark-${timestamp}.json`);
  
  await fs.writeFile(resultsFile, JSON.stringify(suite, null, 2));
  
  // Print summary
  console.log('📊 BENCHMARK SUMMARY');
  console.log('===================');
  console.log(`Total documents indexed: ${suite.summary.totalDocuments}`);
  console.log(`Total time: ${suite.summary.totalTime.toFixed(2)}ms`);
  console.log(`Average rate: ${suite.summary.averageDocsPerSecond.toFixed(2)} docs/sec`);
  if (suite.summary.fastestProvider) {
    console.log(`Fastest provider: ${suite.summary.fastestProvider}`);
  }
  if (suite.summary.slowestProvider && suite.summary.slowestProvider !== suite.summary.fastestProvider) {
    console.log(`Slowest provider: ${suite.summary.slowestProvider}`);
  }
  console.log(`Results saved to: ${resultsFile}`);
  console.log('');

  // Print detailed results
  console.log('📋 DETAILED RESULTS');
  console.log('===================');
  for (const result of suite.results) {
    console.log(`${result.provider} - ${result.documentType}:`);
    console.log(`  Documents: ${result.documentCount}`);
    console.log(`  Time: ${result.indexingTime.toFixed(2)}ms`);
    console.log(`  Rate: ${result.documentsPerSecond.toFixed(2)} docs/sec`);
    console.log(`  Memory: ${Math.round(result.memoryUsage.peak.heapUsed / 1024 / 1024)}MB peak`);
    console.log(`  Errors: ${result.errors}`);
    console.log(`  Success: ${result.success ? '✅' : '❌'}`);
    console.log('');
  }
}

// Main execution
if (require.main === module) {
  runBenchmarkSuite()
    .then(() => {
      console.log('✅ Benchmark suite completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Benchmark suite failed:', error);
      process.exit(1);
    });
}
