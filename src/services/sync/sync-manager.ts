import {
  IMessageConsumer,
  ISyncProcessor,
  SyncConfig,
  IEventTransformer,
  IMetricsCollector,
} from './interfaces';
import { SQSMessageConsumer } from './sqs-consumer';
import { SearchSyncProcessor } from './processor';
import { DatabaseEventTransformer } from './event-transformer';
import { SyncMetricsCollector } from './metrics';
import { logger } from '../../lib/logger';

/**
 * Main sync manager that coordinates all sync components
 */
export class SyncManager {
  private consumer?: IMessageConsumer;
  private processor: ISyncProcessor;
  private transformer: IEventTransformer;
  private metrics: IMetricsCollector;
  private isRunning = false;

  constructor(private config: SyncConfig) {
    this.processor = new SearchSyncProcessor();
    this.transformer = new DatabaseEventTransformer();
    this.metrics = new SyncMetricsCollector();
  }

  /**
   * Initialize and start the sync system
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Sync manager is already running');
      return;
    }

    try {
      logger.info(`Starting sync manager: queue=${this.config.aws.sqsQueueUrl}, batch=${this.config.processor.batchSize}, polling=${this.config.polling.enabled}`);

      // Initialize SQS consumer if queue URL is provided
      if (this.config.aws.sqsQueueUrl) {
        this.consumer = new SQSMessageConsumer(
          this.config.aws.sqsQueueUrl,
          this.processor,
          this.transformer,
          this.config,
          this.metrics,
        );

        await this.consumer.start();
        logger.info('SQS consumer started successfully');
      } else {
        logger.warn('No SQS queue URL provided, skipping message consumer setup');
      }

      this.isRunning = true;
      logger.info('Sync manager started successfully');

    } catch (error) {
      logger.error('Failed to start sync manager', error as Error);
      throw error;
    }
  }

  /**
   * Stop the sync system
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.info('Stopping sync manager');

      if (this.consumer) {
        await this.consumer.stop();
        logger.info('SQS consumer stopped');
      }

      this.isRunning = false;
      logger.info('Sync manager stopped successfully');

    } catch (error) {
      logger.error('Error stopping sync manager', error as Error);
      throw error;
    }
  }

  /**
   * Get overall system status
   */
  getStatus() {
    const consumerStatus = this.consumer?.getStatus() || {
      isRunning: false,
      messagesProcessed: 0,
      errors: 0,
    };

    return {
      isRunning: this.isRunning,
      consumer: consumerStatus,
      processor: this.processor.getStatus(),
      metrics: this.metrics.getMetrics(),
    };
  }

  /**
   * Get detailed metrics
   */
  getMetrics() {
    return this.metrics.getMetrics();
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics.reset();
  }

  /**
   * Process a single event manually (for testing or API-triggered sync)
   */
  async processEvent(eventData: any, source: string = 'api') {
    try {
      const event = this.transformer.transformEvent(eventData, source);

      if (!this.transformer.validateEvent(event)) {
        throw new Error('Invalid event format');
      }

      const success = await this.processor.processChange(event);

      if (success) {
        this.metrics.recordMessageProcessed(0); // No processing time for manual events
      } else {
        this.metrics.recordMessageFailed(new Error('Manual event processing failed'));
      }

      return success;

    } catch (error) {
      logger.error(`Manual event processing failed from source ${source}: ${JSON.stringify(eventData)}`, error as Error);
      this.metrics.recordMessageFailed(error as Error);
      throw error;
    }
  }

  /**
   * Process multiple events manually
   */
  async processBatch(events: any[], source: string = 'api') {
    try {
      const transformedEvents = events.map(eventData =>
        this.transformer.transformEvent(eventData, source),
      );

      // Validate all events
      const validEvents = transformedEvents.filter(event =>
        this.transformer.validateEvent(event),
      );

      if (validEvents.length !== transformedEvents.length) {
        logger.warn(`${transformedEvents.length - validEvents.length} events failed validation`);
      }

      const result = await this.processor.processBatch(validEvents);

      // Update metrics
      this.metrics.recordMessageProcessed(result.duration);
      if (result.failed > 0) {
        this.metrics.recordMessageFailed(new Error(`Batch processing failed: ${result.failed} events`));
      }

      return result;

    } catch (error) {
      logger.error(`Manual batch processing failed from source ${source} (${events.length} events)`, error as Error);
      this.metrics.recordMessageFailed(error as Error);
      throw error;
    }
  }

  /**
   * Get queue statistics (if SQS consumer is available)
   */
  async getQueueStats() {
    if (this.consumer && 'getQueueStats' in this.consumer) {
      return await (this.consumer as SQSMessageConsumer).getQueueStats();
    }
    return null;
  }

  /**
   * Export metrics in Prometheus format
   */
  exportMetrics(): string {
    if ('exportPrometheusMetrics' in this.metrics) {
      return (this.metrics as SyncMetricsCollector).exportPrometheusMetrics();
    }
    return '';
  }

  /**
   * Health check for the sync system
   */
  async healthCheck() {
    try {
      const status = this.getStatus();
      const queueStats = await this.getQueueStats();
      const processorStatus = await this.processor.getStatus();

      const isHealthy = status.isRunning &&
        (processorStatus?.isHealthy !== false) &&
        (status.metrics.errorRate < 0.1); // Less than 10% error rate

      return {
        healthy: isHealthy,
        status: {
          ...status,
          processor: processorStatus,
        },
        queueStats,
        timestamp: Date.now(),
      };

    } catch (error) {
      logger.error('Sync system health check failed', error as Error);
      return {
        healthy: false,
        error: (error as Error).message,
        timestamp: Date.now(),
      };
    }
  }
}

/**
 * Factory function to create sync manager with configuration
 */
export function createSyncManager(config: SyncConfig): SyncManager {
  return new SyncManager(config);
}

/**
 * Get sync configuration from environment variables
 */
export function getSyncConfigFromEnv(): SyncConfig {
  return {
    aws: {
      region: process.env.AWS_REGION || 'us-west-2',
      sqsQueueUrl: process.env.AWS_SQS_QUEUE_URL,
      snsTopicArn: process.env.AWS_SNS_TOPIC_ARN,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    processor: {
      batchSize: parseInt(process.env.SYNC_BATCH_SIZE || '10'),
      maxConcurrentBatches: parseInt(process.env.SYNC_MAX_CONCURRENT_BATCHES || '3'),
      errorRetryAttempts: parseInt(process.env.SYNC_RETRY_ATTEMPTS || '3'),
      deadLetterQueueThreshold: parseInt(process.env.SYNC_DLQ_THRESHOLD || '5'),
    },
    polling: {
      enabled: process.env.SYNC_POLLING_ENABLED !== 'false',
      intervalMs: parseInt(process.env.SYNC_POLLING_INTERVAL || '5000'),
      maxMessages: parseInt(process.env.SYNC_MAX_MESSAGES || '10'),
      visibilityTimeoutSeconds: parseInt(process.env.SYNC_VISIBILITY_TIMEOUT || '300'),
      waitTimeSeconds: parseInt(process.env.SYNC_WAIT_TIME || '20'),
    },
  };
}
