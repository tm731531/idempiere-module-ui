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
