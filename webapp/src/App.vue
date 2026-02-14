<template>
  <div v-if="sessionState.expired" class="session-banner">
    登入已過期，請重新登入
    <button @click="handleRelogin">重新登入</button>
  </div>
  <AppHeader />
  <router-view />
</template>

<script setup lang="ts">
import { sessionState, clearSessionExpired } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'

const auth = useAuthStore()
const router = useRouter()

function handleRelogin() {
  clearSessionExpired()
  auth.logout()
  router.push('/login')
}
</script>

<style scoped>
.session-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  background: var(--color-error);
  color: white;
  padding: 0.75rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}
.session-banner button {
  background: white;
  color: var(--color-error);
  border: none;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}
</style>
