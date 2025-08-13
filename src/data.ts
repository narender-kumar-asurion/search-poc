import { getGlobalSearchService } from './services/search';
import { logger } from './lib/logger';
import {
  SoftwareStackComponent,
  ClaimDocument,
  LocationDocument,
  COLLECTION_SCHEMAS,
  CollectionType,
} from './schema';

// Import JSON data files
import claimsData from './seed-data/claims.json';
import rawLocationsData from './seed-data/locations.json';

// Raw location data structure from JSON
interface RawLocationData {
  countryId: string;
  postalCodeGroup: string;
  postalCode: string;
  lastModifiedDate: string;
  provinceId: string;
  id: string;
  postalCodeCenterPoint: string;
  _version_: number;
}

// Raw claims data structure from JSON
interface RawClaimData {
  serviceProviderId: string;
  serviceProviderCountry: string;
  distributorAmount?: number; // Optional
  consumerAddState: string;
  claimStatusGroup: string;
  dateAdded: string;
  claimType: string;
  referenceNumber: string;
  dateApproved?: string; // Optional
  consumerCompanyName?: string; // Optional
  siCubeDate: string;
  amountRequested: number;
  claimNumber: string;
  amountApproved?: number; // Optional
  productBrandCode?: string; // Optional
  serialNumber: string;
  lastModifiedDate: string;
  serviceProviderLocationId?: string; // Optional
  productConsumerId: string;
  consumerNameFirst: string;
  consumerAddLine1: string;
  claimId: string;
  statusChangeTimestamp: string;
  consumerAddPhone: string;
  serviceAdministratorId: string;
  claimDate: string;
  consumerPostalCode: string;
  warrantyType: string;
  postalCodeFive: string;
  modelNumber?: string; // Optional
  consumerAddCity: string;
  countryCodeTwo: string;
  dateSubmitted: string;
  claimStatus: string;
  consumerName: string;
  _version_: number;
}

/**
 * Sample data for software stack components
 */
const softwareStackData: SoftwareStackComponent[] = [
  {
    id: '1',
    document_type: 'software_stack',
    name: 'React',
    category: 'Frontend Framework',
    description: 'A JavaScript library for building user interfaces, particularly single-page applications where you need dynamic, interactive UIs.',
    tags: ['javascript', 'frontend', 'ui', 'spa', 'component-based'],
    popularity_score: 95,
  },
  {
    id: '2',
    document_type: 'software_stack',
    name: 'Node.js',
    category: 'Runtime Environment',
    description: 'A JavaScript runtime built on Chrome\'s V8 JavaScript engine that allows you to run JavaScript on the server side.',
    tags: ['javascript', 'backend', 'runtime', 'server', 'event-driven'],
    popularity_score: 90,
  },
  {
    id: '3',
    document_type: 'software_stack',
    name: 'PostgreSQL',
    category: 'Database',
    description: 'A powerful, open-source object-relational database system with over 30 years of active development.',
    tags: ['database', 'sql', 'relational', 'acid', 'open-source'],
    popularity_score: 85,
  },
  {
    id: '4',
    document_type: 'software_stack',
    name: 'Docker',
    category: 'Containerization',
    description: 'A platform that uses OS-level virtualization to deliver software in packages called containers.',
    tags: ['containerization', 'devops', 'deployment', 'microservices', 'infrastructure'],
    popularity_score: 88,
  },
  {
    id: '5',
    document_type: 'software_stack',
    name: 'Kubernetes',
    category: 'Container Orchestration',
    description: 'An open-source container orchestration platform for automating deployment, scaling, and management of containerized applications.',
    tags: ['orchestration', 'containers', 'devops', 'scaling', 'microservices'],
    popularity_score: 80,
  },
  {
    id: '6',
    document_type: 'software_stack',
    name: 'TypeScript',
    category: 'Programming Language',
    description: 'A strongly typed programming language that builds on JavaScript, giving you better tooling at any scale.',
    tags: ['typescript', 'javascript', 'static-typing', 'microsoft', 'compiler'],
    popularity_score: 87,
  },
];

/**
 * Transform raw location data to match LocationDocument interface
 */
function transformLocationData(rawData: RawLocationData[]): LocationDocument[] {
  return rawData.map(item => {
    // Parse coordinates from "lat,lng" string to [lat, lng] array
    const coords = item.postalCodeCenterPoint.split(',').map(coord => parseFloat(coord.trim()));
    const lat = coords[0] || 0;
    const lng = coords[1] || 0;

    // Convert ISO date string to Unix timestamp
    const created_at = new Date(item.lastModifiedDate).getTime();

    return {
      id: item.id,
      document_type: 'location' as const,
      countryId: item.countryId,
      postalCodeGroup: item.postalCodeGroup,
      postalCode: item.postalCode,
      provinceId: item.provinceId,
      location: [lat, lng] as [number, number],
      postalCodeCenterPoint: item.postalCodeCenterPoint,
      lastModifiedDate: item.lastModifiedDate,
      version: item._version_,
      created_at,
    };
  });
}

/**
 * Transform raw claims data to match ClaimDocument interface
 */
function transformClaimData(rawData: RawClaimData[]): ClaimDocument[] {
  return rawData.map(item => {
    // Convert ISO date string to Unix timestamp for created_at
    const created_at = new Date(item.lastModifiedDate).getTime();

    const transformed: ClaimDocument = {
      id: item.claimId,
      document_type: 'claim' as const,
      claimId: item.claimId,
      claimNumber: item.claimNumber,
      claimType: item.claimType,
      claimStatus: item.claimStatus,
      claimStatusGroup: item.claimStatusGroup,
      referenceNumber: item.referenceNumber,
      serviceProviderId: item.serviceProviderId,
      serviceProviderCountry: item.serviceProviderCountry,
      serviceAdministratorId: item.serviceAdministratorId,
      consumerName: item.consumerName,
      consumerNameFirst: item.consumerNameFirst,
      consumerAddLine1: item.consumerAddLine1,
      consumerAddCity: item.consumerAddCity,
      consumerAddState: item.consumerAddState,
      consumerPostalCode: item.consumerPostalCode,
      postalCodeFive: item.postalCodeFive,
      countryCodeTwo: item.countryCodeTwo,
      consumerAddPhone: item.consumerAddPhone,
      productConsumerId: item.productConsumerId,
      serialNumber: item.serialNumber,
      warrantyType: item.warrantyType,
      amountRequested: item.amountRequested,
      dateAdded: new Date(item.dateAdded).getTime(),
      dateSubmitted: item.dateSubmitted,
      claimDate: item.claimDate,
      siCubeDate: item.siCubeDate,
      statusChangeTimestamp: item.statusChangeTimestamp,
      lastModifiedDate: item.lastModifiedDate,
      version: item._version_,
      created_at,
    };

    // Add optional fields only if they exist
    if (item.serviceProviderLocationId) {
      transformed.serviceProviderLocationId = item.serviceProviderLocationId;
    }
    if (item.consumerCompanyName) {
      transformed.consumerCompanyName = item.consumerCompanyName;
    }
    if (item.productBrandCode) {
      transformed.productBrandCode = item.productBrandCode;
    }
    if (item.modelNumber) {
      transformed.modelNumber = item.modelNumber;
    }
    if (item.amountApproved !== undefined) {
      transformed.amountApproved = item.amountApproved;
    }
    if (item.distributorAmount !== undefined) {
      transformed.distributorAmount = item.distributorAmount;
    }
    if (item.dateApproved) {
      transformed.dateApproved = item.dateApproved;
    }

    return transformed;
  });
}

// Type assertions and transformations for imported JSON data
const typedClaimsData = transformClaimData(claimsData as RawClaimData[]);
const typedLocationsData = transformLocationData(rawLocationsData as RawLocationData[]);

// Collection of all sample data
export const SAMPLE_DATA = {
  software_stack: softwareStackData,
  claims: typedClaimsData,
  locations: typedLocationsData,
} as const;

/**
 * Seed all collections with their respective sample data
 */
export async function seedData(collections?: CollectionType[]): Promise<void> {
  try {
    logger.data('Starting multi-collection data seeding process...');

    const collectionsToSeed = collections || Object.keys(COLLECTION_SCHEMAS) as CollectionType[];

    // Create all collections first
    await createCollections(collectionsToSeed);

    // Index documents for all collections
    await indexAllDocuments(collectionsToSeed);

    logger.success('All collections seeded successfully!');
  } catch (error) {
    logger.error('Data seeding failed', error as Error);
    throw error;
  }
}

/**
 * Seed a specific collection type
 */
export async function seedCollection(collectionType: CollectionType): Promise<void> {
  try {
    logger.data(`Starting seeding for ${collectionType} collection...`);

    await createCollections([collectionType]);
    await indexAllDocuments([collectionType]);

    logger.success(`${collectionType} collection seeded successfully!`);
  } catch (error) {
    logger.error(`Failed to seed ${collectionType} collection`, error as Error);
    throw error;
  }
}

async function createCollections(collections: CollectionType[]): Promise<void> {
  try {
    logger.data('Setting up collections...');

    const searchService = await getGlobalSearchService();

    for (const collectionType of collections) {
      const schema = COLLECTION_SCHEMAS[collectionType];
      logger.data(`Creating collection: ${schema.name}`);

      // Actually create the collection in Typesense
      await searchService.createCollection(schema.name, schema);
      logger.success(`Collection ${schema.name} created successfully!`);
    }

    logger.success('All collections created successfully!');
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      logger.info('One or more collections already exist, skipping creation.');
      logger.info('TIP: If you have schema issues, run: npm run reset');
    } else {
      logger.error('Error creating collections', error);
      logger.info('TIP: Try running: npm run reset');
      throw error;
    }
  }
}

async function indexAllDocuments(collections: CollectionType[]): Promise<void> {
  try {
    logger.data('Indexing documents for all collections...');

    for (const collectionType of collections) {
      const documents = SAMPLE_DATA[collectionType];
      await indexCollectionDocuments(collectionType, documents);
    }

    logger.success('All documents indexed successfully!');
  } catch (error) {
    logger.error('Error indexing documents', error as Error);
    throw error;
  }
}

async function indexCollectionDocuments(
  collectionType: CollectionType,
  documents: readonly any[],
): Promise<void> {
  try {
    const schema = COLLECTION_SCHEMAS[collectionType];
    logger.data(`Indexing ${documents.length} documents for ${schema.name}...`);

    const searchService = await getGlobalSearchService();

    // Actually index the documents in Typesense
    await searchService.indexDocuments(schema.name, documents as any[]);

    for (const document of documents) {
      const documentName = getDocumentDisplayName(document);
      logger.debug(`Indexed ${collectionType}: ${documentName}`);
    }

    logger.success(`${collectionType} collection indexed successfully!`);
  } catch (error) {
    logger.error(`Error indexing ${collectionType} documents`, error as Error);
    throw error;
  }
}

/**
 * Get a display name for a document based on its type
 */
function getDocumentDisplayName(document: any): string {
  switch (document.document_type) {
    case 'software_stack':
      return document.name;
    case 'claim':
      return `${document.claimNumber} - ${document.consumerName}`;
    case 'location':
      return `${document.postalCode} (${document.provinceId})`;
    default:
      return document.id || 'Unknown';
  }
}

/**
 * Utility functions for specific collection types
 */
export const seedingUtils = {
  /**
   * Seed only software stack data
   */
  seedSoftwareStack: () => seedCollection('software_stack'),

  /**
   * Seed only claims data
   */
  seedClaims: () => seedCollection('claims'),

  /**
   * Seed only locations data
   */
  seedLocations: () => seedCollection('locations'),

  /**
   * Get sample data for a specific collection
   */
  getSampleData: (collectionType: CollectionType) => SAMPLE_DATA[collectionType],

  /**
   * Get collection schema
   */
  getSchema: (collectionType: CollectionType) => COLLECTION_SCHEMAS[collectionType],
};

// Run seeding if this file is executed directly
if (require.main === module) {
  // Check for command line arguments to seed specific collections
  const args = process.argv.slice(2);
  const collectionArg = args.find(arg => arg.startsWith('--collection='));

  if (collectionArg) {
    const collectionType = collectionArg.split('=')[1] as CollectionType;
    if (COLLECTION_SCHEMAS[collectionType]) {
      seedCollection(collectionType);
    } else {
      logger.error(`Invalid collection type: ${collectionType}`);
      logger.info(`Available collections: ${Object.keys(COLLECTION_SCHEMAS).join(', ')}`);
    }
  } else {
    seedData();
  }
}
