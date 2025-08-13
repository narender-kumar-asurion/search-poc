import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from './logger';

/**
 * Security utility functions and middleware
 */

// Constants for security
const MAX_REQUEST_SIZE = '1mb';
const API_KEY_MIN_LENGTH = 32;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 100;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes
const SUSPICIOUS_QUERY_LENGTH = 500;
const MAX_QUERY_COMPLEXITY = 10; // max number of operators/filters

/**
 * Validate API key format and strength
 */
export function validateApiKey(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }

  // Check minimum length
  if (apiKey.length < API_KEY_MIN_LENGTH) {
    return false;
  }

  // Check for common weak patterns
  const weakPatterns = [
    /^123+/,
    /^abc+/i,
    /^password/i,
    /^test/i,
    /(.)\1{4,}/, // Repeated characters
  ];

  return !weakPatterns.some(pattern => pattern.test(apiKey));
}

/**
 * Generate a secure API key
 */
export function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Secure rate limiting configuration
 */
export const createRateLimit = (windowMs: number = RATE_LIMIT_WINDOW_MS, max: number = RATE_LIMIT_MAX_REQUESTS) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks and static assets
      return req.path === '/api/health' || req.path.startsWith('/static/');
    },
    keyGenerator: (req) => {
      // Use IP and User-Agent for more accurate rate limiting
      return `${req.ip}-${req.get('User-Agent') || 'unknown'}`;
    },
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        extra: {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method,
        },
      });

      res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
  });
};

/**
 * Enhanced API key authentication middleware
 */
export async function enhancedApiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const isAuthEnabled = process.env.API_AUTH_ENABLED === 'true';

  if (!isAuthEnabled) {
    return next();
  }

  const expectedKey = process.env.API_KEY;
  if (!expectedKey) {
    logger.error('API_KEY environment variable is not set but authentication is enabled');
    return res.status(500).json({
      success: false,
      error: 'Server configuration error',
    });
  }

  // Validate expected key format
  if (!validateApiKey(expectedKey)) {
    logger.error('Configured API key does not meet security requirements');
    return res.status(500).json({
      success: false,
      error: 'Server configuration error',
    });
  }

  const clientIdentifier = `${req.ip}-${req.get('User-Agent') || 'unknown'}`;

  // Check if client is blocked due to brute force attempts
  if (trackFailedAttempt(clientIdentifier)) {
    return res.status(429).json({
      success: false,
      error: 'Too many failed authentication attempts',
      message: 'Account temporarily locked due to security concerns',
      retryAfter: Math.ceil(LOGIN_ATTEMPT_WINDOW / 1000),
    });
  }

  const providedKey = req.header('x-api-key') || req.header('authorization')?.replace(/^Bearer\s+/i, '');

  if (!providedKey) {
    logger.warn('API request without authentication', {
      extra: {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
      },
    });
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'API key must be provided in x-api-key header or Authorization Bearer token',
    });
  }

  // Use constant-time comparison to prevent timing attacks
  const expectedBuffer = Buffer.from(expectedKey, 'utf8');
  const providedBuffer = Buffer.from(providedKey, 'utf8');

  if (expectedBuffer.length !== providedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
    logger.warn('Invalid API key attempt', {
      extra: {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        keyPrefix: `${providedKey.substring(0, 8)}...`,
        failedAttempts: failedAttempts.get(clientIdentifier)?.count || 1,
      },
    });

    // Add progressive delay based on failed attempts
    const attempts = failedAttempts.get(clientIdentifier)?.count || 1;
    const delay = Math.min(100 + (attempts * 200), 2000); // Max 2 second delay
    await new Promise(resolve => setTimeout(resolve, delay));

    return res.status(401).json({
      success: false,
      error: 'Invalid API key',
    });
  }

  // Clear failed attempts on successful authentication
  clearFailedAttempts(clientIdentifier);

  // Log successful authentication
  logger.debug('API key authentication successful', {
    extra: {
      ip: req.ip,
      path: req.path,
    },
  });

  next();
}

/**
 * Request sanitization middleware
 */
export function sanitizeRequest(req: Request, res: Response, next: NextFunction) {
  // Remove potential XSS patterns from query parameters
  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        req.query[key] = sanitizeString(value);
      }
    }
  }

  // Sanitize request body if it exists
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  next();
}

/**
 * Sanitize string input to prevent XSS
 */
function sanitizeString(input: string): string {
  if (typeof input !== 'string') return input;

  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/<[^>]*>/gi, '') // Remove all HTML tags
    .trim();
}

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any, visited = new WeakSet()): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Handle circular references
  if (visited.has(obj)) {
    return '[Circular Reference]';
  }
  visited.add(obj);

  if (Array.isArray(obj)) {
    return obj.map(item =>
      typeof item === 'string' ? sanitizeString(item) : sanitizeObject(item, visited),
    );
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value, visited);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * CORS security headers middleware
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Remove server identification
  res.removeHeader('X-Powered-By');

  next();
}

/**
 * Request validation middleware for search endpoints
 */
export function validateSearchRequest(req: Request, res: Response, next: NextFunction): void {
  const query = req.query.q as string;

  if (!query) {
    res.status(400).json({
      success: false,
      error: 'Query parameter is required',
    });
    return;
  }

  // Sanitize the query
  const sanitizedQuery = sanitizeSearchInput(query);
  req.query.q = sanitizedQuery;

  // Validate query complexity
  const complexityCheck = validateQueryComplexity(sanitizedQuery);
  if (!complexityCheck.valid) {
    logger.warn('Query failed complexity validation', {
      extra: {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        reason: complexityCheck.reason,
        query: sanitizedQuery.substring(0, 200),
      },
    });

    res.status(400).json({
      success: false,
      error: 'Invalid query format',
      message: complexityCheck.reason,
    });
    return;
  }

  // Additional legacy pattern checks
  const suspiciousPatterns = [
    /union\s+select/i,
    /insert\s+into/i,
    /delete\s+from/i,
    /drop\s+table/i,
    /script\s*:/i,
    /<script/i,
  ];

  const hasSuspiciousPattern = suspiciousPatterns.some(pattern => pattern.test(sanitizedQuery));

  if (hasSuspiciousPattern) {
    logger.warn('Suspicious search query pattern detected', {
      extra: {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        query: sanitizedQuery.substring(0, 200),
      },
    });

    res.status(400).json({
      success: false,
      error: 'Invalid query format',
    });
    return;
  }

  next();
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Brute force protection - track failed attempts
 */
const failedAttempts = new Map<string, { count: number; lastAttempt: number }>();

export function trackFailedAttempt(identifier: string): boolean {
  const now = Date.now();
  const attempts = failedAttempts.get(identifier);

  if (!attempts) {
    failedAttempts.set(identifier, { count: 1, lastAttempt: now });
    return false;
  }

  // Reset if window has expired
  if (now - attempts.lastAttempt > LOGIN_ATTEMPT_WINDOW) {
    failedAttempts.set(identifier, { count: 1, lastAttempt: now });
    return false;
  }

  attempts.count++;
  attempts.lastAttempt = now;

  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    logger.warn('Brute force attack detected', {
      extra: {
        identifier,
        attempts: attempts.count,
        windowStart: new Date(now - LOGIN_ATTEMPT_WINDOW).toISOString(),
      },
    });
    return true; // Blocked
  }

  return false;
}

export function clearFailedAttempts(identifier: string): void {
  failedAttempts.delete(identifier);
}

/**
 * Advanced query validation
 */
export function validateQueryComplexity(query: string): { valid: boolean; reason?: string } {
  if (query === null || query === undefined || typeof query !== 'string') {
    return { valid: false, reason: 'Invalid query type' };
  }

  // Allow empty strings
  if (query === '') {
    return { valid: true };
  }

  if (query.length > SUSPICIOUS_QUERY_LENGTH) {
    return { valid: false, reason: 'Query too long' };
  }

  // Count operators and special characters
  const operators = (query.match(/[&|!(){}[\]"~*]/g) || []).length;
  const filters = (query.match(/:/g) || []).length;
  const complexity = operators + filters;

  if (complexity > MAX_QUERY_COMPLEXITY) {
    return { valid: false, reason: 'Query too complex' };
  }

  // Check for potential NoSQL injection patterns
  const nosqlPatterns = [
    /\$where/i,
    /\$regex/i,
    /\$ne/i,
    /javascript:/i,
    /eval\s*\(/i,
    /function\s*\(/i,
  ];

  for (const pattern of nosqlPatterns) {
    if (pattern.test(query)) {
      return { valid: false, reason: 'Potential injection detected' };
    }
  }

  return { valid: true };
}

/**
 * Content Security Policy generator
 */
export function generateCSPHeader(): string {
  const policies = [
    'default-src \'self\'',
    'script-src \'self\' \'unsafe-inline\'', // Allow inline scripts for React
    'style-src \'self\' \'unsafe-inline\'',  // Allow inline styles for Tailwind
    'img-src \'self\' data: https:',
    'font-src \'self\' data:',
    'connect-src \'self\'',
    'media-src \'none\'',
    'object-src \'none\'',
    'child-src \'none\'',
    'worker-src \'none\'',
    'frame-ancestors \'none\'',
    'form-action \'self\'',
    'base-uri \'self\'',
    'manifest-src \'self\'',
  ];

  if (isDevelopment()) {
    // Allow webpack dev server in development
    policies[policies.indexOf('connect-src \'self\'')] = 'connect-src \'self\' ws: wss:';
  }

  return policies.join('; ');
}

/**
 * Enhanced security headers middleware
 */
export function enhancedSecurityHeaders(req: Request, res: Response, next: NextFunction) {
  // Basic security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');

  // Content Security Policy
  res.setHeader('Content-Security-Policy', generateCSPHeader());

  // HSTS in production
  if (isProduction()) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Remove server identification
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  // Cache control for sensitive endpoints
  if (req.path.includes('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
}

/**
 * Input sanitization for search queries
 */
export function sanitizeSearchInput(input: any, visited = new WeakSet()): any {
  if (typeof input === 'string') {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/data:/gi, '') // Remove data: URLs
      .replace(/vbscript:/gi, '') // Remove VBScript
      .replace(/<[^>]*>/gi, '') // Remove all HTML tags
      .trim()
      .substring(0, 1000); // Limit length
  }

  if (Array.isArray(input)) {
    return input.map(item => sanitizeSearchInput(item, visited));
  }

  if (input && typeof input === 'object') {
    // Handle circular references
    if (visited.has(input)) {
      return '[Circular Reference]';
    }
    visited.add(input);

    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      // Sanitize key names
      const cleanKey = key.replace(/[^a-zA-Z0-9_-]/g, '');
      if (cleanKey.length > 0 && cleanKey.length <= 50) {
        sanitized[cleanKey] = sanitizeSearchInput(value, visited);
      }
    }
    return sanitized;
  }

  return input;
}

/**
 * Get security configuration summary
 */
export function getSecurityConfig() {
  return {
    environment: process.env.NODE_ENV || 'unknown',
    authEnabled: process.env.API_AUTH_ENABLED === 'true',
    apiKeyConfigured: !!process.env.API_KEY,
    apiKeySecure: process.env.API_KEY ? validateApiKey(process.env.API_KEY) : false,
    httpsRequired: isProduction(),
    corsOrigin: process.env.API_CORS_ORIGIN || '*',
    rateLimitEnabled: true,
    bruteForceProtection: true,
    queryValidation: true,
    inputSanitization: true,
    securityHeaders: true,
    cspEnabled: true,
  };
}
