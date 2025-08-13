# Seed Data Files

This directory contains JSON files with sample data for the different document types in our search system.

## Files

### `claims.json`
Contains warranty/insurance claims data with comprehensive tracking fields:

**Core Claim Fields:**
- `claimId`: Unique claim identifier (serves as primary ID)
- `claimNumber`: Human-readable claim number
- `claimType`: Type of claim (e.g., "WARRTY")
- `claimStatus`: Current status code (e.g., "APP", "PND")
- `claimStatusGroup`: Status group number
- `referenceNumber`: Internal reference number

**Service Provider Fields:**
- `serviceProviderId`: ID of the service provider
- `serviceProviderCountry`: Country code for service provider
- `serviceProviderLocationId`: Location ID of service provider
- `serviceAdministratorId`: Administrator handling the claim

**Consumer Information:**
- `consumerName`: Consumer/company name
- `consumerNameFirst`: First name of consumer contact
- `consumerCompanyName`: Company name (e.g., "TIM HORTONS STORE#576")
- `consumerAddLine1`: Street address
- `consumerAddCity`: City
- `consumerAddState`: State/province
- `consumerPostalCode`: Full postal code
- `postalCodeFive`: Shortened postal code
- `countryCodeTwo`: Two-letter country code
- `consumerAddPhone`: Phone number

**Product Information:**
- `productConsumerId`: Consumer product ID
- `productBrandCode`: Brand code (e.g., "MERRYCHE")
- `modelNumber`: Product model number
- `serialNumber`: Product serial number
- `warrantyType`: Type of warranty

**Financial Fields:**
- `amountRequested`: Amount requested for claim
- `amountApproved`: Amount approved for claim
- `distributorAmount`: Distributor amount

**Date Fields (ISO format):**
- `dateAdded`: When claim was added to system
- `dateSubmitted`: When claim was submitted
- `dateApproved`: When claim was approved (optional)
- `claimDate`: Original claim date
- `siCubeDate`: SI cube processing date
- `statusChangeTimestamp`: Last status change
- `lastModifiedDate`: Last modification date

**System Fields:**
- `_version_`: Version number for tracking changes

**Note**: The system automatically transforms this data by:
- Adding `document_type: "claim"`
- Using `claimId` as the primary `id`
- Converting `lastModifiedDate` to `created_at` Unix timestamp
- Renaming `_version_` to `version`

### `locations.json`
Contains postal code geographic data with geo-coordinates:
- `id`: Unique identifier (format: "countryId-postalCode")
- `countryId`: Country identifier (numeric string)
- `postalCodeGroup`: Partial postal code grouping
- `postalCode`: Full postal code
- `provinceId`: Province/state identifier (e.g., "BC", "ON")
- `postalCodeCenterPoint`: Coordinates as "lat,lng" string
- `lastModifiedDate`: ISO date string when last updated
- `_version_`: Version number for tracking changes

**Note**: The system automatically transforms this data by:
- Adding `document_type: "location"`
- Converting `postalCodeCenterPoint` string to `location: [lat, lng]` array
- Converting `lastModifiedDate` to `created_at` Unix timestamp
- Renaming `_version_` to `version`

## Usage

### Adding New Data
1. Edit the JSON files directly with your preferred editor
2. Follow the existing structure and data types
3. For claims: Use the warranty claims schema format with:
   - All required string fields filled
   - Date fields as ISO date strings (e.g., "2018-01-16T06:00:00Z")
   - Numeric amounts as floats
   - `_version_` as numeric version
4. For locations: Use the postal code schema format with:
   - `postalCodeCenterPoint` as "lat,lng" string
   - `lastModifiedDate` as ISO date string
   - `_version_` as numeric version

### Re-seeding Data
After updating the JSON files, re-run the seeding process:

```bash
# Seed all collections
npm run seed

# Seed specific collection
node src/data.ts --collection=claims
node src/data.ts --collection=locations
```

### Validation
The TypeScript interfaces in `src/schema.ts` provide type checking for the data structure. If you add invalid data, TypeScript will show errors during compilation.

## Tips

- For locations: Use real postal codes and coordinates for your region
- Coordinates in `postalCodeCenterPoint` should be "latitude,longitude" format
- Keep claim amounts realistic for the claim type  
- ISO dates can be generated with `new Date().toISOString()` in JavaScript
- Unix timestamps can be generated with `Date.now()` in JavaScript
- Test geo-search functionality with locations spread across different regions
- Province/state codes should be standard abbreviations (BC, ON, CA, TX, etc.)