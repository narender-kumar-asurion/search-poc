import { useMemo, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Search, Loader2, MapPin } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import SearchProviderIndicator, { useSearchProvider } from './SearchProviderIndicator'
import { searchAPI } from '../services/searchAPI'
import { LocationFilters, LocationResult } from '../types/search'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

export default function LocationsSearch() {
  const [query, setQuery] = useState('V5B')
  const [filters, setFilters] = useState<LocationFilters>({})
  const providerName = useSearchProvider()
  const debouncedQuery = useDebouncedValue(query, 350)
  const queryKey = useMemo(() => ['locations-search', debouncedQuery, filters], [debouncedQuery, filters])

  const {
    data: searchData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey,
    queryFn: () => searchAPI.searchLocations({ q: debouncedQuery, filters }),
    enabled: !!debouncedQuery.trim(),
    placeholderData: keepPreviousData,
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (debouncedQuery.trim()) {
      refetch()
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold mb-2 flex items-center justify-center gap-3">
            <MapPin className="h-8 w-8" />
            {providerName} Locations Search
          </CardTitle>
          <CardDescription className="text-purple-100 text-lg">
            Search postal codes and geographic locations
          </CardDescription>
        </CardHeader>
      </Card>

      {/* API Status */}
      <SearchProviderIndicator />

      {/* Search Form */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-3">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by postal code, province, or region..."
                className="flex-1"
              />
              <Button type="submit" disabled={isLoading || !query.trim()}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search
              </Button>
            </div>
            
            <LocationFiltersComponent filters={filters} onFiltersChange={setFilters} />
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      <LocationResults 
        data={searchData}
        isLoading={isLoading}
        error={error}
        query={query}
      />
    </div>
  )
}

function LocationFiltersComponent({ filters, onFiltersChange }: {
  filters: LocationFilters
  onFiltersChange: (filters: LocationFilters) => void
}) {
  const provinces = ['BC', 'AB', 'SK', 'MB', 'ON', 'QC', 'NB', 'NS', 'PE', 'NL', 'YT', 'NT', 'NU']

  return (
    <div className="flex gap-4 flex-wrap">
      <select
        value={filters.province || ''}
        onChange={(e) => onFiltersChange({ ...filters, province: e.target.value || undefined })}
        className="px-3 py-2 border border-input rounded-md bg-background text-sm"
      >
        <option value="">All Provinces</option>
        {provinces.map(province => (
          <option key={province} value={province}>
            {province}
          </option>
        ))}
      </select>

      <Input
        placeholder="Filter by postal code"
        value={filters.postalCode || ''}
        onChange={(e) => onFiltersChange({ ...filters, postalCode: e.target.value || undefined })}
        className="w-48"
      />
    </div>
  )
}

function LocationResults({ data, isLoading, error, query }: {
  data: any
  isLoading: boolean
  error: unknown
  query: string
}) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p className="text-muted-foreground">Searching locations...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-md border border-destructive/20">
            <MapPin className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Locations Search Error</p>
              <p className="text-sm text-destructive/80">
                Failed to search locations. Please try again.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data?.success || data.results.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <MapPin className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No locations found</h3>
            <p className="text-muted-foreground">
              Try different keywords or adjust filters
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Results Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <div className="font-medium">
              Found {data.found} location{data.found !== 1 ? 's' : ''} for "{query}"
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results List */}
      {data.results.map((location: LocationResult, index: number) => (
        <LocationCard key={`${location.id}-${index}`} location={location} />
      ))}
    </div>
  )
}

function LocationCard({ location }: { location: LocationResult }) {
  const getGoogleMapsLink = (lat: number | null, lng: number | null) => {
    if (lat && lng) {
      return `https://www.google.com/maps?q=${lat},${lng}`
    }
    return null
  }

  return (
    <Card className="hover:shadow-md transition-shadow border-l-4 border-l-purple-600">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <CardTitle className="text-xl">
              {location.postalCode}
            </CardTitle>
            <div className="flex gap-2">
              <Badge className="bg-purple-100 text-purple-800">
                {location.provinceId}
              </Badge>
              <Badge variant="outline">{location.postalCodeGroup}</Badge>
            </div>
          </div>
          {location.score && (
            <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">
              Score: {Math.round(location.score)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            <div>
              <span className="font-medium text-sm text-muted-foreground">Province:</span>
              <p className="font-medium">{location.provinceId}</p>
            </div>
            <div>
              <span className="font-medium text-sm text-muted-foreground">Postal Code Group:</span>
              <p>{location.postalCodeGroup}</p>
            </div>
            <div>
              <span className="font-medium text-sm text-muted-foreground">Country:</span>
              <p>{location.countryId === '124' ? 'Canada' : location.countryId}</p>
            </div>
          </div>
          <div className="space-y-2">
            {location.latitude && location.longitude && (
              <>
                <div>
                  <span className="font-medium text-sm text-muted-foreground">Coordinates:</span>
                  <p className="font-mono text-sm">
                    {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-sm text-muted-foreground">View on Map:</span>
                  <div className="mt-1">
                    <a
                      href={getGoogleMapsLink(location.latitude, location.longitude) || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                    >
                      <MapPin className="h-4 w-4" />
                      Open in Google Maps
                    </a>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        
        <div className="pt-4 border-t">
          <span className="font-medium text-sm text-muted-foreground">Raw Center Point:</span>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            {location.postalCodeCenterPoint}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}