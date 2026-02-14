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
      meta: { requiresAuth: true, pageKey: 'appointment' },
      children: [
        { path: '', name: 'appointment-calendar', component: () => import('@/views/appointment/CalendarView.vue') },
        { path: 'new', name: 'appointment-new', component: () => import('@/views/appointment/AppointmentForm.vue'), meta: { requiresAuth: true, pageKey: 'appointment' } },
      ],
    },
    {
      path: '/consultation',
      meta: { requiresAuth: true, pageKey: 'consultation' },
      children: [
        { path: '', name: 'consultation-list', component: () => import('@/views/consultation/RequestListView.vue') },
        { path: 'new', name: 'consultation-new', component: () => import('@/views/consultation/RequestFormView.vue'), meta: { requiresAuth: true, pageKey: 'consultation' } },
        { path: ':id', name: 'consultation-edit', component: () => import('@/views/consultation/RequestFormView.vue'), meta: { requiresAuth: true, pageKey: 'consultation' } },
      ],
    },
    {
      path: '/customer',
      meta: { requiresAuth: true, pageKey: 'customer' },
      children: [
        { path: '', name: 'customer-list', component: () => import('@/views/customer/CustomerListView.vue') },
        { path: 'new', name: 'customer-new', component: () => import('@/views/customer/CustomerFormView.vue'), meta: { requiresAuth: true, pageKey: 'customer' } },
        { path: ':id', name: 'customer-detail', component: () => import('@/views/customer/CustomerDetailView.vue'), meta: { requiresAuth: true, pageKey: 'customer' } },
        { path: ':id/edit', name: 'customer-edit', component: () => import('@/views/customer/CustomerFormView.vue'), meta: { requiresAuth: true, pageKey: 'customer' } },
      ],
    },
    {
      path: '/order',
      meta: { requiresAuth: true, pageKey: 'order' },
      children: [
        { path: '', name: 'order-list', component: () => import('@/views/order/OrderListView.vue') },
        { path: 'new', name: 'order-new', component: () => import('@/views/order/OrderFormView.vue'), meta: { requiresAuth: true, pageKey: 'order' } },
        { path: ':id', name: 'order-detail', component: () => import('@/views/order/OrderFormView.vue'), meta: { requiresAuth: true, pageKey: 'order' } },
      ],
    },
    {
      path: '/treatment',
      meta: { requiresAuth: true, pageKey: 'treatment' },
      children: [
        { path: '', name: 'treatment-list', component: () => import('@/views/treatment/ProductionListView.vue') },
        { path: 'new', name: 'treatment-new', component: () => import('@/views/treatment/ProductionFormView.vue'), meta: { requiresAuth: true, pageKey: 'treatment' } },
        { path: ':id', name: 'treatment-detail', component: () => import('@/views/treatment/ProductionFormView.vue'), meta: { requiresAuth: true, pageKey: 'treatment' } },
      ],
    },
    {
      path: '/payment',
      meta: { requiresAuth: true, pageKey: 'payment' },
      children: [
        { path: '', name: 'payment-list', component: () => import('@/views/payment/PaymentListView.vue') },
        { path: 'new', name: 'payment-new', component: () => import('@/views/payment/PaymentFormView.vue'), meta: { requiresAuth: true, pageKey: 'payment' } },
        { path: ':id', name: 'payment-detail', component: () => import('@/views/payment/PaymentFormView.vue'), meta: { requiresAuth: true, pageKey: 'payment' } },
      ],
    },
    {
      path: '/shipment',
      meta: { requiresAuth: true, pageKey: 'shipment' },
      children: [
        { path: '', name: 'shipment-list', component: () => import('@/views/shipment/InOutListView.vue') },
        { path: 'new', name: 'shipment-new', component: () => import('@/views/shipment/InOutFormView.vue'), meta: { requiresAuth: true, pageKey: 'shipment' } },
        { path: ':id', name: 'shipment-detail', component: () => import('@/views/shipment/InOutFormView.vue'), meta: { requiresAuth: true, pageKey: 'shipment' } },
      ],
    },
    {
      path: '/admin/reference-data',
      name: 'reference-data',
      component: () => import('@/views/admin/ReferenceDataView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/field-config',
      name: 'field-config',
      component: () => import('@/views/admin/FieldConfigView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/tables',
      name: 'table-list',
      component: () => import('@/views/admin/TableListView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/tables/:tableId',
      name: 'table-columns',
      component: () => import('@/views/admin/ColumnListView.vue'),
      meta: { requiresAuth: true },
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
