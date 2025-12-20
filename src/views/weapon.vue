<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { updateModule, getModule } from '../utils/userData';

// ==========================================
// 1. 静态配置 (Weapon Config)
// ==========================================
const CONFIG = {
  // 基础: 45把上限, 每把400
  base: { exp: 400, max_count: 45 },
  
  // 突破: 6个阶段
  break: [
    { lv: 1, exp: 40 }, 
    { lv: 2, exp: 120 }, 
    { lv: 3, exp: 280 },
    { lv: 4, exp: 600 }, 
    { lv: 5, exp: 1240 }, 
    { lv: 6, exp: 2520 }
  ],
  
  // 熔炼: 5个阶段
  smelt: [
    { lv: 1, exp: 200 }, 
    { lv: 2, exp: 400 }, 
    { lv: 3, exp: 600 },
    { lv: 4, exp: 800 }, 
    { lv: 5, exp: 1000 }
  ]
};

// ==========================================
// 2. 算法核心 (反向推导分布)
// ==========================================
const solveDistribution = (targetCount, targetExp, levelsConfig) => {
  if (targetCount <= 0) return Array(levelsConfig.length).fill(0);

  // 构建品质列表 (补充 0级/无消耗 选项)
  const qualities = [
    { lv: 0, exp: 0, max: targetCount }, 
    ...levelsConfig.map(l => ({ ...l, max: targetCount }))
  ];

  const randint = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // 1. 随机初始化
  const initRandom = () => {
    const counts = new Array(qualities.length).fill(0);
    let rem = targetCount;
    const indices = shuffle([...Array(qualities.length).keys()]);
    for (const i of indices) {
      const maxCanFill = Math.min(rem, qualities[i].max);
      let fill = 0;
      if (maxCanFill > 0) fill = randint(0, maxCanFill);
      counts[i] = fill;
      rem -= fill;
    }
    // 填补剩余
    if (rem > 0) {
      for (let i = 0; i < qualities.length; i++) {
        const space = qualities[i].max - counts[i];
        const add = Math.min(rem, space);
        counts[i] += add;
        rem -= add;
        if (rem === 0) break;
      }
    }
    return counts;
  };

  // 2. 优化逼近
  const optimize = (startCounts) => {
    let currentCounts = [...startCounts];
    const maxSteps = 150;
    for (let step = 0; step < maxSteps; step++) {
      const currentExp = currentCounts.reduce((acc, c, i) => acc + c * qualities[i].exp, 0);
      const diff = targetExp - currentExp;
      if (diff === 0) return { counts: currentCounts, diff: 0 };

      let bestMove = null;
      let bestNewDiffAbs = Math.abs(diff);

      if (diff > 0) { 
        for (let i = 0; i < qualities.length; i++) {
          if (currentCounts[i] <= 0) continue;
          for (let j = i + 1; j < qualities.length; j++) {
            const delta = qualities[j].exp - qualities[i].exp;
            const newDiffAbs = Math.abs(diff - delta);
            if (newDiffAbs < bestNewDiffAbs) {
              bestNewDiffAbs = newDiffAbs;
              bestMove = [i, j];
            }
          }
        }
      } else { 
        for (let i = qualities.length - 1; i >= 0; i--) {
          if (currentCounts[i] <= 0) continue;
          for (let j = 0; j < i; j++) {
            const delta = qualities[j].exp - qualities[i].exp;
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
    const finalExp = currentCounts.reduce((acc, c, i) => acc + c * qualities[i].exp, 0);
    return { counts: currentCounts, diff: targetExp - finalExp };
  };

  // 3. 多次尝试
  let bestRes = null;
  let minDiff = Infinity;
  for (let k = 0; k < 30; k++) { 
    const start = initRandom();
    const res = optimize(start);
    if (Math.abs(res.diff) < Math.abs(minDiff)) {
      minDiff = res.diff;
      bestRes = res;
      if (minDiff === 0) break;
    }
  }
  return bestRes ? bestRes.counts.slice(1) : Array(levelsConfig.length).fill(0);
};

// ==========================================
// 3. 状态管理
// ==========================================
const inputs = reactive({
  count: 0,
  baseExp: 0,
  breakExp: 0,
  smeltExp: 0,
  
  breakCounts: [0, 0, 0, 0, 0, 0],
  smeltCounts: [0, 0, 0, 0, 0]
});

// 输入清洗
const sanitizeInput = (targetObj, key) => {
  let val = parseInt(targetObj[key]);
  if (isNaN(val) || val < 0) val = 0;
  targetObj[key] = val;
};

// ==========================================
// 4. 业务逻辑 (失焦优化)
// ==========================================

// --- [新逻辑] 失焦后计算 ---
const onCountBlur = () => {
  const correctExp = inputs.count * CONFIG.base.exp;
  if (inputs.baseExp !== correctExp) {
    inputs.baseExp = correctExp;
  }
};

const onBaseExpBlur = () => {
  const correctCount = Math.floor(inputs.baseExp / CONFIG.base.exp);
  if (inputs.count !== correctCount) {
    inputs.count = correctCount;
  }
};

// --- 推导监听 (保留 watch) ---
// 只要输入了总经验，就尝试推导分布
watch(() => [inputs.breakExp, inputs.count], ([exp, count]) => {
  if (count > 0 && exp > 0) {
    inputs.breakCounts = solveDistribution(count, exp, CONFIG.break);
  } else {
    inputs.breakCounts = [0,0,0,0,0,0];
  }
});

watch(() => [inputs.smeltExp, inputs.count], ([exp, count]) => {
  if (count > 0 && exp > 0) {
    inputs.smeltCounts = solveDistribution(count, exp, CONFIG.smelt);
  } else {
    inputs.smeltCounts = [0,0,0,0,0];
  }
});

// --- 统计计算 ---
const stats = computed(() => {
  const baseE = inputs.baseExp;
  
  const breakReal = inputs.breakCounts.reduce((acc, c, i) => acc + c * CONFIG.break[i].exp, 0);
  const smeltReal = inputs.smeltCounts.reduce((acc, c, i) => acc + c * CONFIG.smelt[i].exp, 0);
  
  const total = baseE + inputs.breakExp + inputs.smeltExp;
  
  return {
    total,
    breakDiff: inputs.breakExp - breakReal,
    smeltDiff: inputs.smeltExp - smeltReal
  };
});

// --- 仪表盘 ---
const dashboard = computed(() => {
  // 最大值常数：18000 + 113400 + 45000 = 176400
  const maxTotal = 176400;
  return {
    curr: stats.value.total,
    max: maxTotal,
    pct: maxTotal ? (stats.value.total / maxTotal) * 100 : 0
  };
});

// ==========================================
// 5. 存储逻辑
// ==========================================
const saveData = () => {
  updateModule('weapon', {
    ...inputs,
    // 适配外部读取规则
    totalExp: stats.value.total
  });
};

watch(inputs, () => saveData(), { deep: true });

onMounted(() => {
  const saved = getModule('weapon');
  if (saved) {
    if (saved.count !== undefined) inputs.count = saved.count;
    if (saved.baseExp !== undefined) inputs.baseExp = saved.baseExp;
    if (saved.breakExp !== undefined) inputs.breakExp = saved.breakExp;
    if (saved.smeltExp !== undefined) inputs.smeltExp = saved.smeltExp;
    if (saved.breakCounts) inputs.breakCounts = saved.breakCounts;
    if (saved.smeltCounts) inputs.smeltCounts = saved.smeltCounts;
  }
});
</script>

<template>
  <div class="light-theme-container">
    
    <div class="dashboard-panel">
      <div class="main-stat-card">
        <div class="stat-header">
          <span class="stat-title">武器培养总进度</span>
          <span class="stat-value">{{ dashboard.curr }} <small>/ {{ dashboard.max }}</small></span>
        </div>
        <div class="progress-track main-track">
          <div class="progress-bar main-bar" :style="{ width: dashboard.pct + '%' }"></div>
        </div>
      </div>
    </div>

    <div class="input-groups">
      
      <div class="group-panel compact-panel">
        <div class="compact-header"><span class="group-title">1. 武器基础数据</span></div>
        <div class="compact-content">
          <div class="compact-grid-2">
            <div class="compact-item">
              <span class="item-label">武器数量</span>
              <input 
                type="number" 
                v-model.number="inputs.count" 
                @input="sanitizeInput(inputs, 'count')" 
                @blur="onCountBlur"
                class="compact-input"
              >
            </div>
            <div class="compact-item">
              <span class="item-label">基础经验</span>
              <input 
                type="number" 
                v-model.number="inputs.baseExp" 
                @input="sanitizeInput(inputs, 'baseExp')" 
                @blur="onBaseExpBlur"
                class="compact-input"
              >
            </div>
          </div>
        </div>
      </div>

      <div class="group-panel compact-panel">
        <div class="compact-header">
          <span class="group-title">2. 武器突破</span>
          <span class="guess-tag">自动推导猜测</span>
        </div>
        <div class="compact-content">
          <div class="input-row-lg">
            <label>突破总经验:</label>
            <input type="number" v-model.number="inputs.breakExp" @input="sanitizeInput(inputs, 'breakExp')" class="input-lg" placeholder="0">
          </div>
          
          <div class="guess-result-grid col-6" v-if="inputs.breakExp > 0">
            <div v-for="(c, i) in inputs.breakCounts" :key="i" class="guess-item" :class="{ 'zero': c === 0 }">
              <span class="guess-lv">{{ i+1 }}阶</span>
              <span class="guess-count">{{ c }}</span>
            </div>
          </div>
          <div class="calc-diff" v-if="stats.breakDiff !== 0">
            (误差: {{ stats.breakDiff }})
          </div>
        </div>
      </div>

      <div class="group-panel compact-panel">
        <div class="compact-header">
          <span class="group-title">3. 武器熔炼</span>
          <span class="guess-tag">自动推导猜测</span>
        </div>
        <div class="compact-content">
          <div class="input-row-lg">
            <label>熔炼总经验:</label>
            <input type="number" v-model.number="inputs.smeltExp" @input="sanitizeInput(inputs, 'smeltExp')" class="input-lg" placeholder="0">
          </div>
          
          <div class="guess-result-grid col-5" v-if="inputs.smeltExp > 0">
            <div v-for="(c, i) in inputs.smeltCounts" :key="i" class="guess-item" :class="{ 'zero': c === 0 }">
              <span class="guess-lv">{{ i+1 }}熔</span>
              <span class="guess-count">{{ c }}</span>
            </div>
          </div>
          <div class="calc-diff" v-if="stats.smeltDiff !== 0">
            (误差: {{ stats.smeltDiff }})
          </div>
        </div>
      </div>

    </div>

  </div>
</template>

<style scoped>
.light-theme-container { font-family: "Inter", sans-serif; color: #333; padding-bottom: 50px; }

/* 仪表盘 */
.dashboard-panel { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); margin-bottom: 20px; }
.main-stat-card { margin-bottom: 0; }
.stat-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
.stat-title { font-weight: 600; font-size: 16px; color: #1f2937; }
.stat-value { font-family: "JetBrains Mono", monospace; font-size: 24px; font-weight: 700; color: #111827; }
.stat-value small { font-size: 14px; color: #9ca3af; font-weight: 400; }
.progress-track { background: #eef2f7; height: 12px; border-radius: 6px; overflow: hidden; }
.main-bar { height: 100%; background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%); transition: width 0.4s ease; }

/* 面板样式 */
.compact-panel { background: #fff; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 12px; overflow: hidden; }
.compact-header { background: #f9fafb; padding: 8px 12px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; }
.group-title { font-weight: 600; font-size: 13px; color: #374151; }
.guess-tag { font-size: 10px; background: #fffbeb; color: #b45309; padding: 2px 6px; border-radius: 4px; border: 1px solid #fcd34d; }
.compact-content { padding: 12px; }

/* 输入控件 */
.compact-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.compact-item { display: flex; align-items: center; background: #fdfdfd; border: 1px solid #eee; border-radius: 4px; padding: 6px 10px; }
.item-label { font-size: 12px; color: #6b7280; margin-right: 8px; white-space: nowrap; }
.compact-input { flex: 1; width: 100%; border: none; background: transparent; font-size: 14px; text-align: right; font-family: "JetBrains Mono"; outline: none; font-weight: 600; }

.input-row-lg { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.input-row-lg label { font-size: 13px; font-weight: 500; color: #374151; }
.input-lg { flex: 1; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; text-align: right; font-family: "JetBrains Mono"; }
.input-lg:focus { border-color: #f59e0b; outline: none; background: #fffbeb; }

/* 猜测结果 */
.guess-result-grid { display: grid; gap: 4px; background: #f3f4f6; padding: 6px; border-radius: 6px; }
.guess-result-grid.col-6 { grid-template-columns: repeat(6, 1fr); }
.guess-result-grid.col-5 { grid-template-columns: repeat(5, 1fr); }

.guess-item { display: flex; flex-direction: column; align-items: center; background: #fff; padding: 4px; border-radius: 4px; border: 1px solid #e5e7eb; }
.guess-item.zero { opacity: 0.4; }
.guess-lv { font-size: 10px; color: #9ca3af; margin-bottom: 2px; }
.guess-count { font-size: 13px; font-weight: bold; color: #111827; font-family: "JetBrains Mono"; }
.calc-diff { font-size: 11px; text-align: right; color: #ef4444; margin-top: 4px; font-family: monospace; }
</style>