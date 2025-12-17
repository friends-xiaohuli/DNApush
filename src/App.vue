<script setup>
// 逻辑部分为空，纯展示
</script>

<template>
  <div class="app-container">
    <header class="main-header">
      <h1>DNA tool</h1>
    </header>

    <nav class="nav-tabs">
      <router-link to="/page1" class="tab-item">模之楔 等级计算器</router-link>
      <router-link to="/page2" class="tab-item">api测试</router-link>
      <router-link to="/page3" class="tab-item">系统设置</router-link>
      <router-link to="/page4" class="tab-item">关于我们</router-link>
    </nav>

    <main class="content-area">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<style scoped>
/* 容器布局 */
.app-container {
  max-width: 800px;
  margin: 0 auto;
  font-family: Arial, sans-serif;
  text-align: center;
}

/* 标题样式 */
.main-header {
  margin-top: 20px;
  margin-bottom: 20px;
  color: #333;
}

/* 导航栏样式 */
.nav-tabs {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 20px;
  border-bottom: 2px solid #eee;
  padding-bottom: 10px;
}

/* 单个 Tab 样式 */
.tab-item {
  text-decoration: none;
  color: #666;
  padding: 10px 20px;
  border-radius: 5px;
  transition: all 0.3s;
  font-weight: bold;
}

/* 鼠标悬停 */
.tab-item:hover {
  background-color: #f0f0f0;
  color: #42b883;
}

/* 激活状态 (Vue Router 自动添加的类名) */
.router-link-active {
  background-color: #42b883;
  color: white !important;
}

/* 内容区域 */
.content-area {
  min-height: 500px;
  border: 1px solid #eee;
  padding: 20px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.05);
}

/* 简单的淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>