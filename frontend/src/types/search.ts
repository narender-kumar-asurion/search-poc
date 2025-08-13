export interface SearchResult {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  score?: number
  highlights?: SearchHighlight[]
}

export interface ClaimResult extends SearchResult {
  category: 'claim'
  claimId: string
  claimNumber: string
  claimType: string
  claimStatus: string
  consumerName: string
  consumerNameFirst: string
  consumerCompanyName?: string
  consumerAddCity: string
  consumerAddState: string
  consumerPostalCode: string
  province: string
  serialNumber: string
  modelNumber?: string
  productBrandCode?: string
  amountRequested: number
  amountApproved?: number
  claimDate: string
  dateSubmitted: string
}

export interface LocationResult extends SearchResult {
  category: 'location'
  postalCode: string
  postalCodeGroup: string
  provinceId: string
  province: string
  countryId: string
  location: [number, number]
  postalCodeCenterPoint: string
  latitude: number | null
  longitude: number | null
}

export interface SearchHighlight {
  field: string
  matches: string[]
}

export interface SearchFacet {
  field: string
  values: Array<{
    value: string
    count: number
  }>
}

export interface SearchPagination {
  currentPage: number
  totalPages: number
  hasNext: boolean
  hasPrevious: boolean
}

export interface SearchResponse {
  success: boolean
  query: string
  found: number
  results: SearchResult[]
  facets?: SearchFacet[]
  pagination?: SearchPagination
  searchTime?: number
  message?: string
}

export interface SearchFilters {
  category?: string
  tags?: string[]
}

export interface ClaimFilters {
  claimType?: string
  claimStatus?: string
  province?: string
}

export interface LocationFilters {
  province?: string
  postalCode?: string
}

export interface SearchParams {
  q: string
  filters?: SearchFilters
  page?: number
  limit?: number
}

export interface ClaimSearchParams {
  q: string
  filters?: ClaimFilters
  page?: number
  limit?: number
}

export interface LocationSearchParams {
  q: string
  filters?: LocationFilters
  page?: number
  limit?: number
}

export interface HealthResponse {
  status: 'OK' | 'ERROR'
  message: string
  provider: string
  features: string[]
}

export interface FacetsResponse {
  success: boolean
  facets: SearchFacet[]
} 