<template>
  <div class="login-container">
    <div class="login-card">
      <h1 class="login-title">醫美診所</h1>

      <div v-if="auth.loginError" class="login-error">
        {{ auth.loginError }}
      </div>

      <!-- Step: Credentials -->
      <form v-if="auth.loginStep === 'credentials'" @submit.prevent="handleLogin">
        <div class="form-group">
          <label>帳號</label>
          <input v-model="username" type="text" autocomplete="username" required />
        </div>
        <div class="form-group">
          <label>密碼</label>
          <input v-model="password" type="password" autocomplete="current-password" required />
        </div>
        <button type="submit" :disabled="auth.loginLoading">
          {{ auth.loginLoading ? '登入中...' : '登入' }}
        </button>
      </form>

      <!-- Step: Selection (client/role/org/warehouse) -->
      <div v-else-if="auth.loginStep !== 'done'" class="selection-step">
        <h2>{{ stepTitle }}</h2>
        <div class="selection-list">
          <button
            v-for="item in currentItems"
            :key="item.id"
            class="selection-item"
            :disabled="auth.loginLoading"
            @click="selectItem(item.id)"
          >
            {{ item.name }}
          </button>
        </div>
        <button class="back-btn" @click="auth.loginGoBack()">返回</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const username = ref('')
const password = ref('')

const stepTitle = computed(() => {
  switch (auth.loginStep) {
    case 'client': return '選擇公司'
    case 'role': return '選擇角色'
    case 'org': return '選擇組織'
    case 'warehouse': return '選擇倉庫'
    default: return ''
  }
})

const currentItems = computed(() => {
  switch (auth.loginStep) {
    case 'client': return auth.availableClients
    case 'role': return auth.availableRoles
    case 'org': return auth.availableOrgs
    case 'warehouse': return auth.availableWarehouses
    default: return []
  }
})

async function handleLogin() {
  const success = await auth.authenticate(username.value, password.value)
  if (success && auth.isAuthenticated) {
    navigateAfterLogin()
  }
}

async function selectItem(id: number) {
  switch (auth.loginStep) {
    case 'client': await auth.selectClient(id); break
    case 'role': await auth.selectRole(id); break
    case 'org': await auth.selectOrg(id); break
    case 'warehouse': await auth.selectWarehouse(id); break
  }
  if (auth.isAuthenticated) {
    navigateAfterLogin()
  }
}

function navigateAfterLogin() {
  const redirect = route.query.redirect as string
  router.push(redirect || '/')
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 1rem;
  background: #f8fafc;
}
.login-card {
  width: 100%;
  max-width: 400px;
  padding: 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
}
.login-title {
  text-align: center;
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
  color: var(--color-primary);
}
.login-error {
  background: #fef2f2;
  color: var(--color-error);
  padding: 0.75rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  font-size: 0.875rem;
}
.form-group {
  margin-bottom: 1rem;
}
.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
}
.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 1rem;
  min-height: var(--min-touch);
}
button[type="submit"], .selection-item {
  width: 100%;
  padding: 0.75rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  min-height: var(--min-touch);
  cursor: pointer;
}
button[type="submit"]:hover, .selection-item:hover {
  background: var(--color-primary-hover);
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.selection-step h2 {
  text-align: center;
  margin-bottom: 1rem;
  font-size: 1.125rem;
}
.selection-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.back-btn {
  width: 100%;
  padding: 0.5rem;
  margin-top: 1rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  min-height: var(--min-touch);
}
</style>
