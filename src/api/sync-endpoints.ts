/**
 * Sync-related API endpoints
 */
import { Router, Request, Response } from 'express';
import { getGlobalSyncManager, startGlobalSync, stopGlobalSync, getSyncStatus } from '../services/sync';
import { logger } from '../lib/logger';

const router = Router();

/**
 * Get sync system status
 */
router.get('/sync/status', async (req: Request, res: Response) => {
  try {
    const status = await getSyncStatus();
    const syncManager = await getGlobalSyncManager();
    const queueStats = await syncManager.getQueueStats();

    res.json({
      success: true,
      status,
      queueStats,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Failed to get sync status', error as Error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * Start sync system
 */
router.post('/sync/start', async (req: Request, res: Response) => {
  try {
    await startGlobalSync();
    res.json({
      success: true,
      message: 'Sync system started successfully',
    });
  } catch (error) {
    logger.error('Failed to start sync system', error as Error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * Stop sync system
 */
router.post('/sync/stop', async (req: Request, res: Response) => {
  try {
    await stopGlobalSync();
    res.json({
      success: true,
      message: 'Sync system stopped successfully',
    });
  } catch (error) {
    logger.error('Failed to stop sync system', error as Error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * Get sync metrics
 */
router.get('/sync/metrics', async (req: Request, res: Response) => {
  try {
    const syncManager = await getGlobalSyncManager();
    const metrics = syncManager.getMetrics();

    res.json({
      success: true,
      metrics,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Failed to get sync metrics', error as Error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * Export metrics in Prometheus format
 */
router.get('/sync/metrics/prometheus', async (req: Request, res: Response) => {
  try {
    const syncManager = await getGlobalSyncManager();
    const prometheusMetrics = syncManager.exportMetrics();

    res.set('Content-Type', 'text/plain');
    res.send(prometheusMetrics);
  } catch (error) {
    logger.error('Failed to export Prometheus metrics', error as Error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * Reset sync metrics
 */
router.post('/sync/metrics/reset', async (req: Request, res: Response) => {
  try {
    const syncManager = await getGlobalSyncManager();
    syncManager.resetMetrics();

    res.json({
      success: true,
      message: 'Sync metrics reset successfully',
    });
  } catch (error) {
    logger.error('Failed to reset sync metrics', error as Error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * Manually process a sync event (for testing)
 */
router.post('/sync/process-event', async (req: Request, res: Response) => {
  try {
    const { eventData, source = 'api' } = req.body;

    if (!eventData) {
      return res.status(400).json({
        success: false,
        error: 'eventData is required',
      });
    }

    const syncManager = await getGlobalSyncManager();
    const success = await syncManager.processEvent(eventData, source);

    return res.json({
      success,
      message: success ? 'Event processed successfully' : 'Event processing failed',
    });
  } catch (error) {
    logger.error('Failed to process manual event', error as Error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * Manually process a batch of sync events
 */
router.post('/sync/process-batch', async (req: Request, res: Response) => {
  try {
    const { events, source = 'api' } = req.body;

    if (!events || !Array.isArray(events)) {
      return res.status(400).json({
        success: false,
        error: 'events array is required',
      });
    }

    const syncManager = await getGlobalSyncManager();
    const result = await syncManager.processBatch(events, source);

    return res.json({
      success: result.success,
      result,
    });
  } catch (error) {
    logger.error('Failed to process manual batch', error as Error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * Health check for sync system
 */
router.get('/sync/health', async (req: Request, res: Response) => {
  try {
    const syncManager = await getGlobalSyncManager();
    const health = await syncManager.healthCheck();

    const statusCode = health.healthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Sync health check failed', error as Error);
    res.status(503).json({
      healthy: false,
      error: (error as Error).message,
      timestamp: Date.now(),
    });
  }
});

export default router;
