import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePermission } from '@/composables/usePermission'

const router = createRouter({
  history: createWebHashHistory('/aesthetics/'),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/appointment',
      name: 'appointment',
      component: () => import('@/views/PlaceholderView.vue'),
      meta: { requiresAuth: true, pageKey: 'appointment' },
    },
    {
      path: '/consultation',
      name: 'consultation',
      component: () => import('@/views/PlaceholderView.vue'),
      meta: { requiresAuth: true, pageKey: 'consultation' },
    },
    {
      path: '/customer',
      name: 'customer',
      component: () => import('@/views/PlaceholderView.vue'),
      meta: { requiresAuth: true, pageKey: 'customer' },
    },
    {
      path: '/order',
      name: 'order',
      component: () => import('@/views/PlaceholderView.vue'),
      meta: { requiresAuth: true, pageKey: 'order' },
    },
    {
      path: '/treatment',
      name: 'treatment',
      component: () => import('@/views/PlaceholderView.vue'),
      meta: { requiresAuth: true, pageKey: 'treatment' },
    },
    {
      path: '/payment',
      name: 'payment',
      component: () => import('@/views/PlaceholderView.vue'),
      meta: { requiresAuth: true, pageKey: 'payment' },
    },
    {
      path: '/shipment',
      name: 'shipment',
      component: () => import('@/views/PlaceholderView.vue'),
      meta: { requiresAuth: true, pageKey: 'shipment' },
    },
    {
      path: '/admin/fields',
      name: 'fieldconfig',
      component: () => import('@/views/PlaceholderView.vue'),
      meta: { requiresAuth: true, pageKey: 'fieldconfig' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/PlaceholderView.vue'),
    },
  ],
})

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'login', query: { redirect: to.fullPath } })
    return
  }

  if (to.name === 'login' && authStore.isAuthenticated) {
    next({ name: 'home' })
    return
  }

  // Permission check for authenticated pages with pageKey
  if (authStore.isAuthenticated && to.meta.pageKey) {
    const { loadPermissions, canAccess } = usePermission()
    const roleId = authStore.context?.roleId || 0
    await loadPermissions(roleId)
    if (!canAccess(to.meta.pageKey as string)) {
      next({ name: 'home', query: { denied: '1' } })
      return
    }
  }

  next()
})

export default router
