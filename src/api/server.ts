import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as dotenv from 'dotenv';
import { searchService } from '../services/search/SearchService';
import { logger } from '../lib/logger';
import pinoHttp from 'pino-http';
import type { Request, Response } from 'express';
import { rawLogger } from '../lib/logger';
import syncEndpoints from './sync-endpoints';
import { startGlobalSync } from '../services/sync';
import {
  enhancedApiKeyAuth,
  createRateLimit,
  sanitizeRequest,
  securityHeaders,
  validateSearchRequest,
  getSecurityConfig,
} from '../lib/security';
import {
  searchQuerySchema,
  categoryParamSchema,
  tagsBodySchema,
  claimsSearchSchema,
  locationsSearchSchema,
} from './validators';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 3001;

// Security & middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ['\'self\''],
      styleSrc: ['\'self\'', '\'unsafe-inline\''],
      scriptSrc: ['\'self\''],
      imgSrc: ['\'self\'', 'data:', 'https:'],
      connectSrc: ['\'self\''],
      fontSrc: ['\'self\''],
      objectSrc: ['\'none\''],
      mediaSrc: ['\'self\''],
      frameSrc: ['\'none\''],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Additional security headers
app.use(securityHeaders);

// Request logging with request id
app.use(pinoHttp({
  logger: rawLogger,
  genReqId: (req: Request, _res: Response) => (req.headers['x-request-id'] as string) || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
}));

// CORS: allow specific origins or all in non-production by default
const corsEnv = process.env.API_CORS_ORIGIN;
let corsMiddleware: any;
if (!corsEnv || corsEnv === '*' || process.env.NODE_ENV !== 'production') {
  corsMiddleware = cors();
} else {
  const allowedOrigins = corsEnv.split(',').map(o => o.trim()).filter(Boolean);
  corsMiddleware = cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });
}
app.use(corsMiddleware);

// Body parser with size limit
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => {
    // Store raw body for signature verification if needed
    (req as any).rawBody = buf;
  },
}));

// Request sanitization
app.use(sanitizeRequest);

// Enhanced rate limiting
app.use(createRateLimit());

// Health check endpoint (no auth)
app.get('/api/health', async (req, res) => {
  const isHealthy = await searchService.healthCheck();
  const providerInfo = await searchService.getProviderInfo();
  const securityConfig = getSecurityConfig();

  res.json({
    status: isHealthy ? 'OK' : 'ERROR',
    message: `Search API is ${isHealthy ? 'running' : 'down'}`,
    provider: providerInfo.name,
    features: providerInfo.features,
    security: {
      authEnabled: securityConfig.authEnabled,
      environment: securityConfig.environment,
      httpsRequired: securityConfig.httpsRequired,
    },
    timestamp: Date.now(),
  });
});

// Protect all remaining API routes if enabled
app.use('/api', enhancedApiKeyAuth);

// Add sync endpoints (protected)
app.use('/api', syncEndpoints);

// Search endpoints
app.get('/api/search', validateSearchRequest, async (req, res) => {
  try {
    const parsed = searchQuerySchema.parse({
      q: req.query.q,
      category: req.query.category,
      tags: req.query.tags,
      limit: req.query.limit,
      page: req.query.page,
    });

    const searchParams = {
      query: parsed.q,
      category: parsed.category,
      tags: parsed.tags,
      limit: parsed.limit,
      page: parsed.page,
    };

    const result = await searchService.search(searchParams);

    return res.json(result);

  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ success: false, error: 'Invalid request', details: error.errors });
    }
    logger.error('Search endpoint error', error);
    return res.status(500).json({
      success: false,
      error: 'Search failed',
      message: error.message,
    });
  }
});

// Claims search endpoint
app.get('/api/search/claims', async (req, res) => {
  try {
    const parsed = claimsSearchSchema.parse({
      q: req.query.q,
      claimType: req.query.claimType,
      claimStatus: req.query.claimStatus,
      province: req.query.province,
      limit: req.query.limit,
      page: req.query.page,
    });

    // Search claims collection directly
    const result = await searchService.searchClaimsCollection(parsed.q, {
      claimType: parsed.claimType,
      claimStatus: parsed.claimStatus,
      province: parsed.province,
      limit: parsed.limit ?? 10,
      page: parsed.page ?? 1,
    });

    return res.json(result);

  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ success: false, error: 'Invalid request', details: error.errors });
    }
    logger.error('Claims search endpoint error', error);
    return res.status(500).json({
      success: false,
      error: 'Claims search failed',
      message: error.message,
    });
  }
});

// Locations search endpoint
app.get('/api/search/locations', async (req, res) => {
  try {
    const parsed = locationsSearchSchema.parse({
      q: req.query.q,
      province: req.query.province,
      postalCode: req.query.postalCode,
      limit: req.query.limit,
      page: req.query.page,
    });

    // Search locations collection directly
    const result = await searchService.searchLocationsCollection(parsed.q, {
      province: parsed.province,
      postalCode: parsed.postalCode,
      limit: parsed.limit ?? 10,
      page: parsed.page ?? 1,
    });

    return res.json(result);

  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ success: false, error: 'Invalid request', details: error.errors });
    }
    logger.error('Locations search endpoint error', error);
    return res.status(500).json({
      success: false,
      error: 'Locations search failed',
      message: error.message,
    });
  }
});

// Category search endpoint
app.get('/api/search/category/:category', async (req, res) => {
  try {
    const { category } = categoryParamSchema.parse(req.params);
    const result = await searchService.searchByCategory(category);

    return res.json(result);

  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ success: false, error: 'Invalid request', details: error.errors });
    }
    logger.error(`Category search endpoint error for category: ${req.params.category}`, error);
    return res.status(500).json({
      success: false,
      error: 'Category search failed',
      message: error.message,
    });
  }
});

// Tag search endpoint
app.post('/api/search/tags', async (req, res) => {
  try {
    const { tags } = tagsBodySchema.parse(req.body);
    const result = await searchService.searchByTags(tags);

    return res.json(result);

  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ success: false, error: 'Invalid request', details: error.errors });
    }
    logger.error('Tag search endpoint error', error);
    return res.status(500).json({
      success: false,
      error: 'Tag search failed',
      message: error.message,
    });
  }
});

// Facets endpoint
app.get('/api/facets', async (req, res) => {
  try {
    const result = await searchService.getFacets();

    return res.json(result);

  } catch (error: any) {
    logger.error('Facets endpoint error', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get facets',
      message: error.message,
    });
  }
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled API error', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Start server
app.listen(PORT, async () => {
  logger.server(`Search API server running on http://localhost:${PORT}`);
  logger.info('API Documentation:');
  logger.info('Search Endpoints:');
  logger.info('   GET  /api/health                     - Health check');
  logger.info('   GET  /api/search?q=term              - Search all documents');
  logger.info('   GET  /api/search/claims?q=term       - Search warranty claims');
  logger.info('   GET  /api/search/locations?q=term    - Search postal code locations');
  logger.info('   GET  /api/search/category/:cat       - Search by category');
  logger.info('   POST /api/search/tags                - Search by tags');
  logger.info('   GET  /api/facets                     - Get available facets');
  logger.info('Sync Endpoints:');
  logger.info('   GET  /api/sync/status                - Sync system status');
  logger.info('   GET  /api/sync/health                - Sync health check');
  logger.info('   GET  /api/sync/metrics               - Sync metrics');
  logger.info('   POST /api/sync/start                 - Start sync system');
  logger.info('   POST /api/sync/stop                  - Stop sync system');
  logger.info('   POST /api/sync/process-event         - Process manual sync event');

  // Start sync system if configured
  try {
    if (process.env.AWS_SQS_QUEUE_URL) {
      await startGlobalSync();
      logger.info('✅ Real-time sync system started');
    } else {
      logger.info('ℹ️  Real-time sync disabled (no SQS queue configured)');
    }
  } catch (error) {
    logger.warn(`Failed to start sync system: ${(error as Error).message}`);
  }
});

export default app;
