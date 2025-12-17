<script setup>
import { ref } from 'vue' // 引入 ref
import FooterInfo from './components/FooterInfo.vue'

// 🎨 定义背景图 URL
// 使用 ref 方便以后动态切换，或者加个时间戳防止缓存
const bgUrl = ref(`url('https://www.loliapi.com/acg/?time=${new Date().getTime()}')`)

</script>

<template>
  <div class="global-bg" :style="{ backgroundImage: bgUrl }"></div>

  <link rel="icon" href="assets/T_Chat_Character_01.ico" />

  <div class="app-container">
    <header class="main-header">
      <h1>DNA tool</h1>
    </header>

    <nav class="nav-tabs">
      <router-link to="/page1" class="tab-item">模之楔 等级计算器</router-link>
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
/* --- 新增：背景层样式 --- */
.global-bg {
  position: fixed;   /* 固定定位，不随滚动条滚动 */
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;       /* 置于最底层 */
  
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
  
  /* 关键：模糊效果 */
  filter: blur(15px); 
  
  /* 技巧：放大一点点，防止模糊后边缘出现白边 */
  transform: scale(1.1); 
}

/* --- 原有样式 (微调) --- */
.app-container {
  max-width: 800px;
  margin: 0 auto;
  font-family: Arial, sans-serif;
  text-align: center;
  position: relative; /* 确保层级正常 */
}

.main-header {
  margin-top: 20px;
  margin-bottom: 20px;
  /* 为了让标题在背景上看得清，可以加一点阴影或改色 */
  color: #333; 
  text-shadow: 0 1px 3px rgba(255,255,255, 0.8);
}

.nav-tabs {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 20px;
  /* 导航栏背景如果不加颜色，可能会透出背景图 */
  background: rgba(255, 255, 255, 0.6); /* 半透明白色背景 */
  backdrop-filter: blur(5px); /* 磨砂玻璃效果 */
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
}

.tab-item:hover {
  background-color: rgba(66, 184, 131, 0.2); /* 悬停颜色改淡一点 */
  color: #42b883;
}

.router-link-active {
  background-color: #42b883;
  color: white !important;
}

.content-area {
  min-height: 500px;
  /* 内容区域必须有背景色，否则文字直接显示在模糊图上会看不清 */
  background: rgba(255, 255, 255, 0.85); /* 85% 不透明度的白色 */
  backdrop-filter: blur(5px); /* 内容区也可以加一点磨砂感 */
  border-radius: 12px; /* 圆角好看点 */
  border: 1px solid rgba(255,255,255,0.5);
  padding: 20px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1); /* 浮起阴影 */
}

/* 动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>