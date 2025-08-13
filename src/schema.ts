import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

/**
 * Base interface for all document types
 */
export interface BaseDocument {
  id: string;
  document_type: string;
  created_at?: number; // Unix timestamp
  updated_at?: number; // Unix timestamp
}

/**
 * Schema definition for software stack components collection
 */
export const softwareStackSchema: CollectionCreateSchema = {
  name: process.env.SOFTWARE_COLLECTION_NAME || 'software_stack_components',
  fields: [
    {
      name: 'id',
      type: 'string',
      facet: false,
      index: true,
    },
    {
      name: 'document_type',
      type: 'string',
      facet: true,
      index: true,
    },
    {
      name: 'name',
      type: 'string',
      facet: false,
      index: true,
    },
    {
      name: 'category',
      type: 'string',
      facet: true,
      index: true,
    },
    {
      name: 'description',
      type: 'string',
      facet: false,
      index: true,
    },
    {
      name: 'tags',
      type: 'string[]',
      facet: true,
      index: true,
    },
    {
      name: 'popularity_score',
      type: 'int32',
      facet: false,
      index: true,
    },
  ],
  default_sorting_field: 'popularity_score',
};

/**
 * Schema definition for claims collection (warranty/insurance claims)
 */
export const claimsSchema: CollectionCreateSchema = {
  name: process.env.CLAIMS_COLLECTION_NAME || 'claims',
  fields: [
    {
      name: 'id',
      type: 'string',
      facet: false,
      index: true,
    },
    {
      name: 'document_type',
      type: 'string',
      facet: true,
      index: true,
    },
    {
      name: 'claimId',
      type: 'string',
      facet: false,
      index: true,
    },
    {
      name: 'claimNumber',
      type: 'string',
      facet: false,
      index: true,
    },
    {
      name: 'claimType',
      type: 'string',
      facet: true,
      index: true,
    },
    {
      name: 'claimStatus',
      type: 'string',
      facet: true,
      index: true,
    },
    {
      name: 'claimStatusGroup',
      type: 'string',
      facet: true,
      index: true,
    },
    {
      name: 'referenceNumber',
      type: 'string',
      facet: false,
      index: true,
    },
    {
      name: 'serviceProviderId',
      type: 'string',
      facet: true,
      index: true,
    },
    {
      name: 'serviceProviderCountry',
      type: 'string',
      facet: true,
      index: true,
    },
    {
      name: 'serviceProviderLocationId',
      type: 'string',
      facet: true,
      index: true,
      optional: true,
    },
    {
      name: 'serviceAdministratorId',
      type: 'string',
      facet: true,
      index: true,
    },
    {
      name: 'consumerName',
      type: 'string',
      facet: false,
      index: true,
    },
    {
      name: 'consumerNameFirst',
      type: 'string',
      facet: false,
      index: true,
    },
    {
      name: 'consumerCompanyName',
      type: 'string',
      facet: false,
      index: true,
      optional: true,
    },
    {
      name: 'consumerAddLine1',
      type: 'string',
      facet: false,
      index: true,
    },
    {
      name: 'consumerAddCity',
      type: 'string',
      facet: true,
      index: true,
    },
    {
      name: 'consumerAddState',
      type: 'string',
      facet: true,
      index: true,
    },
    {
      name: 'consumerPostalCode',
      type: 'string',
      facet: true,
      index: true,
    },
    {
      name: 'postalCodeFive',
      type: 'string',
      facet: true,
      index: true,
    },
    {
      name: 'countryCodeTwo',
      type: 'string',
      facet: true,
      index: true,
    },
    {
      name: 'consumerAddPhone',
      type: 'string',
      facet: false,
      index: true,
    },
    {
      name: 'productConsumerId',
      type: 'string',
      facet: true,
      index: true,
    },
    {
      name: 'productBrandCode',
      type: 'string',
      facet: true,
      index: true,
      optional: true,
    },
    {
      name: 'modelNumber',
      type: 'string',
      facet: true,
      index: true,
      optional: true,
    },
    {
      name: 'serialNumber',
      type: 'string',
      facet: false,
      index: true,
    },
    {
      name: 'warrantyType',
      type: 'string',
      facet: true,
      index: true,
    },
    {
      name: 'amountRequested',
      type: 'float',
      facet: false,
      index: true,
    },
    {
      name: 'amountApproved',
      type: 'float',
      facet: false,
      index: true,
      optional: true,
    },
    {
      name: 'distributorAmount',
      type: 'float',
      facet: false,
      index: true,
      optional: true,
    },
    {
      name: 'dateAdded',
      type: 'int64',
      facet: false,
      index: true,
    },
    {
      name: 'dateSubmitted',
      type: 'string',
      facet: false,
      index: true,
    },
    {
      name: 'dateApproved',
      type: 'string',
      facet: false,
      index: true,
      optional: true,
    },
    {
      name: 'claimDate',
      type: 'string',
      facet: false,
      index: true,
    },
    {
      name: 'siCubeDate',
      type: 'string',
      facet: false,
      index: true,
    },
    {
      name: 'statusChangeTimestamp',
      type: 'string',
      facet: false,
      index: true,
    },
    {
      name: 'lastModifiedDate',
      type: 'string',
      facet: false,
      index: true,
    },
    {
      name: 'version',
      type: 'int64',
      facet: false,
      index: true,
    },
    {
      name: 'created_at',
      type: 'int64',
      facet: false,
      index: true,
    },
  ],
  default_sorting_field: 'dateAdded',
};

/**
 * Schema definition for locations collection with geo-search support
 * Based on postal code geographic data
 */
export const locationsSchema: CollectionCreateSchema = {
  name: process.env.LOCATIONS_COLLECTION_NAME || 'locations',
  fields: [
    {
      name: 'id',
      type: 'string',
      facet: false,
      index: true,
    },
    {
      name: 'document_type',
      type: 'string',
      facet: true,
      index: true,
    },
    {
      name: 'countryId',
      type: 'string',
      facet: true,
      index: true,
    },
    {
      name: 'postalCodeGroup',
      type: 'string',
      facet: true,
      index: true,
    },
    {
      name: 'postalCode',
      type: 'string',
      facet: true,
      index: true,
    },
    {
      name: 'provinceId',
      type: 'string',
      facet: true,
      index: true,
    },
    {
      name: 'location',
      type: 'geopoint', // Typesense geo-point for lat/lng
      facet: false,
      index: true,
    },
    {
      name: 'postalCodeCenterPoint',
      type: 'string', // Store original lat,lng string
      facet: false,
      index: true,
    },
    {
      name: 'lastModifiedDate',
      type: 'string',
      facet: false,
      index: true,
    },
    {
      name: 'version',
      type: 'int64',
      facet: false,
      index: true,
    },
    {
      name: 'created_at',
      type: 'int64',
      facet: false,
      index: true,
    },
  ],
  default_sorting_field: 'created_at',
};

// Collection registry for easy management
export const COLLECTION_SCHEMAS = {
  software_stack: softwareStackSchema,
  claims: claimsSchema,
  locations: locationsSchema,
} as const;

export type CollectionType = keyof typeof COLLECTION_SCHEMAS;

/**
 * TypeScript interfaces for document types
 */
export interface SoftwareStackComponent extends BaseDocument {
  document_type: 'software_stack';
  name: string;
  category: string;
  description: string;
  tags: string[];
  popularity_score: number;
}

export interface ClaimDocument extends BaseDocument {
  document_type: 'claim';
  claimId: string;
  claimNumber: string;
  claimType: string;
  claimStatus: string;
  claimStatusGroup: string;
  referenceNumber: string;
  serviceProviderId: string;
  serviceProviderCountry: string;
  serviceProviderLocationId?: string; // Optional
  serviceAdministratorId: string;
  consumerName: string;
  consumerNameFirst: string;
  consumerCompanyName?: string; // Optional
  consumerAddLine1: string;
  consumerAddCity: string;
  consumerAddState: string;
  consumerPostalCode: string;
  postalCodeFive: string;
  countryCodeTwo: string;
  consumerAddPhone: string;
  productConsumerId: string;
  productBrandCode?: string; // Optional
  modelNumber?: string; // Optional
  serialNumber: string;
  warrantyType: string;
  amountRequested: number;
  amountApproved?: number; // Optional
  distributorAmount?: number; // Optional
  dateAdded: number; // Unix timestamp
  dateSubmitted: string; // ISO date string
  dateApproved?: string; // ISO date string, optional
  claimDate: string; // ISO date string
  siCubeDate: string; // ISO date string
  statusChangeTimestamp: string; // ISO date string
  lastModifiedDate: string; // ISO date string
  version: number; // Converted from _version_
}

export interface LocationDocument extends BaseDocument {
  document_type: 'location';
  countryId: string;
  postalCodeGroup: string;
  postalCode: string;
  provinceId: string;
  location: [number, number]; // [lat, lng] - converted from postalCodeCenterPoint
  postalCodeCenterPoint: string; // Original "lat,lng" string format
  lastModifiedDate: string; // ISO date string
  version: number; // Converted from _version_
  created_at: number; // Unix timestamp (converted from lastModifiedDate)
}

export type SearchableDocument = SoftwareStackComponent | ClaimDocument | LocationDocument;
