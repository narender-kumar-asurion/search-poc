import { useMemo, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Search, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Button } from './ui/button'
import SearchFilters from './SearchFilters'
import SearchResults from './SearchResults'
import SearchProviderIndicator, { useSearchProvider } from './SearchProviderIndicator'
import { searchAPI } from '../services/searchAPI'
import { SearchFilters as SearchFiltersType } from '../types/search'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

export default function SearchPage() {
  const [query, setQuery] = useState('javascript')
  const [filters, setFilters] = useState<SearchFiltersType>({})
  const debouncedQuery = useDebouncedValue(query, 350)
  const queryKey = useMemo(() => ['search', debouncedQuery, filters], [debouncedQuery, filters])

  const {
    data: searchData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey,
    queryFn: () => searchAPI.search({ q: debouncedQuery, filters }),
    enabled: !!debouncedQuery.trim(),
    placeholderData: keepPreviousData,
  })

  const providerName = useSearchProvider()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (debouncedQuery.trim()) {
      refetch()
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <Card className="mb-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
        <CardHeader className="text-center">
          <CardTitle className="text-4xl font-bold mb-2 flex items-center justify-center gap-3">
            <Search className="h-10 w-10" />
            {providerName} Search
          </CardTitle>
          <CardDescription className="text-blue-100 text-lg">
            Search software stack components with advanced filtering
          </CardDescription>
        </CardHeader>
      </Card>

      {/* API Status */}
      <div className="mb-6">
        <SearchProviderIndicator />
      </div>

      {/* Search Form */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-3">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for technologies, frameworks, databases..."
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
            
            <SearchFilters filters={filters} onFiltersChange={setFilters} />
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      <SearchResults 
        data={searchData}
        isLoading={isLoading}
        error={error}
        query={query}
      />
    </div>
  )
}

 