<script setup>
import { ref } from 'vue' // 引入 ref
import FooterInfo from './components/FooterInfo.vue'

// 🎨 定义背景图 URL
// 使用 ref 方便以后动态切换，或者加个时间戳防止缓存
const bgUrl = ref(`url('https://www.loliapi.com/acg/?time=${new Date().getTime()}')`)

</script>

<template>
  <div class="global-bg" :style="{ backgroundImage: bgUrl }"></div>


  <div class="app-container">
    <header class="main-header">
      <h1>DNA咕噜咕噜</h1>
    </header>

    <nav class="nav-tabs">
      <router-link to="/" class="tab-item">＋</router-link>
      <router-link to="/page1" class="tab-item">魔之楔 等级计算器</router-link>
      <router-link to="/ExpCalculator" class="tab-item">等级Exp 差值计算器</router-link>
      <router-link to="/page2" class="tab-item">api测试</router-link>
      <router-link to="/page3" class="tab-item">系统设置</router-link>
      <router-link to="/about" class="tab-item">关于我们</router-link>
    </nav>

    <main class="content-area">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
  
  <FooterInfo />
</template>

<style scoped>
/* --- 保持原有的背景和桌面端样式不变 --- */
.global-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
  filter: blur(15px); 
  transform: scale(1.1); 
}

.app-container {
  max-width: 800px;
  margin: 0 auto;
  font-family: Arial, sans-serif;
  text-align: center;
  position: relative;
}

.main-header {
  margin-top: 20px;
  margin-bottom: 20px;
  color: #333; 
  text-shadow: 0 1px 3px rgba(255,255,255, 0.8);
}

/* --- 桌面端默认样式 (保持不变) --- */
.nav-tabs {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 20px;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(5px);
  border-radius: 8px;
  padding: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
}

.tab-item {
  text-decoration: none;
  color: #333;
  padding: 10px 20px;
  border-radius: 5px;
  transition: all 0.3s;
  font-weight: bold;
  /* 防止文字换行导致高度不一致 */
  white-space: nowrap; 
}

.tab-item:hover {
  background-color: rgba(66, 184, 131, 0.2);
  color: #42b883;
}

.router-link-active {
  background-color: #42b883;
  color: white !important;
}

.content-area {
  min-height: 500px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(5px);
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.5);
  padding: 20px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
}

/* 动画 */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* =========================================
   移动端适配
   ========================================= */
@media (max-width: 800px) {
  /* 1. 容器两侧留白减小，利用更多空间 */
  .app-container {
    padding: 0 10px; 
  }

  /* 2. 导航栏改为网格布局 (2列 x 2行) */
  .nav-tabs {
    display: grid; /* 启用网格布局 */
    grid-template-columns: 1fr 1fr; /* 强制分为两列，每列等宽 */
    gap: 8px; /* 间距稍微调小 */
    padding: 8px;
  }

  /* 3. 按钮样式调整 */
  .tab-item {
    padding: 12px 5px; /* 上下加高方便手指点击，左右减少防止撑开 */
    font-size: 15px;   /* 字体稍微改小一点点 */
    text-align: center;
    white-space: normal; /* 允许手机端长文字换行 (针对"模之楔...") */
    display: flex;       /* 让文字在按钮里垂直居中 */
    align-items: center;
    justify-content: center;
    line-height: 1.2;    /* 行高紧凑一点 */
  }

  /* 4. 针对特别长的按钮做特殊处理 (可选) */
  /* 如果您希望 "系统设置" 和 "关于我们" 在一行，长标题独占一行，可以用这个 */
  .tab-item:first-child { grid-column: span 2; }
  /* .tab-item:nth-child(3) { grid-column: span 2; } */
}
</style>