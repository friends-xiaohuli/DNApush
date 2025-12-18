<template>
  <div class="about-page">
    <div class="glass-card">
      <div class="header">
        <h2>喵~ 🐾</h2>
        <p class="subtitle">Duet Night Abyss</p>
      </div>

      <div class="section">
        <h3 class="section-title">特别鸣谢</h3>
        <div class="info-row">
          <span class="label">· 来源</span>
          <span class="value">@画纸</span>
        </div>
        <div class="info-row">
          <span class="label">· 站点</span>
          <span class="value">@小狐狸</span>
        </div>
      </div>

      <div class="divider"></div>

      <div class="section">
        <h3 class="section-title">技术驱动</h3>
        
        <div class="tech-grid">
          <div class="tech-item">
            <span class="tech-label">x 架构</span>
            <div class="tags">
              <span class="tag vue">Vue3</span>
              <span class="tag vite">Vite</span>
            </div>
          </div>

          <div class="tech-item">
            <span class="tech-label">x 部署</span>
            <div class="tags">
              <span class="tag vercel">Vercel</span>
              <span class="tag cloudflare">Cloudflare</span>
            </div>
          </div>

          <div class="tech-item">
            <span class="tech-label">x 协助</span>
            <div class="tags-full">
              <span class="tag ai">Gemini</span>
              <span class="tag ai">ChatGPT</span>
            </div>
          </div>
        </div>
      </div>

      <div class="action-area">
        <button class="primary-btn" @click="openLink">
          前往皎皎角查看
          <span class="arrow">➜</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
const openLink = () => {
  window.open('https://dnabbs.yingxiong.com/', '_blank')
}
</script>

<style scoped>
/* 页面容器：居中显示 */
.about-page {
  display: flex;
  justify-content: center;
  padding: 20px;
}

/* 卡片主体 */
.glass-card {
  width: 100%;
  max-width: 360px; /* 限制最大宽度，手机电脑都好看 */
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 30px 25px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.8);
  text-align: left; /* 内部文字左对齐更易读 */
}

/* 标题 */
.header {
  text-align: center;
  margin-bottom: 25px;
}
.header h2 {
  margin: 0;
  color: #333;
  font-size: 24px;
}
.subtitle {
  margin: 5px 0 0 0;
  font-size: 12px;
  color: #999;
  letter-spacing: 1px;
  text-transform: uppercase;
}

/* 标题通用样式 */
.section-title {
  font-size: 13px;
  color: #999;
  margin-bottom: 12px;
  font-weight: 600;
}

/* 人员行样式 */
.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 15px;
  color: #444;
}
.info-row .label {
  color: #666;
}
.info-row .value {
  font-weight: bold;
  color: #333;
}

/* 分割线 */
.divider {
  height: 1px;
  background: #eee;
  margin: 20px 0;
}

/* 技术栈网格 */
.tech-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.tech-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.tech-label {
  font-size: 14px;
  color: #666;
}

/* 标签样式 (Tags) */
.tags, .tags-full {
  display: flex;
  gap: 6px;
}
.tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  background: #f0f0f0;
  color: #555;
}

/* 给不同技术加点微色 */
.tag.vue { background: #eaffe6; color: #42b883; }
.tag.vite { background: #fdf0ff; color: #bd34fe; }
.tag.vercel { background: #333; color: #fff; }
.tag.cloudflare { background: #eaf4ff; color: #0088cc; }
.tag.ai { background: #f0f4f8; color: #5c6b7f; border: 1px solid #dae1e7; }

/* 底部按钮 */
.action-area {
  margin-top: 30px;
  text-align: center;
}
.primary-btn {
  background: #42b883; /* Vue绿，或换成你的主题色 */
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 25px;
  font-size: 15px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  width: 100%; /* 按钮撑满卡片宽度 */
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 4px 12px rgba(66, 184, 131, 0.3);
}
.primary-btn:hover {
  background: #3aa876;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(66, 184, 131, 0.4);
}
.primary-btn:active {
  transform: translateY(0);
}
.arrow {
  font-size: 12px;
}
</style>