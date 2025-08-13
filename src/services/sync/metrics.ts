import { IMetricsCollector, SyncMetrics } from './interfaces';
import { logger } from '../../lib/logger';

/**
 * Metrics collector for sync operations
 */
export class SyncMetricsCollector implements IMetricsCollector {
  private metrics: SyncMetrics = {
    messagesReceived: 0,
    messagesProcessed: 0,
    messagesFailed: 0,
    averageProcessingTime: 0,
    errorRate: 0,
  };

  private processingTimes: number[] = [];
  private readonly maxProcessingTimeHistory = 1000; // Keep last 1000 processing times

  recordMessageReceived(): void {
    this.metrics.messagesReceived++;
    this.updateErrorRate();
  }

  recordMessageProcessed(processingTime: number): void {
    this.metrics.messagesProcessed++;
    this.metrics.lastProcessedAt = Date.now();

    // Track processing times for average calculation
    this.processingTimes.push(processingTime);

    // Keep only recent processing times
    if (this.processingTimes.length > this.maxProcessingTimeHistory) {
      this.processingTimes.shift();
    }

    // Update average processing time
    this.metrics.averageProcessingTime =
      this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;

    this.updateErrorRate();

    logger.debug(`Message processed: ${processingTime}ms (avg: ${this.metrics.averageProcessingTime}ms, total: ${this.metrics.messagesProcessed})`);
  }

  recordMessageFailed(error: Error): void {
    this.metrics.messagesFailed++;
    this.updateErrorRate();

    logger.error(`Message processing failed (total failed: ${this.metrics.messagesFailed}, error rate: ${this.metrics.errorRate})`, error);
  }

  getMetrics(): SyncMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics = {
      messagesReceived: 0,
      messagesProcessed: 0,
      messagesFailed: 0,
      averageProcessingTime: 0,
      errorRate: 0,
    };
    this.processingTimes = [];

    logger.info('Sync metrics reset');
  }

  /**
   * Get detailed performance statistics
   */
  getPerformanceStats() {
    if (this.processingTimes.length === 0) {
      return null;
    }

    const sorted = [...this.processingTimes].sort((a, b) => a - b);
    const count = sorted.length;

    return {
      count,
      min: sorted[0]!,
      max: sorted[count - 1]!,
      median: count % 2 === 0
        ? (sorted[count / 2 - 1]! + sorted[count / 2]!) / 2
        : sorted[Math.floor(count / 2)]!,
      p95: sorted[Math.floor(count * 0.95)]!,
      p99: sorted[Math.floor(count * 0.99)]!,
      average: this.metrics.averageProcessingTime,
    };
  }

  /**
   * Get throughput statistics
   */
  getThroughputStats(windowMs: number = 60000) { // Default 1 minute window
    const now = Date.now();
    const windowStart = now - windowMs;

    // This is a simplified version - in production you'd want to track timestamps
    // for more accurate throughput calculations
    const messagesPerSecond = this.metrics.messagesProcessed / (windowMs / 1000);

    return {
      messagesPerSecond,
      messagesPerMinute: messagesPerSecond * 60,
      successRate: this.metrics.messagesProcessed / (this.metrics.messagesProcessed + this.metrics.messagesFailed),
      errorRate: this.metrics.errorRate,
    };
  }

  private updateErrorRate(): void {
    const total = this.metrics.messagesProcessed + this.metrics.messagesFailed;
    this.metrics.errorRate = total > 0 ? this.metrics.messagesFailed / total : 0;
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusMetrics(): string {
    const metrics = this.getMetrics();
    const timestamp = Date.now();

    return [
      `# HELP fs_search_sync_messages_received_total Total number of messages received`,
      `# TYPE fs_search_sync_messages_received_total counter`,
      `fs_search_sync_messages_received_total ${metrics.messagesReceived} ${timestamp}`,
      '',
      `# HELP fs_search_sync_messages_processed_total Total number of messages processed successfully`,
      `# TYPE fs_search_sync_messages_processed_total counter`,
      `fs_search_sync_messages_processed_total ${metrics.messagesProcessed} ${timestamp}`,
      '',
      `# HELP fs_search_sync_messages_failed_total Total number of messages that failed processing`,
      `# TYPE fs_search_sync_messages_failed_total counter`,
      `fs_search_sync_messages_failed_total ${metrics.messagesFailed} ${timestamp}`,
      '',
      `# HELP fs_search_sync_processing_time_avg Average processing time in milliseconds`,
      `# TYPE fs_search_sync_processing_time_avg gauge`,
      `fs_search_sync_processing_time_avg ${metrics.averageProcessingTime} ${timestamp}`,
      '',
      `# HELP fs_search_sync_error_rate Current error rate (0-1)`,
      `# TYPE fs_search_sync_error_rate gauge`,
      `fs_search_sync_error_rate ${metrics.errorRate} ${timestamp}`,
      '',
    ].join('\n');
  }
}
