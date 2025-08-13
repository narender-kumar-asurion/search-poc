import { AlertCircle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { SearchResponse, SearchResult } from '../types/search'

interface SearchResultsProps {
  data?: SearchResponse
  isLoading: boolean
  error: unknown
  query: string
}

export default function SearchResults({ data, isLoading, error, query }: SearchResultsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p className="text-muted-foreground">Searching...</p>
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
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Search Error</p>
              <p className="text-sm text-destructive/80">
                Failed to connect to search API. Make sure the server is running.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data?.success) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-md border border-destructive/20">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Search Failed</p>
              <p className="text-sm text-destructive/80">
                {data?.message || 'Unknown error occurred'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (data.results.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium mb-2">No results found</h3>
            <p className="text-muted-foreground">
              Try different keywords or remove filters
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
              Found {data.found} result{data.found !== 1 ? 's' : ''} for "{query}"
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results List */}
      {data.results.map((result, index) => (
        <ResultCard key={`${result.name}-${index}`} result={result} />
      ))}
    </div>
  )
}

function ResultCard({ result }: { result: SearchResult }) {
  return (
    <Card className="hover:shadow-md transition-shadow border-l-4 border-l-primary">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <CardTitle className="text-xl">{result.name}</CardTitle>
            <Badge variant="secondary">{result.category}</Badge>
          </div>
          {result.score && (
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
              Score: {Math.round(result.score)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-base mb-4 leading-relaxed">
          {result.description}
        </CardDescription>
        <div className="flex gap-2 flex-wrap">
          {result.tags.map(tag => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
} 