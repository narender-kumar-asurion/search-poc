import { describe, it, expect, vitest, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { render, createMockClaimResult, createMockApiResponse } from '../../test/utils'
import { server } from '../../test/setup'
import ClaimsSearch from '../ClaimsSearch'

// Mock the search API
vitest.mock('../services/searchAPI', () => ({
  searchAPI: {
    searchClaims: vitest.fn(),
  },
}))

// Mock the search provider hook
vitest.mock('../SearchProviderIndicator', () => ({
  default: () => <div data-testid="search-provider-indicator">Provider Status</div>,
  useSearchProvider: () => 'Typesense',
}))

describe('ClaimsSearch', () => {
  beforeEach(() => {
    vitest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render the claims search interface', () => {
      render(<ClaimsSearch />)
      
      expect(screen.getByText('Typesense Claims Search')).toBeInTheDocument()
      expect(screen.getByText('Search warranty claims and service records')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/Search claims by customer name/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
    })

    it('should render claim filters', () => {
      render(<ClaimsSearch />)
      
      expect(screen.getByText('All Claim Types')).toBeInTheDocument()
      expect(screen.getByText('All Statuses')).toBeInTheDocument()
      expect(screen.getByText('All Provinces')).toBeInTheDocument()
    })

    it('should have default search query', () => {
      render(<ClaimsSearch />)
      
      const searchInput = screen.getByPlaceholderText(/Search claims by customer name/)
      expect(searchInput).toHaveValue('warranty')
    })
  })

  describe('Search Functionality', () => {
    it('should perform search when typing in input', async () => {
      server.use(
        http.get('/api/search/claims', () => {
          return HttpResponse.json(createMockApiResponse('test claim', [createMockClaimResult()]))
        })
      )

      const user = userEvent.setup()
      render(<ClaimsSearch />)
      
      const searchInput = screen.getByPlaceholderText(/Search claims by customer name/)
      await user.clear(searchInput)
      await user.type(searchInput, 'test claim')
      
      // Wait for debounced search
      await waitFor(() => {
        expect(screen.getByText(/Found 1 claim for "test claim"/)).toBeInTheDocument()
      })
    })

    it('should show loading state during search', async () => {
      // Mock a delayed response
      server.use(
        http.get('/api/search/claims', async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
          return HttpResponse.json(createMockApiResponse('test', []))
        })
      )

      const user = userEvent.setup()
      render(<ClaimsSearch />)
      
      const searchInput = screen.getByPlaceholderText(/Search claims by customer name/)
      await user.clear(searchInput)
      await user.type(searchInput, 'test')
      
      expect(screen.getByText('Searching claims...')).toBeInTheDocument()
    })

    it('should handle search form submission', async () => {
      const user = userEvent.setup()
      render(<ClaimsSearch />)
      
      const searchInput = screen.getByPlaceholderText(/Search claims by customer name/)
      const searchButton = screen.getByRole('button', { name: /search/i })
      
      await user.clear(searchInput)
      await user.type(searchInput, 'claim search')
      await user.click(searchButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Found.*claim.*for "claim search"/)).toBeInTheDocument()
      })
    })

    it('should disable search button when query is empty', async () => {
      const user = userEvent.setup()
      render(<ClaimsSearch />)
      
      const searchInput = screen.getByPlaceholderText(/Search claims by customer name/)
      const searchButton = screen.getByRole('button', { name: /search/i })
      
      await user.clear(searchInput)
      
      expect(searchButton).toBeDisabled()
    })
  })

  describe('Claim Filters', () => {
    it('should update claim type filter', async () => {
      const user = userEvent.setup()
      render(<ClaimsSearch />)
      
      const claimTypeSelect = screen.getByDisplayValue('All Claim Types')
      await user.selectOptions(claimTypeSelect, 'WARRTY')
      
      expect(claimTypeSelect).toHaveValue('WARRTY')
    })

    it('should update claim status filter', async () => {
      const user = userEvent.setup()
      render(<ClaimsSearch />)
      
      const statusSelect = screen.getByDisplayValue('All Statuses')
      await user.selectOptions(statusSelect, 'APP')
      
      expect(statusSelect).toHaveValue('APP')
    })

    it('should update province filter', async () => {
      const user = userEvent.setup()
      render(<ClaimsSearch />)
      
      const provinceSelect = screen.getByDisplayValue('All Provinces')
      await user.selectOptions(provinceSelect, 'ON')
      
      expect(provinceSelect).toHaveValue('ON')
    })
  })

  describe('Search Results', () => {
    it('should display claim results correctly', async () => {
      const mockClaim = createMockClaimResult({
        claimNumber: 'CLM-123456',
        claimStatus: 'APP',
        claimType: 'WARRTY',
        consumerNameFirst: 'John',
        consumerName: 'Doe',
        consumerAddCity: 'Toronto',
        consumerAddState: 'ON',
        consumerPostalCode: 'M5V 1A1',
        amountRequested: 1500.00,
        amountApproved: 1200.00,
        claimDate: '2024-01-15',
      })

      server.use(
        http.get('/api/search/claims', () => {
          return HttpResponse.json(createMockApiResponse('warranty', [mockClaim]))
        })
      )

      render(<ClaimsSearch />)
      
      await waitFor(() => {
        expect(screen.getByText('CLM-123456')).toBeInTheDocument()
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.getByText('Toronto, ON M5V 1A1')).toBeInTheDocument()
        expect(screen.getByText('$1,500.00')).toBeInTheDocument()
        expect(screen.getByText('$1,200.00')).toBeInTheDocument()
      })
    })

    it('should display no results message when no claims found', async () => {
      server.use(
        http.get('/api/search/claims', () => {
          return HttpResponse.json(createMockApiResponse('nonexistent', []))
        })
      )

      const user = userEvent.setup()
      render(<ClaimsSearch />)
      
      const searchInput = screen.getByPlaceholderText(/Search claims by customer name/)
      await user.clear(searchInput)
      await user.type(searchInput, 'nonexistent')
      
      await waitFor(() => {
        expect(screen.getByText('No claims found')).toBeInTheDocument()
        expect(screen.getByText('Try different keywords or adjust filters')).toBeInTheDocument()
      })
    })

    it('should display error message when search fails', async () => {
      server.use(
        http.get('/api/search/claims', () => {
          return HttpResponse.error()
        })
      )

      const user = userEvent.setup()
      render(<ClaimsSearch />)
      
      const searchInput = screen.getByPlaceholderText(/Search claims by customer name/)
      await user.clear(searchInput)
      await user.type(searchInput, 'error test')
      
      await waitFor(() => {
        expect(screen.getByText('Claims Search Error')).toBeInTheDocument()
        expect(screen.getByText('Failed to search claims. Please try again.')).toBeInTheDocument()
      })
    })
  })

  describe('Claim Card', () => {
    const mockClaim = createMockClaimResult({
      claimNumber: 'CLM-789',
      claimStatus: 'PEN',
      claimType: 'SERVICE',
      consumerNameFirst: 'Jane',
      consumerName: 'Smith',
      consumerCompanyName: 'Tech Corp',
      serialNumber: 'SN123456',
      productBrandCode: 'APPLE',
      modelNumber: 'MBP-2023',
      score: 0.85,
    })

    beforeEach(() => {
      server.use(
        http.get('/api/search/claims', () => {
          return HttpResponse.json(createMockApiResponse('test', [mockClaim]))
        })
      )
    })

    it('should display claim card with all information', async () => {
      render(<ClaimsSearch />)
      
      await waitFor(() => {
        expect(screen.getByText('CLM-789')).toBeInTheDocument()
        expect(screen.getByText('Jane Smith')).toBeInTheDocument()
        expect(screen.getByText('(Tech Corp)')).toBeInTheDocument()
        expect(screen.getByText('SN123456')).toBeInTheDocument()
        expect(screen.getByText('APPLE')).toBeInTheDocument()
        expect(screen.getByText('MBP-2023')).toBeInTheDocument()
        expect(screen.getByText('Score: 85')).toBeInTheDocument()
      })
    })

    it('should display correct status colors', async () => {
      render(<ClaimsSearch />)
      
      await waitFor(() => {
        const statusBadge = screen.getByText('PEN')
        expect(statusBadge).toHaveClass('bg-yellow-100', 'text-yellow-800')
      })
    })

    it('should format currency correctly', async () => {
      const claimWithAmounts = createMockClaimResult({
        amountRequested: 2500.99,
        amountApproved: 2000.50,
      })

      server.use(
        http.get('/api/search/claims', () => {
          return HttpResponse.json(createMockApiResponse('test', [claimWithAmounts]))
        })
      )

      render(<ClaimsSearch />)
      
      await waitFor(() => {
        expect(screen.getByText('$2,500.99')).toBeInTheDocument()
        expect(screen.getByText('$2,000.50')).toBeInTheDocument()
      })
    })

    it('should handle missing optional fields gracefully', async () => {
      const minimalClaim = createMockClaimResult({
        consumerCompanyName: undefined,
        serialNumber: undefined,
        productBrandCode: undefined,
        modelNumber: undefined,
        amountApproved: undefined,
      })

      server.use(
        http.get('/api/search/claims', () => {
          return HttpResponse.json(createMockApiResponse('test', [minimalClaim]))
        })
      )

      render(<ClaimsSearch />)
      
      await waitFor(() => {
        expect(screen.getByText(minimalClaim.claimNumber)).toBeInTheDocument()
        expect(screen.queryByText('(Tech Corp)')).not.toBeInTheDocument()
        expect(screen.queryByText('Serial Number:')).not.toBeInTheDocument()
        expect(screen.queryByText('Amount Approved:')).not.toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper form labels and structure', () => {
      render(<ClaimsSearch />)
      
      expect(screen.getByRole('textbox')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
      expect(screen.getAllByRole('combobox')).toHaveLength(3) // Three filter dropdowns
    })

    it('should have proper heading structure', () => {
      render(<ClaimsSearch />)
      
      expect(screen.getByRole('heading', { name: /Typesense Claims Search/ })).toBeInTheDocument()
    })
  })
})
