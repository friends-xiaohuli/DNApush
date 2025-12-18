<template>
  <div class="container">
    <div class="result-card" :class="{ 'highlight-rank': isSpecialLevel(inputLevel) }">
      
      <div class="target-badge">
        <div class="target-label">距离目标 <span class="target-tag">Lv.{{ inputTargetLevel }}</span> 还需经验</div>
        <div class="target-value" :class="{ 'text-green': expToTarget <= 0 }">
          {{ expToTarget <= 0 ? '已达成目标' : expToTarget.toLocaleString() }}
        </div>
      </div>

      <hr class="divider" />

      <div class="status-row">
        <div class="level-badge">
          <span class="label">当前段位</span>
          <span class="value">{{ inputLevel }}</span>
        </div>
        
        <div class="exp-info">
          <div class="row">
            <span>当前总经验:</span>
            <strong>{{ calculatedTotalExp.toLocaleString() }}</strong>
          </div>
          <div class="row">
            <span>距离下一级 (Lv.{{ isMaxLevel ? 'MAX' : inputLevel + 1 }}):</span>
            <span>{{ nextLevelDiff }}</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" :style="{ width: progressPercentage + '%' }"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="input-section">
      <div class="input-row">
        <div class="input-group">
          <label>当前等级</label>
          <input 
            type="number" 
            v-model.number="inputLevel" 
            @input="handleLevelInput"
            min="1"
            max="65"
            class="main-input"
          />
        </div>
        
        <div class="input-group">
          <label>当前已有经验</label>
          <input 
            type="number" 
            v-model.number="inputCurrentExp" 
            @change="handleExpOverflow" 
            min="0"
            placeholder="0"
            class="main-input"
          />
          <div class="input-tip" v-if="!isMaxLevel">
            上限: {{ currentLevelData[2] }} (超过自动升级)
          </div>
        </div>
        
        <div class="input-group target-group">
          <label>目标等级</label>
          <input 
            type="number" 
            v-model.number="inputTargetLevel" 
            @change="validateTargetLevel"
            :min="inputLevel"
            max="65"
            class="main-input target-input"
          />
        </div>
      </div>
    </div>

    <div class="table-section">
      <h3>等级对照表</h3>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>等级</th>
              <th>下级所需</th>
              <th>达到该级累计</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="row in LEVEL_TABLE" 
              :key="row[0]"
              :class="{ 
                'special-row': isSpecialLevel(row[0]), 
                'current-row': row[0] === inputLevel,
                'target-row': row[0] === inputTargetLevel
              }"
            >
              <td>
                {{ row[0] }}
                <span v-if="row[0] === inputTargetLevel" class="table-tag">目标</span>
              </td>
              <td>{{ row[2] }}</td>
              <td>{{ row[1] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="json-tools">
      <h3>数据备份 / JSON 接口</h3>
      <textarea v-model="jsonString" rows="2" placeholder='{"level": 45, "exp": 1200, "target": 60}'></textarea>
      <div class="btn-group">
        <button @click="importJson">导入 JSON</button>
        <button @click="exportJson" class="outline">生成 JSON</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

// --- 1. 常量定义 ---
const LEVEL_TABLE = [
  [1, 0, 100], [2, 100, 120], [3, 220, 140], [4, 360, 160], [5, 520, 180], 
  [6, 700, 200], [7, 900, 220], [8, 1120, 240], [9, 1360, 260], [10, 1620, 280], 
  [11, 1900, 300], [12, 2200, 320], [13, 2520, 340], [14, 2860, 360], 
  [15, 3220, 390], 
  [16, 3610, 420], [17, 4030, 450], [18, 4480, 480], [19, 4960, 510], [20, 5470, 540], 
  [21, 6010, 570], [22, 6580, 600], [23, 7180, 630], [24, 7810, 660], 
  [25, 8470, 710], 
  [26, 9180, 760], [27, 9940, 810], [28, 10750, 860], [29, 11610, 910], [30, 12520, 960], 
  [31, 13480, 1010], [32, 14490, 1060], [33, 15550, 1110], [34, 16660, 1160], 
  [35, 17820, 1210], 
  [36, 19030, 1260], [37, 20290, 1310], [38, 21600, 1360], [39, 22960, 1410], [40, 24370, 1460], 
  [41, 25830, 1510], [42, 27340, 1560], [43, 28900, 1610], [44, 30510, 1660], 
  [45, 32170, 2060], 
  [46, 34230, 2460], [47, 36690, 2860], [48, 39550, 3260], [49, 42810, 3660], [50, 46470, 4060], 
  [51, 50530, 4460], [52, 54990, 4860], [53, 59850, 5260], [54, 65110, 5660], 
  [55, 70770, 7660], 
  [56, 78430, 9660], [57, 88090, 11660], [58, 99750, 13660], [59, 113410, 15660], 
  [60, 129070, 20660], 
  [61, 149730, 30660], [62, 180390, 45660], [63, 226050, 65660], [64, 291710, 90660], 
  [65, 382370, 99999]
];
const SPECIAL_LEVELS = [15, 25, 35, 45, 55, 60];
const MAX_LEVEL = 65;

// --- 2. 状态定义 ---
const inputLevel = ref(1);
const inputCurrentExp = ref(0);
const inputTargetLevel = ref(60); 
const jsonString = ref('');

// --- 3. 辅助计算属性 ---
const currentLevelData = computed(() => LEVEL_TABLE.find(row => row[0] === inputLevel.value) || LEVEL_TABLE[0]);
const targetLevelData = computed(() => LEVEL_TABLE.find(row => row[0] === inputTargetLevel.value) || LEVEL_TABLE[LEVEL_TABLE.length-1]);
const isMaxLevel = computed(() => inputLevel.value >= MAX_LEVEL);

// 当前总累计经验
const calculatedTotalExp = computed(() => {
  return currentLevelData.value[1] + (inputCurrentExp.value || 0);
});

// 距离目标的差值
const expToTarget = computed(() => {
  const targetExp = targetLevelData.value[1]; 
  return targetExp - calculatedTotalExp.value;
});

// 距离下一级还差多少
const nextLevelDiff = computed(() => {
  if (isMaxLevel.value) return '已满级';
  const neededForNext = currentLevelData.value[2];
  const diff = neededForNext - (inputCurrentExp.value || 0);
  return diff > 0 ? diff.toLocaleString() : 0;
});

// 进度条
const progressPercentage = computed(() => {
  if (isMaxLevel.value) return 100;
  const needed = currentLevelData.value[2];
  const current = inputCurrentExp.value || 0;
  if (needed <= 0) return 100;
  return Math.min(100, Math.max(0, (current / needed) * 100));
});

// --- 4. 核心逻辑方法 ---

const isSpecialLevel = (lvl) => SPECIAL_LEVELS.includes(lvl);

// 处理等级输入验证
const handleLevelInput = () => {
  if (inputLevel.value < 1) inputLevel.value = 1;
  if (inputLevel.value > MAX_LEVEL) inputLevel.value = MAX_LEVEL;
  // 联动: 如果当前等级超过了目标等级，推高目标等级
  if (inputTargetLevel.value < inputLevel.value) {
    inputTargetLevel.value = inputLevel.value;
  }
};

// 处理经验输入溢出 (自动升级换算)
// 使用 @change 而不是 @input，确保用户输完数字后再计算
const handleExpOverflow = () => {
  if (inputCurrentExp.value < 0) {
    inputCurrentExp.value = 0;
    return;
  }

  // 循环检查是否升级
  while (!isMaxLevel.value) {
    // 重新获取当前等级的升级所需经验 (因为 inputLevel 可能在循环中变了)
    const currentRow = LEVEL_TABLE.find(r => r[0] === inputLevel.value);
    if (!currentRow) break;
    
    const needed = currentRow[2]; // 第3列是升级所需
    
    if (inputCurrentExp.value >= needed) {
      inputCurrentExp.value -= needed; // 扣除升级所需
      inputLevel.value++;             // 等级 +1
    } else {
      break; // 不再溢出，停止循环
    }
  }

  // 如果满级了，经验值保留，不再自动进位
  if (inputLevel.value >= MAX_LEVEL) {
    // 也可以选择在这里限制 inputCurrentExp 的最大值
  }

  // 升级后再次检查目标等级
  if (inputTargetLevel.value < inputLevel.value) {
    inputTargetLevel.value = inputLevel.value;
  }
};

// 验证目标等级
const validateTargetLevel = () => {
  if (inputTargetLevel.value < inputLevel.value) {
    inputTargetLevel.value = inputLevel.value; // 强制拉回
  }
  if (inputTargetLevel.value > MAX_LEVEL) {
    inputTargetLevel.value = MAX_LEVEL;
  }
};

// --- 5. JSON 导入导出 ---
const exportJson = () => {
  const data = { 
    level: inputLevel.value, 
    exp: inputCurrentExp.value,
    target: inputTargetLevel.value
  };
  jsonString.value = JSON.stringify(data);
};

const importJson = () => {
  try {
    if (!jsonString.value) return;
    const parsed = JSON.parse(jsonString.value);
    if (parsed.level) inputLevel.value = Number(parsed.level);
    if (parsed.exp !== undefined) inputCurrentExp.value = Number(parsed.exp);
    if (parsed.target) inputTargetLevel.value = Number(parsed.target);
    
    // 导入后运行一次校验逻辑
    handleLevelInput();
    handleExpOverflow();
  } catch (e) {
    alert('JSON解析失败');
  }
};

// 监听 inputLevel 变化，确保目标等级始终 >= 当前等级
watch(inputLevel, (newVal) => {
  if (inputTargetLevel.value < newVal) {
    inputTargetLevel.value = newVal;
  }
});
</script>

<style scoped>
.container {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  padding: 16px;
  background: #f5f7fa;
  min-height: 100vh;
}

/* 结果卡片 */
.result-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  margin-bottom: 20px;
  border: 1px solid #e0e0e0;
}
.result-card.highlight-rank {
  border-left: 5px solid #e67e22;
}

/* 顶部目标区域 */
.target-badge {
  text-align: center;
  margin-bottom: 15px;
}
.target-label {
  font-size: 0.95rem;
  color: #666;
  margin-bottom: 5px;
}
.target-tag {
  background: #e0f2f1;
  color: #00796b;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: bold;
}
.target-value {
  font-size: 2.2rem;
  font-weight: 800;
  color: #d35400;
  line-height: 1.2;
}
.target-value.text-green {
  color: #42b983;
}

.divider {
  border: 0;
  border-top: 1px dashed #eee;
  margin: 15px 0;
}

/* 状态区域 */
.status-row {
  display: flex;
  align-items: center;
  gap: 15px;
}
.level-badge {
  text-align: center;
  min-width: 60px;
}
.level-badge .label {
  display: block;
  font-size: 0.75rem;
  color: #999;
}
.level-badge .value {
  font-size: 1.8rem;
  font-weight: 700;
  color: #2c3e50;
}
.exp-info {
  flex: 1;
  font-size: 0.9rem;
  color: #555;
}
.exp-info .row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.progress-bar-bg {
  height: 6px;
  background: #eee;
  border-radius: 3px;
  margin-top: 8px;
  overflow: hidden;
}
.progress-bar-fill {
  height: 100%;
  background: #42b983;
  transition: width 0.3s ease;
}

/* 输入区 */
.input-section {
  background: #fff;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
  margin-bottom: 20px;
}
.input-row {
  display: flex;
  gap: 10px;
}
.input-group {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.input-group label {
  margin-bottom: 6px;
  font-weight: 600;
  color: #333;
  font-size: 0.8rem;
  white-space: nowrap;
}
.main-input {
  width: 100%;
  padding: 10px;
  font-size: 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-sizing: border-box;
  text-align: center;
  outline: none;
  background: #fafafa;
}
.main-input:focus {
  border-color: #42b983;
  background: #fff;
}
.input-tip {
  font-size: 0.7rem;
  color: #999;
  text-align: center;
  margin-top: 4px;
}

.target-input {
  border-color: #b2dfdb;
  background: #f0fdfc;
}
.target-input:focus {
  border-color: #009688;
}

/* 表格区 */
.table-section {
  background: #fff;
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 20px;
}
.table-section h3 {
  margin-top: 0;
  font-size: 1rem;
  color: #333;
  margin-bottom: 10px;
}
.table-container {
  max-height: 250px;
  overflow-y: auto;
  border: 1px solid #eee;
  border-radius: 6px;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
th, td {
  padding: 8px;
  text-align: center;
  border-bottom: 1px solid #eee;
}
th {
  background: #f9f9f9;
  position: sticky;
  top: 0;
  font-weight: 600;
  color: #666;
}
.special-row {
  font-weight: bold;
  color: #d35400;
  background-color: #fff8f0;
}
.current-row {
  background-color: #e8f5e9;
  color: #2ecc71;
}
.target-row {
  background-color: #e0f2f1;
  color: #00796b;
  border: 2px solid #009688;
}
.table-tag {
  font-size: 0.7rem;
  background: #009688;
  color: white;
  padding: 1px 3px;
  border-radius: 2px;
  margin-left: 2px;
}

/* JSON 工具 */
.json-tools {
  background: #fff;
  padding: 16px;
  border-radius: 12px;
}
.json-tools h3 {
  font-size: 1rem;
  margin-top: 0;
}
textarea {
  width: 100%;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 8px;
  font-family: monospace;
  box-sizing: border-box;
  margin-bottom: 10px;
}
.btn-group {
  display: flex;
  gap: 10px;
}
button {
  flex: 1;
  padding: 10px;
  background: #42b983;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
}
button.outline {
  background: transparent;
  border: 1px solid #42b983;
  color: #42b983;
}
</style>