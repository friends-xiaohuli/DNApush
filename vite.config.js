import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: '/',
  plugins: [vue()],
  
  // 关键：用于 Vercel + 前端路由
  build: {
    outDir: 'dist'
  },

  // 本地开发时代理 API（非常重要）
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
