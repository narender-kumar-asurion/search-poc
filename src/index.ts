import { seedData } from './data';
import { searchService } from './services/search/SearchService';

/**
 * Main application entry point
 * This file demonstrates the complete workflow of the search service
 */
async function main(): Promise<void> {
  try {
    console.log('=== Search Service Demo ===\n');

    // Check if we should seed data first
    const args = process.argv.slice(2);
    const shouldSeed = args.includes('--seed') || args.includes('-s');

    if (shouldSeed) {
      console.log('Seeding data first...\n');
      await seedData();
      console.log('\n');
    }

    // Run search demonstration
    await demonstrateSearch();

    console.log('\nNext steps:');
    console.log('   - Start the API server: npm run api');
    console.log('   - Start the frontend: npm run frontend');
    console.log('   - Try the full-stack application\n');

  } catch (error: any) {
    console.error('Application failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('   - Make sure Typesense server is running');
    console.error('   - Check your connection settings');
    console.error('   - Verify the collection exists (run: npm run seed)');
    process.exit(1);
  }
}

/**
 * Demo function using the service layer
 */
async function demonstrateSearch(): Promise<void> {
  try {
    console.log('\n=== Search Service Demo ===\n');

    // 1. Basic text search
    console.log('1. Basic text search for "javascript":');
    const jsResults = await searchService.search({ query: 'javascript' });
    if (jsResults.success) {
      jsResults.results.slice(0, 3).forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.name} (${result.category})`);
        console.log(`      ${result.description.substring(0, 100)}...`);
      });
    }

    // 2. Category search
    console.log('\n2. Filter by category "Database":');
    const dbResults = await searchService.searchByCategory('Database');
    if (dbResults.success) {
      dbResults.results.slice(0, 3).forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.name}`);
      });
    }

    // 3. Tag search
    console.log('\n3. Search by tags ["devops", "deployment"]:');
    const tagResults = await searchService.searchByTags(['devops', 'deployment']);
    if (tagResults.success) {
      tagResults.results.slice(0, 3).forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.name} - Tags: ${result.tags.join(', ')}`);
      });
    }

    // 4. Facets
    console.log('\n4. Available facets:');
    const facetsResult = await searchService.getFacets();
    if (facetsResult.success && facetsResult.facets.length > 0) {
      const categoryFacet = facetsResult.facets.find(f => f.field === 'category');
      if (categoryFacet) {
        console.log('   Categories:');
        categoryFacet.values.forEach((value: any) => {
          console.log(`     - ${value.value} (${value.count})`);
        });
      }
    }

    console.log('\nDemo completed successfully!');

  } catch (error) {
    console.error('Demo failed:', error);
  }
}

/**
 * Export main functions for use in other modules
 */
export { main, seedData, demonstrateSearch };

// Run main function if this file is executed directly
if (require.main === module) {
  main();
}
