import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

const pathAlias = {
  '@/common': fileURLToPath(new URL('./common', import.meta.url)),
  '@/electron': fileURLToPath(new URL('./electron', import.meta.url)),
  '@': fileURLToPath(new URL('./src', import.meta.url)),
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
    tailwindcss(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          resolve: {
            alias: pathAlias,
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart: (options) => options.reload(),
        vite: {
          resolve: {
            alias: pathAlias,
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: pathAlias,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true, // 允许跨域
      },
    },
  },
})
