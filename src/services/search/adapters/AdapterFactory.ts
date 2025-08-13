/**
 * Adapter Factory
 *
 * Simple, clean factory for creating search adapters.
 * Replaces the over-engineered SearchServiceFactory.
 */

import { SearchAdapter, SearchConfig, SearchProvider, SearchAdapterError } from './SearchAdapter';
import { TypesenseAdapter } from './TypesenseAdapter';
import { MeilisearchAdapter } from './MeilisearchAdapter';
import { logger } from '../../../lib/logger';
import { config } from '../../../config';

/**
 * Available search providers
 */
export const SUPPORTED_PROVIDERS: readonly SearchProvider[] = ['typesense', 'meilisearch'] as const;

/**
 * Provider feature matrix
 */
export const PROVIDER_FEATURES = {
  typesense: {
    name: 'Typesense',
    strengths: ['typo-tolerance', 'real-time', 'easy-setup', 'geo-search'],
    limitations: ['smaller-ecosystem'],
    useCase: 'Fast search with typo tolerance, good for most applications',
  },
  meilisearch: {
    name: 'Meilisearch',
    strengths: ['fast', 'relevant-results', 'easy-setup', 'open-source'],
    limitations: ['limited-analytics'],
    useCase: 'Instant search experience, great for documentation and content',
  },
} as const;

/**
 * Simple adapter factory class
 */
export class AdapterFactory {
  private static adapters = new Map<string, SearchAdapter>();

  /**
   * Create a search adapter for the specified provider
   */
  static async createAdapter(config: SearchConfig): Promise<SearchAdapter> {
    this.validateConfig(config);

    const cacheKey = this.createCacheKey(config);

    // Return cached adapter if available
    if (this.adapters.has(cacheKey)) {
      const adapter = this.adapters.get(cacheKey)!;
      // Verify adapter is still connected
      if (await adapter.healthCheck()) {
        return adapter;
      } else {
        // Remove stale adapter from cache
        this.adapters.delete(cacheKey);
      }
    }

    // Create new adapter
    const adapter = this.createAdapterInstance(config.provider);
    await adapter.initialize(config);

    // Cache the adapter
    this.adapters.set(cacheKey, adapter);

    logger.info(`Created ${config.provider} adapter`);
    return adapter;
  }

  /**
   * Create adapter from environment variables
   */
  static async createFromEnvironment(provider?: SearchProvider): Promise<SearchAdapter> {
    const config = this.getConfigFromEnvironment(provider);
    return this.createAdapter(config);
  }

  /**
   * Get provider recommendations based on requirements
   */
  static getProviderRecommendation(requirements: {
    realTime?: boolean;
    typoTolerance?: boolean;
    easySetup?: boolean;
    openSource?: boolean;
  }): SearchProvider {
    // Simple recommendation logic
    if (requirements.typoTolerance && requirements.realTime) {
      return 'typesense';
    }

    if (requirements.openSource) {
      return 'meilisearch';
    }

    // Default to Typesense for current setup
    return 'typesense';
  }

  /**
   * Clear all cached adapters
   */
  static clearCache(): void {
    this.adapters.clear();
    logger.info('Cleared adapter cache');
  }

  /**
   * Clear cache for specific provider
   */
  static clearProviderCache(provider: SearchProvider): void {
    for (const [key, adapter] of this.adapters.entries()) {
      if (key.startsWith(provider)) {
        this.adapters.delete(key);
      }
    }
    logger.info(`Cleared cache for ${provider}`);
  }

  /**
   * Get all supported providers
   */
  static getSupportedProviders(): readonly SearchProvider[] {
    return SUPPORTED_PROVIDERS;
  }

  /**
   * Get provider features and information
   */
  static getProviderInfo(provider: SearchProvider) {
    return PROVIDER_FEATURES[provider];
  }

  /**
   * Validate that provider is supported
   */
  static isProviderSupported(provider: string): provider is SearchProvider {
    return SUPPORTED_PROVIDERS.includes(provider as SearchProvider);
  }

  /**
   * Get health status of all cached adapters
   */
  static async getHealthStatus(): Promise<Record<string, boolean>> {
    const status: Record<string, boolean> = {};

    for (const [key, adapter] of this.adapters.entries()) {
      const provider = key.split(':')[0]!;
      status[provider] = await adapter.healthCheck();
    }

    return status;
  }

  /**
   * Create adapter instance for provider
   */
  private static createAdapterInstance(provider: SearchProvider): SearchAdapter {
    switch (provider) {
      case 'typesense':
        return new TypesenseAdapter();
      case 'meilisearch':
        return new MeilisearchAdapter();
      default:
        throw new SearchAdapterError(
          `Unsupported search provider: ${provider}. Supported providers: ${SUPPORTED_PROVIDERS.join(', ')}`,
          'UNSUPPORTED_PROVIDER',
        );
    }
  }

  /**
   * Validate search configuration
   */
  private static validateConfig(config: SearchConfig): void {
    if (!config.provider) {
      throw new SearchAdapterError('Search provider is required', 'INVALID_CONFIG');
    }

    if (!this.isProviderSupported(config.provider)) {
      throw new SearchAdapterError(
        `Unsupported search provider: ${config.provider}. Supported providers: ${SUPPORTED_PROVIDERS.join(', ')}`,
        'UNSUPPORTED_PROVIDER',
      );
    }

    if (!config.connection) {
      throw new SearchAdapterError('Connection configuration is required', 'INVALID_CONFIG');
    }

    // Provider-specific validation
    this.validateProviderConfig(config);
  }

  /**
   * Provider-specific configuration validation
   */
  private static validateProviderConfig(config: SearchConfig): void {
    const { provider, connection } = config;

    switch (provider) {
      case 'typesense':
        if (!connection.host || !connection.apiKey) {
          throw new SearchAdapterError(
            'Typesense requires host and apiKey in connection config',
            'INVALID_CONFIG',
          );
        }
        break;

      case 'meilisearch':
        if (!connection.host) {
          throw new SearchAdapterError(
            'Meilisearch requires host in connection config',
            'INVALID_CONFIG',
          );
        }
        break;

      default:
        throw new SearchAdapterError(
          `Unknown provider validation: ${provider}`,
          'INVALID_CONFIG',
        );
    }
  }

  /**
   * Get configuration from environment variables
   */
  private static getConfigFromEnvironment(provider?: SearchProvider): SearchConfig {
    const selectedProvider = provider || config.search.provider;

    if (!this.isProviderSupported(selectedProvider)) {
      throw new SearchAdapterError(
        `Unsupported provider from environment: ${selectedProvider}`,
        'INVALID_CONFIG',
      );
    }

    const isDev = (process.env.NODE_ENV || 'development') !== 'production' ;

    switch (selectedProvider) {
      case 'typesense':
        {
          const apiKey = process.env.TYPESENSE_API_KEY;
          if (!apiKey && !isDev) {
            throw new SearchAdapterError(
              'TYPESENSE_API_KEY is required in production environments',
              'INVALID_CONFIG',
            );
          }
        }
        return {
          provider: 'typesense',
          connection: {
            host: process.env.TYPESENSE_HOST || 'localhost',
            port: parseInt(process.env.TYPESENSE_PORT || '8108'),
            protocol: (process.env.TYPESENSE_PROTOCOL as 'http' | 'https') || 'http',
            apiKey: process.env.TYPESENSE_API_KEY || 'dev-api-key-change-in-production',
            indexName: process.env.TYPESENSE_COLLECTION || 'software_stack_components',
          },
          options: {
            timeout: parseInt(process.env.TYPESENSE_TIMEOUT || '2'),
            retries: parseInt(process.env.TYPESENSE_RETRIES || '3'),
            logLevel: (process.env.TYPESENSE_LOG_LEVEL as any) || 'info',
          },
        };

      case 'meilisearch':
        {
          const apiKey = process.env.MEILISEARCH_MASTER_KEY || process.env.MEILISEARCH_API_KEY;
          if (!apiKey && !isDev) {
            throw new SearchAdapterError(
              'MEILISEARCH_MASTER_KEY or MEILISEARCH_API_KEY is required in production environments',
              'INVALID_CONFIG',
            );
          }
        }
        return {
          provider: 'meilisearch',
          connection: {
            host: process.env.MEILISEARCH_HOST || 'localhost',
            port: parseInt(process.env.MEILISEARCH_PORT || '7700'),
            protocol: (process.env.MEILISEARCH_PROTOCOL as 'http' | 'https') || 'http',
            apiKey: process.env.MEILISEARCH_API_KEY || '',
            masterKey: process.env.MEILISEARCH_MASTER_KEY,
            indexName: process.env.MEILISEARCH_INDEX || 'software_stack_components',
          },
          options: {
            timeout: parseInt(process.env.MEILISEARCH_TIMEOUT || '5'),
            logLevel: (process.env.LOG_LEVEL as any) || 'info',
          },
        };

      default:
        throw new SearchAdapterError(
          `Configuration not implemented for provider: ${selectedProvider}`,
          'INVALID_CONFIG',
        );
    }
  }

  /**
   * Create cache key for adapter instance
   */
  private static createCacheKey(config: SearchConfig): string {
    const { provider, connection } = config;
    return `${provider}:${connection.host}:${connection.port}:${connection.indexName || 'default'}`;
  }
}

/**
 * Convenience function to create an adapter
 */
export async function createSearchAdapter(config?: SearchConfig): Promise<SearchAdapter> {
  if (config) {
    return AdapterFactory.createAdapter(config);
  } else {
    return AdapterFactory.createFromEnvironment();
  }
}

/**
 * Global adapter instance (singleton pattern)
 */
let globalAdapter: SearchAdapter | null = null;

export async function getGlobalAdapter(): Promise<SearchAdapter> {
  if (!globalAdapter) {
    globalAdapter = await AdapterFactory.createFromEnvironment();
  }
  return globalAdapter;
}

export function resetGlobalAdapter(): void {
  globalAdapter = null;
  AdapterFactory.clearCache();
}
