/**
 * Configuration Management
 * Centralized configuration for the entire application
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface AppConfig {
  api: {
    port: number;
    host: string;
    cors: {
      origin: string;
    };
    auth: {
      enabled: boolean;
      apiKey?: string;
    };
  };
  search: {
    provider: 'typesense' | 'meilisearch';
    typesense: {
      host: string;
      port: number;
      protocol: 'http' | 'https';
      apiKey: string;
      collection: string;
      timeout: number;
      retries: number;
    };
    meilisearch: {
      host: string;
      port: number;
      protocol: 'http' | 'https';
      masterKey: string;
      index: string;
      timeout: number;
    };
  };
  sync: {
    aws: {
      region: string;
      sqsQueueUrl?: string;
      snsTopicArn?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
    };
  };
  logging: {
    level: string;
  };
  env: string;
}

export const config: AppConfig = {
  api: {
    port: parseInt(process.env.API_PORT || '3001'),
    host: process.env.API_HOST || 'localhost',
    cors: {
      origin: process.env.API_CORS_ORIGIN || '*',
    },
    auth: {
      enabled: process.env.API_AUTH_ENABLED === 'true',
      apiKey: process.env.API_KEY,
    },
  },
  search: {
    provider: (process.env.SEARCH_PROVIDER as 'typesense' | 'meilisearch') || 'typesense',
    typesense: {
      host: process.env.TYPESENSE_HOST || 'localhost',
      port: parseInt(process.env.TYPESENSE_PORT || '8108'),
      protocol: (process.env.TYPESENSE_PROTOCOL as 'http' | 'https') || 'http',
      apiKey: process.env.TYPESENSE_API_KEY || '',
      collection: process.env.TYPESENSE_COLLECTION || 'software_stack_components',
      timeout: parseInt(process.env.TYPESENSE_TIMEOUT || '2'),
      retries: parseInt(process.env.TYPESENSE_RETRIES || '3'),
    },
    meilisearch: {
      host: process.env.MEILISEARCH_HOST || 'localhost',
      port: parseInt(process.env.MEILISEARCH_PORT || '7700'),
      protocol: (process.env.MEILISEARCH_PROTOCOL as 'http' | 'https') || 'http',
      masterKey: process.env.MEILISEARCH_MASTER_KEY || '',
      index: process.env.MEILISEARCH_INDEX || 'software_stack_components',
      timeout: parseInt(process.env.MEILISEARCH_TIMEOUT || '5'),
    },
  },
  sync: {
    aws: {
      region: process.env.AWS_REGION || 'us-west-2',
      sqsQueueUrl: process.env.AWS_SQS_QUEUE_URL,
      snsTopicArn: process.env.AWS_SNS_TOPIC_ARN,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  },
  logging: {
    level: process.env.LOG_LEVEL || 'INFO',
  },
  env: process.env.NODE_ENV || 'development',
};

export default config;
