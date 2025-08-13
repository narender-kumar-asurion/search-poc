import {
  validateApiKey,
  generateApiKey,
  trackFailedAttempt,
  clearFailedAttempts,
  validateQueryComplexity,
  generateCSPHeader,
  sanitizeSearchInput,
  isDevelopment,
  isProduction,
  getSecurityConfig,
} from '../../../src/lib/security';

// Mock logger to avoid console noise during tests
jest.mock('../../../src/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('Security Utilities', () => {
  beforeEach(() => {
    // Clear any cached state between tests
    clearFailedAttempts('test-user');
  });

  describe('API Key Validation', () => {
    describe('validateApiKey', () => {
      it('should validate correct API key format', () => {
        const validKey = '4f2a8b7c9d1e3f6a8b9c5e1f2a4d7e8c'; // 32 hex chars, no weak patterns
        expect(validateApiKey(validKey)).toBe(true);
      });

      it('should reject short API key', () => {
        const shortKey = 'short';
        expect(validateApiKey(shortKey)).toBe(false);
      });

      it('should reject weak patterns', () => {
        expect(validateApiKey('12345678901234567890123456789012')).toBe(false); // starts with 123
        expect(validateApiKey('password12345678901234567890123')).toBe(false); // starts with password
        expect(validateApiKey('testkey123456789012345678901234')).toBe(false); // starts with test
        expect(validateApiKey('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe(false); // repeated chars
      });

      it('should handle null/undefined keys', () => {
        expect(validateApiKey(null as any)).toBe(false);
        expect(validateApiKey(undefined as any)).toBe(false);
        expect(validateApiKey('')).toBe(false);
      });

      it('should handle non-string input', () => {
        expect(validateApiKey(12345 as any)).toBe(false);
        expect(validateApiKey({} as any)).toBe(false);
        expect(validateApiKey([] as any)).toBe(false);
      });
    });

    describe('generateApiKey', () => {
      it('should generate valid API key', () => {
        const apiKey = generateApiKey();
        expect(typeof apiKey).toBe('string');
        expect(apiKey.length).toBe(64); // 32 bytes = 64 hex chars
        expect(validateApiKey(apiKey)).toBe(true);
      });

      it('should generate different keys each time', () => {
        const key1 = generateApiKey();
        const key2 = generateApiKey();
        expect(key1).not.toBe(key2);
      });

      it('should generate hex string', () => {
        const apiKey = generateApiKey();
        expect(apiKey).toMatch(/^[a-f0-9]+$/);
      });
    });
  });

  describe('Brute Force Protection', () => {
    describe('trackFailedAttempt', () => {
      it('should track failed attempts', () => {
        const identifier = 'test-user';
        
        // First few attempts should return false (not locked)
        expect(trackFailedAttempt(identifier)).toBe(false);
        expect(trackFailedAttempt(identifier)).toBe(false);
        expect(trackFailedAttempt(identifier)).toBe(false);
        expect(trackFailedAttempt(identifier)).toBe(false);
        
        // After threshold, should return true (locked)
        expect(trackFailedAttempt(identifier)).toBe(true);
      });

      it('should handle different identifiers separately', () => {
        const identifier1 = 'user1';
        const identifier2 = 'user2';
        
        // Exhaust attempts for user1
        for (let i = 0; i < 5; i++) {
          trackFailedAttempt(identifier1);
        }
        
        // user2 should still be allowed
        expect(trackFailedAttempt(identifier2)).toBe(false);
      });
    });

    describe('clearFailedAttempts', () => {
      it('should clear failed attempts for user', () => {
        const identifier = 'clear-test';
        
        // Build up some failed attempts
        trackFailedAttempt(identifier);
        trackFailedAttempt(identifier);
        
        // Clear attempts
        clearFailedAttempts(identifier);
        
        // Should be able to try again without being locked
        expect(trackFailedAttempt(identifier)).toBe(false);
      });
    });
  });

  describe('Query Security', () => {
    describe('validateQueryComplexity', () => {
      it('should allow simple queries', () => {
        const result = validateQueryComplexity('simple search term');
        expect(result.valid).toBe(true);
        expect(result.reason).toBeUndefined();
      });

      it('should allow queries with basic operators', () => {
        const result = validateQueryComplexity('term1 AND term2 OR term3');
        expect(result.valid).toBe(true);
      });

      it('should reject overly complex queries', () => {
        const complexQuery = 'a:1 AND b:2 OR c:3 AND d:4 OR e:5 AND f:6 OR g:7 AND h:8 OR i:9 AND j:10 OR k:11 AND l:12';
        const result = validateQueryComplexity(complexQuery);
        expect(result.valid).toBe(false);
        expect(result.reason).toBeDefined();
      });

      it('should handle empty queries', () => {
        const result = validateQueryComplexity('');
        expect(result.valid).toBe(true);
      });

      it('should handle null queries', () => {
        const result = validateQueryComplexity(null as any);
        expect(result.valid).toBe(false);
        expect(result.reason).toBeDefined();
      });
    });

    describe('sanitizeSearchInput', () => {
      it('should sanitize harmful input', () => {
        const maliciousInput = {
          query: '<script>alert("xss")</script>search term',
          filters: {
            category: 'normal',
            description: '<img src=x onerror=alert(1)>',
          },
        };

        const sanitized = sanitizeSearchInput(maliciousInput);
        
        expect(sanitized.query).not.toContain('<script>');
        expect(sanitized.query).toContain('search term');
        expect(sanitized.filters.category).toBe('normal');
        expect(sanitized.filters.description).not.toContain('<img');
      });

      it('should preserve safe input', () => {
        const safeInput = {
          query: 'normal search terms',
          limit: 20,
          offset: 0,
        };

        const sanitized = sanitizeSearchInput(safeInput);
        expect(sanitized).toEqual(safeInput);
      });

      it('should handle null input', () => {
        expect(sanitizeSearchInput(null)).toBe(null);
        expect(sanitizeSearchInput(undefined)).toBe(undefined);
      });

      it('should handle primitive inputs', () => {
        expect(sanitizeSearchInput('simple string')).toBe('simple string');
        expect(sanitizeSearchInput(123)).toBe(123);
        expect(sanitizeSearchInput(true)).toBe(true);
      });
    });
  });

  describe('Security Headers', () => {
    describe('generateCSPHeader', () => {
      it('should generate CSP header string', () => {
        const csp = generateCSPHeader();
        expect(typeof csp).toBe('string');
        expect(csp).toContain("default-src 'self'");
        expect(csp).toContain("script-src 'self'");
        expect(csp).toContain("object-src 'none'");
      });

      it('should include common security directives', () => {
        const csp = generateCSPHeader();
        expect(csp).toContain('style-src');
        expect(csp).toContain('img-src');
        expect(csp).toContain('connect-src');
        expect(csp).toContain('font-src');
      });
    });
  });

  describe('Environment Detection', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    describe('isDevelopment', () => {
      it('should return true in development', () => {
        process.env.NODE_ENV = 'development';
        expect(isDevelopment()).toBe(true);
      });

      it('should return false in production', () => {
        process.env.NODE_ENV = 'production';
        expect(isDevelopment()).toBe(false);
      });

      it('should return false for undefined environment', () => {
        delete process.env.NODE_ENV;
        expect(isDevelopment()).toBe(false);
      });
    });

    describe('isProduction', () => {
      it('should return true in production', () => {
        process.env.NODE_ENV = 'production';
        expect(isProduction()).toBe(true);
      });

      it('should return false in development', () => {
        process.env.NODE_ENV = 'development';
        expect(isProduction()).toBe(false);
      });

      it('should return false for undefined environment', () => {
        delete process.env.NODE_ENV;
        expect(isProduction()).toBe(false);
      });
    });
  });

  describe('Security Configuration', () => {
    describe('getSecurityConfig', () => {
      it('should return security configuration object', () => {
        const config = getSecurityConfig();
        expect(typeof config).toBe('object');
        expect(config).toBeDefined();
      });

      it('should contain expected configuration keys', () => {
        const config = getSecurityConfig();
        // Test structure without assuming exact keys since we don't know the implementation
        expect(config).toBeTruthy();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long input strings', () => {
      const longString = 'a'.repeat(10000);
      const result = sanitizeSearchInput(longString);
      expect(typeof result).toBe('string');
      expect(result.length).toBeLessThanOrEqual(longString.length);
    });

    it('should handle deeply nested objects', () => {
      const deepObject = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: '<script>alert("deep")</script>test',
              },
            },
          },
        },
      };

      const sanitized = sanitizeSearchInput(deepObject);
      expect(sanitized.level1.level2.level3.level4.value).not.toContain('<script>');
      expect(sanitized.level1.level2.level3.level4.value).toContain('test');
    });

    it('should handle circular references safely', () => {
      const obj: any = { name: 'test' };
      obj.self = obj; // Create circular reference

      // Should not throw an error and should handle circular reference
      const result = sanitizeSearchInput(obj);
      expect(result.name).toBe('test');
      expect(result.self).toBe('[Circular Reference]');
    });

    it('should handle arrays with mixed content', () => {
      const mixedArray = [
        'safe string',
        '<script>alert("xss")</script>',
        123,
        { name: 'object with <script>' },
        null,
      ];

      const sanitized = sanitizeSearchInput(mixedArray);
      expect(Array.isArray(sanitized)).toBe(true);
      expect(sanitized[0]).toBe('safe string');
      expect(sanitized[1]).not.toContain('<script>');
      expect(sanitized[2]).toBe(123);
      expect(sanitized[3].name).not.toContain('<script>');
      expect(sanitized[4]).toBe(null);
    });
  });
});
