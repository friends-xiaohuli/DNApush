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
      '/api_gamekee': {
        target: 'https://www.gamekee.com',
        changeOrigin: true, // 必须为 true，修改 host 头为目标域名
        rewrite: (path) => path.replace(/^\/api_gamekee/, '/v1'),
        
        // 【关键】在这里伪造请求头，完全模拟真实浏览器行为
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // 1. 伪造来源 (绕过防盗链)
            proxyReq.setHeader('Referer', 'https://www.gamekee.com/dna/');
            proxyReq.setHeader('Origin', 'https://www.gamekee.com');
            
            // 2. 伪造 User-Agent
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            // 3. 注入自定义头
            proxyReq.setHeader('game-alias', 'dna');
            proxyReq.setHeader('device-num', '1');
            
            // 4. 【最关键】注入 Cookie (CK)
            // 请在浏览器 F12 -> Network 抓包复制一个能用的 Cookie 填入这里
            // 如果接口不需要登录，通常不需要这行；如果报500/403，则必须填
            // proxyReq.setHeader('Cookie', 'acw_tc=...; PHPSESSID=...; YOUR_COOKIE_HERE');
          });
        }
      }
    }
  }
})
