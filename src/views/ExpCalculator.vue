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
          <span class="label">当前等级</span>
          <span class="value">{{ inputLevel }}</span>
        </div>
        <div class="exp-info">
          <div class="row">
            <span>当前总经验:</span>
            <strong>{{ calculatedTotalExp.toLocaleString() }}</strong>
          </div>
          <div class="row">
            <span>下级所需:</span>
            <span>{{ nextLevelDiff }}</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" :style="{ width: progressPercentage + '%' }"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="target-setting-bar">
      <label class="setting-label">🎯 设定目标等级</label>
      <div class="setting-input-wrapper">
        <button class="adj-btn" @click="adjustTarget(-1)">-</button>
        <input 
          type="number" 
          v-model.number="inputTargetLevel" 
          @change="validateTargetLevel"
          :min="inputLevel"
          max="65"
          class="target-input-field"
        />
        <button class="adj-btn" @click="adjustTarget(1)">+</button>
      </div>
    </div>

    <div class="module-section">
      <div class="module-header-tip">
        <span class="tip-icon">💡</span>
        <span>点击下方图标切换页面填写详细数据，返回后自动更新</span>
      </div>
      
      <nav class="module-nav">
        <template v-for="(item, key) in moduleDisplayList" :key="key">
          <component 
            :is="item.route ? 'router-link' : 'div'" 
            :to="item.route"
            class="module-item"
            :class="{ 
              'has-data': item.hasData, 
              'no-data': !item.hasData && item.route,
              'disabled': !item.route 
            }"
          >
            <div class="module-icon">{{ item.icon }}</div>
            <div class="module-name">{{ item.name }}</div>
            
            <div v-if="item.hasData" class="module-stats">
              <div class="stat-exp">{{ item.exp.toLocaleString() }} exp</div>
              <div class="stat-bar-bg">
                <div class="stat-bar-fill" :style="{ width: item.percent + '%' }"></div>
              </div>
              <div class="stat-percent">{{ item.percent }}%</div>
            </div>

            <div v-else class="module-empty">
              <span>点击录入</span>
              <span class="plus-icon">+</span>
            </div>
          </component>
        </template>
      </nav>
    </div>

    <div class="input-section">
      <div class="input-header" @click="toggleInput">
        <span class="title">手动校准 (当前等级/经验)</span>
        <span class="arrow" :class="{ rotated: isInputExpanded }">▼</span>
      </div>
      
      <div v-show="isInputExpanded" class="input-body">
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
            <label>已有经验 (本级)</label>
            <input 
              type="number" 
              v-model.number="inputCurrentExp" 
              @change="handleExpOverflow" 
              min="0"
              placeholder="0"
              class="main-input"
            />
            <div class="input-tip" v-if="!isMaxLevel">
              上限: {{ currentLevelData[2] }} (自动升级)
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="table-section">
      <div class="table-header" @click="toggleTable">
        <h3>等级对照表</h3>
        <span class="arrow" :class="{ rotated: isTableExpanded }">▼</span>
      </div>
      <div v-show="isTableExpanded" class="table-container">
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
              :id="'row-' + row[0]" 
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
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick, reactive } from 'vue';
import { updateModule, getModule, updateUiState, getUiState } from '../utils/userData';

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

const isInputExpanded = ref(true); 
const isTableExpanded = ref(false);

const moduleRawData = reactive({
  wedge_calc: 0,
  role: 0,
  weapon: 0,
  Spirit: 0,
  other: 0
});

// --- 3. 辅助计算属性 ---
const currentLevelData = computed(() => LEVEL_TABLE.find(row => row[0] === inputLevel.value) || LEVEL_TABLE[0]);
const targetLevelData = computed(() => LEVEL_TABLE.find(row => row[0] === inputTargetLevel.value) || LEVEL_TABLE[LEVEL_TABLE.length-1]);
const isMaxLevel = computed(() => inputLevel.value >= MAX_LEVEL);

const calculatedTotalExp = computed(() => {
  return currentLevelData.value[1] + (inputCurrentExp.value || 0);
});

const expToTarget = computed(() => {
  const targetExp = targetLevelData.value[1]; 
  return targetExp - calculatedTotalExp.value;
});

const nextLevelDiff = computed(() => {
  if (isMaxLevel.value) return '已满级';
  const neededForNext = currentLevelData.value[2];
  const diff = neededForNext - (inputCurrentExp.value || 0);
  return diff > 0 ? diff.toLocaleString() : 0;
});

const progressPercentage = computed(() => {
  if (isMaxLevel.value) return 100;
  const needed = currentLevelData.value[2];
  const current = inputCurrentExp.value || 0;
  if (needed <= 0) return 100;
  return Math.min(100, Math.max(0, (current / needed) * 100));
});

// 模块列表展示逻辑
const moduleDisplayList = computed(() => {
  const total = calculatedTotalExp.value || 1; 
  
  const configs = [
    { key: 'wedge_calc', name: '魔之楔', icon: '🧩', route: '/page1' },
    { key: 'role',       name: '角色',   icon: '👤', route: '/role' },
    { key: 'weapon',     name: '武器',   icon: '⚔️', route: '/weapon' },
    { key: 'Spirit',     name: '魔灵',   icon: '👻', route: '/spirit' },
    { key: 'other',      name: '其他',   icon: '📦', route: '/other' }
  ];

  return configs.map(cfg => {
    const exp = moduleRawData[cfg.key] || 0;
    const hasData = exp > 0;
    let percent = 0;
    if (hasData) {
      percent = ((exp / total) * 100).toFixed(1);
      if (percent > 100) percent = 100; 
    }
    return { ...cfg, exp, hasData, percent };
  });
});

// --- 4. 核心逻辑方法 ---
const isSpecialLevel = (lvl) => SPECIAL_LEVELS.includes(lvl);

const handleLevelInput = () => {
  if (inputLevel.value < 1) inputLevel.value = 1;
  if (inputLevel.value > MAX_LEVEL) inputLevel.value = MAX_LEVEL;
  if (inputTargetLevel.value < inputLevel.value) inputTargetLevel.value = inputLevel.value;
};

const handleExpOverflow = () => {
  if (inputCurrentExp.value < 0) { inputCurrentExp.value = 0; return; }
  while (!isMaxLevel.value) {
    const currentRow = LEVEL_TABLE.find(r => r[0] === inputLevel.value);
    if (!currentRow) break;
    const needed = currentRow[2];
    if (inputCurrentExp.value >= needed) {
      inputCurrentExp.value -= needed;
      inputLevel.value++;
    } else { break; }
  }
  if (inputTargetLevel.value < inputLevel.value) inputTargetLevel.value = inputLevel.value;
};

const validateTargetLevel = () => {
  if (inputTargetLevel.value < inputLevel.value) inputTargetLevel.value = inputLevel.value;
  if (inputTargetLevel.value > MAX_LEVEL) inputTargetLevel.value = MAX_LEVEL;
};

const adjustTarget = (delta) => {
  let newValue = inputTargetLevel.value + delta;
  if (newValue < inputLevel.value) newValue = inputLevel.value;
  if (newValue > MAX_LEVEL) newValue = MAX_LEVEL;
  inputTargetLevel.value = newValue;
};

const toggleInput = () => { isInputExpanded.value = !isInputExpanded.value; };
const toggleTable = () => { isTableExpanded.value = !isTableExpanded.value; };

// --- 5. 数据逻辑 (Updated) ---

const calculateLevelFromTotalExp = (totalExp) => {
  let lvl = 1;
  for (let i = 0; i < LEVEL_TABLE.length; i++) {
    const [level, baseExp] = LEVEL_TABLE[i];
    if (level === MAX_LEVEL) {
      if (totalExp >= baseExp) return { level: MAX_LEVEL, exp: totalExp - baseExp };
    }
    const nextRow = LEVEL_TABLE[i+1];
    if (nextRow) {
      if (totalExp < nextRow[1]) return { level: level, exp: totalExp - baseExp };
    }
  }
  return { level: 1, exp: 0 };
};

const loadData = () => {
  // 1. 读取基础 exp_calc 数据 (手动填写的)
  const expData = getModule('exp_calc');
  if (expData) {
    inputLevel.value = expData.level ?? 1;
    inputCurrentExp.value = expData.currentExp ?? 0;
    inputTargetLevel.value = expData.targetLevel ?? 60;
  }

  // 2. 遍历读取各模块数据并汇总
  const keys = ['wedge_calc', 'role', 'weapon', 'Spirit', 'other'];
  let grandTotalExp = 0;

  keys.forEach(key => {
    const modData = getModule(key);
    let modExp = 0;
    
    if (modData) {
      if (key === 'role') {
        // --- 角色模块特殊解析规则 ---
        // 结构: { detail: [...], summary: { total: { curr: 13200 } } }
        // 安全读取深层属性
        if (modData.summary && modData.summary.total && modData.summary.total.curr) {
          modExp = parseInt(modData.summary.total.curr);
        }
      } else {
        // --- 其他模块常规规则 ---
        // 优先读取 totalExp (新版), 兼容 exp (旧版 wedge)
        modExp = parseInt(modData.totalExp ?? modData.exp ?? 0);
      }
    }
    
    // 存入展示用的 RawData
    modExp = isNaN(modExp) ? 0 : modExp;
    moduleRawData[key] = modExp;
    
    // 累加到总经验池
    grandTotalExp += modExp;
  });

  // 3. 自动计算逻辑
  // 如果从各模块汇总到了经验值，则重新计算当前等级和经验
  // 逻辑：以“模块汇总”为准 (Source of Truth)，覆盖可能的手动输入
  if (grandTotalExp > 0) {
    const res = calculateLevelFromTotalExp(grandTotalExp);
    inputLevel.value = res.level;
    inputCurrentExp.value = res.exp;
  }

  // 4. 读取 UI 状态
  const uiState = getUiState();
  if (uiState.expCalc_input_expanded !== undefined) isInputExpanded.value = uiState.expCalc_input_expanded;
  if (uiState.expCalc_table_expanded !== undefined) isTableExpanded.value = uiState.expCalc_table_expanded;
};

watch([inputLevel, inputCurrentExp, inputTargetLevel], () => {
  updateModule('exp_calc', {
    level: inputLevel.value,
    currentExp: inputCurrentExp.value,
    targetLevel: inputTargetLevel.value,
    totalExp: calculatedTotalExp.value 
  });
});

watch([isInputExpanded, isTableExpanded], ([newInput, newTable]) => {
  updateUiState({
    expCalc_input_expanded: newInput,
    expCalc_table_expanded: newTable
  });
});

onMounted(() => {
  loadData();
  nextTick(() => {
    const el = document.getElementById('row-' + inputLevel.value);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
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
  margin-bottom: 15px;
  border: 1px solid #e0e0e0;
}
.result-card.highlight-rank { border-left: 5px solid #e67e22; }

.target-badge { text-align: center; margin-bottom: 15px; }
.target-label { font-size: 0.95rem; color: #666; margin-bottom: 5px; }
.target-tag { background: #e0f2f1; color: #00796b; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
.target-value { font-size: 2.2rem; font-weight: 800; color: #d35400; line-height: 1.2; }
.target-value.text-green { color: #42b983; }

.divider { border: 0; border-top: 1px dashed #eee; margin: 15px 0; }

.status-row { display: flex; align-items: center; gap: 15px; }
.level-badge { text-align: center; min-width: 60px; }
.level-badge .label { display: block; font-size: 0.75rem; color: #999; }
.level-badge .value { font-size: 1.8rem; font-weight: 700; color: #2c3e50; }
.exp-info { flex: 1; font-size: 0.9rem; color: #555; }
.exp-info .row { display: flex; justify-content: space-between; margin-bottom: 4px; }

.progress-bar-bg { height: 6px; background: #eee; border-radius: 3px; margin-top: 8px; overflow: hidden; }
.progress-bar-fill { height: 100%; background: #42b983; transition: width 0.3s ease; }

/* 独立目标设置栏 */
.target-setting-bar {
  background: #fff;
  border-radius: 12px;
  padding: 15px;
  margin-bottom: 15px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid #e0f2f1;
}
.setting-label { font-weight: bold; color: #00796b; font-size: 0.95rem; }
.setting-input-wrapper { display: flex; align-items: center; gap: 8px; }
.target-input-field {
  width: 60px; padding: 8px; text-align: center; font-size: 1.1rem;
  font-weight: bold; border: 1px solid #b2dfdb; border-radius: 6px;
  background: #f0fdfc; outline: none; color: #00695c;
}
.target-input-field:focus { border-color: #009688; }
.adj-btn {
  width: 32px; height: 32px; border: 1px solid #eee; background: #f9f9f9;
  border-radius: 6px; color: #666; font-size: 1.2rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center; user-select: none;
}
.adj-btn:active { background: #e0e0e0; }

/* 模块导航 */
.module-header-tip {
  display: flex; align-items: center; gap: 6px; font-size: 0.75rem;
  color: #666; margin-bottom: 8px; padding: 0 4px;
}
.tip-icon { font-size: 0.9rem; }

.module-nav {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
  gap: 10px; margin-bottom: 15px;
}

.module-item {
  position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: #fff; padding: 12px 5px; border-radius: 10px; text-decoration: none;
  border: 1px solid #eee; transition: all 0.2s; box-shadow: 0 2px 6px rgba(0,0,0,0.02); min-height: 80px;
}

/* 状态样式 */
.module-item.has-data {
  background: #e0f2f1; border-color: #42b983; color: #00796b;
}
.module-item.no-data {
  background: #fff; border-color: #ddd; color: #666; cursor: pointer;
}
.module-item.no-data:hover {
  border-color: #42b983; color: #42b983; box-shadow: 0 4px 12px rgba(66, 184, 131, 0.15);
}
.module-item.disabled {
  background: #f9f9f9; color: #ccc; border-color: #f0f0f0; cursor: default;
}
.module-item.disabled .module-icon { filter: grayscale(100%); opacity: 0.5; }

.module-icon { font-size: 1.4rem; margin-bottom: 4px; }
.module-name { font-size: 0.8rem; font-weight: 600; margin-bottom: 6px; }

.module-stats { width: 100%; padding: 0 8px; box-sizing: border-box; text-align: center; }
.stat-exp { font-size: 0.65rem; margin-bottom: 2px; white-space: nowrap; }
.stat-bar-bg { height: 4px; background: rgba(0,0,0,0.1); border-radius: 2px; margin-bottom: 2px; overflow: hidden; }
.stat-bar-fill { height: 100%; background: #42b983; border-radius: 2px; }
.stat-percent { font-size: 0.6rem; opacity: 0.8; }

.module-empty { font-size: 0.7rem; color: #bbb; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.plus-icon { font-size: 1rem; font-weight: bold; color: #ddd; }
.module-item.no-data:hover .plus-icon { color: #42b983; }

/* 其他样式保持 */
.input-section { background: #fff; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); margin-bottom: 15px; overflow: hidden; }
.input-header { padding: 15px; background: #fafafa; cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none; }
.input-header .title { font-weight: 600; color: #333; font-size: 0.95rem; }
.arrow { color: #999; font-size: 0.8rem; transition: transform 0.3s; }
.arrow.rotated { transform: rotate(180deg); }
.input-body { padding: 20px; border-top: 1px solid #eee; }
.input-row { display: flex; gap: 10px; }
.input-group { flex: 1; display: flex; flex-direction: column; }
.input-group label { margin-bottom: 6px; font-weight: 600; color: #333; font-size: 0.8rem; white-space: nowrap; }
.main-input { width: 100%; padding: 10px; font-size: 1rem; border: 1px solid #ddd; border-radius: 8px; box-sizing: border-box; text-align: center; outline: none; background: #fff; }
.main-input:focus { border-color: #42b983; }
.input-tip { font-size: 0.7rem; color: #999; text-align: center; margin-top: 4px; }

.table-section { background: #fff; border-radius: 12px; margin-bottom: 20px; overflow: hidden; }
.table-header { padding: 15px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; background: #fafafa; }
.table-header h3 { margin: 0; font-size: 1rem; color: #333; }
.table-container { max-height: 250px; overflow-y: auto; border-top: 1px solid #eee; }
table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
th, td { padding: 8px; text-align: center; border-bottom: 1px solid #eee; }
th { background: #f9f9f9; position: sticky; top: 0; font-weight: 600; color: #666; }
.special-row { font-weight: bold; color: #d35400; background-color: #fff8f0; }
.current-row { background-color: #e8f5e9; color: #2ecc71; }
.target-row { background-color: #e0f2f1; color: #00796b; border: 2px solid #009688; }
.table-tag { font-size: 0.7rem; background: #009688; color: white; padding: 2px 4px; border-radius: 3px; white-space: nowrap; line-height: 1; display: inline-block; }
</style>