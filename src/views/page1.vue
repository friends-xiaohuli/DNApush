<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
// 引入数据管理工具
// 如果路径报错，请根据你的文件结构调整，例如 ../utils/userData
import { updateModule, getModule } from '../utils/userData';

// --- 1. 核心配置 ---
const qualities = [
  { name: "白色", max: 35,  exp_per: 20,  color: "#757575" },
  { name: "绿色", max: 36,  exp_per: 40,  color: "#2E7D32" },
  { name: "蓝色", max: 89,  exp_per: 50,  color: "#1565C0" },
  { name: "紫色", max: 173, exp_per: 100, color: "#7B1FA2" },
  { name: "金色", max: 131, exp_per: 200, color: "#FF8F00" },
]

const MAX_TOTAL_CAPACITY = qualities.reduce((sum, q) => sum + q.max, 0)

// --- 2. 响应式状态 ---
const inputCount = ref('')
const inputExp = ref('')

const resultStatus = reactive({
  success: false,
  message: '等待输入...',
  totalCount: 0,
  totalExp: 0
})

const distribution = ref(qualities.map(q => ({ ...q, count: 0, currentExp: 0 })))

// --- 3. 数据加载与互通逻辑 ---
onMounted(() => {
  // 1. 优先读取自己的数据 (wedge_calc)
  const wedgeData = getModule('wedge_calc');
  
  if (wedgeData) {
    if (wedgeData.count) inputCount.value = wedgeData.count;
    if (wedgeData.exp) inputExp.value = wedgeData.exp;
  }

  // // 2. 互通逻辑：如果没有填入经验，尝试从“经验计算器”读取总经验
  // // 这样用户在另一页算完等级后，过来可以直接算楔子分配
  // if (!inputExp.value) {
  //   const expData = getModule('exp_calc');
  //   if (expData && expData.totalExp) {
  //     inputExp.value = expData.totalExp;
  //   }
  // }

  // 3. 如果有数据，自动触发一次计算
  if (inputCount.value && inputExp.value) {
    runCalculation();
  }
});

// --- 4. 算法移植 (保持不变) ---
const clone = (arr) => [...arr]
const randint = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

const shuffle = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array
}

const initGreedyBottomUp = (targetCount) => {
  const counts = new Array(qualities.length).fill(0)
  let rem = targetCount
  for (let i = 0; i < qualities.length; i++) {
    const fill = Math.min(rem, qualities[i].max)
    counts[i] = fill
    rem -= fill
  }
  return rem === 0 ? counts : null
}

const initGreedyTopDown = (targetCount) => {
  const counts = new Array(qualities.length).fill(0)
  let rem = targetCount
  for (let i = qualities.length - 1; i >= 0; i--) {
    const fill = Math.min(rem, qualities[i].max)
    counts[i] = fill
    rem -= fill
  }
  return rem === 0 ? counts : null
}

const initRandom = (targetCount) => {
  const counts = new Array(qualities.length).fill(0)
  let rem = targetCount
  const indices = shuffle([...Array(qualities.length).keys()])
  for (const i of indices) {
    const maxCanFill = Math.min(rem, qualities[i].max)
    let fill = 0
    if (maxCanFill > 0) fill = randint(0, maxCanFill)
    counts[i] = fill
    rem -= fill
  }
  if (rem > 0) {
    for (let i = 0; i < qualities.length; i++) {
      const space = qualities[i].max - counts[i]
      const add = Math.min(rem, space)
      counts[i] += add
      rem -= add
      if (rem === 0) break
    }
  }
  return counts
}

const optimizeCounts = (startCounts, targetExp) => {
  let currentCounts = [...startCounts]
  const maxSteps = 100
  for (let step = 0; step < maxSteps; step++) {
    const currentExp = currentCounts.reduce((acc, c, i) => acc + c * qualities[i].exp_per, 0)
    const diff = targetExp - currentExp
    if (diff === 0) return { counts: currentCounts, diff: 0 }
    
    let bestMove = null
    let bestNewDiffAbs = Math.abs(diff)
    
    if (diff > 0) { 
      for (let i = 0; i < qualities.length; i++) {
        if (currentCounts[i] <= 0) continue
        for (let j = i + 1; j < qualities.length; j++) {
          if (currentCounts[j] >= qualities[j].max) continue
          const delta = qualities[j].exp_per - qualities[i].exp_per
          const newDiffAbs = Math.abs(diff - delta)
          if (newDiffAbs < bestNewDiffAbs) {
            bestNewDiffAbs = newDiffAbs
            bestMove = [i, j]
          }
        }
      }
    } else { 
      for (let i = qualities.length - 1; i >= 0; i--) {
        if (currentCounts[i] <= 0) continue
        for (let j = 0; j < i; j++) {
          if (currentCounts[j] >= qualities[j].max) continue
          const delta = qualities[j].exp_per - qualities[i].exp_per 
          const newDiffAbs = Math.abs(diff - delta)
          if (newDiffAbs < bestNewDiffAbs) {
            bestNewDiffAbs = newDiffAbs
            bestMove = [i, j]
          }
        }
      }
    }
    if (!bestMove) break
    const [src, dst] = bestMove
    currentCounts[src]--
    currentCounts[dst]++
  }
  const finalExp = currentCounts.reduce((acc, c, i) => acc + c * qualities[i].exp_per, 0)
  return { counts: currentCounts, diff: targetExp - finalExp }
}

const getExpRange = (count) => {
  const cMin = initGreedyBottomUp(count)
  const cMax = initGreedyTopDown(count)
  if (!cMin || !cMax) return [0, 0]
  const expMin = cMin.reduce((acc, c, i) => acc + c * qualities[i].exp_per, 0)
  const expMax = cMax.reduce((acc, c, i) => acc + c * qualities[i].exp_per, 0)
  return [expMin, expMax]
}

const runCalculation = () => {
  const tCount = parseInt(inputCount.value)
  const tExp = parseInt(inputExp.value)
  
  if (isNaN(tCount) || isNaN(tExp) || tCount <= 0 || tExp <= 0) {
    resultStatus.message = "等待输入有效数字..."
    resultStatus.success = false
    resultStatus.totalCount = 0
    resultStatus.totalExp = 0
    distribution.value.forEach(d => { d.count = 0; d.currentExp = 0 })
    return
  }

  if (tCount > MAX_TOTAL_CAPACITY) {
    resultStatus.message = `数量 ${tCount} 超过仓库上限 ${MAX_TOTAL_CAPACITY}`
    resultStatus.success = false
    return
  }
  
  const [minExp, maxExp] = getExpRange(tCount)
  if (tExp < minExp) {
    resultStatus.message = `目标经验过低 (至少需要 ${minExp})`
    resultStatus.success = false
    return
  }
  if (tExp > maxExp) {
    resultStatus.message = `目标经验过高 (至多只能 ${maxExp})`
    resultStatus.success = false
    return
  }

  let bestCounts = null
  let minDiff = Infinity
  const startPoints = []
  
  const p1 = initGreedyBottomUp(tCount)
  if (p1) startPoints.push(p1)
  const p2 = initGreedyTopDown(tCount)
  if (p2) startPoints.push(p2)
  for (let i = 0; i < 500; i++) {
    startPoints.push(initRandom(tCount))
  }
  
  for (const counts of startPoints) {
    const { counts: optCounts, diff } = optimizeCounts(counts, tExp)
    if (diff === 0) {
      bestCounts = optCounts
      minDiff = 0
      break 
    }
    if (Math.abs(diff) < Math.abs(minDiff)) {
      minDiff = diff
      bestCounts = optCounts
    }
  }
  
  if (bestCounts) {
    let sumC = 0
    let sumE = 0
    bestCounts.forEach((c, idx) => {
      distribution.value[idx].count = c
      distribution.value[idx].currentExp = c * qualities[idx].exp_per
      sumC += c
      sumE += c * qualities[idx].exp_per
    })
    
    resultStatus.totalCount = sumC
    resultStatus.totalExp = sumE
    
    if (minDiff === 0) {
      resultStatus.success = true
      resultStatus.message = "预估完成 仅供参考"
    } else {
      resultStatus.success = false
      resultStatus.message = `无精确解 (误差 ${minDiff} exp)`
    }
  }
}

// --- 5. 监听与保存逻辑 ---
watch([inputCount, inputExp], () => {
  // 1. 每次变化都计算
  runCalculation();

  // 2. 每次变化都保存到 wedge_calc 模块
  updateModule('wedge_calc', {
    count: inputCount.value,
    exp: inputExp.value
  });
});

// --- 6. 输入处理 ---
const handleinputCount = (e) => {
  let value = e.target.value
  value = value.replace(/[^\d]/g, '')
  if (value !== '') {
    if (parseInt(value) > 464) value = '464'
    value = String(parseInt(value))
  }
  inputCount.value = value
  e.target.value = value
}

const handleinputExp = (e) => {
  let value = e.target.value
  value = value.replace(/[^\d]/g, '')
  if (value !== '') {
    if (parseInt(value) > 50090) value = '50090' 
    value = String(parseInt(value))
  }
  inputExp.value = value
  e.target.value = value
}
</script>

<template>
  <div class="page-container">
    <div class="calculator-card">
      
      <div class="header-info">
        Version: v1.0.8 Web | Author: 皎皎角wiki组 (Ported)
      </div>

      <fieldset class="group-box">
        <legend>基础数据输入</legend>
        <div class="input-grid">
          <label>首次获得的魔之楔数量:</label>
          <input 
            type="number" 
            :value="inputCount"
            @input="handleinputCount"
            placeholder="总数"
          />
          
          <label>首次获得魔之楔的总经验:</label>
          <input 
            type="number" 
            :value="inputExp"
            @input="handleinputExp"
            placeholder="总经验"
          />
        </div>
      </fieldset>

      <fieldset class="group-box">
        <legend>各品质分配详情[推测]</legend>
        
        <div class="result-list">
          <div v-for="item in distribution" :key="item.name" class="result-row">
            <span class="row-label">{{ item.name }} (单个{{ item.exp_per }} exp):</span>
            <div class="row-value-box" :style="{ color: item.count > 0 ? item.color : '#ccc' }">
              {{ item.count }} 个 <span class="sub-text">(共 {{ item.currentExp }} exp)</span>
            </div>
          </div>

          <div class="divider"></div>

          <div class="result-row total-row">
            <span class="row-label bold">合计 (验算):</span>
            <div 
              class="row-value-box total-box"
              :class="{ 'success-bg': resultStatus.success, 'fail-bg': !resultStatus.success && resultStatus.totalCount > 0 }"
            >
              {{ resultStatus.totalCount }} 个 / {{ resultStatus.totalExp }} exp
            </div>
          </div>
        </div>
      </fieldset>

      <div class="status-bar" :class="{ 'status-ok': resultStatus.success, 'status-fail': !resultStatus.success }">
        <span v-if="resultStatus.success">✅ {{ resultStatus.message }}</span>
        <span v-else>
          <template v-if="resultStatus.message !== '等待输入...'">⚠️</template> 
          {{ resultStatus.message }}
        </span>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* =========================================
   1. 桌面端默认样式 (保持你原有的逻辑不变)
   ========================================= */

/* 容器布局 */
.page-container {
  display: flex;
  justify-content: center;
  padding: 20px;
  font-family: "Microsoft YaHei UI", sans-serif;
  color: #333;
}

.calculator-card {
  width: 100%;
  max-width: 450px;
  background: #fff;
  padding: 10px;
  border-radius: 4px;
}

.header-info {
  text-align: center;
  font-size: 10px;
  color: #888;
  margin-bottom: 10px;
}

.group-box {
  border: 1px solid #dcdcdc;
  border-radius: 4px;
  padding: 15px;
  margin-bottom: 15px;
}

legend {
  font-size: 14px;
  color: #333;
  padding: 0 5px;
  font-weight: bold;
}

/* 输入网格 (桌面: 左右排列) */
.input-grid {
  display: grid;
  grid-template-columns: auto 1fr; /* 左侧自适应，右侧撑满 */
  gap: 10px 15px;
  align-items: center;
}

.input-grid label {
  text-align: right;
  font-size: 14px;
}

input {
  padding: 5px;
  border: 1px solid #ccc;
  border-radius: 2px;
  outline: none;
  /* 桌面端字体可以小一点 */
  font-size: 14px; 
}
input:focus {
  border-color: #1565C0;
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 结果行 (桌面: 左右排列，左侧固定140px) */
.result-row {
  display: grid;
  grid-template-columns: 140px 1fr; 
  align-items: center;
  gap: 10px;
}

.row-label {
  text-align: right;
  font-size: 13px;
}
.row-label.bold {
  font-weight: bold;
}

.row-value-box {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 6px;
  background-color: #f9f9f9;
  text-align: center;
  font-weight: bold;
  font-size: 13px;
}

.sub-text {
  font-weight: normal;
  font-size: 12px;
  margin-left: 5px;
  opacity: 0.8;
}

.divider {
  height: 1px;
  background: #eee;
  border-bottom: 1px solid #fff;
  box-shadow: 0 1px 0 #ddd inset;
  margin: 5px 0;
}

.total-box {
  background-color: #f0f0f0;
  color: #000;
  border-style: double;
}

.success-bg {
  background-color: #E8F5E9;
  color: #2E7D32;
  border-color: #388E3C;
}

.fail-bg {
  background-color: #FFEBEE;
  color: #C62828;
  border-color: #d32f2f;
}

.status-bar {
  text-align: center;
  font-style: italic;
  font-size: 14px;
  margin-top: 5px;
  color: #666;
}

.status-ok {
  color: #388E3C;
  font-weight: bold;
  font-style: normal;
}

.status-fail {
  color: #d32f2f;
  font-weight: bold;
  font-style: normal;
}

/* =========================================
   📱 2. 移动端竖屏适配 (新增核心代码)
   ========================================= */
@media (max-width: 600px) {
  /* 1. 减少容器边距，争取更多空间 */
  .page-container {
    padding: 10px;
  }
  
  .calculator-card {
    padding: 0; /* 卡片内边距清零，由 group-box 提供间距 */
    background: transparent; /* 手机上可以去掉卡片背景，直接融为一体 */
  }

  /* 2. GroupBox 调整 */
  .group-box {
    padding: 12px; /* 稍微紧凑一点 */
    background: #fff; /* 确保内容有背景 */
  }

  /* 3. 输入区域：改为上下堆叠 */
  .input-grid {
    grid-template-columns: 1fr; /* 强制单列 */
    gap: 5px; /* 减小间距 */
  }

  .input-grid label {
    text-align: left; /* 标签改为左对齐 */
    margin-top: 5px;
    font-weight: bold;
    color: #555;
  }

  input {
    padding: 10px; /* 增大点击区域 */
    font-size: 16px; /* 关键：iOS上字体小于16px点击时会强制放大页面，设为16px可防止 */
  }

  /* 4. 结果区域：改为上下堆叠 */
  .result-row {
    grid-template-columns: 1fr; /* 强制单列 */
    gap: 4px;
    margin-bottom: 8px; /* 增加行间距 */
  }

  .row-label {
    text-align: left; /* 标签左对齐 */
    font-size: 12px;
    color: #666;
  }

  /* 5. 数值框样式优化 */
  .row-value-box {
    padding: 10px; /* 增加高度 */
    display: flex; /* 使用 flex 让内部文字更好排版 */
    justify-content: space-between; /* 数量和经验值两端对齐 (可选) */
    align-items: center;
  }

  .sub-text {
    font-size: 12px;
    /* 手机上字号小一点，或者让它换行 */
  }
  
  /* 6. 合计行特殊处理 */
  .total-row {
    margin-top: 10px;
  }
  .total-row .row-label {
    font-size: 14px;
    color: #333;
  }
}
</style>