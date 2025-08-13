import { useQuery } from '@tanstack/react-query'
import { Database } from 'lucide-react'
import { Card, CardContent } from './ui/card'
import { searchAPI } from '../services/searchAPI'

export default function SearchProviderIndicator() {
  const { data: healthData, isError } = useQuery({
    queryKey: ['health'],
    queryFn: () => searchAPI.health(),
    refetchInterval: 30000, // Check every 30 seconds
  })

  const getProviderIcon = (provider: string) => {
    switch (provider?.toLowerCase()) {
      case 'meilisearch':
        return '🔍'
      case 'typesense':
        return '⚡'
      default:
        return '❓'
    }
  }

  const getProviderColor = (provider: string) => {
    switch (provider?.toLowerCase()) {
      case 'meilisearch':
        return 'text-purple-600'
      case 'typesense':
        return 'text-blue-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isError ? 'bg-red-500' : 'bg-green-500'}`} />
          <span className="text-sm font-medium">
            {isError ? 'API Disconnected ✗ - Start the API server first' : 'API Connected ✓'}
          </span>
          {!isError && healthData?.provider && (
            <div className="flex items-center gap-2 ml-4 px-3 py-1 bg-gray-100 rounded-full border">
              <span className="text-lg">{getProviderIcon(healthData.provider)}</span>
              <span className={`text-sm font-semibold ${getProviderColor(healthData.provider)}`}>
                {healthData.provider}
              </span>
            </div>
          )}
          <Database className="h-4 w-4 ml-auto text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  )
}

export function useSearchProvider() {
  const { data: healthData } = useQuery({
    queryKey: ['health'],
    queryFn: () => searchAPI.health(),
    refetchInterval: 30000,
  })

  return healthData?.provider || 'Search'
}