<script setup>
import { reactive, computed, watch, onMounted } from 'vue'
// 引入数据管理工具
import { updateModule, getModule } from '../utils/userData';

// ==========================================
// 1. 状态管理
// ==========================================
const inputs = reactive({
  questExp: 0, // 主线/支线/探索
  dailyExp: 0  // 每日任务
});

// 输入清洗 (保证非负整数)
const sanitizeInput = (targetObj, key) => {
  let val = parseInt(targetObj[key]);
  if (isNaN(val) || val < 0) val = 0;
  targetObj[key] = val;
};

// ==========================================
// 2. 计算与存储
// ==========================================
const totalExp = computed(() => inputs.questExp + inputs.dailyExp);

const saveData = () => {
  updateModule('other', {
    ...inputs, // 保存输入项以便恢复显示
    
    // ⚠️ 关键：兼容外部读取规则
    // 规则: modExp = parseInt(modData.totalExp ?? modData.exp ?? 0);
    totalExp: totalExp.value 
  });
};

// 监听变化自动保存
watch(inputs, () => saveData(), { deep: true });

// 初始化读取
onMounted(() => {
  const saved = getModule('other');
  if (saved) {
    if (saved.questExp !== undefined) inputs.questExp = saved.questExp;
    if (saved.dailyExp !== undefined) inputs.dailyExp = saved.dailyExp;
  }
});
</script>

<template>
  <div class="light-theme-container">
    
    <div class="dashboard-panel">
      <div class="main-stat-card">
        <div class="stat-header">
          <span class="stat-title">其他来源总经验</span>
          <span class="stat-value">{{ totalExp }}</span>
        </div>
        <div class="progress-track main-track">
          <div class="progress-bar main-bar" style="width: 100%"></div>
        </div>
      </div>
    </div>

    <div class="input-groups">
      <div class="group-panel compact-panel">
        <div class="compact-header">
          <span class="group-title">自定义经验录入</span>
        </div>
        <div class="compact-content">
          
          <div class="input-row-lg">
            <label>主线/支线任务与探索奖励:</label>
            <input 
              type="number" 
              v-model.number="inputs.questExp" 
              @input="sanitizeInput(inputs, 'questExp')" 
              class="input-lg" 
              placeholder="0"
            >
          </div>

          <div class="input-row-lg" style="margin-bottom: 0;"> <label>每日任务奖励:</label>
            <input 
              type="number" 
              v-model.number="inputs.dailyExp" 
              @input="sanitizeInput(inputs, 'dailyExp')" 
              class="input-lg" 
              placeholder="0"
            >
          </div>

        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* --- 全局基础 (与之前模块保持一致) --- */
.light-theme-container { font-family: "Inter", sans-serif; color: #333; padding-bottom: 50px; }

/* 仪表盘 */
.dashboard-panel { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); margin-bottom: 20px; }
.main-stat-card { margin-bottom: 0; }
.stat-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
.stat-title { font-weight: 600; font-size: 16px; color: #1f2937; }
.stat-value { font-family: "JetBrains Mono", monospace; font-size: 24px; font-weight: 700; color: #111827; }
.progress-track { background: #eef2f7; height: 12px; border-radius: 6px; overflow: hidden; }
/* 灰色渐变，代表通用/杂项 */
.main-bar { height: 100%; background: linear-gradient(90deg, #64748b 0%, #475569 100%); }

/* 面板样式 */
.compact-panel { background: #fff; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 12px; overflow: hidden; }
.compact-header { background: #f9fafb; padding: 8px 12px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; }
.group-title { font-weight: 600; font-size: 13px; color: #374151; }
.compact-content { padding: 16px 12px; } /*稍微增加一点内边距让大输入框更舒适*/

/* 大号输入框样式 */
.input-row-lg { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.input-row-lg label { font-size: 13px; font-weight: 500; color: #374151; }
.input-lg { 
  width: 100%; 
  padding: 10px 12px; 
  border: 1px solid #d1d5db; 
  border-radius: 6px; 
  font-size: 16px; 
  font-family: "JetBrains Mono"; 
  color: #111827;
  transition: all 0.2s;
  box-sizing: border-box; /* 确保 padding 不撑大宽度 */
}
.input-lg:focus { 
  border-color: #64748b; 
  outline: none; 
  background: #f8fafc; 
  box-shadow: 0 0 0 3px rgba(100, 116, 139, 0.1);
}
.input-lg::placeholder { color: #9ca3af; }

/* 移动端适配 */
@media (max-width: 600px) {
  .dashboard-panel { padding: 16px; }
}
</style>