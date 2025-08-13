import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import {
  IMessageConsumer,
  ISyncProcessor,
  SQSMessage,
  DatabaseChangeEvent,
  SyncConfig,
  IEventTransformer,
  IMetricsCollector,
} from './interfaces';
import { logger } from '../../lib/logger';

/**
 * AWS SQS message consumer for real-time sync
 */
export class SQSMessageConsumer implements IMessageConsumer {
  private sqsClient: SQSClient;
  private isRunning = false;
  private pollingTimeout?: NodeJS.Timeout;
  private messagesProcessed = 0;
  private errors = 0;
  private lastActivity?: number;

  constructor(
    private queueUrl: string,
    private processor: ISyncProcessor,
    private transformer: IEventTransformer,
    private config: SyncConfig,
    private metrics?: IMetricsCollector,
  ) {
    this.sqsClient = new SQSClient({
      region: config.aws.region,
      credentials: config.aws.accessKeyId ? {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey!,
      } : undefined,
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('SQS consumer is already running');
      return;
    }

    this.isRunning = true;
    logger.info(`Starting SQS message consumer: ${this.queueUrl} (batch: ${this.config.processor.batchSize}, polling: ${this.config.polling.intervalMs}ms)`);

    // Start polling if enabled
    if (this.config.polling.enabled) {
      this.startPolling();
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout);
      this.pollingTimeout = undefined;
    }

    logger.info(`SQS message consumer stopped (processed: ${this.messagesProcessed}, errors: ${this.errors})`);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      messagesProcessed: this.messagesProcessed,
      errors: this.errors,
      lastActivity: this.lastActivity,
    };
  }

  private startPolling() {
    if (!this.isRunning) {
      return;
    }

    this.pollingTimeout = setTimeout(async () => {
      try {
        await this.pollMessages();
      } catch (error) {
        logger.error('Error during message polling', error as Error);
        this.errors++;
      } finally {
        // Schedule next poll
        this.startPolling();
      }
    }, this.config.polling.intervalMs);
  }

  private async pollMessages() {
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: this.config.polling.maxMessages,
        VisibilityTimeout: this.config.polling.visibilityTimeoutSeconds,
        WaitTimeSeconds: this.config.polling.waitTimeSeconds, // Long polling
        MessageAttributeNames: ['All'],
      });

      const response = await this.sqsClient.send(command);

      if (!response.Messages || response.Messages.length === 0) {
        return; // No messages to process
      }

      this.lastActivity = Date.now();
      this.metrics?.recordMessageReceived();

      logger.debug(`Received ${response.Messages.length} messages from SQS`);

      // Convert SQS messages to our format
      const sqsMessages: SQSMessage[] = response.Messages.map(msg => ({
        MessageId: msg.MessageId!,
        Body: msg.Body!,
        Attributes: msg.Attributes,
        MessageAttributes: msg.MessageAttributes,
        ReceiptHandle: msg.ReceiptHandle!,
      }));

      // Process messages
      await this.processMessages(sqsMessages);

    } catch (error) {
      logger.error('Failed to poll messages from SQS', error as Error);
      this.errors++;
      throw error;
    }
  }

  private async processMessages(messages: SQSMessage[]) {
    const events: DatabaseChangeEvent[] = [];
    const validMessages: SQSMessage[] = [];

    // Parse and validate messages
    for (const message of messages) {
      try {
        const event = this.parseMessage(message);
        if (event && this.transformer.validateEvent(event)) {
          events.push(event);
          validMessages.push(message);
        } else {
          logger.warn(`Invalid message format, skipping message ID: ${message.MessageId}`);
          await this.deleteMessage(message);
        }
      } catch (error) {
        logger.error(`Failed to parse message ${message.MessageId}`, error as Error);
        await this.handleFailedMessage(message, error as Error);
      }
    }

    if (events.length === 0) {
      return;
    }

    // Process events in batch
    try {
      const startTime = Date.now();
      const result = await this.processor.processBatch(events);
      const processingTime = Date.now() - startTime;

      logger.info(`Batch processing completed: ${result.processed}/${events.length} processed, ${result.failed} failed, duration: ${processingTime}ms`);

      // Delete successfully processed messages
      if (result.processed > 0) {
        await this.deleteProcessedMessages(validMessages, result);
      }

      // Update metrics
      this.messagesProcessed += result.processed;
      this.errors += result.failed;
      this.metrics?.recordMessageProcessed(processingTime);

      // Handle failed messages
      if (result.failed > 0) {
        logger.warn(`${result.failed} messages failed processing: ${result.errors?.join(', ') || 'unknown errors'}`);
        this.metrics?.recordMessageFailed(new Error(`Batch processing failed: ${result.errors?.join(', ')}`));
      }

    } catch (error) {
      logger.error('Batch processing failed completely', error as Error);
      this.errors += events.length;
      this.metrics?.recordMessageFailed(error as Error);

      // Handle all messages as failed
      for (const message of validMessages) {
        await this.handleFailedMessage(message, error as Error);
      }
    }
  }

  private parseMessage(message: SQSMessage): DatabaseChangeEvent | null {
    try {
      // Check if message body is SNS notification format
      let eventData: any;

      try {
        const parsed = JSON.parse(message.Body);

        // Handle SNS message format
        if (parsed.Type === 'Notification' && parsed.Message) {
          eventData = JSON.parse(parsed.Message);
        } else {
          eventData = parsed;
        }
      } catch (parseError) {
        logger.error(`Failed to parse message body: ${message.MessageId}`, parseError as Error);
        return null;
      }

      // Transform the event using the transformer
      const transformedEvent = this.transformer.transformEvent(eventData, 'sqs');

      return transformedEvent;

    } catch (error) {
      logger.error(`Failed to parse message ${message.MessageId}`, error as Error);
      return null;
    }
  }

  private async deleteProcessedMessages(messages: SQSMessage[], result: any) {
    // For simplicity, delete all messages if batch was mostly successful
    const successRate = result.processed / (result.processed + result.failed);

    if (successRate >= 0.8) { // 80% success rate threshold
      for (const message of messages) {
        await this.deleteMessage(message);
      }
    }
  }

  private async deleteMessage(message: SQSMessage) {
    try {
      const command = new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: message.ReceiptHandle,
      });

      await this.sqsClient.send(command);
      logger.debug(`Deleted message: ${message.MessageId}`);

    } catch (error) {
      logger.error(`Failed to delete message ${message.MessageId}`, error as Error);
    }
  }

  private async handleFailedMessage(message: SQSMessage, error: Error) {
    logger.error(`Handling failed message: ${message.MessageId}`, error);

    // For now, just log the failure
    // In production, you might want to:
    // 1. Send to dead letter queue
    // 2. Retry with exponential backoff
    // 3. Alert monitoring systems

    // Check retry count from message attributes
    const retryCount = parseInt(message.MessageAttributes?.retryCount?.StringValue || '0');

    if (retryCount < this.config.processor.errorRetryAttempts) {
      // Could implement retry logic here
      logger.info(`Message ${message.MessageId} will be retried (attempt ${retryCount + 1})`);
    } else {
      // Send to dead letter queue or log for manual intervention
      logger.error(`Message ${message.MessageId} exceeded retry limit, sending to DLQ`);
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    try {
      const command = new GetQueueAttributesCommand({
        QueueUrl: this.queueUrl,
        AttributeNames: [
          'ApproximateNumberOfMessages',
          'ApproximateNumberOfMessagesNotVisible',
          'ApproximateNumberOfMessagesDelayed',
        ],
      });

      const response = await this.sqsClient.send(command);

      return {
        messagesAvailable: parseInt(response.Attributes?.ApproximateNumberOfMessages || '0'),
        messagesInFlight: parseInt(response.Attributes?.ApproximateNumberOfMessagesNotVisible || '0'),
        messagesDelayed: parseInt(response.Attributes?.ApproximateNumberOfMessagesDelayed || '0'),
      };
    } catch (error) {
      logger.error('Failed to get queue statistics', error as Error);
      return null;
    }
  }
}
