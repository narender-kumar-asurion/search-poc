#!/usr/bin/env ts-node

/**
 * Utility script to validate JSON seed data files
 * Usage: npx ts-node src/utils/validate-seed-data.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { ClaimDocument, LocationDocument } from '../schema';

interface ValidationResult {
  file: string;
  valid: boolean;
  errors: string[];
  count: number;
}

/**
 * Validate claims data structure (warranty/insurance claims)
 */
function validateClaimsData(data: any[]): string[] {
  const errors: string[] = [];

  data.forEach((claim, index) => {
    // Core required fields (always present)
    const coreRequiredFields = [
      'claimId', 'claimNumber', 'claimType', 'claimStatus', 'claimStatusGroup',
      'referenceNumber', 'serviceProviderId', 'serviceProviderCountry',
      'serviceAdministratorId', 'consumerName', 'consumerNameFirst',
      'consumerAddLine1', 'consumerAddCity', 'consumerAddState',
      'consumerPostalCode', 'postalCodeFive', 'countryCodeTwo',
      'consumerAddPhone', 'productConsumerId', 'serialNumber', 'warrantyType',
    ];

    coreRequiredFields.forEach(field => {
      if (!claim[field] || typeof claim[field] !== 'string') {
        errors.push(`Claim ${index}: Invalid or missing ${field}`);
      }
    });

    // Optional string fields (validate if present)
    const optionalStringFields = [
      'serviceProviderLocationId', 'consumerCompanyName',
      'productBrandCode', 'modelNumber',
    ];

    optionalStringFields.forEach(field => {
      if (claim[field] && typeof claim[field] !== 'string') {
        errors.push(`Claim ${index}: Invalid ${field}, must be string if provided`);
      }
    });

    // Required number fields
    if (typeof claim.amountRequested !== 'number' || claim.amountRequested < 0) {
      errors.push(`Claim ${index}: Invalid amountRequested, must be a non-negative number`);
    }

    // Optional number fields
    const optionalNumberFields = ['amountApproved', 'distributorAmount'];
    optionalNumberFields.forEach(field => {
      if (claim[field] !== undefined && (typeof claim[field] !== 'number' || claim[field] < 0)) {
        errors.push(`Claim ${index}: Invalid ${field}, must be a non-negative number if provided`);
      }
    });

    // Required date fields (ISO format)
    const requiredDateFields = [
      'dateAdded', 'dateSubmitted', 'claimDate', 'siCubeDate',
      'statusChangeTimestamp', 'lastModifiedDate',
    ];

    requiredDateFields.forEach(field => {
      if (!claim[field] || typeof claim[field] !== 'string') {
        errors.push(`Claim ${index}: Invalid ${field}, must be ISO date string`);
      } else {
        const date = new Date(claim[field]);
        if (isNaN(date.getTime())) {
          errors.push(`Claim ${index}: ${field} must be valid ISO date string`);
        }
      }
    });

    // Optional date field
    if (claim.dateApproved) {
      if (typeof claim.dateApproved !== 'string') {
        errors.push(`Claim ${index}: dateApproved must be ISO date string if provided`);
      } else {
        const date = new Date(claim.dateApproved);
        if (isNaN(date.getTime())) {
          errors.push(`Claim ${index}: dateApproved must be valid ISO date string`);
        }
      }
    }

    // Version field
    if (!claim._version_ || typeof claim._version_ !== 'number') {
      errors.push(`Claim ${index}: Invalid _version_, must be a number`);
    }
  });

  return errors;
}

/**
 * Validate locations data structure (postal code-based schema)
 */
function validateLocationsData(data: any[]): string[] {
  const errors: string[] = [];

  data.forEach((location, index) => {
    if (!location.id) errors.push(`Location ${index}: Missing id`);

    if (!location.countryId || typeof location.countryId !== 'string') {
      errors.push(`Location ${index}: Invalid countryId`);
    }

    if (!location.postalCodeGroup || typeof location.postalCodeGroup !== 'string') {
      errors.push(`Location ${index}: Invalid postalCodeGroup`);
    }

    if (!location.postalCode || typeof location.postalCode !== 'string') {
      errors.push(`Location ${index}: Invalid postalCode`);
    }

    if (!location.provinceId || typeof location.provinceId !== 'string') {
      errors.push(`Location ${index}: Invalid provinceId`);
    }

    if (!location.lastModifiedDate || typeof location.lastModifiedDate !== 'string') {
      errors.push(`Location ${index}: Invalid lastModifiedDate`);
    } else {
      // Validate ISO date format
      const date = new Date(location.lastModifiedDate);
      if (isNaN(date.getTime())) {
        errors.push(`Location ${index}: lastModifiedDate must be valid ISO date string`);
      }
    }

    // Validate postalCodeCenterPoint format
    if (!location.postalCodeCenterPoint || typeof location.postalCodeCenterPoint !== 'string') {
      errors.push(`Location ${index}: Missing postalCodeCenterPoint`);
    } else {
      const coords = location.postalCodeCenterPoint.split(',');
      if (coords.length !== 2) {
        errors.push(`Location ${index}: postalCodeCenterPoint must be "lat,lng" format`);
      } else {
        const [lat, lng] = coords.map((coord: string) => parseFloat(coord.trim()));
        if (isNaN(lat) || isNaN(lng)) {
          errors.push(`Location ${index}: postalCodeCenterPoint coordinates must be valid numbers`);
        }
        if (lat < -90 || lat > 90) {
          errors.push(`Location ${index}: Invalid latitude, must be between -90 and 90`);
        }
        if (lng < -180 || lng > 180) {
          errors.push(`Location ${index}: Invalid longitude, must be between -180 and 180`);
        }
      }
    }

    if (!location._version_ || typeof location._version_ !== 'number') {
      errors.push(`Location ${index}: Invalid _version_, must be a number`);
    }
  });

  return errors;
}

/**
 * Validate a JSON data file
 */
function validateDataFile(filePath: string, validator: (data: any[]) => string[]): ValidationResult {
  try {
    const fileContent = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);

    if (!Array.isArray(data)) {
      return {
        file: filePath,
        valid: false,
        errors: ['File must contain a JSON array'],
        count: 0,
      };
    }

    const errors = validator(data);

    return {
      file: filePath,
      valid: errors.length === 0,
      errors,
      count: data.length,
    };
  } catch (error) {
    return {
      file: filePath,
      valid: false,
      errors: [`Failed to read/parse file: ${error instanceof Error ? error.message : String(error)}`],
      count: 0,
    };
  }
}

/**
 * Main validation function
 */
function validateSeedData(): void {
  console.log('🔍 Validating seed data files...\n');

  const seedDataDir = join(__dirname, '..', 'seed-data');

  const results: ValidationResult[] = [
    validateDataFile(join(seedDataDir, 'claims.json'), validateClaimsData),
    validateDataFile(join(seedDataDir, 'locations.json'), validateLocationsData),
  ];

  let allValid = true;

  results.forEach(result => {
    const status = result.valid ? '✅' : '❌';
    const fileName = result.file.split('/').pop();

    console.log(`${status} ${fileName} (${result.count} records)`);

    if (!result.valid) {
      allValid = false;
      result.errors.forEach(error => {
        console.log(`   └── ${error}`);
      });
    }

    console.log('');
  });

  if (allValid) {
    console.log('🎉 All seed data files are valid!');
    console.log('\nSummary:');
    results.forEach(result => {
      const fileName = result.file.split('/').pop();
      console.log(`  • ${fileName}: ${result.count} records`);
    });
  } else {
    console.log('❌ Some seed data files have validation errors. Please fix them before seeding.');
    process.exit(1);
  }
}

// Run validation if script is executed directly
if (require.main === module) {
  validateSeedData();
}

export { validateSeedData, validateClaimsData, validateLocationsData };
