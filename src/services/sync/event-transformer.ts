import { IEventTransformer, DatabaseChangeEvent, DocumentType, ChangeEventType } from './interfaces';
import { logger } from '../../lib/logger';

/**
 * Transforms raw database events to standardized format
 */
export class DatabaseEventTransformer implements IEventTransformer {

  transformEvent(rawEvent: any, source: string): DatabaseChangeEvent {
    try {
      // Handle different event sources and formats
      switch (source) {
        case 'sqs':
          return this.transformSQSEvent(rawEvent);
        case 'database-trigger':
          return this.transformDatabaseTriggerEvent(rawEvent);
        case 'api':
          return this.transformAPIEvent(rawEvent);
        default:
          return this.transformGenericEvent(rawEvent, source);
      }
    } catch (error) {
      logger.error(`Failed to transform event from source: ${source} - Raw event: ${JSON.stringify(rawEvent)}`, error as Error);
      throw new Error(`Event transformation failed: ${(error as Error).message}`);
    }
  }

  validateEvent(event: DatabaseChangeEvent): boolean {
    try {
      // Required fields validation
      if (!event.id || !event.eventType || !event.documentType || !event.timestamp) {
        logger.warn(`Event missing required fields: ${JSON.stringify(event)}`);
        return false;
      }

      // Event type validation
      const validEventTypes: ChangeEventType[] = ['INSERT', 'UPDATE', 'DELETE', 'BULK_UPDATE', 'BULK_DELETE'];
      if (!validEventTypes.includes(event.eventType)) {
        logger.warn(`Invalid event type: ${event.eventType} for event ID: ${event.id}`);
        return false;
      }

      // Document type validation
      const validDocumentTypes: DocumentType[] = ['software_stack', 'claims', 'locations'];
      if (!validDocumentTypes.includes(event.documentType)) {
        logger.warn(`Invalid document type: ${event.documentType} for event ID: ${event.id}`);
        return false;
      }

      // Data validation based on event type
      if (['INSERT', 'UPDATE'].includes(event.eventType) && !event.data) {
        logger.warn(`${event.eventType} event missing data for event ID: ${event.id}`);
        return false;
      }

      if (event.eventType === 'DELETE' && !event.data?.id) {
        logger.warn(`DELETE event missing document ID for event ID: ${event.id}`);
        return false;
      }

      if (['BULK_UPDATE', 'BULK_DELETE'].includes(event.eventType)) {
        if (event.eventType === 'BULK_UPDATE' && (!event.data?.documents || !Array.isArray(event.data.documents))) {
          logger.warn(`BULK_UPDATE event missing documents array for event ID: ${event.id}`);
          return false;
        }

        if (event.eventType === 'BULK_DELETE' && (!event.data?.documentIds || !Array.isArray(event.data.documentIds))) {
          logger.warn(`BULK_DELETE event missing documentIds array for event ID: ${event.id}`);
          return false;
        }
      }

      // Timestamp validation
      const now = Date.now();
      const eventAge = now - event.timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (eventAge > maxAge) {
        logger.warn(`Event is too old: ${eventAge}ms for event ID: ${event.id}`);
        return false;
      }

      if (event.timestamp > now + 60000) { // 1 minute future tolerance
        logger.warn(`Event timestamp is in the future: ${event.timestamp} for event ID: ${event.id}`);
        return false;
      }

      return true;

    } catch (error) {
      logger.error(`Event validation failed for event ID: ${event.id}`, error as Error);
      return false;
    }
  }

  extractDocumentType(event: any): DocumentType | null {
    try {
      // Try direct mapping
      if (event.documentType || event.document_type) {
        return event.documentType || event.document_type;
      }

      // Try to infer from table name or collection
      if (event.tableName || event.table || event.collection) {
        const tableName = event.tableName || event.table || event.collection;
        return this.mapTableToDocumentType(tableName);
      }

      // Try to infer from data structure
      if (event.data) {
        return this.inferDocumentTypeFromData(event.data);
      }

      return null;
    } catch (error) {
      logger.error(`Failed to extract document type from event: ${JSON.stringify(event)}`, error as Error);
      return null;
    }
  }

  private transformSQSEvent(rawEvent: any): DatabaseChangeEvent {
    // Handle AWS DMS format or custom format
    const eventData = rawEvent.eventName ? this.transformDMSEvent(rawEvent) : rawEvent;

    return {
      id: eventData.id || this.generateEventId(eventData),
      eventType: this.mapEventType(eventData.eventType || eventData.eventName),
      documentType: this.extractDocumentType(eventData) || 'software_stack',
      timestamp: eventData.timestamp || Date.now(),
      data: eventData.data || eventData.dynamodb?.NewImage || eventData.fullDocument,
      oldData: eventData.oldData || eventData.dynamodb?.OldImage || eventData.fullDocumentBeforeChange,
      metadata: {
        source: 'sqs',
        correlationId: eventData.correlationId,
        user: eventData.user,
        batchId: eventData.batchId,
      },
    };
  }

  private transformDatabaseTriggerEvent(rawEvent: any): DatabaseChangeEvent {
    return {
      id: rawEvent.id || this.generateEventId(rawEvent),
      eventType: this.mapEventType(rawEvent.operation || rawEvent.eventType),
      documentType: this.extractDocumentType(rawEvent) || 'software_stack',
      timestamp: new Date(rawEvent.timestamp || rawEvent.ts).getTime(),
      data: rawEvent.new || rawEvent.data,
      oldData: rawEvent.old || rawEvent.oldData,
      metadata: {
        source: 'database-trigger',
        user: rawEvent.user || rawEvent.userId,
        correlationId: rawEvent.correlationId,
      },
    };
  }

  private transformAPIEvent(rawEvent: any): DatabaseChangeEvent {
    return {
      id: rawEvent.id || this.generateEventId(rawEvent),
      eventType: rawEvent.eventType || 'UPDATE',
      documentType: rawEvent.documentType || 'software_stack',
      timestamp: rawEvent.timestamp || Date.now(),
      data: rawEvent.data,
      oldData: rawEvent.oldData,
      metadata: {
        source: 'api',
        user: rawEvent.userId || rawEvent.user,
        correlationId: rawEvent.correlationId,
      },
    };
  }

  private transformGenericEvent(rawEvent: any, source: string): DatabaseChangeEvent {
    return {
      id: rawEvent.id || this.generateEventId(rawEvent),
      eventType: this.mapEventType(rawEvent.eventType || rawEvent.action || 'UPDATE'),
      documentType: this.extractDocumentType(rawEvent) || 'software_stack',
      timestamp: this.parseTimestamp(rawEvent.timestamp || rawEvent.ts || rawEvent.time),
      data: rawEvent.data || rawEvent.document || rawEvent.payload,
      oldData: rawEvent.oldData || rawEvent.previousData,
      metadata: {
        source,
        correlationId: rawEvent.correlationId || rawEvent.traceId,
        user: rawEvent.user || rawEvent.userId,
      },
    };
  }

  private transformDMSEvent(dmsEvent: any): any {
    // AWS DMS event transformation
    const eventName = dmsEvent.eventName;
    let eventType: ChangeEventType;

    switch (eventName) {
      case 'INSERT':
        eventType = 'INSERT';
        break;
      case 'MODIFY':
        eventType = 'UPDATE';
        break;
      case 'REMOVE':
        eventType = 'DELETE';
        break;
      default:
        eventType = 'UPDATE';
    }

    return {
      id: dmsEvent.eventID || this.generateEventId(dmsEvent),
      eventType,
      documentType: this.mapTableToDocumentType(dmsEvent.eventSourceARN),
      timestamp: new Date(dmsEvent.dynamodb?.ApproximateCreationDateTime || Date.now()).getTime(),
      data: dmsEvent.dynamodb?.NewImage ? this.unmarshalDynamoDBItem(dmsEvent.dynamodb.NewImage) : null,
      oldData: dmsEvent.dynamodb?.OldImage ? this.unmarshalDynamoDBItem(dmsEvent.dynamodb.OldImage) : null,
    };
  }

  private mapEventType(eventType: string): ChangeEventType {
    const typeMap: Record<string, ChangeEventType> = {
      'INSERT': 'INSERT',
      'CREATE': 'INSERT',
      'ADD': 'INSERT',
      'UPDATE': 'UPDATE',
      'MODIFY': 'UPDATE',
      'CHANGE': 'UPDATE',
      'DELETE': 'DELETE',
      'REMOVE': 'DELETE',
      'BULK_INSERT': 'BULK_UPDATE',
      'BULK_UPDATE': 'BULK_UPDATE',
      'BULK_DELETE': 'BULK_DELETE',
      'BULK_REMOVE': 'BULK_DELETE',
    };

    const normalizedType = eventType?.toUpperCase();
    return typeMap[normalizedType] || 'UPDATE';
  }

  private mapTableToDocumentType(tableName: string): DocumentType | null {
    const tableMap: Record<string, DocumentType> = {
      'software_components': 'software_stack',
      'software_stack_components': 'software_stack',
      'software': 'software_stack',
      'claims': 'claims',
      'warranty_claims': 'claims',
      'insurance_claims': 'claims',
      'locations': 'locations',
      'postal_codes': 'locations',
      'addresses': 'locations',
    };

    // Extract table name from ARN if needed
    const extractedName = tableName.includes('/') ?
      tableName.split('/').pop()?.toLowerCase() :
      tableName.toLowerCase();

    return extractedName ? tableMap[extractedName] || null : null;
  }

  private inferDocumentTypeFromData(data: any): DocumentType | null {
    if (!data || typeof data !== 'object') {
      return null;
    }

    // Check for characteristic fields
    if (data.claimId || data.claimNumber || data.claimType) {
      return 'claims';
    }

    if (data.postalCode || data.location || data.coordinates) {
      return 'locations';
    }

    if (data.category || data.tags || data.popularity_score) {
      return 'software_stack';
    }

    return null;
  }

  private parseTimestamp(timestamp: any): number {
    if (typeof timestamp === 'number') {
      // Handle both milliseconds and seconds
      return timestamp > 1e12 ? timestamp : timestamp * 1000;
    }

    if (typeof timestamp === 'string') {
      const parsed = new Date(timestamp).getTime();
      return isNaN(parsed) ? Date.now() : parsed;
    }

    return Date.now();
  }

  private generateEventId(event: any): string {
    // Generate a unique ID for the event
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const hash = this.simpleHash(JSON.stringify(event));

    return `evt_${timestamp}_${hash}_${random}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private unmarshalDynamoDBItem(item: any): any {
    // Simple DynamoDB attribute value unmarshalling
    const result: any = {};

    for (const [key, value] of Object.entries(item)) {
      if (typeof value === 'object' && value !== null) {
        const attrValue = value as any;
        if (attrValue.S) result[key] = attrValue.S;
        else if (attrValue.N) result[key] = Number(attrValue.N);
        else if (attrValue.BOOL) result[key] = attrValue.BOOL;
        else if (attrValue.SS) result[key] = attrValue.SS;
        else if (attrValue.NS) result[key] = attrValue.NS.map(Number);
        else if (attrValue.L) result[key] = attrValue.L.map((item: any) => this.unmarshalDynamoDBItem(item));
        else if (attrValue.M) result[key] = this.unmarshalDynamoDBItem(attrValue.M);
        else result[key] = value;
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}
