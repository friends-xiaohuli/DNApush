<script setup>
import buildData from '../../build-info.json'
</script>

<template>
  <footer class="app-footer">
    <div class="info-container">
      <div class="info-item">
        <span class="label">Version</span>
        <span class="value">{{ buildData.version  }}</span>
      </div>

      <div class="divider">|</div>

      <div class="info-item">
        <span class="label">Build</span>
        <span class="value mono">{{ buildData.buildTime }}</span>
      </div>

      <div class="divider">|</div>

      <div class="info-item">
        <span class="label">Author</span>
        <span class="value highlight">{{ buildData.author }}</span>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.app-footer {
  width: 100%;
  padding: 20px 0 30px 0; /* 底部稍微多留点白，防止贴底 */
  display: flex;
  justify-content: center;
  align-items: center;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  
  /* 确保页脚在内容之下，有一定间距 */
  margin-top: auto; 
}

/* 核心修改：将 info-container 变成磨砂玻璃胶囊 */
.info-container {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 15px; /* 稍微拉大间距 */
  
  /* --- 玻璃拟态样式 --- */
  background: rgba(255, 255, 255, 0.65); /* 半透明白 */
  backdrop-filter: blur(8px);            /* 模糊背后的背景图 */
  -webkit-backdrop-filter: blur(8px);    /* Safari 兼容 */
  
  padding: 8px 24px;       /* 胶囊内边距 */
  border-radius: 50px;     /* 圆角设大一点，变成胶囊形状 */
  border: 1px solid rgba(255, 255, 255, 0.6); /* 淡淡的白边 */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); /* 柔和阴影 */
  
  color: #555; /* 字体颜色加深一点，防止背景太亮看不清 */
  font-size: 13px;
  transition: all 0.3s ease;
}

/* 鼠标悬停时的小特效（可选） */
.info-container:hover {
  background: rgba(255, 255, 255, 0.85);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
}

.info-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.label {
  font-weight: 600;
  opacity: 0.8; /* 增加一点不透明度 */
  color: #333;
}

.value {
  color: #444;
}

/* 等宽字体 */
.mono {
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 12px;
  background: rgba(0,0,0,0.05); /* 给时间加个淡灰色底，像代码块 */
  padding: 2px 6px;
  border-radius: 4px;
}

.highlight {
  color: #42b883; 
  font-weight: bold;
}

.divider {
  color: #bbb;
  font-size: 10px;
  opacity: 0.6;
}

/* 移动端适配 */
@media (max-width: 600px) {
  .info-container {
    flex-direction: column;
    gap: 8px;
    padding: 15px 20px;
    border-radius: 16px; /* 手机上改回普通圆角矩形，省空间 */
    width: 90%;          /* 手机上宽度自适应 */
  }
  .divider {
    display: none;
  }
}
</style>