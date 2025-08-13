import { useMemo, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Search, Loader2, FileText } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import SearchProviderIndicator, { useSearchProvider } from './SearchProviderIndicator'
import { searchAPI } from '../services/searchAPI'
import { ClaimFilters, ClaimResult } from '../types/search'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

export default function ClaimsSearch() {
  const [query, setQuery] = useState('warranty')
  const [filters, setFilters] = useState<ClaimFilters>({})
  const providerName = useSearchProvider()
  const debouncedQuery = useDebouncedValue(query, 350)
  const queryKey = useMemo(() => ['claims-search', debouncedQuery, filters], [debouncedQuery, filters])

  const {
    data: searchData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey,
    queryFn: () => searchAPI.searchClaims({ q: debouncedQuery, filters }),
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
      <Card className="bg-gradient-to-r from-green-600 to-blue-600 text-white border-0">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold mb-2 flex items-center justify-center gap-3">
            <FileText className="h-8 w-8" />
            {providerName} Claims Search
          </CardTitle>
          <CardDescription className="text-green-100 text-lg">
            Search warranty claims and service records
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
                placeholder="Search claims by customer name, claim number, product..."
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
            
            <ClaimFiltersComponent filters={filters} onFiltersChange={setFilters} />
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      <ClaimResults 
        data={searchData}
        isLoading={isLoading}
        error={error}
        query={query}
      />
    </div>
  )
}

function ClaimFiltersComponent({ filters, onFiltersChange }: {
  filters: ClaimFilters
  onFiltersChange: (filters: ClaimFilters) => void
}) {
  const claimTypes = ['WARRTY', 'SERVICE', 'REPAIR', 'REPLACEMENT']
  const claimStatuses = ['APP', 'PEN', 'REJ', 'COM']
  const provinces = ['ON', 'BC', 'AB', 'QC', 'MB', 'SK', 'NS', 'NB', 'PE', 'NL']

  return (
    <div className="flex gap-4 flex-wrap">
      <select
        value={filters.claimType || ''}
        onChange={(e) => onFiltersChange({ ...filters, claimType: e.target.value || undefined })}
        className="px-3 py-2 border border-input rounded-md bg-background text-sm"
      >
        <option value="">All Claim Types</option>
        {claimTypes.map(type => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>

      <select
        value={filters.claimStatus || ''}
        onChange={(e) => onFiltersChange({ ...filters, claimStatus: e.target.value || undefined })}
        className="px-3 py-2 border border-input rounded-md bg-background text-sm"
      >
        <option value="">All Statuses</option>
        {claimStatuses.map(status => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>

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
    </div>
  )
}

function ClaimResults({ data, isLoading, error, query }: {
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
            <p className="text-muted-foreground">Searching claims...</p>
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
            <FileText className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Claims Search Error</p>
              <p className="text-sm text-destructive/80">
                Failed to search claims. Please try again.
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
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No claims found</h3>
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
              Found {data.found} claim{data.found !== 1 ? 's' : ''} for "{query}"
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results List */}
      {data.results.map((claim: ClaimResult, index: number) => (
        <ClaimCard key={`${claim.claimId}-${index}`} claim={claim} />
      ))}
    </div>
  )
}

function ClaimCard({ claim }: { claim: ClaimResult }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APP': return 'bg-green-100 text-green-800'
      case 'PEN': return 'bg-yellow-100 text-yellow-800'
      case 'REJ': return 'bg-red-100 text-red-800'
      default: return 'bg-blue-100 text-blue-800'
    }
  }

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === 0) return 'N/A'
    return new Intl.NumberFormat('en-CA', { 
      style: 'currency', 
      currency: 'CAD' 
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-CA')
  }

  return (
    <Card className="hover:shadow-md transition-shadow border-l-4 border-l-green-600">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <CardTitle className="text-xl">
              {claim.claimNumber}
            </CardTitle>
            <div className="flex gap-2">
              <Badge className={getStatusColor(claim.claimStatus)}>
                {claim.claimStatus}
              </Badge>
              <Badge variant="outline">{claim.claimType}</Badge>
            </div>
          </div>
          {claim.score && (
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
              Score: {Math.round(claim.score)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            <div>
              <span className="font-medium text-sm text-muted-foreground">Customer:</span>
              <p className="font-medium">
                {claim.consumerNameFirst} {claim.consumerName}
                {claim.consumerCompanyName && (
                  <span className="text-muted-foreground"> ({claim.consumerCompanyName})</span>
                )}
              </p>
            </div>
            <div>
              <span className="font-medium text-sm text-muted-foreground">Location:</span>
              <p>{claim.consumerAddCity}, {claim.consumerAddState} {claim.consumerPostalCode}</p>
            </div>
            {claim.serialNumber && (
              <div>
                <span className="font-medium text-sm text-muted-foreground">Serial Number:</span>
                <p className="font-mono text-sm">{claim.serialNumber}</p>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div>
              <span className="font-medium text-sm text-muted-foreground">Claim Date:</span>
              <p>{formatDate(claim.claimDate)}</p>
            </div>
            <div>
              <span className="font-medium text-sm text-muted-foreground">Amount Requested:</span>
              <p className="font-medium">{formatCurrency(claim.amountRequested)}</p>
            </div>
            {claim.amountApproved !== undefined && (
              <div>
                <span className="font-medium text-sm text-muted-foreground">Amount Approved:</span>
                <p className="font-medium text-green-600">{formatCurrency(claim.amountApproved)}</p>
              </div>
            )}
          </div>
        </div>
        
        {(claim.productBrandCode || claim.modelNumber) && (
          <div className="pt-4 border-t">
            <span className="font-medium text-sm text-muted-foreground">Product:</span>
            <div className="flex gap-2 mt-1">
              {claim.productBrandCode && (
                <Badge variant="outline">{claim.productBrandCode}</Badge>
              )}
              {claim.modelNumber && (
                <Badge variant="outline" className="font-mono text-xs">{claim.modelNumber}</Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}