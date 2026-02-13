import { createRouter, createWebHashHistory } from 'vue-router'
const router = createRouter({
  history: createWebHashHistory('/aesthetics/'),
  routes: [
    { path: '/', name: 'home', component: () => import('@/App.vue') },
  ],
})
export default router
