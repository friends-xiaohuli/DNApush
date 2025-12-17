<script setup>
import { ref, reactive, watch, computed } from 'vue'

// --- 1. 核心配置 (与 Python 代码一致) ---
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

// 用于存储每个品质的计算结果
const distribution = ref(qualities.map(q => ({ ...q, count: 0, currentExp: 0 })))

// --- 3. 算法移植 (Python -> JS) ---

// 辅助：深拷贝数组
const clone = (arr) => [...arr]

// 辅助：随机整数 [min, max]
const randint = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

// 辅助：洗牌算法 (Fisher-Yates)
const shuffle = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array
}

// 策略初始化函数
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
    if (maxCanFill > 0) {
      fill = randint(0, maxCanFill)
    }
    counts[i] = fill
    rem -= fill
  }
  
  // 修正阶段
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

// 核心优化器
const optimizeCounts = (startCounts, targetExp) => {
  let currentCounts = [...startCounts]
  const maxSteps = 100
  
  for (let step = 0; step < maxSteps; step++) {
    const currentExp = currentCounts.reduce((acc, c, i) => acc + c * qualities[i].exp_per, 0)
    const diff = targetExp - currentExp
    
    if (diff === 0) return { counts: currentCounts, diff: 0 }
    
    let bestMove = null
    let bestNewDiffAbs = Math.abs(diff)
    
    if (diff > 0) { // 缺经验：低换高 (i -> j, i < j)
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
    } else { // 经验多了：高换低 (i -> j, i > j)
      for (let i = qualities.length - 1; i >= 0; i--) {
        if (currentCounts[i] <= 0) continue
        for (let j = 0; j < i; j++) {
          if (currentCounts[j] >= qualities[j].max) continue
          
          const delta = qualities[j].exp_per - qualities[i].exp_per // delta is negative
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
  
  // 如果连基础填充都做不到（数量超标），返回 null
  if (!cMin || !cMax) return [0, 0]

  const expMin = cMin.reduce((acc, c, i) => acc + c * qualities[i].exp_per, 0)
  const expMax = cMax.reduce((acc, c, i) => acc + c * qualities[i].exp_per, 0)
  return [expMin, expMax]
}

// 主计算逻辑
const runCalculation = () => {
  const tCount = parseInt(inputCount.value)
  const tExp = parseInt(inputExp.value)
  
  // 1. 基础校验
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

  // 2. 策略执行
  let bestCounts = null
  let minDiff = Infinity
  
  const startPoints = []
  
  // 策略 A & B
  const p1 = initGreedyBottomUp(tCount)
  if (p1) startPoints.push(p1)
  
  const p2 = initGreedyTopDown(tCount)
  if (p2) startPoints.push(p2)
  
  // 策略 C: 随机轰炸 (JS 速度很快，500次没问题)
  for (let i = 0; i < 500; i++) {
    startPoints.push(initRandom(tCount))
  }
  
  // 3. 优化循环
  for (const counts of startPoints) {
    const { counts: optCounts, diff } = optimizeCounts(counts, tExp)
    
    if (diff === 0) {
      bestCounts = optCounts
      minDiff = 0
      break // 找到完美解，直接退出
    }
    
    if (Math.abs(diff) < Math.abs(minDiff)) {
      minDiff = diff
      bestCounts = optCounts
    }
  }
  
  // 4. 更新 UI 数据
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
      resultStatus.message = "完美匹配"
    } else {
      resultStatus.success = false
      resultStatus.message = `无精确解 (误差 ${minDiff} exp)`
    }
  }
}

// 监听输入变化自动计算
watch([inputCount, inputExp], runCalculation)

//强制范围
const handleinputCount = (e) => {
  let value = e.target.value
  // 2. 正则替换：把所有"非数字"替换为空字符串
  value = value.replace(/[^\d]/g, '')
  // 3. 逻辑判断：如果为空则不处理，如果有值则判断大小
  if (value !== '') {
    // 转为数字比较
    if (parseInt(value) > 464) {
      value = '464' // 超过50强制设为50
    }
    // (可选) 移除前导零，比如用户输入 05 -> 5
    value = String(parseInt(value))
  }

  // 4. 更新数据
  inputCount.value = value
  // 5. 强制更新输入框显示 (处理 Vue 有时 DOM 不更新的问题)
  e.target.value = value
}
const handleinputExp = (e) => {

  let value = e.target.value
  value = value.replace(/[^\d]/g, '')
  
  if (value !== '') {
    if (parseInt(value) > 50090) {
      value = '50090' 
    }
    value = String(parseInt(value))
  }

  // 4. 更新数据
  inputExp.value = value
  

  e.target.value = value
}
</script>

<template>
  <div class="page-container">
    <div class="calculator-card">
      
      <div class="header-info">
        Version: v1.0.7 Web | Author: 胶胶角wiki组 (Ported)
      </div>

      <fieldset class="group-box">
        <legend>基础数据输入</legend>
        <div class="input-grid">
          <label>当前魔之楔总数量:</label>
          <input 
            type="number" 
            :value="inputCount"
            @input="handleinputCount"
            placeholder="目标总数"
          />
          
          <label>当前总经验:</label>
          <input 
            type="number" 
            :value="inputExp"
            @input="handleinputExp"
            placeholder="目标总经验"
          />
        </div>
      </fieldset>

      <fieldset class="group-box">
        <legend>各品质分配详情</legend>
        
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
  border-radius: 4px; /* 模拟窗口 */
}

/* 顶部信息 */
.header-info {
  text-align: center;
  font-size: 10px;
  color: #888;
  margin-bottom: 10px;
}

/* GroupBox 模拟 */
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

/* 输入网格 */
.input-grid {
  display: grid;
  grid-template-columns: auto 1fr;
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
}
input:focus {
  border-color: #1565C0;
}

/* 结果列表 */
.result-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-row {
  display: grid;
  grid-template-columns: 140px 1fr; /* 左侧标签固定宽度，右侧自适应 */
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
  border-bottom: 1px solid #fff; /* 制造一点凹陷感 */
  box-shadow: 0 1px 0 #ddd inset;
  margin: 5px 0;
}

/* 合计状态样式 */
.total-box {
  background-color: #f0f0f0;
  color: #000;
  border-style: double; /* 模拟 Qt 的 double border */
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

/* 底部状态栏 */
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
</style>