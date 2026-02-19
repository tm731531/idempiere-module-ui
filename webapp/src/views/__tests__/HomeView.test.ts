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

  it('displays consultation dashboard card in business section', () => {
    const wrapper = mount(HomeView, {
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    expect(wrapper.text()).toContain('諮詢儀表板')
    expect(wrapper.text()).toContain('追蹤諮詢狀態與客戶旅程')
  })

  it('dashboard card is in the 業務流程 section', () => {
    const wrapper = mount(HomeView)

    const sections = wrapper.findAll('.section')
    let found = false

    for (const section of sections) {
      if (section.text().includes('業務流程') && section.text().includes('諮詢儀表板')) {
        found = true
        break
      }
    }

    expect(found).toBe(true)
  })

  it('navigates to dashboard view when card clicked', async () => {
    const wrapper = mount(HomeView)

    const cards = wrapper.findAll('.module-card')
    let dashboardCard = null

    for (const card of cards) {
      if (card.text().includes('諮詢儀表板')) {
        dashboardCard = card
        break
      }
    }

    expect(dashboardCard).not.toBe(null)

    if (dashboardCard) {
      await dashboardCard.find('.card-body').trigger('click')
      expect(mockPush).toHaveBeenCalledWith({ path: '/consultation-dashboard', query: undefined })
    }
  })
})
