import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { render, createMockSearchResult, createMockApiResponse } from '../../test/utils'
import SearchResults from '../SearchResults'

describe('SearchResults', () => {
  const defaultProps = {
    isLoading: false,
    error: null,
    query: 'test query',
  }

  describe('Loading state', () => {
    it('should display loading spinner when isLoading is true', () => {
      render(<SearchResults {...defaultProps} isLoading={true} />)
      
      expect(screen.getByText('Searching...')).toBeInTheDocument()
      expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument() // Loader2 icon
    })
  })

  describe('Error states', () => {
    it('should display error message when there is an error', () => {
      const error = new Error('Network error')
      render(<SearchResults {...defaultProps} error={error} />)
      
      expect(screen.getByText('Search Error')).toBeInTheDocument()
      expect(screen.getByText(/Failed to connect to search API/)).toBeInTheDocument()
    })

    it('should display search failed message when data.success is false', () => {
      const data = {
        success: false,
        message: 'Invalid query parameters',
        query: 'test',
        found: 0,
        results: [],
      }
      
      render(<SearchResults {...defaultProps} data={data} />)
      
      expect(screen.getByText('Search Failed')).toBeInTheDocument()
      expect(screen.getByText('Invalid query parameters')).toBeInTheDocument()
    })

    it('should display generic error when data.success is false without message', () => {
      const data = {
        success: false,
        query: 'test',
        found: 0,
        results: [],
      }
      
      render(<SearchResults {...defaultProps} data={data} />)
      
      expect(screen.getByText('Search Failed')).toBeInTheDocument()
      expect(screen.getByText('Unknown error occurred')).toBeInTheDocument()
    })
  })

  describe('No results state', () => {
    it('should display no results message when results array is empty', () => {
      const data = createMockApiResponse('test query', [])
      
      render(<SearchResults {...defaultProps} data={data} />)
      
      expect(screen.getByText('No results found')).toBeInTheDocument()
      expect(screen.getByText('Try different keywords or remove filters')).toBeInTheDocument()
    })
  })

  describe('Results display', () => {
    it('should display search results correctly', () => {
      const results = [
        createMockSearchResult({
          id: '1',
          name: 'React Framework',
          description: 'A JavaScript library for building user interfaces',
          category: 'frontend',
          tags: ['javascript', 'react'],
          score: 0.95,
        }),
        createMockSearchResult({
          id: '2',
          name: 'Vue.js',
          description: 'Progressive JavaScript framework',
          category: 'frontend',
          tags: ['javascript', 'vue'],
          score: 0.87,
        }),
      ]
      
      const data = createMockApiResponse('javascript', results)
      
      render(<SearchResults {...defaultProps} data={data} query="javascript" />)
      
      // Check results header
      expect(screen.getByText('Found 2 results for "javascript"')).toBeInTheDocument()
      
      // Check first result
      expect(screen.getByText('React Framework')).toBeInTheDocument()
      expect(screen.getByText('A JavaScript library for building user interfaces')).toBeInTheDocument()
      expect(screen.getByText('Score: 95')).toBeInTheDocument()
      
      // Check second result
      expect(screen.getByText('Vue.js')).toBeInTheDocument()
      expect(screen.getByText('Progressive JavaScript framework')).toBeInTheDocument()
      expect(screen.getByText('Score: 87')).toBeInTheDocument()
      
      // Check categories
      const frontendBadges = screen.getAllByText('frontend')
      expect(frontendBadges).toHaveLength(2)
      
      // Check tags
      expect(screen.getAllByText('javascript')).toHaveLength(2)
      expect(screen.getByText('react')).toBeInTheDocument()
      expect(screen.getByText('vue')).toBeInTheDocument()
    })

    it('should handle singular vs plural results text correctly', () => {
      const singleResult = [createMockSearchResult()]
      const singleData = createMockApiResponse('test', singleResult)
      
      const { rerender } = render(<SearchResults {...defaultProps} data={singleData} query="test" />)
      
      expect(screen.getByText('Found 1 result for "test"')).toBeInTheDocument()
      
      // Test plural
      const multipleResults = [createMockSearchResult(), createMockSearchResult({ id: '2' })]
      const multipleData = createMockApiResponse('test', multipleResults)
      
      rerender(<SearchResults {...defaultProps} data={multipleData} query="test" />)
      
      expect(screen.getByText('Found 2 results for "test"')).toBeInTheDocument()
    })

    it('should not display score badge when score is not provided', () => {
      const result = createMockSearchResult({ score: undefined })
      const data = createMockApiResponse('test', [result])
      
      render(<SearchResults {...defaultProps} data={data} />)
      
      expect(screen.queryByText(/Score:/)).not.toBeInTheDocument()
    })

    it('should display tags correctly when they exist', () => {
      const result = createMockSearchResult({
        tags: ['react', 'typescript', 'frontend'],
      })
      const data = createMockApiResponse('test', [result])
      
      render(<SearchResults {...defaultProps} data={data} />)
      
      expect(screen.getByText('react')).toBeInTheDocument()
      expect(screen.getByText('typescript')).toBeInTheDocument()
      expect(screen.getByText('frontend')).toBeInTheDocument()
    })

    it('should handle empty tags array gracefully', () => {
      const result = createMockSearchResult({ tags: [] })
      const data = createMockApiResponse('test', [result])
      
      render(<SearchResults {...defaultProps} data={data} />)
      
      // Should render without errors and not show any tag badges
      expect(screen.getByText(result.name)).toBeInTheDocument()
      expect(screen.getByText(result.description)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper accessibility attributes', () => {
      const results = [createMockSearchResult()]
      const data = createMockApiResponse('test', results)
      
      render(<SearchResults {...defaultProps} data={data} />)
      
      // Check that cards are properly labeled
      const cards = screen.getAllByRole('article')
      expect(cards.length).toBeGreaterThan(0)
    })

    it('should provide meaningful text for screen readers', () => {
      const result = createMockSearchResult({
        name: 'Test Framework',
        description: 'A testing framework for JavaScript',
        category: 'testing',
      })
      const data = createMockApiResponse('test', [result])
      
      render(<SearchResults {...defaultProps} data={data} />)
      
      expect(screen.getByRole('heading', { name: 'Test Framework' })).toBeInTheDocument()
    })
  })
})
