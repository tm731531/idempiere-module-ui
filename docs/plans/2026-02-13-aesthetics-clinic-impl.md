# 醫美診所 UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Mobile-First Vue 3 + PrimeVue 4 frontend for aesthetics clinics, deployed as an OSGi WAB bundle on iDempiere, with dynamic field rendering from AD_Field/AD_Column metadata.

**Architecture:** Vue 3 + TypeScript + PrimeVue 4 (Unstyled) + Pinia + Axios. Auth module ported from idempiere-skin-ui. Dynamic forms render from iDempiere metadata. OSGi WAB JAR deployed at `/aesthetics/`. DocAction via single POST to Process endpoint.

**Tech Stack:** Vue 3.5, Vite 7, PrimeVue 4.5, Pinia 3, Axios, Vitest, browser-image-compression, TypeScript 5.9

**Reference project:** `/home/tom/idempiere-skin-ui/` — auth store, API client, build.sh, OSGi bundle structure are directly portable.

**Design doc:** `docs/plans/2026-02-13-aesthetics-clinic-design.md`

---

## Phase 0: Project Scaffolding + Auth + API Foundation

### Task 0.1: Initialize Vue 3 + Vite project

**Files:**
- Create: `webapp/package.json`
- Create: `webapp/index.html`
- Create: `webapp/tsconfig.json`
- Create: `webapp/tsconfig.app.json`
- Create: `webapp/tsconfig.node.json`
- Create: `webapp/vite.config.ts`
- Create: `webapp/vitest.config.ts`
- Create: `webapp/src/main.ts`
- Create: `webapp/src/App.vue`
- Create: `webapp/src/style.css`
- Create: `webapp/src/vite-env.d.ts`

**Step 1: Create webapp/package.json**

```json
{
  "name": "idempiere-aesthetics-ui",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "description": "Medical Aesthetics Clinic UI for iDempiere",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "build:only": "vite build",
    "preview": "vite preview",
    "type-check": "vue-tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "axios": "^1.13.4",
    "browser-image-compression": "^2.0.2",
    "pinia": "^3.0.4",
    "primevue": "^4.5.4",
    "@primevue/themes": "^4.5.4",
    "vue": "^3.5.24",
    "vue-router": "^4.6.4"
  },
  "devDependencies": {
    "@types/node": "^24.10.1",
    "@vitejs/plugin-vue": "^6.0.1",
    "@vue/test-utils": "^2.4.6",
    "@vue/tsconfig": "^0.8.1",
    "happy-dom": "^20.5.0",
    "terser": "^5.46.0",
    "typescript": "~5.9.3",
    "vite": "^7.2.4",
    "vitest": "^4.0.18",
    "vue-tsc": "^3.1.4"
  }
}
```

**Step 2: Create webapp/index.html**

```html
<!DOCTYPE html>
<html lang="zh-TW">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>醫美診所</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

**Step 3: Create webapp/vite.config.ts**

```typescript
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [vue()],
    base: '/aesthetics/',

    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },

    build: {
      outDir: '../osgi-bundle/web',
      emptyOutDir: true,
      minify: 'terser',
      terserOptions: {
        compress: { drop_console: true, drop_debugger: true },
        mangle: { toplevel: true },
        format: { comments: false },
      },
      rollupOptions: {
        output: {
          manualChunks: {
            'vue-vendor': ['vue', 'vue-router', 'pinia'],
            'primevue-vendor': ['primevue'],
          },
        },
      },
    },

    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
  }
})
```

**Step 4: Create webapp/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.{test,spec}.{js,ts}'],
    exclude: ['src/__integration__/**', 'node_modules/**'],
  },
})
```

**Step 5: Create tsconfig files**

`webapp/tsconfig.json`:
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

`webapp/tsconfig.app.json`:
```json
{
  "extends": "@vue/tsconfig/tsconfig.dom.json",
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsBuildInfo",
    "paths": { "@/*": ["./src/*"] },
    "erasableSyntaxOnly": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue", "src/vite-env.d.ts"]
}
```

`webapp/tsconfig.node.json`:
```json
{
  "extends": "@vue/tsconfig/tsconfig.node.json",
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsBuildInfo"
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

**Step 6: Create minimal app entry**

`webapp/src/vite-env.d.ts`:
```typescript
/// <reference types="vite/client" />
```

`webapp/src/style.css`:
```css
:root {
  --color-primary: #6366f1;
  --color-primary-hover: #4f46e5;
  --color-bg: #ffffff;
  --color-text: #1e293b;
  --color-border: #e2e8f0;
  --color-error: #ef4444;
  --color-success: #22c55e;
  --min-touch: 44px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: var(--color-text);
  background: var(--color-bg);
  -webkit-font-smoothing: antialiased;
}

#app {
  min-height: 100vh;
}
```

`webapp/src/App.vue`:
```vue
<template>
  <router-view />
</template>
```

`webapp/src/main.ts`:
```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import router from './router'
import App from './App.vue'
import { loadConfig } from './config'
import './style.css'

loadConfig().then(() => {
  const app = createApp(App)

  app.use(createPinia())
  app.use(PrimeVue, { unstyled: true })
  app.use(router)

  app.mount('#app')
})
```

**Step 7: Install dependencies and verify build**

Run: `cd /home/tom/idempiere-module-ui/webapp && npm install`
Expected: node_modules created, no errors

Run: `cd /home/tom/idempiere-module-ui/webapp && npx vue-tsc --noEmit`
Expected: No type errors (may need router/config stubs first — create them in Task 0.2/0.3)

**Step 8: Commit**

```bash
git add webapp/
git commit -m "feat: scaffold Vue 3 + Vite + PrimeVue 4 project"
```

---

### Task 0.2: Runtime config module

**Files:**
- Create: `webapp/src/config.ts`
- Create: `webapp/public/config.json`
- Create: `webapp/src/api/__tests__/config.test.ts`

**Step 1: Write the failing test**

`webapp/src/api/__tests__/config.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// We test the config module's behavior
describe('config', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should load config from /aesthetics/config.json', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ apiBaseUrl: '' }),
    }))

    // Re-import to get fresh module
    const { loadConfig } = await import('@/config')
    const config = await loadConfig()

    expect(config.apiBaseUrl).toBe('')
    expect(fetch).toHaveBeenCalledWith('/aesthetics/config.json')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd /home/tom/idempiere-module-ui/webapp && npx vitest run src/api/__tests__/config.test.ts`
Expected: FAIL (module not found)

**Step 3: Write implementation**

`webapp/src/config.ts`:
```typescript
interface AppConfig {
  apiBaseUrl: string
}

let config: AppConfig | null = null

export async function loadConfig(): Promise<AppConfig> {
  if (config) return config

  try {
    const response = await fetch('/aesthetics/config.json')
    config = await response.json()
  } catch {
    config = { apiBaseUrl: '' }
  }

  return config!
}

export function getConfig(): AppConfig {
  if (!config) {
    throw new Error('Config not loaded. Call loadConfig() first.')
  }
  return config
}

export function getApiBaseUrl(): string {
  return getConfig().apiBaseUrl
}
```

`webapp/public/config.json`:
```json
{
  "apiBaseUrl": ""
}
```

**Step 4: Run test to verify it passes**

Run: `cd /home/tom/idempiere-module-ui/webapp && npx vitest run src/api/__tests__/config.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add webapp/src/config.ts webapp/public/config.json webapp/src/api/__tests__/config.test.ts
git commit -m "feat: add runtime config module"
```

---

### Task 0.3: API client with 401 interceptor

**Files:**
- Create: `webapp/src/api/client.ts`
- Create: `webapp/src/api/utils.ts`
- Create: `webapp/src/api/__tests__/client.test.ts`
- Create: `webapp/src/api/__tests__/utils.test.ts`

**Step 1: Write failing tests for utils**

`webapp/src/api/__tests__/utils.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { escapeODataString, toIdempiereDateTime, toDateString } from '@/api/utils'

describe('escapeODataString', () => {
  it('should escape single quotes', () => {
    expect(escapeODataString("O'Brien")).toBe("O''Brien")
  })

  it('should remove dangerous characters', () => {
    expect(escapeODataString('test<script>')).toBe('testscript')
  })

  it('should return empty for empty input', () => {
    expect(escapeODataString('')).toBe('')
  })
})

describe('toIdempiereDateTime', () => {
  it('should format local time with Z suffix (no milliseconds)', () => {
    const d = new Date(2026, 1, 13, 14, 30, 0) // Feb 13, 2026 14:30:00
    expect(toIdempiereDateTime(d)).toBe('2026-02-13T14:30:00Z')
  })
})

describe('toDateString', () => {
  it('should format as YYYY-MM-DD', () => {
    const d = new Date(2026, 0, 5)
    expect(toDateString(d)).toBe('2026-01-05')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd /home/tom/idempiere-module-ui/webapp && npx vitest run src/api/__tests__/utils.test.ts`
Expected: FAIL

**Step 3: Write utils implementation**

`webapp/src/api/utils.ts`:
```typescript
export function escapeODataString(value: string): string {
  if (!value) return ''
  return value
    .replace(/'/g, "''")
    .replace(/[<>{}|\\^~\[\]`]/g, '')
    .trim()
}

export function toIdempiereDateTime(date: Date): string {
  const y = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`
}

export function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
```

**Step 4: Run utils tests**

Run: `cd /home/tom/idempiere-module-ui/webapp && npx vitest run src/api/__tests__/utils.test.ts`
Expected: PASS

**Step 5: Write failing test for client**

`webapp/src/api/__tests__/client.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should export apiClient and sessionState', async () => {
    const { apiClient, sessionState } = await import('@/api/client')
    expect(apiClient).toBeDefined()
    expect(sessionState.expired).toBe(false)
  })

  it('should export generic CRUD api object', async () => {
    const { api } = await import('@/api/client')
    expect(api.getRecords).toBeTypeOf('function')
    expect(api.getRecord).toBeTypeOf('function')
    expect(api.createRecord).toBeTypeOf('function')
    expect(api.updateRecord).toBeTypeOf('function')
    expect(api.deleteRecord).toBeTypeOf('function')
  })
})
```

**Step 6: Write client implementation**

`webapp/src/api/client.ts`:
```typescript
import axios from 'axios'
import { getApiBaseUrl } from '@/config'

export const apiClient = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Dynamic baseURL from config.json
apiClient.interceptors.request.use((config) => {
  const apiBase = getApiBaseUrl()
  if (apiBase) {
    config.baseURL = apiBase
  }
  return config
})

// Session expired state
export const sessionState = { expired: false }
export function clearSessionExpired() { sessionState.expired = false }

// 401 interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || ''
      if (!url.includes('/api/v1/auth/')) {
        sessionState.expired = true
      }
    }
    return Promise.reject(error)
  }
)

// Generic CRUD methods
export const api = {
  async getRecords(model: string, params?: Record<string, unknown>) {
    const response = await apiClient.get(`/api/v1/models/${model}`, { params })
    return response.data
  },

  async getRecord(model: string, id: number) {
    const response = await apiClient.get(`/api/v1/models/${model}/${id}`)
    return response.data
  },

  async createRecord(model: string, data: Record<string, unknown>) {
    const response = await apiClient.post(`/api/v1/models/${model}`, data)
    return response.data
  },

  async updateRecord(model: string, id: number, data: Record<string, unknown>) {
    const response = await apiClient.put(`/api/v1/models/${model}/${id}`, data)
    return response.data
  },

  async deleteRecord(model: string, id: number) {
    const response = await apiClient.delete(`/api/v1/models/${model}/${id}`)
    return response.data
  },
}

export default api
```

**Step 7: Run all tests**

Run: `cd /home/tom/idempiere-module-ui/webapp && npx vitest run`
Expected: All PASS

**Step 8: Commit**

```bash
git add webapp/src/api/
git commit -m "feat: add API client with 401 interceptor and OData utils"
```

---

### Task 0.4: Auth store (multi-step login)

**Files:**
- Create: `webapp/src/stores/auth.ts`
- Create: `webapp/src/api/lookup.ts`
- Create: `webapp/src/stores/__tests__/auth.test.ts`

**Step 1: Write failing test**

`webapp/src/stores/__tests__/auth.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { apiClient } from '@/api/client'

vi.mock('@/api/client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    defaults: { headers: { common: {} } },
  },
  clearSessionExpired: vi.fn(),
}))

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('should start at credentials step', () => {
    const auth = useAuthStore()
    expect(auth.loginStep).toBe('credentials')
    expect(auth.isAuthenticated).toBe(false)
  })

  it('should authenticate and move to client step', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        token: 'test-token',
        clients: [
          { id: 1, name: 'Client A' },
          { id: 2, name: 'Client B' },
        ],
      },
    })

    const auth = useAuthStore()
    const result = await auth.authenticate('admin', 'pass')

    expect(result).toBe(true)
    expect(auth.loginStep).toBe('client')
    expect(auth.availableClients).toHaveLength(2)
  })

  it('should auto-skip single client', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        token: 'test-token',
        clients: [{ id: 1, name: 'Only Client' }],
      },
    })
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        roles: [
          { id: 10, name: 'Admin' },
          { id: 20, name: 'User' },
        ],
      },
    })

    const auth = useAuthStore()
    await auth.authenticate('admin', 'pass')

    // Should have auto-selected client and moved to role step
    expect(auth.loginStep).toBe('role')
  })

  it('should logout and clear state', () => {
    const auth = useAuthStore()
    auth.logout()
    expect(auth.token).toBeNull()
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.loginStep).toBe('credentials')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd /home/tom/idempiere-module-ui/webapp && npx vitest run src/stores/__tests__/auth.test.ts`
Expected: FAIL

**Step 3: Create lookup.ts stub (needed by auth store)**

`webapp/src/api/lookup.ts`:
```typescript
import { apiClient } from './client'

const cache: Record<string, number> = {}

export function clearLookupCache(): void {
  for (const key of Object.keys(cache)) {
    delete cache[key]
  }
}

export async function lookupCustomerGroupId(): Promise<number> {
  if (cache['C_BP_Group_ID'] !== undefined) return cache['C_BP_Group_ID']

  const resp = await apiClient.get('/api/v1/models/C_BP_Group', {
    params: {
      '$filter': 'IsActive eq true',
      '$select': 'C_BP_Group_ID,Name,IsDefault',
      '$orderby': 'IsDefault desc, Name asc',
      '$top': 5,
    },
  })

  const records = resp.data.records || []
  const defaultGroup = records.find((r: any) => r.IsDefault) || records[0]
  const id = defaultGroup?.id || 0
  cache['C_BP_Group_ID'] = id
  return id
}

export async function lookupDocTypeId(docBaseType: string): Promise<number> {
  const cacheKey = `C_DocType_${docBaseType}`
  if (cache[cacheKey] !== undefined) return cache[cacheKey]

  const resp = await apiClient.get('/api/v1/models/C_DocType', {
    params: {
      '$filter': `DocBaseType eq '${docBaseType}' and IsActive eq true`,
      '$select': 'C_DocType_ID,Name',
      '$top': 1,
    },
  })

  const records = resp.data.records || []
  const id = records[0]?.id || 0
  cache[cacheKey] = id
  return id
}

export async function lookupEachUomId(): Promise<number> {
  if (cache['C_UOM_Each'] !== undefined) return cache['C_UOM_Each']

  const resp = await apiClient.get('/api/v1/models/C_UOM', {
    params: {
      '$filter': "X12DE355 eq 'EA' and IsActive eq true",
      '$select': 'C_UOM_ID,Name',
      '$top': 1,
    },
  })

  const records = resp.data.records || []
  const id = records[0]?.id || 0
  cache['C_UOM_Each'] = id
  return id
}

export async function lookupSalesPriceListId(): Promise<number> {
  if (cache['M_PriceList_SO'] !== undefined) return cache['M_PriceList_SO']

  const resp = await apiClient.get('/api/v1/models/M_PriceList', {
    params: {
      '$filter': 'IsSOPriceList eq true and IsActive eq true',
      '$select': 'M_PriceList_ID,Name,C_Currency_ID,IsDefault',
      '$orderby': 'IsDefault desc',
      '$top': 1,
    },
  })

  const records = resp.data.records || []
  const id = records[0]?.id || 0
  cache['M_PriceList_SO'] = id
  if (records[0]?.C_Currency_ID) {
    cache['C_Currency_SO'] = records[0].C_Currency_ID?.id || records[0].C_Currency_ID
  }
  return id
}

export async function lookupDefaultPaymentTermId(): Promise<number> {
  if (cache['C_PaymentTerm'] !== undefined) return cache['C_PaymentTerm']

  const resp = await apiClient.get('/api/v1/models/C_PaymentTerm', {
    params: {
      '$filter': 'IsActive eq true',
      '$select': 'C_PaymentTerm_ID,Name,IsDefault',
      '$orderby': 'IsDefault desc, Name asc',
      '$top': 1,
    },
  })

  const records = resp.data.records || []
  const id = records[0]?.id || 0
  cache['C_PaymentTerm'] = id
  return id
}

export async function lookupDefaultTaxId(): Promise<number> {
  if (cache['C_Tax'] !== undefined) return cache['C_Tax']

  const resp = await apiClient.get('/api/v1/models/C_Tax', {
    params: {
      '$filter': 'IsActive eq true',
      '$select': 'C_Tax_ID,Name,IsDefault',
      '$orderby': 'IsDefault desc, Name asc',
      '$top': 1,
    },
  })

  const records = resp.data.records || []
  const id = records[0]?.id || 0
  cache['C_Tax'] = id
  return id
}
```

**Step 4: Write auth store implementation**

`webapp/src/stores/auth.ts` — Port directly from `/home/tom/idempiere-skin-ui/webapp/src/stores/auth.ts` with these changes:
- No changes to logic — identical multi-step flow
- Same localStorage persistence pattern
- Same `switchContext` / `loginGoBack` logic

(Copy the full file from skin-ui reference — 416 lines, no modifications needed)

**Step 5: Run auth tests**

Run: `cd /home/tom/idempiere-module-ui/webapp && npx vitest run src/stores/__tests__/auth.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add webapp/src/stores/auth.ts webapp/src/api/lookup.ts webapp/src/stores/__tests__/
git commit -m "feat: add auth store with multi-step login and lookup module"
```

---

### Task 0.5: Router skeleton with auth guard

**Files:**
- Create: `webapp/src/router/index.ts`
- Create: `webapp/src/views/LoginView.vue` (stub)
- Create: `webapp/src/views/HomeView.vue` (stub)

**Step 1: Write router**

`webapp/src/router/index.ts`:
```typescript
import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

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
    // Business modules (stubs — filled in later phases)
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

  next()
})

export default router
```

**Step 2: Create stub views**

`webapp/src/views/LoginView.vue`:
```vue
<template>
  <div class="login-page">
    <h1>醫美診所</h1>
    <p>Login coming in Task 0.6</p>
  </div>
</template>
```

`webapp/src/views/HomeView.vue`:
```vue
<template>
  <div class="home-page">
    <h1>首頁</h1>
    <p>Home coming in Phase 1</p>
  </div>
</template>
```

`webapp/src/views/PlaceholderView.vue`:
```vue
<template>
  <div style="padding: 2rem; text-align: center;">
    <h2>{{ $route.name }}</h2>
    <p>此頁面尚未實作</p>
  </div>
</template>
```

**Step 3: Verify type check passes**

Run: `cd /home/tom/idempiere-module-ui/webapp && npx vue-tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add webapp/src/router/ webapp/src/views/
git commit -m "feat: add router skeleton with auth guard and stub views"
```

---

### Task 0.6: Login view (multi-step UI)

**Files:**
- Modify: `webapp/src/views/LoginView.vue`
- Create: `webapp/src/views/__tests__/LoginView.test.ts`

**Step 1: Write failing test**

`webapp/src/views/__tests__/LoginView.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LoginView from '@/views/LoginView.vue'

vi.mock('@/api/client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    defaults: { headers: { common: {} } },
  },
  clearSessionExpired: vi.fn(),
}))

describe('LoginView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('should render credentials form by default', () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [createPinia()] },
    })
    expect(wrapper.find('input[type="text"]').exists()).toBe(true)
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
    expect(wrapper.find('button').text()).toContain('登入')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd /home/tom/idempiere-module-ui/webapp && npx vitest run src/views/__tests__/LoginView.test.ts`
Expected: FAIL

**Step 3: Implement LoginView**

`webapp/src/views/LoginView.vue`:
```vue
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

button[type="submit"],
.selection-item {
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

button[type="submit"]:hover,
.selection-item:hover {
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
```

**Step 4: Run test**

Run: `cd /home/tom/idempiere-module-ui/webapp && npx vitest run src/views/__tests__/LoginView.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add webapp/src/views/LoginView.vue webapp/src/views/__tests__/
git commit -m "feat: add multi-step login view"
```

---

### Task 0.7: OSGi bundle structure + build.sh

**Files:**
- Create: `osgi-bundle/META-INF/MANIFEST.MF`
- Create: `osgi-bundle/WEB-INF/web.xml`
- Create: `osgi-bundle/plugin.xml`
- Create: `build.sh`

**Step 1: Create MANIFEST.MF**

`osgi-bundle/META-INF/MANIFEST.MF`:
```
Manifest-Version: 1.0
Bundle-ManifestVersion: 2
Bundle-Name: iDempiere Aesthetics UI
Bundle-SymbolicName: org.idempiere.ui.aesthetics;singleton:=true
Bundle-Version: 1.0.0.qualifier
Bundle-Vendor: Yishou Clinic
Bundle-RequiredExecutionEnvironment: JavaSE-17
Web-ContextPath: /aesthetics
Jetty-Environment: ee8
Import-Package: javax.servlet;version="[3.1,5)",
 javax.servlet.http;version="[3.1,5)"

```

(Note: trailing newline required)

**Step 2: Create web.xml**

`osgi-bundle/WEB-INF/web.xml`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<web-app xmlns="http://xmlns.jcp.org/xml/ns/javaee"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://xmlns.jcp.org/xml/ns/javaee http://xmlns.jcp.org/xml/ns/javaee/web-app_4_0.xsd"
         version="4.0">
    <display-name>iDempiere Aesthetics Clinic UI</display-name>

    <welcome-file-list>
        <welcome-file>index.html</welcome-file>
    </welcome-file-list>
</web-app>
```

**Step 3: Create empty plugin.xml**

`osgi-bundle/plugin.xml`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<?eclipse version="3.4"?>
<plugin>
</plugin>
```

**Step 4: Create build.sh**

`build.sh`:
```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBAPP_DIR="$SCRIPT_DIR/webapp"
BUNDLE_DIR="$SCRIPT_DIR/osgi-bundle"
IDEMPIERE_HOME="${IDEMPIERE_HOME:-/opt/idempiere-server/x86_64}"

BUILD_TIMESTAMP="$(date +%Y%m%d%H%M)"
JAR_NAME="org.idempiere.ui.aesthetics_1.0.0.${BUILD_TIMESTAMP}.jar"
OUTPUT_JAR="$SCRIPT_DIR/$JAR_NAME"

echo "=========================================="
echo "  iDempiere Aesthetics UI - Build Script"
echo "  Build: $BUILD_TIMESTAMP"
echo "=========================================="
echo ""

echo "[1/4] Building Vue frontend..."
cd "$WEBAPP_DIR"
npm run build
echo "Vue build complete"
echo ""

echo "[2/4] Preparing MANIFEST (qualifier → $BUILD_TIMESTAMP)..."
cd "$BUNDLE_DIR"
cp META-INF/MANIFEST.MF META-INF/MANIFEST.MF.bak
sed -i "s/Bundle-Version: 1.0.0.qualifier/Bundle-Version: 1.0.0.${BUILD_TIMESTAMP}/" META-INF/MANIFEST.MF

echo "[3/4] Building OSGi JAR..."
jar cfm "$OUTPUT_JAR" META-INF/MANIFEST.MF \
    -C . WEB-INF \
    -C . plugin.xml \
    -C web .

mv META-INF/MANIFEST.MF.bak META-INF/MANIFEST.MF

echo "JAR built: $JAR_NAME"
echo "Size: $(ls -lh "$OUTPUT_JAR" | awk '{print $5}')"
echo ""

if [ "$1" = "--deploy" ]; then
    rm -f "$IDEMPIERE_HOME/plugins/org.idempiere.ui.aesthetics_1.0.0"*.jar 2>/dev/null || true
    DEPLOY_JAR="$IDEMPIERE_HOME/plugins/$JAR_NAME"
    echo "[4/4] Deploying to $DEPLOY_JAR ..."
    cp "$OUTPUT_JAR" "$DEPLOY_JAR"
    echo "Deployed successfully."
    echo ""
    echo "To activate, use Felix Web Console or restart iDempiere."
else
    echo "[4/4] Skipping deploy (use --deploy flag)"
fi

echo ""
echo "URL: https://<host>:8443/aesthetics/#/"
echo "=========================================="
```

**Step 5: Make build.sh executable**

Run: `chmod +x /home/tom/idempiere-module-ui/build.sh`

**Step 6: Commit**

```bash
git add osgi-bundle/ build.sh
git commit -m "feat: add OSGi WAB bundle structure and build script"
```

---

### Task 0.8: Session expired banner in App.vue

**Files:**
- Modify: `webapp/src/App.vue`

**Step 1: Update App.vue with session expired polling**

`webapp/src/App.vue`:
```vue
<template>
  <div v-if="sessionState.expired" class="session-banner">
    登入已過期，請重新登入
    <button @click="handleRelogin">重新登入</button>
  </div>
  <router-view />
</template>

<script setup lang="ts">
import { sessionState, clearSessionExpired } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

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
```

**Step 2: Run all tests**

Run: `cd /home/tom/idempiere-module-ui/webapp && npx vitest run`
Expected: All PASS

**Step 3: Commit**

```bash
git add webapp/src/App.vue
git commit -m "feat: add session expired banner to App.vue"
```

---

### Task 0.9: Verify full build pipeline

**Step 1: Run type check**

Run: `cd /home/tom/idempiere-module-ui/webapp && npx vue-tsc --noEmit`
Expected: No errors

**Step 2: Run all tests**

Run: `cd /home/tom/idempiere-module-ui/webapp && npx vitest run`
Expected: All PASS

**Step 3: Run production build**

Run: `cd /home/tom/idempiere-module-ui/webapp && npm run build`
Expected: Build succeeds, outputs to `osgi-bundle/web/`

**Step 4: Verify build output**

Run: `ls -la /home/tom/idempiere-module-ui/osgi-bundle/web/`
Expected: index.html, assets/ directory with JS/CSS chunks

**Step 5: Build OSGi JAR**

Run: `cd /home/tom/idempiere-module-ui && bash build.sh`
Expected: JAR file created successfully

**Step 6: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve build pipeline issues"
```

---

## Phase 0 Checkpoint

At this point you should have:
- Working Vue 3 + Vite + PrimeVue 4 project
- Runtime config module (`config.ts`)
- API client with 401 interceptor (`api/client.ts`)
- OData utilities (`api/utils.ts`)
- Dynamic ID lookup module (`api/lookup.ts`)
- Auth store with multi-step login (`stores/auth.ts`)
- Router with auth guard and stub routes
- Multi-step LoginView
- Session expired banner
- OSGi bundle structure + build.sh
- All tests passing
- Production build working

---

## Phase 1: Cross-Cutting Core — Dynamic Fields, DocAction, Attachments, Permissions

### Task 1.1: Metadata API module

**Files:**
- Create: `webapp/src/api/metadata.ts`
- Create: `webapp/src/api/__tests__/metadata.test.ts`

**Step 1: Write failing test**

`webapp/src/api/__tests__/metadata.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '@/api/client'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), defaults: { headers: { common: {} } } },
}))

describe('metadata API', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('should fetch AD_Field list for a tab', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        records: [{
          id: 100, Name: 'DocumentNo', SeqNo: 10,
          IsDisplayed: true, FieldGroup: '基本資訊', IsReadOnly: false,
          AD_Column_ID: { id: 200 },
        }],
      },
    })

    const { fetchFieldsForTab } = await import('@/api/metadata')
    const fields = await fetchFieldsForTab(100)
    expect(fields).toHaveLength(1)
    expect(fields[0].name).toBe('DocumentNo')
  })

  it('should fetch AD_Column details', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        id: 200, ColumnName: 'DocumentNo',
        AD_Reference_ID: { id: 10 }, FieldLength: 30,
        IsMandatory: true, DefaultValue: '', AD_Reference_Value_ID: null,
      },
    })

    const { fetchColumn } = await import('@/api/metadata')
    const col = await fetchColumn(200)
    expect(col.columnName).toBe('DocumentNo')
    expect(col.referenceId).toBe(10)
    expect(col.isMandatory).toBe(true)
  })
})
```

**Step 2: Run test — Expected: FAIL**

**Step 3: Write implementation**

`webapp/src/api/metadata.ts`:
```typescript
import { apiClient } from './client'

export interface FieldMeta {
  id: number; name: string; seqNo: number; isDisplayed: boolean
  isReadOnly: boolean; fieldGroup: string; columnId: number
}

export interface ColumnMeta {
  id: number; columnName: string; referenceId: number
  referenceValueId: number | null; fieldLength: number
  isMandatory: boolean; defaultValue: string; isUpdateable: boolean
}

export interface FieldDefinition { field: FieldMeta; column: ColumnMeta }

export async function fetchFieldsForTab(tabId: number): Promise<FieldMeta[]> {
  const resp = await apiClient.get('/api/v1/models/AD_Field', {
    params: {
      '$filter': `AD_Tab_ID eq ${tabId} and IsActive eq true and IsDisplayed eq true`,
      '$select': 'AD_Field_ID,Name,SeqNo,IsDisplayed,IsReadOnly,FieldGroup,AD_Column_ID',
      '$orderby': 'SeqNo', '$top': 200,
    },
  })
  return (resp.data.records || []).map((r: any) => ({
    id: r.id, name: r.Name, seqNo: r.SeqNo, isDisplayed: r.IsDisplayed,
    isReadOnly: r.IsReadOnly, fieldGroup: r.FieldGroup || '',
    columnId: r.AD_Column_ID?.id || r.AD_Column_ID,
  }))
}

export async function fetchColumn(columnId: number): Promise<ColumnMeta> {
  const resp = await apiClient.get(`/api/v1/models/AD_Column/${columnId}`, {
    params: { '$select': 'AD_Column_ID,ColumnName,AD_Reference_ID,AD_Reference_Value_ID,FieldLength,IsMandatory,DefaultValue,IsUpdateable' },
  })
  const r = resp.data
  return {
    id: r.id, columnName: r.ColumnName,
    referenceId: r.AD_Reference_ID?.id || r.AD_Reference_ID,
    referenceValueId: r.AD_Reference_Value_ID?.id || r.AD_Reference_Value_ID || null,
    fieldLength: r.FieldLength || 0,
    isMandatory: r.IsMandatory === true || r.IsMandatory === 'Y',
    defaultValue: r.DefaultValue || '',
    isUpdateable: r.IsUpdateable === true || r.IsUpdateable === 'Y',
  }
}

export async function fetchRefListItems(referenceValueId: number): Promise<{ value: string; name: string }[]> {
  const resp = await apiClient.get('/api/v1/models/AD_Ref_List', {
    params: {
      '$filter': `AD_Reference_ID eq ${referenceValueId} and IsActive eq true`,
      '$select': 'Value,Name', '$orderby': 'Name',
    },
  })
  return (resp.data.records || []).map((r: any) => ({ value: r.Value, name: r.Name }))
}

export async function fetchFieldDefinitions(tabId: number): Promise<FieldDefinition[]> {
  const fields = await fetchFieldsForTab(tabId)
  const columns = await Promise.all(fields.map(f => fetchColumn(f.columnId)))
  return fields.map((field, i) => ({ field, column: columns[i] }))
}
```

**Step 4: Run test — Expected: PASS**

**Step 5: Commit**
```bash
git add webapp/src/api/metadata.ts webapp/src/api/__tests__/metadata.test.ts
git commit -m "feat: add metadata API for AD_Field and AD_Column"
```

---

### Task 1.2: useMetadata composable with session cache

**Files:**
- Create: `webapp/src/composables/useMetadata.ts`
- Create: `webapp/src/composables/__tests__/useMetadata.test.ts`

**Step 1: Write failing test**

`webapp/src/composables/__tests__/useMetadata.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/metadata', () => ({ fetchFieldDefinitions: vi.fn() }))

describe('useMetadata', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('should load and cache field definitions', async () => {
    const { fetchFieldDefinitions } = await import('@/api/metadata')
    vi.mocked(fetchFieldDefinitions).mockResolvedValue([{
      field: { id: 1, name: 'Name', seqNo: 10, isDisplayed: true, isReadOnly: false, fieldGroup: '基本', columnId: 100 },
      column: { id: 100, columnName: 'Name', referenceId: 10, referenceValueId: null, fieldLength: 60, isMandatory: true, defaultValue: '', isUpdateable: true },
    }])

    const { useMetadata } = await import('@/composables/useMetadata')
    const { loadFields, fieldDefs } = useMetadata()
    await loadFields(50)
    expect(fieldDefs.value).toHaveLength(1)
    await loadFields(50) // cached
    expect(fetchFieldDefinitions).toHaveBeenCalledTimes(1)
  })
})
```

**Step 2: Run test — Expected: FAIL**

**Step 3: Write implementation**

`webapp/src/composables/useMetadata.ts`:
```typescript
import { ref } from 'vue'
import { fetchFieldDefinitions, type FieldDefinition } from '@/api/metadata'

const cache = new Map<number, FieldDefinition[]>()

export function clearMetadataCache(): void { cache.clear() }

export function useMetadata() {
  const fieldDefs = ref<FieldDefinition[]>([])
  const loading = ref(false)
  const error = ref('')

  async function loadFields(tabId: number): Promise<void> {
    if (cache.has(tabId)) { fieldDefs.value = cache.get(tabId)!; return }
    loading.value = true; error.value = ''
    try {
      const defs = await fetchFieldDefinitions(tabId)
      cache.set(tabId, defs); fieldDefs.value = defs
    } catch (e: any) { error.value = e.message || '載入欄位定義失敗' }
    finally { loading.value = false }
  }

  function groupedFields(): Map<string, FieldDefinition[]> {
    const groups = new Map<string, FieldDefinition[]>()
    for (const def of fieldDefs.value) {
      const g = def.field.fieldGroup || '其他'
      if (!groups.has(g)) groups.set(g, [])
      groups.get(g)!.push(def)
    }
    return groups
  }

  return { fieldDefs, loading, error, loadFields, groupedFields }
}
```

**Step 4: Run test — Expected: PASS**

**Step 5: Commit**
```bash
git add webapp/src/composables/
git commit -m "feat: add useMetadata composable with session cache"
```

---

### Task 1.3: DynamicField component

**Files:**
- Create: `webapp/src/components/DynamicField.vue`
- Create: `webapp/src/components/__tests__/DynamicField.test.ts`

**Step 1: Write failing test**

`webapp/src/components/__tests__/DynamicField.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DynamicField from '@/components/DynamicField.vue'

vi.mock('@/api/metadata', () => ({ fetchRefListItems: vi.fn().mockResolvedValue([]) }))

const baseField = { id: 1, name: 'Test', seqNo: 10, isDisplayed: true, isReadOnly: false, fieldGroup: '', columnId: 1 }
const baseColumn = { id: 1, columnName: 'Test', referenceId: 10, referenceValueId: null, fieldLength: 60, isMandatory: true, defaultValue: '', isUpdateable: true }

describe('DynamicField', () => {
  it('renders text input for referenceId=10', () => {
    const w = mount(DynamicField, { props: { field: baseField, column: baseColumn, modelValue: '', disabled: false } })
    expect(w.find('input[type="text"]').exists()).toBe(true)
  })

  it('renders number input for referenceId=11', () => {
    const w = mount(DynamicField, { props: { field: baseField, column: { ...baseColumn, referenceId: 11 }, modelValue: 0, disabled: false } })
    expect(w.find('input[type="number"]').exists()).toBe(true)
  })

  it('renders checkbox for referenceId=20', () => {
    const w = mount(DynamicField, { props: { field: baseField, column: { ...baseColumn, referenceId: 20 }, modelValue: true, disabled: false } })
    expect(w.find('input[type="checkbox"]').exists()).toBe(true)
  })

  it('shows required indicator', () => {
    const w = mount(DynamicField, { props: { field: baseField, column: baseColumn, modelValue: '', disabled: false } })
    expect(w.find('.required').exists()).toBe(true)
  })
})
```

**Step 2: Run test — Expected: FAIL**

**Step 3: Write implementation**

`webapp/src/components/DynamicField.vue` — renders HTML input/textarea/select/checkbox based on `column.referenceId`:

| referenceId | Renders |
|---|---|
| 10 (String) | `<input type="text">` |
| 11 (Integer), 29 (Qty) | `<input type="number">` |
| 12 (Amount) | `<input type="number" step="0.01">` |
| 13 (ID) | `<input type="hidden">` |
| 14 (Text), 38 (Memo) | `<textarea>` |
| 15 (Date) | `<input type="date">` |
| 16 (DateTime) | `<input type="datetime-local">` |
| 17 (List) | `<select>` — loads options from `fetchRefListItems(referenceValueId)` |
| 19 (Table Direct), 30 (Search) | Slot for SearchSelector (fallback: text input) |
| 20 (YesNo) | `<input type="checkbox">` |
| Other | `<input type="text">` (fallback) |

Props: `field: FieldMeta`, `column: ColumnMeta`, `modelValue: any`, `disabled: boolean`
Emits: `update:modelValue`
Shows required indicator (`*`) when `column.isMandatory`.

**Step 4: Run test — Expected: PASS**

**Step 5: Commit**
```bash
git add webapp/src/components/DynamicField.vue webapp/src/components/__tests__/
git commit -m "feat: add DynamicField component with AD_Reference_ID mapping"
```

---

### Task 1.4: DynamicForm component (grouped panels)

**Files:**
- Create: `webapp/src/components/DynamicForm.vue`
- Create: `webapp/src/components/__tests__/DynamicForm.test.ts`

**Step 1: Write failing test** — verify field groups rendered as sections, mandatory groups auto-expanded

**Step 2: Run test — Expected: FAIL**

**Step 3: Write implementation**

`webapp/src/components/DynamicForm.vue`:
- Groups `fieldDefs` by `field.fieldGroup`
- Each group is a collapsible panel (button header + content div)
- First group + groups with mandatory fields auto-expanded
- Renders `DynamicField` for each field in expanded groups
- Emits `update:modelValue` with merged record object

**Step 4: Run test — Expected: PASS**

**Step 5: Commit**
```bash
git add webapp/src/components/DynamicForm.vue webapp/src/components/__tests__/DynamicForm.test.ts
git commit -m "feat: add DynamicForm with collapsible field groups"
```

---

### Task 1.5: DocAction composable + DocActionBar component

**Files:**
- Create: `webapp/src/composables/useDocAction.ts`
- Create: `webapp/src/components/DocActionBar.vue`
- Create: `webapp/src/composables/__tests__/useDocAction.test.ts`

**Step 1: Write failing test**

```typescript
// Key assertions:
// 1. completeDocument() POSTs to /api/v1/processes/{slug} with record-id + table-id
// 2. Returns { success: true } on non-error response
// 3. Returns { success: false, error } on isError response
// 4. canComplete('DR') === true, canComplete('CO') === false
```

**Step 2: Run test — Expected: FAIL**

**Step 3: Write implementation**

`webapp/src/composables/useDocAction.ts`:
- `PROCESS_MAP`: `{ C_Order: { slug: 'c_order-process', tableId: 259 }, ... }`
- `completeDocument(tableName, tableId, recordId)` → POST single step, **no field update**
- `canComplete(docStatus)` → true for DR/IP/WP
- `isLocked(docStatus)` → true for non-DR

`webapp/src/components/DocActionBar.vue`:
- Shows "完成" button when `canComplete(docStatus)`
- Two-step confirmation (click → "確定要完成？" → confirm/cancel)
- Emits `completed` or `error`
- Shows "已完成" badge when `docStatus === 'CO'`

**Step 4: Run test — Expected: PASS**

**Step 5: Commit**
```bash
git add webapp/src/composables/useDocAction.ts webapp/src/components/DocActionBar.vue webapp/src/composables/__tests__/
git commit -m "feat: add DocAction composable and DocActionBar (Complete only, via Process endpoint)"
```

---

### Task 1.6: Attachment API + useAttachment composable

**Files:**
- Create: `webapp/src/api/attachment.ts`
- Create: `webapp/src/composables/useAttachment.ts`
- Create: `webapp/src/api/__tests__/attachment.test.ts`

**Step 1: Write failing test** — verify `listAttachments`, `uploadAttachment`, `deleteAttachment` API calls

**Step 2: Run test — Expected: FAIL**

**Step 3: Write implementation**

`webapp/src/api/attachment.ts`:
- `listAttachments(tableName, recordId)` → GET `.../attachments`
- `uploadAttachment(tableName, recordId, fileName, base64Data)` → POST
- `deleteAttachment(tableName, recordId, fileName)` → DELETE

`webapp/src/composables/useAttachment.ts`:
- `upload(recordId, file: File)` — compress images via `browser-image-compression` (maxSizeMB: 0.5, maxWidthOrHeight: 1920) then base64 encode and upload
- `loadAttachments(recordId)` — fetch list
- `remove(recordId, fileName)` — delete

**Step 4: Run test — Expected: PASS**

**Step 5: Commit**
```bash
git add webapp/src/api/attachment.ts webapp/src/composables/useAttachment.ts webapp/src/api/__tests__/attachment.test.ts
git commit -m "feat: add attachment API and useAttachment composable with image compression"
```

---

### Task 1.7: usePermission composable (role-based page access)

**Files:**
- Create: `webapp/src/composables/usePermission.ts`
- Create: `webapp/src/composables/__tests__/usePermission.test.ts`

**Step 1: Write failing test**

```typescript
// Key assertions:
// 1. No SysConfig → all business pages allowed (blocklist model)
// 2. SysConfig exists with "appointment,consultation" → only those allowed
// 3. canAccessFieldConfig() checks userLevel contains 'S'
```

**Step 2: Run test — Expected: FAIL**

**Step 3: Write implementation**

`webapp/src/composables/usePermission.ts`:
- `loadPermissions(roleId)` — queries `AD_SysConfig` for `AESTHETICS_ROLE_{roleId}_PAGES`
- No key found → `allowedPages = ALL_BUSINESS_PAGES` (blocklist: unrestricted by default)
- Key found → `allowedPages = value.split(',')`
- `canAccess(pageKey)` → checks `allowedPages.includes(pageKey)`
- `canAccessFieldConfig(userLevel)` → checks `userLevel.includes('S')`

**Step 4: Run test — Expected: PASS**

**Step 5: Commit**
```bash
git add webapp/src/composables/usePermission.ts webapp/src/composables/__tests__/
git commit -m "feat: add usePermission composable with AD_SysConfig blocklist model"
```

---

### Task 1.8: StatusBadge + integrate permission into router

**Files:**
- Create: `webapp/src/components/StatusBadge.vue`
- Modify: `webapp/src/router/index.ts` — add permission guard

**Step 1: Create StatusBadge**

Maps DocStatus codes to Chinese labels with color badges:
DR=草稿(gray), IP=處理中(blue), CO=已完成(green), CL=已關閉(gray), VO=已作廢(red), RE=已沖銷(yellow)

**Step 2: Update router guard to check permissions**

After auth check, load permissions from `usePermission()` and check `canAccess(route.meta.pageKey)`.

**Step 3: Run all tests**

Run: `cd /home/tom/idempiere-module-ui/webapp && npx vitest run`
Expected: All PASS

**Step 4: Commit**
```bash
git add webapp/src/components/StatusBadge.vue webapp/src/router/index.ts
git commit -m "feat: add StatusBadge and integrate permission guard into router"
```

---

## Phase 1 Checkpoint

At this point you should have:
- Metadata API + useMetadata composable with session cache
- DynamicField + DynamicForm components (AD_Reference_ID → input mapping, grouped panels)
- useDocAction + DocActionBar (Complete only, single POST to Process endpoint)
- Attachment API + useAttachment with image compression
- usePermission (AD_SysConfig blocklist model)
- StatusBadge component
- Permission-aware router guard
- All tests passing

---

## Phase 2: Business Partner (三表聯動)

### Task 2.1: BPartner API module (three-table linked create)

**Files:**
- Create: `webapp/src/api/bpartner.ts`
- Create: `webapp/src/api/__tests__/bpartner.test.ts`

**Step 1: Write failing test**

```typescript
// Key assertions:
// 1. createCustomer() calls 4 APIs in sequence:
//    POST C_Location → POST C_BPartner → POST C_BPartner_Location → POST AD_User
// 2. Returns { bpartnerId, locationId, userId }
// 3. On partial failure (e.g., AD_User fails), attempts rollback (DELETE created records)
// 4. searchCustomers(query) → GET C_BPartner with TaxID/Name filter
// 5. getCustomerDetail(id) → GET with $expand for related records
```

**Step 2: Run test — Expected: FAIL**

**Step 3: Write implementation**

`webapp/src/api/bpartner.ts`:
```typescript
import { apiClient } from './client'
import { lookupCustomerGroupId } from './lookup'

export interface CustomerCreateData {
  name: string
  taxId?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  countryId?: number  // default 316 = Taiwan
}

export interface CustomerCreateResult {
  bpartnerId: number
  locationId: number
  bpLocationId: number
  userId: number
}

export async function createCustomer(data: CustomerCreateData, orgId: number): Promise<CustomerCreateResult> {
  const countryId = data.countryId || 316  // Taiwan

  // 1. Create C_Location
  const locResp = await apiClient.post('/api/v1/models/C_Location', {
    AD_Org_ID: orgId,
    C_Country_ID: countryId,
    Address1: data.address || '',
    City: data.city || '',
  })
  const locationId = locResp.data.id

  let bpartnerId = 0
  let bpLocationId = 0
  let userId = 0

  try {
    // 2. Create C_BPartner
    const groupId = await lookupCustomerGroupId()
    const bpResp = await apiClient.post('/api/v1/models/C_BPartner', {
      AD_Org_ID: orgId,
      Name: data.name,
      TaxID: data.taxId || '',
      IsCustomer: true,
      C_BP_Group_ID: groupId,
    })
    bpartnerId = bpResp.data.id

    // 3. Create C_BPartner_Location (link address)
    const bpLocResp = await apiClient.post('/api/v1/models/C_BPartner_Location', {
      AD_Org_ID: orgId,
      C_BPartner_ID: bpartnerId,
      C_Location_ID: locationId,
      Name: data.address || data.name,
    })
    bpLocationId = bpLocResp.data.id

    // 4. Create AD_User (contact)
    const userResp = await apiClient.post('/api/v1/models/AD_User', {
      AD_Org_ID: orgId,
      C_BPartner_ID: bpartnerId,
      Name: data.name,
      Phone: data.phone || '',
      EMail: data.email || '',
    })
    userId = userResp.data.id

  } catch (error) {
    // Rollback: delete created records in reverse order
    if (bpLocationId) { try { await apiClient.delete(`/api/v1/models/C_BPartner_Location/${bpLocationId}`) } catch {} }
    if (bpartnerId) { try { await apiClient.delete(`/api/v1/models/C_BPartner/${bpartnerId}`) } catch {} }
    try { await apiClient.delete(`/api/v1/models/C_Location/${locationId}`) } catch {}
    throw error
  }

  return { bpartnerId, locationId, bpLocationId, userId }
}

export async function searchCustomers(query: string): Promise<any[]> {
  const safe = query.replace(/'/g, "''")
  const resp = await apiClient.get('/api/v1/models/C_BPartner', {
    params: {
      '$filter': `IsCustomer eq true and IsActive eq true and (contains(Name,'${safe}') or contains(TaxID,'${safe}'))`,
      '$select': 'C_BPartner_ID,Name,TaxID',
      '$orderby': 'Name',
      '$top': 50,
    },
  })
  return resp.data.records || []
}

export async function getCustomerDetail(id: number): Promise<any> {
  return (await apiClient.get(`/api/v1/models/C_BPartner/${id}`)).data
}
```

**Step 4: Run test — Expected: PASS**

**Step 5: Commit**
```bash
git add webapp/src/api/bpartner.ts webapp/src/api/__tests__/bpartner.test.ts
git commit -m "feat: add BPartner API with three-table linked create and rollback"
```

---

### Task 2.2: SearchSelector component

**Files:**
- Create: `webapp/src/components/SearchSelector.vue`
- Create: `webapp/src/components/__tests__/SearchSelector.test.ts`

**Step 1: Write failing test**

```typescript
// Key assertions:
// 1. Renders dropdown when items ≤ 20
// 2. Renders search input when items > 20
// 3. Emits 'update:modelValue' on selection
// 4. Shows "QuickCreate" button when enabled and no match
```

**Step 2: Run test — Expected: FAIL**

**Step 3: Write implementation**

`webapp/src/components/SearchSelector.vue`:
- Props: `modelValue`, `tableName`, `displayField`, `searchField`, `filter?`, `quickCreate?`
- Auto-detects count: ≤20 → dropdown, 21-200 → search input, >200 → search+pagination
- QuickCreate button emits `quick-create` event
- Uses debounced search (300ms)

**Step 4: Run test — Expected: PASS**

**Step 5: Commit**
```bash
git add webapp/src/components/SearchSelector.vue webapp/src/components/__tests__/
git commit -m "feat: add SearchSelector component with auto-mode and QuickCreate"
```

---

### Task 2.3: Customer views (List + Form + Detail)

**Files:**
- Create: `webapp/src/views/customer/CustomerListView.vue`
- Create: `webapp/src/views/customer/CustomerFormView.vue`
- Modify: `webapp/src/router/index.ts` — replace customer placeholder

**Step 1: Implement CustomerListView**

- Search bar (Name / TaxID / Phone)
- List results with tap to navigate to detail
- "新增客戶" FAB button

**Step 2: Implement CustomerFormView**

- Uses `DynamicForm` if AD_Tab metadata is configured
- Fallback: static form with Name, TaxID, Phone, Email, Address fields
- Calls `createCustomer()` on submit (three-table linked create)
- Success → navigate to customer detail

**Step 3: Update router**

Replace customer placeholder routes with:
```typescript
{
  path: '/customer',
  children: [
    { path: '', name: 'customer-list', component: CustomerListView },
    { path: 'new', name: 'customer-new', component: CustomerFormView },
    { path: ':id', name: 'customer-detail', component: CustomerDetailView },
  ],
}
```

**Step 4: Run all tests**

**Step 5: Commit**
```bash
git add webapp/src/views/customer/ webapp/src/router/
git commit -m "feat: add Customer module (list + form with three-table create)"
```

---

## Phase 2 Checkpoint

- BPartner API with three-table linked create + rollback
- SearchSelector component (auto-mode + QuickCreate)
- Customer list/form/detail views
- All tests passing

---

## Phase 3: Consultation (R_Request) + Resource Appointment

### Task 3.1: Request API module

**Files:**
- Create: `webapp/src/api/request.ts`
- Create: `webapp/src/api/__tests__/request.test.ts`

**Implementation:**
- `listRequests(filter?)` → GET R_Request with $expand=R_Status_ID,C_BPartner_ID
- `getRequest(id)` → GET single with all fields
- `createRequest(data)` → POST R_Request (needs R_RequestType_ID, R_Status_ID lookup)
- `updateRequest(id, data)` → PUT R_Request
- `updateRequestStatus(id, statusId)` → PUT R_Request with R_Status_ID
- `listRequestStatuses(requestTypeId?)` → GET R_Status for status transition dropdown

**Key note:** R_Request has **no DocAction** — status via R_Status_ID + Processed field.

---

### Task 3.2: Request views (List + Form with Attachments)

**Files:**
- Create: `webapp/src/views/consultation/RequestListView.vue`
- Create: `webapp/src/views/consultation/RequestFormView.vue`

**Implementation:**
- List with status filter (tabs: 全部/進行中/已完成)
- Form uses DynamicForm + AttachmentManager for photos
- Status transition dropdown (from R_Status)
- BPartner search selector to link customer

---

### Task 3.3: Resource + Assignment API

**Files:**
- Create: `webapp/src/api/resource.ts`
- Create: `webapp/src/api/assignment.ts`
- Create: `webapp/src/api/__tests__/assignment.test.ts`

**Implementation:**
- `listResources()` → GET S_Resource
- `listAssignments(dateFrom, dateTo, resourceId?)` → GET S_ResourceAssignment
- `createAssignment(data)` → POST (AssignDateFrom/To, S_Resource_ID, Name/Description)
- `updateAssignment(id, data)` → PUT
- `deleteAssignment(id)` → DELETE
- Conflict detection: query existing assignments for same resource + overlapping time

**Known limitation:** `IsConfirmed` is not updateable via REST API.

---

### Task 3.4: Calendar view (week view by resource)

**Files:**
- Create: `webapp/src/views/appointment/CalendarView.vue`
- Create: `webapp/src/views/appointment/AppointmentForm.vue`

**Implementation:**
- Week view with resources as columns, time slots as rows
- Navigate prev/next week
- Click slot to create appointment
- Display existing appointments as blocks
- Conflict detection on create/update

---

## Phase 3 Checkpoint

- R_Request CRUD (no DocAction, status via R_Status_ID)
- Consultation list/form with photo attachments
- S_ResourceAssignment CRUD with conflict detection
- Calendar week view
- All tests passing

---

## Phase 4: Orders (C_Order + C_OrderLine)

### Task 4.1: Order API module

**Files:**
- Create: `webapp/src/api/order.ts`
- Create: `webapp/src/api/__tests__/order.test.ts`

**Implementation:**
- `listOrders(filter?)` → GET C_Order with DocStatus filter
- `getOrder(id)` → GET with $expand
- `createOrder(header)` → POST C_Order (needs: C_DocType_ID via `lookupDocTypeId('SOO')`, C_BPartner_ID, M_PriceList_ID, C_PaymentTerm_ID, M_Warehouse_ID, etc.)
- `addOrderLine(orderId, lineData)` → POST C_OrderLine
- `updateOrderLine(lineId, data)` → PUT C_OrderLine
- `deleteOrderLine(lineId)` → DELETE
- `getOrderLines(orderId)` → GET C_OrderLine
- `completeOrder(orderId)` → POST `/api/v1/processes/c_order-process` with `{ 'record-id': orderId, 'table-id': 259 }`

**Parallel lookups needed:** DocType(SOO), PriceList(SO), PaymentTerm, Tax, Warehouse, Currency — use `Promise.all()`.

---

### Task 4.2: Order views (List + Form with Lines)

**Files:**
- Create: `webapp/src/views/order/OrderListView.vue`
- Create: `webapp/src/views/order/OrderFormView.vue`

**Implementation:**
- List with DocStatus filter tabs (草稿/已完成/全部)
- Form: Header section (DynamicForm or static) + Lines section
- Lines: inline add/edit/delete with product SearchSelector
- DocActionBar at bottom (Complete button when DR)
- After Complete: all fields read-only, no line editing

---

## Phase 4 Checkpoint

- Order CRUD with header + lines
- DocAction Complete via Process endpoint
- Parallel lookups for mandatory references
- All tests passing

---

## Phase 5: Treatment (M_Production + M_ProductionLine)

### Task 5.1: Production API module

**Files:**
- Create: `webapp/src/api/production.ts`
- Create: `webapp/src/api/__tests__/production.test.ts`

**Implementation:**
- `listProductions(filter?)` → GET M_Production
- `createProduction(data)` → POST (M_Product_ID, ProductionQty, MovementDate)
- `addProductionLine(productionId, data)` → POST M_ProductionLine (耗材明細)
- `completeProduction(id)` → POST `/api/v1/processes/m_production-process`
- BOM expansion: if product has BOM, auto-populate lines

---

### Task 5.2: Treatment views

**Files:**
- Create: `webapp/src/views/treatment/ProductionListView.vue`
- Create: `webapp/src/views/treatment/ProductionFormView.vue`

**Implementation:**
- Same pattern as Orders: list with status filter + form with lines + DocActionBar

---

## Phase 5 Checkpoint

- Production CRUD with lines
- BOM expansion for auto-populating materials
- DocAction Complete
- All tests passing

---

## Phase 6: Payment + Shipment

### Task 6.1: Payment API + views

**Files:**
- Create: `webapp/src/api/payment.ts`
- Create: `webapp/src/views/payment/PaymentListView.vue`
- Create: `webapp/src/views/payment/PaymentFormView.vue`

**Implementation:**
- `createPayment(data)` → POST C_Payment (C_BPartner_ID, PayAmt, TenderType, C_Order_ID?)
- `completePayment(id)` → POST `/api/v1/processes/c_payment-process` with `{ 'record-id': id, 'table-id': 335 }`
- TenderType options: Cash(X), Check(K), Credit Card(C), Direct Deposit(T)
- Form: customer selector, amount, tender type, optional order link

---

### Task 6.2: Shipment (InOut) API + views

**Files:**
- Create: `webapp/src/api/inout.ts`
- Create: `webapp/src/views/shipment/InOutListView.vue`
- Create: `webapp/src/views/shipment/InOutFormView.vue`

**Implementation:**
- `createInOut(data)` → POST M_InOut (C_BPartner_ID, M_Warehouse_ID, C_DocType_ID, MovementDate)
- `addInOutLine(inoutId, data)` → POST M_InOutLine (M_Product_ID, MovementQty, M_Locator_ID)
- `completeInOut(id)` → POST `/api/v1/processes/m_inout-process` with `{ 'record-id': id, 'table-id': 319 }`
- Receipt (收貨) vs Shipment (出貨) — determined by DocBaseType (MMR vs MMS)

---

### Task 6.3: Home view with role-based menu

**Files:**
- Modify: `webapp/src/views/HomeView.vue`

**Implementation:**
- Grid of module cards, filtered by `usePermission().canAccess(pageKey)`
- Each card: icon + label + description
- Shows user name + role + switch context button
- Logout button

---

### Task 6.4: Field Config admin view

**Files:**
- Create: `webapp/src/views/admin/FieldConfigView.vue`

**Implementation:**
- Only visible to System role (`canAccessFieldConfig(userLevel)`)
- Select Window → Tab → displays AD_Field list
- Toggle IsDisplayed, drag to reorder SeqNo, edit FieldGroup
- Save: PUT each modified AD_Field
- After save: clear metadata cache

---

### Task 6.5: Final integration + build verification

**Step 1: Run all tests**

Run: `cd /home/tom/idempiere-module-ui/webapp && npx vitest run`
Expected: All PASS

**Step 2: Run type check**

Run: `cd /home/tom/idempiere-module-ui/webapp && npx vue-tsc --noEmit`
Expected: No errors

**Step 3: Build and deploy**

Run: `cd /home/tom/idempiere-module-ui && bash build.sh --deploy`
Expected: JAR built and deployed

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete all phases — aesthetics clinic UI v1.0"
```

---

## Phase 6 Checkpoint (Final)

- Payment CRUD + DocAction Complete
- Shipment (InOut) CRUD + DocAction Complete
- Home view with role-based menu
- Field Config admin view (System role only)
- Full build pipeline working
- All tests passing

---

## Appendix: Key Reference Files

| File | Purpose |
|---|---|
| `/home/tom/idempiere-skin-ui/webapp/src/stores/auth.ts` | Auth store to port (416 lines, no changes needed) |
| `/home/tom/idempiere-skin-ui/webapp/src/api/client.ts` | API client pattern reference |
| `/home/tom/idempiere-skin-ui/webapp/src/api/utils.ts` | OData + datetime utils reference |
| `/home/tom/idempiere-skin-ui/webapp/src/api/lookup.ts` | Dynamic ID lookup pattern |
| `/home/tom/idempiere-skin-ui/build.sh` | Build script pattern |
| `/home/tom/idempiere-skin-ui/osgi-bundle/META-INF/MANIFEST.MF` | MANIFEST reference |
| `docs/plans/2026-02-13-aesthetics-clinic-design.md` | Design doc (source of truth) |
| `/home/tom/.claude/projects/-home-tom/memory/docaction-process.md` | DocAction rules |

## Appendix: Critical Rules

1. **DocAction**: ONLY `POST /api/v1/processes/{slug}` with `record-id` + `table-id`. **NEVER** PUT DocAction field.
2. **REST list-type fields** return objects: `{"id":"DR","identifier":"Drafted"}` — always extract `.id`.
3. **iDempiere datetime format**: `yyyy-MM-ddTHH:mm:ssZ` (no milliseconds, local time, NOT UTC).
4. **`!0 === true`** in JavaScript — always use `=== null` checks when id=0 is valid.
5. **Mandatory fields**: Query `AD_Column.IsMandatory` before building POST payloads.
6. **OSGi version qualifier**: Alphanumeric only, no dots (e.g., `202602131200`).
7. **JAR static files at root**: `jar cfm ... -C web .` NOT `jar ... web`.
8. **Auth context must persist to localStorage**: token + context + user + clients.
