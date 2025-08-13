export default async function globalTeardown() {
  console.log('🧹 Cleaning up test environment...');
  
  // Clean up any test collections or data
  // This will be called after all tests complete
  
  if (process.env.CLEANUP_TEST_DATA === 'true') {
    console.log('Cleaning up test search collections...');
    // Add cleanup logic here if needed
  }
  
  console.log('✅ Test cleanup completed');
}
