import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import router from './router'
import App from './App.vue'
import { loadConfig } from './config'
import './style.css'
// v2.1 - force recompile

loadConfig().then(() => {
  const app = createApp(App)
  app.use(createPinia())
  app.use(PrimeVue, { unstyled: true })
  app.use(router)
  app.mount('#app')
})
