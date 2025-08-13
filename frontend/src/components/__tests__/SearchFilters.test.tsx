import { describe, it, expect, vitest } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../../test/utils'
import SearchFilters from '../SearchFilters'

describe('SearchFilters', () => {
  const mockOnFiltersChange = vitest.fn()
  
  const defaultProps = {
    filters: {},
    onFiltersChange: mockOnFiltersChange,
  }

  beforeEach(() => {
    mockOnFiltersChange.mockClear()
  })

  describe('Rendering', () => {
    it('should render category dropdown and tags input', () => {
      render(<SearchFilters {...defaultProps} />)
      
      expect(screen.getByRole('combobox')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Filter by tags (comma-separated)')).toBeInTheDocument()
    })

    it('should show "All Categories" as default option', () => {
      render(<SearchFilters {...defaultProps} />)
      
      const categorySelect = screen.getByRole('combobox')
      expect(categorySelect).toHaveValue('')
      expect(screen.getByText('All Categories')).toBeInTheDocument()
    })

    it('should display all predefined categories', () => {
      render(<SearchFilters {...defaultProps} />)
      
      const expectedCategories = [
        'All Categories',
        'Frontend Framework',
        'Runtime Environment',
        'Database',
        'Containerization',
        'Container Orchestration',
        'Programming Language',
      ]
      
      expectedCategories.forEach(category => {
        expect(screen.getByText(category)).toBeInTheDocument()
      })
    })
  })

  describe('Category Filter', () => {
    it('should call onFiltersChange when category is selected', async () => {
      const user = userEvent.setup()
      render(<SearchFilters {...defaultProps} />)
      
      const categorySelect = screen.getByRole('combobox')
      await user.selectOptions(categorySelect, 'Frontend Framework')
      
      expect(mockOnFiltersChange).toHaveBeenCalledWith({
        category: 'Frontend Framework',
      })
    })

    it('should call onFiltersChange with undefined category when "All Categories" is selected', async () => {
      const user = userEvent.setup()
      const propsWithCategory = {
        ...defaultProps,
        filters: { category: 'Frontend Framework' },
      }
      
      render(<SearchFilters {...propsWithCategory} />)
      
      const categorySelect = screen.getByRole('combobox')
      await user.selectOptions(categorySelect, '')
      
      expect(mockOnFiltersChange).toHaveBeenCalledWith({
        category: undefined,
      })
    })

    it('should display selected category correctly', () => {
      const propsWithCategory = {
        ...defaultProps,
        filters: { category: 'Database' },
      }
      
      render(<SearchFilters {...propsWithCategory} />)
      
      const categorySelect = screen.getByRole('combobox')
      expect(categorySelect).toHaveValue('Database')
    })
  })

  describe('Tags Filter', () => {
    it('should call onFiltersChange when tags are entered', async () => {
      const user = userEvent.setup()
      render(<SearchFilters {...defaultProps} />)
      
      const tagsInput = screen.getByPlaceholderText('Filter by tags (comma-separated)')
      await user.type(tagsInput, 'react, typescript')
      
      expect(mockOnFiltersChange).toHaveBeenLastCalledWith({
        tags: ['react', 'typescript'],
      })
    })

    it('should handle single tag correctly', async () => {
      const user = userEvent.setup()
      render(<SearchFilters {...defaultProps} />)
      
      const tagsInput = screen.getByPlaceholderText('Filter by tags (comma-separated)')
      await user.type(tagsInput, 'javascript')
      
      expect(mockOnFiltersChange).toHaveBeenLastCalledWith({
        tags: ['javascript'],
      })
    })

    it('should trim whitespace from tags', async () => {
      const user = userEvent.setup()
      render(<SearchFilters {...defaultProps} />)
      
      const tagsInput = screen.getByPlaceholderText('Filter by tags (comma-separated)')
      await user.type(tagsInput, '  react  ,  typescript  ,  frontend  ')
      
      expect(mockOnFiltersChange).toHaveBeenLastCalledWith({
        tags: ['react', 'typescript', 'frontend'],
      })
    })

    it('should filter out empty tags', async () => {
      const user = userEvent.setup()
      render(<SearchFilters {...defaultProps} />)
      
      const tagsInput = screen.getByPlaceholderText('Filter by tags (comma-separated)')
      await user.type(tagsInput, 'react, , typescript, ')
      
      expect(mockOnFiltersChange).toHaveBeenLastCalledWith({
        tags: ['react', 'typescript'],
      })
    })

    it('should call onFiltersChange with undefined tags when input is empty', async () => {
      const user = userEvent.setup()
      const propsWithTags = {
        ...defaultProps,
        filters: { tags: ['react', 'typescript'] },
      }
      
      render(<SearchFilters {...propsWithTags} />)
      
      const tagsInput = screen.getByPlaceholderText('Filter by tags (comma-separated)')
      await user.clear(tagsInput)
      
      expect(mockOnFiltersChange).toHaveBeenCalledWith({
        tags: undefined,
      })
    })

    it('should display existing tags correctly', () => {
      const propsWithTags = {
        ...defaultProps,
        filters: { tags: ['react', 'typescript', 'frontend'] },
      }
      
      render(<SearchFilters {...propsWithTags} />)
      
      const tagsInput = screen.getByPlaceholderText('Filter by tags (comma-separated)')
      expect(tagsInput).toHaveValue('react, typescript, frontend')
    })
  })

  describe('Combined Filters', () => {
    it('should preserve existing filters when updating one filter', async () => {
      const user = userEvent.setup()
      const propsWithExistingFilters = {
        ...defaultProps,
        filters: { category: 'Frontend Framework', tags: ['react'] },
      }
      
      render(<SearchFilters {...propsWithExistingFilters} />)
      
      const tagsInput = screen.getByPlaceholderText('Filter by tags (comma-separated)')
      await user.type(tagsInput, ', typescript')
      
      expect(mockOnFiltersChange).toHaveBeenLastCalledWith({
        category: 'Frontend Framework',
        tags: ['react', 'typescript'],
      })
    })

    it('should handle both category and tags filters together', async () => {
      const user = userEvent.setup()
      render(<SearchFilters {...defaultProps} />)
      
      // Set category first
      const categorySelect = screen.getByRole('combobox')
      await user.selectOptions(categorySelect, 'Frontend Framework')
      
      // Then set tags
      const tagsInput = screen.getByPlaceholderText('Filter by tags (comma-separated)')
      await user.type(tagsInput, 'react, javascript')
      
      expect(mockOnFiltersChange).toHaveBeenLastCalledWith({
        category: 'Frontend Framework',
        tags: ['react', 'javascript'],
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle only commas in tags input', async () => {
      const user = userEvent.setup()
      render(<SearchFilters {...defaultProps} />)
      
      const tagsInput = screen.getByPlaceholderText('Filter by tags (comma-separated)')
      await user.type(tagsInput, ', , , ')
      
      expect(mockOnFiltersChange).toHaveBeenLastCalledWith({
        tags: undefined,
      })
    })

    it('should handle special characters in tags', async () => {
      const user = userEvent.setup()
      render(<SearchFilters {...defaultProps} />)
      
      const tagsInput = screen.getByPlaceholderText('Filter by tags (comma-separated)')
      await user.type(tagsInput, 'react-native, vue.js, node.js')
      
      expect(mockOnFiltersChange).toHaveBeenLastCalledWith({
        tags: ['react-native', 'vue.js', 'node.js'],
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper form controls', () => {
      render(<SearchFilters {...defaultProps} />)
      
      const categorySelect = screen.getByRole('combobox')
      const tagsInput = screen.getByRole('textbox')
      
      expect(categorySelect).toBeInTheDocument()
      expect(tagsInput).toBeInTheDocument()
    })

    it('should have accessible labels', () => {
      render(<SearchFilters {...defaultProps} />)
      
      const tagsInput = screen.getByPlaceholderText('Filter by tags (comma-separated)')
      expect(tagsInput).toHaveAttribute('placeholder', 'Filter by tags (comma-separated)')
    })
  })
})
