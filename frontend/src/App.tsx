import { useState } from 'react'
import { Database, FileText, MapPin, Search } from 'lucide-react'
import SearchPage from './components/SearchPage'
import ClaimsSearch from './components/ClaimsSearch'
import LocationsSearch from './components/LocationsSearch'
import { Card, CardContent } from './components/ui/card'

type SearchType = 'software' | 'claims' | 'locations'

function App() {
  const [activeTab, setActiveTab] = useState<SearchType>('claims')

  const tabs = [
    {
      id: 'software' as const,
      label: 'Software Stack',
      icon: Search,
      component: SearchPage
    },
    {
      id: 'claims' as const,
      label: 'Claims',
      icon: FileText,
      component: ClaimsSearch
    },
    {
      id: 'locations' as const,
      label: 'Locations',
      icon: MapPin,
      component: LocationsSearch
    }
  ]

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || SearchPage

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Navigation Tabs */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-1 p-1 bg-muted rounded-lg">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Active Search Component */}
        <ActiveComponent />

        {/* Footer */}
        <Card className="mt-8 bg-muted/50">
          <CardContent className="pt-6">
            <div className="text-center text-sm text-muted-foreground">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Database className="h-4 w-4" />
                Field Service POC - Search Demo
              </div>
              <p>
                Search across {tabs.length} different data types: Software Components, Warranty Claims, and Geographic Locations
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default App 