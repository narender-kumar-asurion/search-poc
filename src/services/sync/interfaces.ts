/**
 * Real-time sync interfaces for handling database changes
 */

// Change event types
export type ChangeEventType = 'INSERT' | 'UPDATE' | 'DELETE' | 'BULK_UPDATE' | 'BULK_DELETE';

export type DocumentType = 'software_stack' | 'claims' | 'locations';

// Database change event structure
export interface DatabaseChangeEvent {
  id: string;
  eventType: ChangeEventType;
  documentType: DocumentType;
  timestamp: number;
  data?: any; // The actual document data (for INSERT/UPDATE)
  oldData?: any; // Previous data (for UPDATE)
  metadata?: {
    source: string; // Database trigger, API, etc.
    user?: string;
    correlationId?: string;
    batchId?: string; // For bulk operations
  };
}

// AWS SQS message structure
export interface SQSMessage {
  MessageId: string;
  Body: string; // JSON stringified DatabaseChangeEvent
  Attributes?: Record<string, string>;
  MessageAttributes?: Record<string, any>;
  ReceiptHandle: string;
}

// Sync operation result
export interface SyncResult {
  success: boolean;
  processed: number;
  failed: number;
  errors?: string[];
  duration: number;
}

// Sync processor interface
export interface ISyncProcessor {
  /**
   * Process a single change event
   */
  processChange(event: DatabaseChangeEvent): Promise<boolean>;

  /**
   * Process multiple change events in batch
   */
  processBatch(events: DatabaseChangeEvent[]): Promise<SyncResult>;

  /**
   * Get processor status and health
   */
  getStatus(): Promise<{
    isHealthy: boolean;
    lastProcessed?: number;
    queueDepth?: number;
    errorRate?: number;
  }>;
}

// Message queue consumer interface
export interface IMessageConsumer {
  /**
   * Start consuming messages from the queue
   */
  start(): Promise<void>;

  /**
   * Stop consuming messages
   */
  stop(): Promise<void>;

  /**
   * Get consumer status
   */
  getStatus(): {
    isRunning: boolean;
    messagesProcessed: number;
    errors: number;
    lastActivity?: number;
  };
}

// Bulk operation configuration
export interface BulkOperationConfig {
  batchSize: number;
  maxWaitTime: number; // milliseconds
  retryAttempts: number;
  retryDelay: number; // milliseconds
}

// Sync configuration
export interface SyncConfig {
  aws: {
    region: string;
    sqsQueueUrl?: string;
    snsTopicArn?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  };
  processor: {
    batchSize: number;
    maxConcurrentBatches: number;
    errorRetryAttempts: number;
    deadLetterQueueThreshold: number;
  };
  polling: {
    enabled: boolean;
    intervalMs: number;
    maxMessages: number;
    visibilityTimeoutSeconds: number;
    waitTimeSeconds: number; // Long polling
  };
}

// Dead letter queue handling
export interface DeadLetterHandler {
  handleFailedMessage(message: SQSMessage, error: Error, retryCount: number): Promise<void>;
  getFailedMessages(limit?: number): Promise<SQSMessage[]>;
  reprocessFailedMessages(): Promise<SyncResult>;
}

// Event transformer interface
export interface IEventTransformer {
  /**
   * Transform raw database event to standardized format
   */
  transformEvent(rawEvent: any, source: string): DatabaseChangeEvent;

  /**
   * Validate event structure
   */
  validateEvent(event: DatabaseChangeEvent): boolean;

  /**
   * Extract document type from event
   */
  extractDocumentType(event: any): DocumentType | null;
}

// Metrics and monitoring
export interface SyncMetrics {
  messagesReceived: number;
  messagesProcessed: number;
  messagesFailed: number;
  averageProcessingTime: number;
  lastProcessedAt?: number;
  errorRate: number;
  queueDepth?: number;
}

export interface IMetricsCollector {
  recordMessageReceived(): void;
  recordMessageProcessed(processingTime: number): void;
  recordMessageFailed(error: Error): void;
  getMetrics(): SyncMetrics;
  reset(): void;
}
