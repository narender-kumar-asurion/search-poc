import { 
  SearchParams, 
  SearchResponse, 
  HealthResponse, 
  FacetsResponse,
  ClaimSearchParams,
  LocationSearchParams 
} from '../types/search'
import { SearchResponseSchema } from '../lib/schemas'

const API_BASE = '/api'

class SearchAPI {
  async health(): Promise<HealthResponse> {
    const response = await fetch(`${API_BASE}/health`)
    if (!response.ok) {
      throw new Error('Health check failed')
    }
    return response.json()
  }

  async search({ q, filters, page = 1, limit = 10 }: SearchParams): Promise<SearchResponse> {
    const params = new URLSearchParams({ 
      q,
      page: page.toString(),
      limit: limit.toString()
    })
    
    if (filters?.category) {
      params.append('category', filters.category)
    }
    
    if (filters?.tags?.length) {
      filters.tags.forEach(tag => params.append('tags', tag))
    }

    const response = await fetch(`${API_BASE}/search?${params}`)
    
    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`)
    }
    
    const json = await response.json()
    return SearchResponseSchema.parse(json)
  }

  async searchByCategory(category: string): Promise<SearchResponse> {
    const response = await fetch(`${API_BASE}/search/category/${encodeURIComponent(category)}`)
    
    if (!response.ok) {
      throw new Error(`Category search failed: ${response.status}`)
    }
    
    const json = await response.json()
    return SearchResponseSchema.parse(json)
  }

  async searchByTags(tags: string[]): Promise<SearchResponse> {
    const response = await fetch(`${API_BASE}/search/tags`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tags }),
    })
    
    if (!response.ok) {
      throw new Error(`Tag search failed: ${response.status}`)
    }
    
    const json = await response.json()
    return SearchResponseSchema.parse(json)
  }

  async getFacets(): Promise<FacetsResponse> {
    const response = await fetch(`${API_BASE}/facets`)
    
    if (!response.ok) {
      throw new Error(`Facets fetch failed: ${response.status}`)
    }
    
    return response.json()
  }

  async searchClaims({ q, filters, page = 1, limit = 10 }: ClaimSearchParams): Promise<SearchResponse> {
    const params = new URLSearchParams({ 
      q,
      page: page.toString(),
      limit: limit.toString()
    })
    
    if (filters?.claimType) {
      params.append('claimType', filters.claimType)
    }
    
    if (filters?.claimStatus) {
      params.append('claimStatus', filters.claimStatus)
    }
    
    if (filters?.province) {
      params.append('province', filters.province)
    }

    const response = await fetch(`${API_BASE}/search/claims?${params}`)
    
    if (!response.ok) {
      throw new Error(`Claims search failed: ${response.status}`)
    }
    
    return response.json()
  }

  async searchLocations({ q, filters, page = 1, limit = 10 }: LocationSearchParams): Promise<SearchResponse> {
    const params = new URLSearchParams({ 
      q,
      page: page.toString(),
      limit: limit.toString()
    })
    
    if (filters?.province) {
      params.append('province', filters.province)
    }
    
    if (filters?.postalCode) {
      params.append('postalCode', filters.postalCode)
    }

    const response = await fetch(`${API_BASE}/search/locations?${params}`)
    
    if (!response.ok) {
      throw new Error(`Locations search failed: ${response.status}`)
    }
    
    return response.json()
  }
}

export const searchAPI = new SearchAPI() 