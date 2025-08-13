import { Input } from './ui/input'
import { SearchFilters as SearchFiltersType } from '../types/search'

interface SearchFiltersProps {
  filters: SearchFiltersType
  onFiltersChange: (filters: SearchFiltersType) => void
}

const categories = [
  'Frontend Framework',
  'Runtime Environment', 
  'Database',
  'Containerization',
  'Container Orchestration',
  'Programming Language'
]

export default function SearchFilters({ filters, onFiltersChange }: SearchFiltersProps) {
  const handleCategoryChange = (category: string) => {
    onFiltersChange({
      ...filters,
      category: category || undefined
    })
  }

  const handleTagsChange = (tagsInput: string) => {
    const tags = tagsInput
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
    
    onFiltersChange({
      ...filters,
      tags: tags.length > 0 ? tags : undefined
    })
  }

  return (
    <div className="flex gap-4 flex-wrap">
      <select
        value={filters.category || ''}
        onChange={(e) => handleCategoryChange(e.target.value)}
        className="px-3 py-2 border border-input rounded-md bg-background text-sm"
      >
        <option value="">All Categories</option>
        {categories.map(category => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>

      <Input
        placeholder="Filter by tags (comma-separated)"
        value={filters.tags?.join(', ') || ''}
        onChange={(e) => handleTagsChange(e.target.value)}
        className="flex-1 min-w-[200px]"
      />
    </div>
  )
} 