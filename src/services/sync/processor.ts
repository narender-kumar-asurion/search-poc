import {
  ISyncProcessor,
  DatabaseChangeEvent,
  SyncResult,
  DocumentType,
  ChangeEventType,
} from './interfaces';
import { getGlobalSearchService } from '../search';
import { logger } from '../../lib/logger';
import { COLLECTION_SCHEMAS } from '../../schema';

/**
 * Main sync processor that handles database change events
 * and updates the search index accordingly
 */
export class SearchSyncProcessor implements ISyncProcessor {
  private processingCount = 0;
  private lastProcessedAt?: number;
  private errorCount = 0;
  private totalProcessed = 0;

  async processChange(event: DatabaseChangeEvent): Promise<boolean> {
    try {
      logger.info(`Processing change event: ${event.eventType} for ${event.documentType} (ID: ${event.id}, timestamp: ${event.timestamp})`);

      const searchService = await getGlobalSearchService();
      const collectionName = this.getCollectionName(event.documentType);

      switch (event.eventType) {
        case 'INSERT':
          await this.handleInsert(searchService, collectionName, event);
          break;

        case 'UPDATE':
          await this.handleUpdate(searchService, collectionName, event);
          break;

        case 'DELETE':
          await this.handleDelete(searchService, collectionName, event);
          break;

        case 'BULK_UPDATE':
          await this.handleBulkUpdate(searchService, collectionName, event);
          break;

        case 'BULK_DELETE':
          await this.handleBulkDelete(searchService, collectionName, event);
          break;

        default:
          logger.warn(`Unknown event type: ${event.eventType} for event ID: ${event.id}`);
          return false;
      }

      this.recordSuccess();
      return true;

    } catch (error) {
      this.recordError();
      logger.error(`Failed to process change event: ${event.id} (type: ${event.eventType}, documentType: ${event.documentType})`, error as Error);
      return false;
    }
  }

  async processBatch(events: DatabaseChangeEvent[]): Promise<SyncResult> {
    const startTime = Date.now();
    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    logger.info(`Processing batch of ${events.length} events`);

    // Group events by document type and operation for efficiency
    const eventGroups = this.groupEvents(events);

    for (const [key, groupEvents] of eventGroups.entries()) {
      try {
        const [documentType, eventType] = key.split(':');

        if (eventType === 'BULK_UPDATE' || eventType === 'BULK_DELETE') {
          // Process bulk operations
          const success = await this.processBulkOperation(
            documentType as DocumentType,
            eventType as ChangeEventType,
            groupEvents,
          );

          if (success) {
            processed += groupEvents.length;
          } else {
            failed += groupEvents.length;
            errors.push(`Bulk ${eventType} failed for ${documentType}`);
          }
        } else {
          // Process individual operations
          for (const event of groupEvents) {
            const success = await this.processChange(event);
            if (success) {
              processed++;
            } else {
              failed++;
              errors.push(`Failed to process event ${event.id}`);
            }
          }
        }
      } catch (error) {
        failed += groupEvents.length;
        const errorMsg = `Batch processing failed for group ${key}: ${(error as Error).message}`;
        errors.push(errorMsg);
        logger.error(errorMsg, error as Error);
      }
    }

    const duration = Date.now() - startTime;
    const result: SyncResult = {
      success: failed === 0,
      processed,
      failed,
      errors: errors.length > 0 ? errors : undefined,
      duration,
    };

    logger.info(`Batch processing completed: ${processed}/${events.length} processed, ${failed} failed, duration: ${duration}ms`);

    return result;
  }

  async getStatus() {
    return {
      isHealthy: this.errorCount < 10, // Consider unhealthy if more than 10 recent errors
      lastProcessed: this.lastProcessedAt,
      queueDepth: this.processingCount,
      errorRate: this.totalProcessed > 0 ? this.errorCount / this.totalProcessed : 0,
    };
  }

  private async handleInsert(searchService: any, collectionName: string, event: DatabaseChangeEvent) {
    if (!event.data) {
      throw new Error('Insert event missing data');
    }

    // Transform data to match search schema
    const document = this.transformDocument(event.data, event.documentType);

    // Index the document
    await searchService.indexDocuments(collectionName, [document]);

    logger.debug(`Indexed new document: ${document.id} in ${collectionName} (type: ${event.documentType})`);
  }

  private async handleUpdate(searchService: any, collectionName: string, event: DatabaseChangeEvent) {
    if (!event.data) {
      throw new Error('Update event missing data');
    }

    // Transform data to match search schema
    const document = this.transformDocument(event.data, event.documentType);

    // Update the document (Typesense will handle upsert)
    await searchService.indexDocuments(collectionName, [document]);

    logger.debug(`Updated document: ${document.id} in ${collectionName} (type: ${event.documentType})`);
  }

  private async handleDelete(searchService: any, collectionName: string, event: DatabaseChangeEvent) {
    if (!event.data?.id) {
      throw new Error('Delete event missing document ID');
    }

    // For now, we'll need to implement document deletion in the search service
    // This is a TODO item that needs to be added to the ISearchService interface
    logger.warn(`Document deletion not yet implemented for document: ${event.data.id} in ${collectionName} (type: ${event.documentType})`);

    // TODO: Implement delete operation in search providers
    // await searchService.deleteDocument(collectionName, event.data.id);
  }

  private async handleBulkUpdate(searchService: any, collectionName: string, event: DatabaseChangeEvent) {
    if (!event.data?.documents || !Array.isArray(event.data.documents)) {
      throw new Error('Bulk update event missing documents array');
    }

    const documents = event.data.documents.map((doc: any) =>
      this.transformDocument(doc, event.documentType),
    );

    // Batch index all documents
    await searchService.indexDocuments(collectionName, documents);

    logger.debug(`Bulk updated ${documents.length} documents in ${collectionName} (type: ${event.documentType})`);
  }

  private async handleBulkDelete(searchService: any, collectionName: string, event: DatabaseChangeEvent) {
    if (!event.data?.documentIds || !Array.isArray(event.data.documentIds)) {
      throw new Error('Bulk delete event missing documentIds array');
    }

    logger.warn(`Bulk document deletion not yet implemented for ${event.data.documentIds.length} documents in ${collectionName} (type: ${event.documentType})`);

    // TODO: Implement bulk delete operation in search providers
    // await searchService.deleteDocuments(collectionName, event.data.documentIds);
  }

  private async processBulkOperation(
    documentType: DocumentType,
    eventType: ChangeEventType,
    events: DatabaseChangeEvent[],
  ): Promise<boolean> {
    try {
      const searchService = await getGlobalSearchService();
      const collectionName = this.getCollectionName(documentType);

      if (eventType === 'BULK_UPDATE') {
        // Combine all documents from the events
        const allDocuments = events
          .flatMap(event => event.data?.documents || [])
          .map(doc => this.transformDocument(doc, documentType));

        if (allDocuments.length > 0) {
          await searchService.indexDocuments(collectionName, allDocuments);
          logger.info(`Bulk updated ${allDocuments.length} documents of type ${documentType}`);
        }
      } else if (eventType === 'BULK_DELETE') {
        // Combine all document IDs from the events
        const allDocumentIds = events
          .flatMap(event => event.data?.documentIds || []);

        if (allDocumentIds.length > 0) {
          logger.warn(`Bulk delete requested for ${allDocumentIds.length} documents but not yet implemented`);
          // TODO: Implement bulk delete
        }
      }

      return true;
    } catch (error) {
      logger.error(`Bulk operation failed: ${eventType} for ${documentType}`, error as Error);
      return false;
    }
  }

  private groupEvents(events: DatabaseChangeEvent[]): Map<string, DatabaseChangeEvent[]> {
    const groups = new Map<string, DatabaseChangeEvent[]>();

    for (const event of events) {
      const key = `${event.documentType}:${event.eventType}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(event);
    }

    return groups;
  }

  private transformDocument(data: any, documentType: DocumentType): any {
    // Add document_type field and ensure proper structure
    const transformed = {
      ...data,
      document_type: documentType,
    };

    // Add type-specific transformations
    switch (documentType) {
      case 'software_stack':
        return {
          ...transformed,
          id: data.id || data.name?.toLowerCase().replace(/\s+/g, '_'),
          popularity_score: data.popularity_score || 0,
        };

      case 'claims':
        return {
          ...transformed,
          id: data.claimId || data.id,
          created_at: data.created_at || new Date(data.lastModifiedDate || Date.now()).getTime(),
        };

      case 'locations':
        return {
          ...transformed,
          id: data.id,
          location: data.location || this.parseLocationCoordinates(data.postalCodeCenterPoint),
          created_at: data.created_at || new Date(data.lastModifiedDate || Date.now()).getTime(),
        };

      default:
        return transformed;
    }
  }

  private parseLocationCoordinates(centerPoint: string): [number, number] | undefined {
    if (!centerPoint) return undefined;

    const coords = centerPoint.split(',').map(coord => parseFloat(coord.trim()));
    if (coords.length === 2 && !isNaN(coords[0]!) && !isNaN(coords[1]!)) {
      return [coords[0]!, coords[1]!];
    }
    return undefined;
  }

  private getCollectionName(documentType: DocumentType): string {
    const schema = COLLECTION_SCHEMAS[documentType];
    if (!schema) {
      throw new Error(`Unknown document type: ${documentType}`);
    }
    return schema.name;
  }

  private recordSuccess() {
    this.lastProcessedAt = Date.now();
    this.totalProcessed++;
  }

  private recordError() {
    this.errorCount++;
    this.totalProcessed++;
  }
}
