<script setup>
import { ref } from 'vue' // 引入 ref
import FooterInfo from './components/FooterInfo.vue'

// 🎨 定义背景图 URL
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
      <router-link to="/ExpCalculator" class="tab-item">历练经验</router-link>
      <router-link to="/page1" class="tab-item">魔之楔培养</router-link>
      <router-link to="/role" class="tab-item">角色培养</router-link>
      <router-link to="/page2" class="tab-item">api测试</router-link>
      <router-link to="/instanceInfo" class="tab-item">instanceInfo</router-link>
      <router-link to="/page3" class="tab-item">数据存储</router-link>
      <router-link to="/DataImportOCR" class="tab-item">ocr-upload</router-link>
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
/* --- 保持原有的背景样式不变 --- */
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

/* =========================================
   桌面端样式 (核心修改)
   ========================================= */
.nav-tabs {
  display: flex;
  justify-content: center;
  /* 1. 允许换行：当按钮太多一行放不下时，自动掉到下一行 */
  flex-wrap: wrap; 
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
  padding: 10px 15px; /* 左右内边距稍微减小，交给 flex 控制宽度 */
  border-radius: 5px;
  transition: all 0.3s;
  font-weight: bold;
  white-space: nowrap; 
  
  /* 2. 自动宽度核心：让所有按钮平分当前行的剩余空间 */
  flex: 1 1 auto; 
  
  /* 3. 视觉优化： */
  text-align: center; /* 文字居中 */
  min-width: 80px;    /* 最小宽度，防止按钮被压得太扁 */
  max-width: 200px;   /* 最大宽度，防止只有1个按钮时它撑满整个屏幕太丑 */
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
   移动端适配 (小于 800px)
   ========================================= */
@media (max-width: 800px) {
  .app-container {
    padding: 0 10px; 
  }

  /* 移动端强制网格布局 */
  .nav-tabs {
    display: grid; 
    /* 强制两列布局，自动平分 */
    grid-template-columns: 1fr 1fr; 
    gap: 8px; 
    padding: 8px;
  }

  .tab-item {
    /* 移动端重置 flex 属性，完全听 grid 的话 */
    flex: initial; 
    max-width: none; /* 移除最大宽度限制，填满格子 */
    min-width: 0;    /* 防止内容溢出撑开格子 */
    
    padding: 12px 5px; 
    font-size: 14px; /* 稍微改小字体适应长标题 */
    text-align: center;
    white-space: normal; /* 允许换行 */
    display: flex;       
    align-items: center;
    justify-content: center;
    line-height: 1.3;
  }
  
  /* 可选：如果你希望最下面的按钮如果是单数，就占满一行 */
  .tab-item:last-child:nth-child(odd) {
      grid-column: span 2;
  }
}
</style>