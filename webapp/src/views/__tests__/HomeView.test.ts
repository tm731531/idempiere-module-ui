import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HomeView from '@/views/HomeView.vue'

vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({
    canAccess: () => true,
    loadPermissions: vi.fn(),
  }),
}))

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { name: 'Test User' },
    context: {
      clientId: 1,
      clientName: 'Test Client',
      organizationName: 'Test Org',
      roleName: 'Test Role',
      warehouseName: 'Test Warehouse',
    },
    logout: vi.fn(),
    switchContext: vi.fn(),
  }),
}))

describe('HomeView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockPush.mockClear()
  })

  it('displays consultation record card in customer service section', () => {
    const wrapper = mount(HomeView, {
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    expect(wrapper.text()).toContain('諮詢記錄')
    expect(wrapper.text()).toContain('諮詢與評估記錄')
  })

  it('consultation record card is in the 客戶服務 section', () => {
    const wrapper = mount(HomeView)

    const sections = wrapper.findAll('.section')
    let found = false

    for (const section of sections) {
      if (section.text().includes('客戶服務') && section.text().includes('諮詢記錄')) {
        found = true
        break
      }
    }

    expect(found).toBe(true)
  })

  it('navigates to consultation list view when card clicked', async () => {
    const wrapper = mount(HomeView)

    const cards = wrapper.findAll('.module-card')
    let consultationCard = null

    for (const card of cards) {
      if (card.text().includes('諮詢記錄')) {
        consultationCard = card
        break
      }
    }

    expect(consultationCard).not.toBe(null)

    if (consultationCard) {
      await consultationCard.find('.card-body').trigger('click')
      expect(mockPush).toHaveBeenCalledWith({ path: '/consultation', query: undefined })
    }
  })
})
