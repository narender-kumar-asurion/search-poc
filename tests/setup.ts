import * as dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test defaults
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce noise in tests
process.env.API_AUTH_ENABLED = 'false'; // Disable auth for tests by default

// Global test utilities
declare global {
  var testUtils: {
    delay: (ms: number) => Promise<void>;
    generateId: () => string;
  };
}

globalThis.testUtils = {
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  generateId: () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
};
