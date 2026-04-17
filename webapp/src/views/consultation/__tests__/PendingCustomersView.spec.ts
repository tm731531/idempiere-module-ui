import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import PendingCustomersView from '../PendingCustomersView.vue'

// Mock vue-router
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
  useRoute: vi.fn(() => ({ query: {}, params: {} })),
}))

// Mock auth store — simulate logged-in user
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    user: { id: 0, name: 'TestUser', role: 'user' },
    context: { organizationId: 1000000 },
    isAuthenticated: true,
  })),
}))

// Mock API modules
vi.mock('@/api/request', () => ({
  listRequests: vi.fn(),
  updateRequest: vi.fn(),
}))

vi.mock('@/api/bpartner', () => ({
  listProspects: vi.fn(),
}))

vi.mock('@/api/lookup', () => ({
  lookupCurrentUserId: vi.fn(),
}))

import { listRequests, updateRequest } from '@/api/request'
import { listProspects } from '@/api/bpartner'
import { lookupCurrentUserId } from '@/api/lookup'

const mockListRequests = vi.mocked(listRequests)
const mockUpdateRequest = vi.mocked(updateRequest)
const mockListProspects = vi.mocked(listProspects)
const mockLookupCurrentUserId = vi.mocked(lookupCurrentUserId)

// Sample data
const unassignedRequest = {
  id: 1,
  DocumentNo: 'REQ-001',
  Summary: 'Test Consultation',
  SalesRep_ID: null,
  C_BPartner_ID: { id: 100, Name: 'Alice', identifier: 'Alice' },
  Created: '2026-04-01T10:00:00Z',
}

const assignedRequest = {
  id: 2,
  DocumentNo: 'REQ-002',
  Summary: 'Assigned Consultation',
  SalesRep_ID: { id: 50, Name: 'Bob', identifier: 'Bob' },
  C_BPartner_ID: { id: 101, Name: 'Bob Customer', identifier: 'Bob Customer' },
  Created: '2026-04-01T11:00:00Z',
}

const prospectWithRequest = {
  id: 100,
  Name: 'Alice',
  Phone: '0912345678',
  EMail: '',
  IsProspect: true,
}

const prospectWithoutRequest = {
  id: 200,
  Name: 'Charlie',
  Phone: '0987654321',
  EMail: 'charlie@example.com',
  IsProspect: true,
}

describe('PendingCustomersView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListRequests.mockResolvedValue([unassignedRequest, assignedRequest])
    mockListProspects.mockResolvedValue([prospectWithRequest, prospectWithoutRequest])
    mockLookupCurrentUserId.mockResolvedValue(999)
    mockUpdateRequest.mockResolvedValue({})
  })

  it('renders unassigned tab by default and shows unassigned request cards', async () => {
    const wrapper = mount(PendingCustomersView, {
      global: { stubs: { teleport: true } },
    })
    await flushPromises()

    // Should be on "unassigned" tab
    expect(wrapper.find('.tab-btn.active').text()).toContain('未分配諮詢單')

    // Should show one unassigned card (assigned request filtered out)
    const cards = wrapper.findAll('.request-card')
    expect(cards).toHaveLength(1)
    expect(cards[0]!.text()).toContain('Test Consultation')
    expect(cards[0]!.text()).toContain('Alice')
  })

  it('shows claim button and calls updateRequest with current userId on confirm', async () => {
    // Stub window.confirm to auto-accept (happy-dom does not define it)
    vi.stubGlobal('confirm', vi.fn(() => true))

    const wrapper = mount(PendingCustomersView, {
      global: { stubs: { teleport: true } },
    })
    await flushPromises()

    const claimBtn = wrapper.find('.claim-btn')
    expect(claimBtn.exists()).toBe(true)

    await claimBtn.trigger('click')
    await flushPromises()

    expect(mockLookupCurrentUserId).toHaveBeenCalledWith('TestUser')
    expect(mockUpdateRequest).toHaveBeenCalledWith(1, { SalesRep_ID: 999 })

    vi.unstubAllGlobals()
  })

  it('removes claimed request from the list immediately after successful claim', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true))

    const wrapper = mount(PendingCustomersView, {
      global: { stubs: { teleport: true } },
    })
    await flushPromises()

    expect(wrapper.findAll('.request-card')).toHaveLength(1)

    await wrapper.find('.claim-btn').trigger('click')
    await flushPromises()

    // Card should be gone from the list
    expect(wrapper.findAll('.request-card')).toHaveLength(0)

    vi.unstubAllGlobals()
  })

  it('does not claim when user cancels the confirm dialog', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false))

    const wrapper = mount(PendingCustomersView, {
      global: { stubs: { teleport: true } },
    })
    await flushPromises()

    await wrapper.find('.claim-btn').trigger('click')
    await flushPromises()

    expect(mockUpdateRequest).not.toHaveBeenCalled()
    // Card should still be there
    expect(wrapper.findAll('.request-card')).toHaveLength(1)

    vi.unstubAllGlobals()
  })

  it('shows prospects tab and only customers without existing requests', async () => {
    const wrapper = mount(PendingCustomersView, {
      global: { stubs: { teleport: true } },
    })
    await flushPromises()

    // Switch to prospects tab
    const prospectsTab = wrapper.findAll('.tab-btn')[1]!
    await prospectsTab.trigger('click')

    // Only Charlie should appear (Alice already has a request — C_BPartner_ID.id=100)
    const cards = wrapper.findAll('.prospect-card')
    expect(cards).toHaveLength(1)
    expect(cards[0]!.text()).toContain('Charlie')
    expect(cards[0]!.text()).not.toContain('Alice')
  })

  it('navigates to consultation-new with customerId when "建立諮詢" is clicked', async () => {
    const wrapper = mount(PendingCustomersView, {
      global: { stubs: { teleport: true } },
    })
    await flushPromises()

    // Switch to prospects tab
    await wrapper.findAll('.tab-btn')[1]!.trigger('click')
    await wrapper.find('.create-btn').trigger('click')

    expect(mockPush).toHaveBeenCalledWith({
      name: 'consultation-new',
      query: { customerId: '200' },
    })
  })

  it('shows count badges on both tabs after loading', async () => {
    const wrapper = mount(PendingCustomersView, {
      global: { stubs: { teleport: true } },
    })
    await flushPromises()

    const badges = wrapper.findAll('.tab-badge')
    // Tab 1: 1 unassigned
    expect(badges[0]!.text()).toBe('1')
    // Tab 2: 1 prospect without request (Charlie)
    expect(badges[1]!.text()).toBe('1')
  })
})
