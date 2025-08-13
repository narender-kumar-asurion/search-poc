import { execSync } from 'child_process';
import * as dotenv from 'dotenv';

// Load test environment
dotenv.config({ path: '.env.test' });

export default async function globalSetup() {
  console.log('🚀 Setting up test environment...');
  
  // Check if we need to start test search providers
  const searchProvider = process.env.SEARCH_PROVIDER || 'typesense';
  
  if (process.env.CI === 'true') {
    console.log('Running in CI environment - search providers should be pre-configured');
    return;
  }
  
  // For local development, check if services are available
  try {
    if (searchProvider === 'typesense') {
      const typesenseHost = process.env.TYPESENSE_HOST || 'localhost';
      const typesensePort = process.env.TYPESENSE_PORT || '8108';
      console.log(`Checking Typesense availability at ${typesenseHost}:${typesensePort}...`);
      
      // Simple health check
      execSync(`curl -f http://${typesenseHost}:${typesensePort}/health`, { 
        stdio: 'ignore',
        timeout: 5000 
      });
      console.log('✅ Typesense is available');
    }
  } catch (error) {
    console.warn('⚠️  Search provider not available - some integration tests may fail');
    console.log('To run full integration tests, start search providers with: npm run docker:dev');
  }
}
