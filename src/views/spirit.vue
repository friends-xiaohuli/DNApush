<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { updateModule, getModule } from '../utils/userData';

// ==========================================
// 1. 静态配置 & 限制常量
// ==========================================
// 限制常量定义
const LIMITS = {
  COUNT: 60,       // 魔灵数量最大值
  BASE_EXP: 6000,  // 基础经验最大值 (60 * 100)
  BREAK_EXP: 7650, // 突破经验最大值
  TOTAL_VIEW: 13650 // 仪表盘总上限 (6000 + 7650)
};

const CONFIG = {
  // 基础: exp_per 100
  base: { exp: 100 },
  
  // 突破: 3个阶段, 加入了 max 属性限制单阶数量
  break: [
    { lv: 1, exp: 50,  max: 51 }, 
    { lv: 2, exp: 100, max: 51 }, 
    { lv: 3, exp: 150, max: 51 }
  ]
};

// ==========================================
// 2. 算法核心 (支持单阶数量上限)
// ==========================================
const solveDistribution = (targetCount, targetExp, levelsConfig) => {
  if (targetCount <= 0) return Array(levelsConfig.length).fill(0);

  // 构建品质列表
  // 0级(无消耗)的上限就是总数量
  // 其他等级的上限 = Math.min(配置上限, 用户拥有的总数量)
  const qualities = [
    { lv: 0, exp: 0, max: targetCount }, 
    ...levelsConfig.map(l => ({ 
      ...l, 
      max: l.max ? Math.min(l.max, targetCount) : targetCount 
    }))
  ];

  const randint = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const initRandom = () => {
    const counts = new Array(qualities.length).fill(0);
    let rem = targetCount;
    const indices = shuffle([...Array(qualities.length).keys()]);
    
    for (const i of indices) {
      // 关键：这里会受到 qualities[i].max 的限制 (即 51)
      const maxCanFill = Math.min(rem, qualities[i].max);
      let fill = 0;
      if (maxCanFill > 0) fill = randint(0, maxCanFill);
      counts[i] = fill;
      rem -= fill;
    }
    
    // 填补剩余 (通常填入 0级/无消耗 槽位)
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

  const optimize = (startCounts) => {
    let currentCounts = [...startCounts];
    const maxSteps = 150;
    for (let step = 0; step < maxSteps; step++) {
      const currentExp = currentCounts.reduce((acc, c, i) => acc + c * qualities[i].exp, 0);
      const diff = targetExp - currentExp;
      if (diff === 0) return { counts: currentCounts, diff: 0 };

      let bestMove = null;
      let bestNewDiffAbs = Math.abs(diff);

      if (diff > 0) { // 需要加分：低级 -> 高级
        for (let i = 0; i < qualities.length; i++) {
          if (currentCounts[i] <= 0) continue;
          for (let j = i + 1; j < qualities.length; j++) {
            // 检查目标层级是否已满 (受 max: 51 限制)
            if (currentCounts[j] >= qualities[j].max) continue;
            
            const delta = qualities[j].exp - qualities[i].exp;
            const newDiffAbs = Math.abs(diff - delta);
            if (newDiffAbs < bestNewDiffAbs) {
              bestNewDiffAbs = newDiffAbs;
              bestMove = [i, j];
            }
          }
        }
      } else { // 需要减分：高级 -> 低级
        for (let i = qualities.length - 1; i >= 0; i--) {
          if (currentCounts[i] <= 0) continue;
          for (let j = 0; j < i; j++) {
            // 检查目标层级是否已满
            if (currentCounts[j] >= qualities[j].max) continue;

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
  breakCounts: [0, 0, 0]
});

// 错误信息状态
const errorMsg = reactive({
  count: '',
  base: '',
  break: ''
});

// ==========================================
// 4. 输入拦截与清洗
// ==========================================
const sanitizeInput = (targetObj, key) => {
  let val = parseInt(targetObj[key]);
  if (isNaN(val) || val < 0) val = 0;

  // --- 拦截逻辑 ---
  if (key === 'count') {
    if (val > LIMITS.COUNT) {
      val = LIMITS.COUNT;
      errorMsg.count = `数量上限 ${LIMITS.COUNT}`;
    } else {
      errorMsg.count = '';
    }
  }

  if (key === 'baseExp') {
    if (val > LIMITS.BASE_EXP) {
      val = LIMITS.BASE_EXP;
      errorMsg.base = `基础经验上限 ${LIMITS.BASE_EXP}`;
    } else {
      errorMsg.base = '';
    }
  }

  if (key === 'breakExp') {
    if (val > LIMITS.BREAK_EXP) {
      val = LIMITS.BREAK_EXP;
      errorMsg.break = `突破经验上限 ${LIMITS.BREAK_EXP}`;
    } else {
      errorMsg.break = '';
    }
  }

  targetObj[key] = val;
};

// ==========================================
// 5. 业务逻辑 (失焦互转 + 自动推导)
// ==========================================

const onCountBlur = () => {
  const correctExp = inputs.count * CONFIG.base.exp;
  if (inputs.baseExp !== correctExp) {
    inputs.baseExp = correctExp;
    // 如果修正后的值超过上限，sanitizeInput 会在下次输入时处理，
    // 但这里直接赋值需要手动检查一下边界
    if (inputs.baseExp > LIMITS.BASE_EXP) inputs.baseExp = LIMITS.BASE_EXP;
  }
};

const onBaseExpBlur = () => {
  const correctCount = Math.floor(inputs.baseExp / CONFIG.base.exp);
  if (inputs.count !== correctCount) {
    inputs.count = correctCount;
    if (inputs.count > LIMITS.COUNT) inputs.count = LIMITS.COUNT;
  }
};

// 监听推导
watch(() => [inputs.breakExp, inputs.count], ([exp, count]) => {
  if (count > 0 && exp > 0) {
    inputs.breakCounts = solveDistribution(count, exp, CONFIG.break);
  } else {
    inputs.breakCounts = [0, 0, 0];
  }
});

// 统计
const stats = computed(() => {
  const baseE = inputs.baseExp;
  const breakReal = inputs.breakCounts.reduce((acc, c, i) => acc + c * CONFIG.break[i].exp, 0);
  const total = baseE + inputs.breakExp; 
  
  return {
    total,
    breakDiff: inputs.breakExp - breakReal
  };
});

// 仪表盘
const dashboard = computed(() => {
  return {
    curr: stats.value.total,
    max: LIMITS.TOTAL_VIEW,
    pct: LIMITS.TOTAL_VIEW ? (stats.value.total / LIMITS.TOTAL_VIEW) * 100 : 0
  };
});

// ==========================================
// 6. 存储逻辑
// ==========================================
const saveData = () => {
  updateModule('Spirit', {
    ...inputs, 
    totalExp: stats.value.total
  });
};

watch(inputs, () => saveData(), { deep: true });

onMounted(() => {
  const saved = getModule('Spirit');
  if (saved) {
    if (saved.count !== undefined) inputs.count = saved.count;
    if (saved.baseExp !== undefined) inputs.baseExp = saved.baseExp;
    if (saved.breakExp !== undefined) inputs.breakExp = saved.breakExp;
    if (saved.breakCounts) inputs.breakCounts = saved.breakCounts;
  }
});
</script>

<template>
  <div class="light-theme-container">
    
    <div class="dashboard-panel">
      <div class="main-stat-card">
        <div class="stat-header">
          <span class="stat-title">魔灵培养总进度</span>
          <span class="stat-value">{{ dashboard.curr }} <small>/ {{ dashboard.max }}</small></span>
        </div>
        <div class="progress-track main-track">
          <div class="progress-bar main-bar" :style="{ width: dashboard.pct + '%' }"></div>
        </div>
      </div>
    </div>

    <div class="input-groups">
      
      <div class="group-panel compact-panel">
        <div class="compact-header"><span class="group-title">1. 魔灵基础数据</span></div>
        <div class="compact-content">
          <div class="compact-grid-2">
            
            <div class="compact-item-wrapper">
              <div class="compact-item" :class="{ 'has-error': errorMsg.count }">
                <span class="item-label">魔灵数量</span>
                <input 
                  type="number" 
                  v-model.number="inputs.count" 
                  @input="sanitizeInput(inputs, 'count')" 
                  @blur="onCountBlur"
                  class="compact-input"
                  placeholder="0"
                >
              </div>
              <div class="error-tip" v-if="errorMsg.count">{{ errorMsg.count }}</div>
            </div>

            <div class="compact-item-wrapper">
              <div class="compact-item" :class="{ 'has-error': errorMsg.base }">
                <span class="item-label">基础经验</span>
                <input 
                  type="number" 
                  v-model.number="inputs.baseExp" 
                  @input="sanitizeInput(inputs, 'baseExp')" 
                  @blur="onBaseExpBlur"
                  class="compact-input"
                  placeholder="0"
                >
              </div>
              <div class="error-tip" v-if="errorMsg.base">{{ errorMsg.base }}</div>
            </div>

          </div>
        </div>
      </div>

      <div class="group-panel compact-panel">
        <div class="compact-header">
          <span class="group-title">2. 魔灵突破</span>
          <span class="guess-tag">自动推导猜测</span>
        </div>
        <div class="compact-content">
          
          <div class="compact-item-wrapper">
            <div class="input-row-lg" :class="{ 'has-error': errorMsg.break }">
              <label>突破总经验:</label>
              <input 
                type="number" 
                v-model.number="inputs.breakExp" 
                @input="sanitizeInput(inputs, 'breakExp')" 
                class="input-lg" 
                placeholder="0"
              >
            </div>
            <div class="error-tip" v-if="errorMsg.break">{{ errorMsg.break }}</div>
          </div>
          
          <div class="guess-result-grid col-3" v-if="inputs.breakExp > 0">
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
.main-bar { height: 100%; background: linear-gradient(90deg, #10b981 0%, #059669 100%); transition: width 0.4s ease; }

/* 面板样式 */
.compact-panel { background: #fff; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 12px; overflow: hidden; }
.compact-header { background: #f9fafb; padding: 8px 12px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; }
.group-title { font-weight: 600; font-size: 13px; color: #374151; }
.guess-tag { font-size: 10px; background: #ecfdf5; color: #047857; padding: 2px 6px; border-radius: 4px; border: 1px solid #a7f3d0; }
.compact-content { padding: 12px; }

/* 输入控件 & 错误提示 */
.compact-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.compact-item-wrapper { display: flex; flex-direction: column; }

.compact-item { display: flex; align-items: center; background: #fdfdfd; border: 1px solid #eee; border-radius: 4px; padding: 6px 10px; transition: all 0.2s; }
.compact-item.has-error { border-color: #fca5a5; background: #fef2f2; }

.item-label { font-size: 12px; color: #6b7280; margin-right: 8px; white-space: nowrap; }
.compact-input { flex: 1; width: 100%; border: none; background: transparent; font-size: 14px; text-align: right; font-family: "JetBrains Mono"; outline: none; font-weight: 600; }

.input-row-lg { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; border: 1px solid transparent; border-radius: 4px; }
.input-row-lg.has-error .input-lg { border-color: #fca5a5; background: #fef2f2; }
.input-row-lg label { font-size: 13px; font-weight: 500; color: #374151; }
.input-lg { flex: 1; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; text-align: right; font-family: "JetBrains Mono"; }
.input-lg:focus { border-color: #10b981; outline: none; background: #ecfdf5; }

.error-tip { font-size: 10px; color: #ef4444; margin-top: 2px; text-align: right; height: 14px; }

/* 猜测结果 */
.guess-result-grid { display: grid; gap: 4px; background: #f3f4f6; padding: 6px; border-radius: 6px; }
.guess-result-grid.col-3 { grid-template-columns: repeat(3, 1fr); }

.guess-item { display: flex; flex-direction: column; align-items: center; background: #fff; padding: 4px; border-radius: 4px; border: 1px solid #e5e7eb; }
.guess-item.zero { opacity: 0.4; }
.guess-lv { font-size: 10px; color: #9ca3af; margin-bottom: 2px; }
.guess-count { font-size: 13px; font-weight: bold; color: #111827; font-family: "JetBrains Mono"; }
.calc-diff { font-size: 11px; text-align: right; color: #ef4444; margin-top: 4px; font-family: monospace; }
</style>