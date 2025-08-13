import { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }

// Test data factories
export const createMockSearchResult = (overrides = {}) => ({
  id: '1',
  name: 'Test Result',
  description: 'Test description',
  category: 'test',
  tags: ['test'],
  score: 0.95,
  ...overrides,
})

export const createMockClaimResult = (overrides = {}) => ({
  id: 'claim-1',
  name: 'Claim CLM-001',
  description: 'Test claim',
  category: 'claim',
  tags: ['warranty'],
  claimNumber: 'CLM-001',
  claimType: 'warranty',
  claimStatus: 'approved',
  consumerName: 'John Doe',
  province: 'ON',
  ...overrides,
})

export const createMockLocationResult = (overrides = {}) => ({
  id: 'location-1',
  name: 'Toronto Location',
  description: 'Toronto location',
  category: 'location',
  tags: ['ON'],
  postalCode: 'M5V 1A1',
  provinceId: 'ON',
  latitude: 43.6426,
  longitude: -79.3871,
  ...overrides,
})

export const createMockApiResponse = (query = 'test', results: any[] = []) => ({
  success: true,
  query,
  found: results.length,
  results,
  pagination: {
    currentPage: 1,
    totalPages: Math.ceil(results.length / 10),
    hasNext: false,
    hasPrevious: false,
  },
  searchTime: 15,
})

// Custom matchers for common assertions
export const expectElementToBeVisible = (element: HTMLElement) => {
  expect(element).toBeInTheDocument()
  expect(element).toBeVisible()
}

export const expectElementToHaveText = (element: HTMLElement, text: string) => {
  expect(element).toBeInTheDocument()
  expect(element).toHaveTextContent(text)
}

// Wait for async operations to complete
export const waitForLoadingToFinish = async () => {
  const { findByTestId } = await import('@testing-library/react')
  // Wait for any loading indicators to disappear
  try {
    const loadingElement = await findByTestId('loading-indicator', {}, { timeout: 100 })
    if (loadingElement) {
      const { waitForElementToBeRemoved } = await import('@testing-library/react')
      await waitForElementToBeRemoved(loadingElement)
    }
  } catch {
    // Loading indicator might not exist, which is fine
  }
}
