import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import gameKeeHandler from './api/gamekee.js'

export default defineConfig({
  base: "/",
  plugins: [
    vue(),
    {
      name: "vercel-api-mock",
      configureServer(server) {
        // 拦截 /api/gamekee 请求
        server.middlewares.use("/api/gamekee", async (req, res) => {
          console.log("⚡️ [Local Mock] 拦截到 API 请求:", req.url);

          // 3. 构造 Vercel 风格的 Response 对象 (Polyfill)
          // 因为 Node 原生的 res 不支持 .status().json()，我们需要手动补上
          res.status = (statusCode) => {
            res.statusCode = statusCode;
            return res; // 支持链式调用
          };

          res.json = (data) => {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(data));
          };

          // 4. 执行 API 逻辑
          try {
            await gameKeeHandler(req, res);
          } catch (err) {
            console.error("API Execution Error:", err);
            res.status(500).json({ error: "Local Mock Error" });
          }
        });
      },
    },
  ],

  // 关键：用于 Vercel + 前端路由
  build: {
    outDir: "dist",
  },

  // 本地开发时代理 API（非常重要）
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },

});
