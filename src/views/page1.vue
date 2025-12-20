<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { updateModule, getModule } from '../utils/userData';

// ==========================================
// 1. 静态配置
// ==========================================
const QUALITIES = [
  { name: "白色", max: 35,  exp: 20,  color: "#9ca3af" }, 
  { name: "绿色", max: 36,  exp: 40,  color: "#16a34a" }, 
  { name: "蓝色", max: 89,  exp: 50,  color: "#2563eb" }, 
  { name: "紫色", max: 176, exp: 100, color: "#9333ea" }, 
  { name: "金色", max: 137, exp: 200, color: "#d97706" }, 
];

// --- 核心限制常量 ---
const MAX_COUNT_CAP = 473;      // 数量最大值
const MAX_FIRST_EXP_CAP = 51590; // 【修正】首次获得经验的硬上限 (固定)
const TASK_BONUS_EXP = 1430;    // 任务奖励值
const MAX_MODULE_EXP = 53020;   // 模块总上限 (51590 + 1430)

// ==========================================
// 2. 算法核心 (分布推导)
// ==========================================
const solveDistribution = (targetCount, targetExp) => {
  if (targetCount <= 0 || targetExp <= 0) {
    return QUALITIES.map(q => ({ ...q, count: 0, totalExp: 0 }));
  }

  let bestCounts = Array(QUALITIES.length).fill(0);
  let minDiff = Infinity;

  const randint = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const initRandom = () => {
    const counts = Array(QUALITIES.length).fill(0);
    let rem = targetCount;
    const indices = shuffle([...Array(QUALITIES.length).keys()]);
    for (const i of indices) {
      const maxCanFill = Math.min(rem, QUALITIES[i].max);
      let fill = 0;
      if (maxCanFill > 0) fill = randint(0, maxCanFill);
      counts[i] = fill;
      rem -= fill;
    }
    if (rem > 0) {
      for (let i = 0; i < QUALITIES.length; i++) {
        const space = QUALITIES[i].max - counts[i];
        const add = Math.min(rem, space);
        counts[i] += add;
        rem -= add;
        if (rem === 0) break;
      }
    }
    return counts;
  };

  const optimize = (startCounts) => {
    let currentCounts = [...startCounts];
    for (let step = 0; step < 200; step++) {
      const currentExp = currentCounts.reduce((acc, c, i) => acc + c * QUALITIES[i].exp, 0);
      const diff = targetExp - currentExp;
      if (diff === 0) return { counts: currentCounts, diff: 0 };

      let bestMove = null;
      let bestNewDiffAbs = Math.abs(diff);

      if (diff > 0) { 
        for (let i = 0; i < QUALITIES.length; i++) {
          if (currentCounts[i] <= 0) continue;
          for (let j = i + 1; j < QUALITIES.length; j++) {
            if (currentCounts[j] >= QUALITIES[j].max) continue;
            const delta = QUALITIES[j].exp - QUALITIES[i].exp;
            const newDiffAbs = Math.abs(diff - delta);
            if (newDiffAbs < bestNewDiffAbs) {
              bestNewDiffAbs = newDiffAbs;
              bestMove = [i, j]; 
            }
          }
        }
      } else { 
        for (let i = QUALITIES.length - 1; i >= 0; i--) {
          if (currentCounts[i] <= 0) continue;
          for (let j = 0; j < i; j++) {
            if (currentCounts[j] >= QUALITIES[j].max) continue;
            const delta = QUALITIES[j].exp - QUALITIES[i].exp;
            const newDiffAbs = Math.abs(diff - delta);
            if (newDiffAbs < bestNewDiffAbs) {
              bestNewDiffAbs = newDiffAbs;
              bestMove = [i, j]; 
            }
          }
        }
      }
      if (!bestMove) break;
      const [src, dst] = bestMove;
      currentCounts[src]--;
      currentCounts[dst]++;
    }
    const finalExp = currentCounts.reduce((acc, c, i) => acc + c * QUALITIES[i].exp, 0);
    return { counts: currentCounts, diff: targetExp - finalExp };
  };

  for (let k = 0; k < 50; k++) {
    const start = initRandom();
    const res = optimize(start);
    if (Math.abs(res.diff) < Math.abs(minDiff)) {
      minDiff = res.diff;
      bestCounts = res.counts;
      if (minDiff === 0) break;
    }
  }

  return QUALITIES.map((q, idx) => ({
    ...q,
    count: bestCounts[idx],
    totalExp: bestCounts[idx] * q.exp
  }));
};

// ==========================================
// 3. 状态管理
// ==========================================
const inputs = reactive({
  firstCount: 0,
  firstExp: 0,
  isTaskDone: false
});

// UI 状态
const distribution = ref([]);
const calcDiff = ref(0);
const errorMsg = reactive({ count: '', exp: '' });

// ==========================================
// 4. 输入拦截与清洗
// ==========================================
const sanitizeInput = (targetObj, key) => {
  let val = parseInt(targetObj[key]);
  if (isNaN(val) || val < 0) val = 0;

  // --- 拦截逻辑 ---
  
  // 1. 数量拦截
  if (key === 'firstCount') {
    if (val > MAX_COUNT_CAP) {
      val = MAX_COUNT_CAP;
      errorMsg.count = `数量已达上限 ${MAX_COUNT_CAP}`;
    } else {
      errorMsg.count = '';
    }
  }

  // 2. 经验拦截 (固定死 51590)
  if (key === 'firstExp') {
    if (val > MAX_FIRST_EXP_CAP) {
      val = MAX_FIRST_EXP_CAP;
      errorMsg.exp = `首次获得经验上限为 ${MAX_FIRST_EXP_CAP}`;
    } else {
      errorMsg.exp = '';
    }
  }

  targetObj[key] = val;
};

// ==========================================
// 5. 业务逻辑
// ==========================================

// 监听输入触发计算
watch(() => [inputs.firstCount, inputs.firstExp], ([count, exp]) => {
  if (count > 0 && exp > 0) {
    const res = solveDistribution(count, exp);
    distribution.value = res;
    const calcExp = res.reduce((sum, item) => sum + item.totalExp, 0);
    calcDiff.value = exp - calcExp;
  } else {
    distribution.value = QUALITIES.map(q => ({ ...q, count: 0, totalExp: 0 }));
    calcDiff.value = 0;
  }
});

// 仪表盘数据
const dashboard = computed(() => {
  const currentTotal = inputs.firstExp + (inputs.isTaskDone ? TASK_BONUS_EXP : 0);
  return {
    curr: currentTotal,
    max: MAX_MODULE_EXP,
    pct: MAX_MODULE_EXP ? (currentTotal / MAX_MODULE_EXP) * 100 : 0
  };
});

// ==========================================
// 6. 存储逻辑
// ==========================================
const saveData = () => {
  updateModule('wedge_calc', {
    count: inputs.firstCount,
    exp: inputs.firstExp,
    isTaskCompleted: inputs.isTaskDone,
    totalExp: dashboard.value.curr
  });
};

watch(inputs, () => saveData(), { deep: true });

onMounted(() => {
  const saved = getModule('wedge_calc');
  if (saved) {
    if (saved.count !== undefined) inputs.firstCount = saved.count;
    if (saved.exp !== undefined) inputs.firstExp = saved.exp;
    if (saved.isTaskCompleted !== undefined) inputs.isTaskDone = saved.isTaskCompleted;
  }
});
</script>

<template>
  <div class="light-theme-container">
    
    <div class="dashboard-panel">
      <div class="main-stat-card">
        <div class="stat-header">
          <span class="stat-title">魔之楔培养总进度</span>
          <span class="stat-value">
            {{ dashboard.curr }} <small>/ {{ dashboard.max }}</small>
          </span>
        </div>
        <div class="progress-track main-track">
          <div class="progress-bar main-bar" :style="{ width: dashboard.pct + '%' }"></div>
        </div>
        <div class="stat-subtext">
          结构: 首次获得 {{ inputs.firstExp }} + 任务 {{ inputs.isTaskDone ? TASK_BONUS_EXP : 0 }}
        </div>
      </div>
    </div>

    <div class="input-groups">
      
      <div class="group-panel compact-panel">
        <div class="compact-header">
          <span class="group-title">1. 首次获得数据录入</span>
        </div>
        <div class="compact-content">
          
          <div class="task-row">
            <label class="task-check">
              <input type="checkbox" v-model="inputs.isTaskDone" class="hidden-check">
              <span class="custom-check">
                <svg viewBox="0 0 24 24" class="icon"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </span>
              <span class="task-label">已完成魔之楔任务 (+{{ TASK_BONUS_EXP }} exp)</span>
            </label>
          </div>

          <div class="divider"></div>

          <div class="compact-grid-2">
            
            <div class="compact-item-wrapper">
              <div class="compact-item" :class="{ 'has-error': errorMsg.count }">
                <span class="item-label">首次获得数量</span>
                <input 
                  type="number" 
                  v-model.number="inputs.firstCount" 
                  @input="sanitizeInput(inputs, 'firstCount')"
                  class="compact-input" 
                  placeholder="0"
                >
              </div>
              <div class="error-tip" v-if="errorMsg.count">{{ errorMsg.count }}</div>
            </div>

            <div class="compact-item-wrapper">
              <div class="compact-item" :class="{ 'has-error': errorMsg.exp }">
                <span class="item-label">首次获得总经验</span>
                <input 
                  type="number" 
                  v-model.number="inputs.firstExp" 
                  @input="sanitizeInput(inputs, 'firstExp')"
                  class="compact-input" 
                  placeholder="0"
                >
              </div>
              <div class="error-tip" v-if="errorMsg.exp">{{ errorMsg.exp }}</div>
            </div>

          </div>

        </div>
      </div>

      <div class="group-panel compact-panel">
        <div class="compact-header">
          <span class="group-title">2. 首次获得分布预估</span>
          <span class="guess-tag">自动推导猜测</span>
        </div>
        <div class="compact-content">
          
          <div class="dist-list" v-if="inputs.firstCount > 0">
            <div 
              v-for="item in distribution" 
              :key="item.name" 
              class="dist-row"
              :class="{ 'zero': item.count === 0 }"
            >
              <div class="dist-left">
                <span class="color-dot" :style="{ backgroundColor: item.color }"></span>
                <span class="dist-name">{{ item.name }}</span>
                <span class="dist-per">(Max:{{ item.max }})</span>
              </div>
              <div class="dist-right">
                <span class="dist-val">{{ item.count }}</span> 个
              </div>
            </div>
          </div>
          
          <div v-else class="empty-tip">
            等待输入数据...
          </div>

          <div class="calc-diff" v-if="inputs.firstCount > 0 && calcDiff !== 0">
            ⚠ 无法精确匹配，误差: {{ calcDiff }} exp
          </div>

        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* 基础样式 */
.light-theme-container { font-family: "Inter", sans-serif; color: #333; padding-bottom: 50px; }

/* 仪表盘 */
.dashboard-panel { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); margin-bottom: 20px; }
.main-stat-card { margin-bottom: 0; }
.stat-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
.stat-title { font-weight: 600; font-size: 16px; color: #1f2937; }
.stat-value { font-family: "JetBrains Mono", monospace; font-size: 24px; font-weight: 700; color: #111827; }
.stat-value small { font-size: 14px; color: #9ca3af; font-weight: 400; }
.stat-subtext { font-size: 11px; color: #6b7280; margin-top: 6px; text-align: right; }
.progress-track { background: #eef2f7; height: 12px; border-radius: 6px; overflow: hidden; }
.main-bar { height: 100%; background: linear-gradient(90deg, #f97316 0%, #ea580c 100%); transition: width 0.4s ease; }

/* 面板通用 */
.compact-panel { background: #fff; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 12px; overflow: hidden; }
.compact-header { background: #f9fafb; padding: 10px 14px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; }
.group-title { font-weight: 600; font-size: 13px; color: #374151; }
.guess-tag { font-size: 10px; background: #fff7ed; color: #c2410c; padding: 2px 6px; border-radius: 4px; border: 1px solid #fed7aa; }
.compact-content { padding: 14px; }

/* 任务勾选 */
.task-row { margin-bottom: 12px; display: flex; align-items: center; }
.task-check { display: flex; align-items: center; cursor: pointer; user-select: none; }
.hidden-check { display: none; }
.custom-check { width: 18px; height: 18px; border: 2px solid #d1d5db; border-radius: 4px; margin-right: 8px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; background: #fff; }
.hidden-check:checked + .custom-check { background: #f97316; border-color: #f97316; }
.icon { width: 12px; height: 12px; stroke: white; stroke-width: 3; fill: none; opacity: 0; }
.hidden-check:checked + .custom-check .icon { opacity: 1; }
.task-label { font-size: 14px; font-weight: 600; color: #374151; }

.divider { height: 1px; background: #f0f0f0; margin: 12px 0; }

/* 输入区 (Grid & Error Handling) */
.compact-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.compact-item-wrapper { display: flex; flex-direction: column; }
.compact-item { display: flex; align-items: center; background: #fdfdfd; border: 1px solid #eee; border-radius: 6px; padding: 8px 12px; transition: border-color 0.2s; }
.compact-item.has-error { border-color: #fca5a5; background: #fef2f2; }
.item-label { font-size: 12px; color: #6b7280; margin-right: 8px; white-space: nowrap; }
.compact-input { flex: 1; width: 100%; border: none; background: transparent; font-size: 15px; text-align: right; font-family: "JetBrains Mono"; outline: none; font-weight: 600; color: #111827; }
.error-tip { font-size: 10px; color: #ef4444; margin-top: 4px; text-align: right; }

/* 分布列表 */
.dist-list { display: flex; flex-direction: column; gap: 6px; }
.dist-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px dashed #f3f4f6; }
.dist-row:last-child { border-bottom: none; }
.dist-row.zero { opacity: 0.4; }
.dist-left { display: flex; align-items: center; gap: 6px; }
.color-dot { width: 8px; height: 8px; border-radius: 50%; }
.dist-name { font-size: 13px; font-weight: 500; color: #374151; }
.dist-per { font-size: 12px; color: #9ca3af; }
.dist-val { font-family: "JetBrains Mono"; font-weight: 700; color: #111827; margin-right: 2px; }
.dist-right { font-size: 12px; color: #6b7280; }
.empty-tip { text-align: center; color: #d1d5db; font-size: 12px; font-style: italic; padding: 10px; }
.calc-diff { font-size: 11px; text-align: right; color: #ef4444; margin-top: 8px; font-family: monospace; background: #fef2f2; padding: 4px 8px; border-radius: 4px; }

@media (max-width: 600px) {
  .compact-grid-2 { grid-template-columns: 1fr; }
}
</style>