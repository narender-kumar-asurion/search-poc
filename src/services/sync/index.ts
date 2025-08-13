/**
 * Sync Service Module
 *
 * Provides real-time synchronization between databases and search indexes
 * via AWS SQS/SNS message queues
 */

// Core interfaces and types
export * from './interfaces';

// Main components
export { SearchSyncProcessor } from './processor';
export { SQSMessageConsumer } from './sqs-consumer';
export { DatabaseEventTransformer } from './event-transformer';
export { SyncMetricsCollector } from './metrics';
export { SyncManager, createSyncManager, getSyncConfigFromEnv } from './sync-manager';

// Import types for local use
import { SyncManager } from './sync-manager';
import { createSyncManager, getSyncConfigFromEnv } from './sync-manager';

// Create a global sync manager instance
let globalSyncManager: SyncManager | null = null;

/**
 * Get or create the global sync manager instance
 */
export async function getGlobalSyncManager(): Promise<SyncManager> {
  if (!globalSyncManager) {
    const config = getSyncConfigFromEnv();
    globalSyncManager = createSyncManager(config);
  }
  return globalSyncManager;
}

/**
 * Start the global sync system
 */
export async function startGlobalSync(): Promise<void> {
  const syncManager = await getGlobalSyncManager();
  await syncManager.start();
}

/**
 * Stop the global sync system
 */
export async function stopGlobalSync(): Promise<void> {
  if (globalSyncManager) {
    await globalSyncManager.stop();
  }
}

/**
 * Get sync system status
 */
export async function getSyncStatus() {
  if (!globalSyncManager) {
    return { isRunning: false, error: 'Sync manager not initialized' };
  }
  return globalSyncManager.getStatus();
}

/**
 * Reset the global sync manager (useful for testing)
 */
export function resetGlobalSyncManager(): void {
  globalSyncManager = null;
}
