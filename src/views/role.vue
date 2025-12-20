<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { updateModule, getModule } from '../utils/userData';

// ==========================================
// 1. 静态配置 & 限制常量
// ==========================================
const ROLES_DB = {
  '暗': ['幻景', '贝蕾妮卡'],
  '火': ['海尔法', '耶尔与奥利弗', '希尔妲', '琳恩', '玛尔洁'],
  '水': ['扶疏', '丽蓓卡', '塔比瑟', '水系角色A'], 
  '雷': ['止流', '煜明', '黎瑟', '兰迪', '西比尔'],
  '光': ['刻舟', '莉兹贝尔', '妮弗尔夫人', '狩月人', '菲娜'],
  '风': ['松露与榛子', '奥特赛德', '赛琪', '达芙涅']
};

const CONFIG = {
  base: { exp: 500 },
  break: [
    { lv: 1, exp: 50 }, { lv: 2, exp: 150 }, { lv: 3, exp: 350 },
    { lv: 4, exp: 750 }, { lv: 5, exp: 1550 }, { lv: 6, exp: 3150 }
  ],
  origin: [
    { lv: 1, exp: 250 }, { lv: 2, exp: 500 }, { lv: 3, exp: 750 },
    { lv: 4, exp: 1000 }, { lv: 5, exp: 1250 }, { lv: 6, exp: 1500 }
  ]
};

// 新增：输入限制配置
const MAX_LIMITS = {
  roleCount: 18,      // 角色数量最大值
  baseExp: 9000,      // 角色数量经验最大值 (18 * 500)
  breakExp: 59850,    // 角色突破经验最大值
  originExp: 28500,   // 角色溯源经验最大值
  perLevelMax: 19     // 单个阶/溯层级的最大数量限制
};

// ==========================================
// 2. 算法核心 (反向推导分布)
// ==========================================
const solveDistribution = (targetCount, targetExp, levelsConfig) => {
  if (targetCount <= 0) return Array(levelsConfig.length).fill(0);

  // 修改逻辑：同时受限于 用户输入的总数量(targetCount) 和 单层级最大数量(19)
  // 虽然 roleCount 上限是 18，逻辑上 Math.min(18, 19) 会取 18，但保留配置灵活性
  const maxPerSlot = Math.min(targetCount, MAX_LIMITS.perLevelMax);

  const qualities = [
    { lv: 0, exp: 0, max: maxPerSlot }, 
    ...levelsConfig.map(l => ({ ...l, max: maxPerSlot }))
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
    let rem = targetCount; // 核心逻辑：确保所有层级加起来等于(或小于)总数量
    const indices = shuffle([...Array(qualities.length).keys()]);
    for (const i of indices) {
      const maxCanFill = Math.min(rem, qualities[i].max);
      let fill = 0;
      if (maxCanFill > 0) fill = randint(0, maxCanFill);
      counts[i] = fill;
      rem -= fill;
    }
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

      if (diff > 0) { 
        for (let i = 0; i < qualities.length; i++) {
          if (currentCounts[i] <= 0) continue;
          for (let j = i + 1; j < qualities.length; j++) {
            // 确保目标槽位没满才能移动
            if (currentCounts[j] >= qualities[j].max) continue;
            
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
             // 确保目标槽位没满才能移动
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
const activeMode = ref('numeric'); 

// 模式 A: 名册
const rosterData = reactive({});
const rosterUI = reactive({ '暗': false, '火': false, '水': false, '雷': false, '光': false, '风': false });

// 模式 B: 数值
const numericData = reactive({
  roleCount: 0,
  baseExp: 0,
  breakExp: 0,  
  originExp: 0, 
  
  // 推测结果
  breakCounts: [0, 0, 0, 0, 0, 0], 
  originCounts: [0, 0, 0, 0, 0, 0]
});

// 初始化名册
const initRoster = () => {
  for (const [element, names] of Object.entries(ROLES_DB)) {
    rosterData[element] = names.map(name => ({ name, owned: false, breakLv: 0, originLv: 0 }));
  }
};

// 输入清洗 (新增限制逻辑)
const sanitizeInput = (targetObj, key) => {
  let val = parseInt(targetObj[key]);
  if (isNaN(val) || val < 0) val = 0;

  // 1. 角色数量限制 Max 18
  if (key === 'roleCount' && val > MAX_LIMITS.roleCount) {
    val = MAX_LIMITS.roleCount;
  }
  // 2. 首次获得经验限制 Max 9000
  if (key === 'baseExp' && val > MAX_LIMITS.baseExp) {
    val = MAX_LIMITS.baseExp;
  }
  // 3. 突破经验限制 Max 59850
  if (key === 'breakExp' && val > MAX_LIMITS.breakExp) {
    val = MAX_LIMITS.breakExp;
  }
  // 4. 溯源经验限制 Max 28500
  if (key === 'originExp' && val > MAX_LIMITS.originExp) {
    val = MAX_LIMITS.originExp;
  }

  targetObj[key] = val;
};

// ==========================================
// 4. 业务逻辑 (Blur & Guess)
// ==========================================

// --- 失焦互转逻辑 (防止输入跳变) ---
const onCountBlur = () => {
  const correctExp = numericData.roleCount * CONFIG.base.exp;
  if (numericData.baseExp !== correctExp) {
    numericData.baseExp = correctExp;
  }
};

const onBaseExpBlur = () => {
  const correctCount = Math.floor(numericData.baseExp / CONFIG.base.exp);
  // 此时也需要检查反算出来的数量是否超限
  if (correctCount > MAX_LIMITS.roleCount) {
    numericData.roleCount = MAX_LIMITS.roleCount;
    numericData.baseExp = MAX_LIMITS.baseExp; // 修正回最大经验
  } else {
    if (numericData.roleCount !== correctCount) {
        numericData.roleCount = correctCount;
    }
  }
};

// --- 自动推导猜测 (监听总经验变化) ---
watch(() => [numericData.breakExp, numericData.roleCount], ([exp, count]) => {
  if (count > 0 && exp > 0) {
    numericData.breakCounts = solveDistribution(count, exp, CONFIG.break);
  } else {
    numericData.breakCounts = [0,0,0,0,0,0];
  }
});

watch(() => [numericData.originExp, numericData.roleCount], ([exp, count]) => {
  if (count > 0 && exp > 0) {
    numericData.originCounts = solveDistribution(count, exp, CONFIG.origin);
  } else {
    numericData.originCounts = [0,0,0,0,0,0];
  }
});

// --- 统计计算 ---
const rosterStats = computed(() => {
  let count = 0, baseE = 0, breakE = 0, originE = 0;
  for (const group of Object.values(rosterData)) {
    group.forEach(r => {
      if (r.owned) {
        count++;
        baseE += CONFIG.base.exp;
        if (r.breakLv > 0) breakE += CONFIG.break[r.breakLv-1].exp;
        if (r.originLv > 0) originE += CONFIG.origin[r.originLv-1].exp;
      }
    });
  }
  return { count, baseE, breakE, originE };
});

const numericStats = computed(() => {
  const count = numericData.roleCount;
  const baseE = numericData.baseExp;
  
  // 校验推导误差
  const breakReal = numericData.breakCounts.reduce((acc, c, i) => acc + c * CONFIG.break[i].exp, 0);
  const originReal = numericData.originCounts.reduce((acc, c, i) => acc + c * CONFIG.origin[i].exp, 0);
  
  return { 
    count, 
    baseE, 
    breakE: breakReal, 
    originE: originReal 
  };
});

const dashboard = computed(() => {
  const src = activeMode.value === 'roster' ? rosterStats.value : numericStats.value;
  // 数值模式下使用输入值(Inputs)作为总和，名册模式下使用计算值
  const currTotal = activeMode.value === 'roster' 
    ? (src.baseE + src.breakE + src.originE)
    : (numericData.baseExp + numericData.breakExp + numericData.originExp);
  
  let maxCount = 0;
  if (activeMode.value === 'roster') {
    for (const group of Object.values(ROLES_DB)) maxCount += group.length;
  } else {
    // 仪表盘的最大值逻辑：
    // 如果没有输入，默认为1防止除零；如果有输入，根据输入值显示进度（或者你可以设定为固定18）
    // 这里保持原来的逻辑：以当前输入值为基准显示填满程度，或者使用全局上限 MAX_LIMITS.roleCount
    // 为了让进度条好看，这里我们使用 MAX_LIMITS.roleCount (18) 作为分母
    maxCount = MAX_LIMITS.roleCount; 
  }
  
  const maxBase = maxCount * CONFIG.base.exp;
  const maxBreak = maxCount * CONFIG.break[5].exp; 
  const maxOrigin = maxCount * CONFIG.origin[5].exp; 
  const maxTotal = maxBase + maxBreak + maxOrigin;

  return {
    modeName: activeMode.value === 'roster' ? '角色勾选' : '数值输入',
    count: src.count,
    maxCount: maxCount,
    total: { curr: currTotal, max: maxTotal, pct: maxTotal ? (currTotal/maxTotal)*100 : 0 },
    base: { curr: src.baseE, max: maxBase, pct: maxBase ? (src.baseE/maxBase)*100 : 0 },
    break: { curr: src.breakE, max: maxBreak, pct: maxBreak ? (src.breakE/maxBreak)*100 : 0 },
    origin: { curr: src.originE, max: maxOrigin, pct: maxOrigin ? (src.originE/maxOrigin)*100 : 0 },
  };
});

// ==========================================
// 5. 存储
// ==========================================
const saveData = () => {
  const activeStats = activeMode.value === 'roster' ? rosterStats.value : numericStats.value;
  // 计算最终总经验
  const currentTotalExp = activeMode.value === 'roster'
    ? (activeStats.baseE + activeStats.breakE + activeStats.originE)
    : (numericData.baseExp + numericData.breakExp + numericData.originExp);

  updateModule('role', {
    activeMode: activeMode.value,
    roster: rosterData,
    numeric: numericData,
    summary: {
      total: { curr: currentTotalExp },
      detail: {
        count: activeStats.count,
        base: activeStats.baseE,
        break: activeStats.breakE,
        origin: activeStats.originE
      }
    }
  });
};

watch([activeMode, rosterData, numericData], () => saveData(), { deep: true });

onMounted(() => {
  initRoster();
  const saved = getModule('role');
  if (saved) {
    if (saved.activeMode) activeMode.value = saved.activeMode;
    if (saved.numeric) Object.assign(numericData, saved.numeric);
    if (saved.roster) {
      for (const ele in saved.roster) {
        if (rosterData[ele]) {
          saved.roster[ele].forEach((sRole, idx) => {
            if (rosterData[ele][idx] && rosterData[ele][idx].name === sRole.name) {
              Object.assign(rosterData[ele][idx], sRole);
            }
          });
        }
      }
    }
  }
});

const toggleRoster = (ele) => rosterUI[ele] = !rosterUI[ele];
</script>

<template>
  <div class="light-theme-container">
    
    <div class="dashboard-panel">
      <div class="mode-badge">当前模式: {{ dashboard.modeName }}</div>
      <div class="main-stat-card">
        <div class="stat-header">
          <span class="stat-title">角色培养总进度</span>
          <span class="stat-value">{{ dashboard.total.curr }} <small>/ {{ dashboard.total.max }}</small></span>
        </div>
        <div class="progress-track main-track">
          <div class="progress-bar main-bar" :style="{ width: dashboard.total.pct + '%' }"></div>
        </div>
      </div>
      <div class="sub-stats-grid">
        <div class="stat-card">
          <div class="card-label">首次获得 ({{ dashboard.count }})</div>
          <div class="card-num">{{ dashboard.base.curr }}</div>
          <div class="progress-track"><div class="progress-bar blue" :style="{ width: dashboard.base.pct + '%' }"></div></div>
        </div>
        <div class="stat-card">
          <div class="card-label">突破累计</div>
          <div class="card-num">{{ dashboard.break.curr }}</div>
          <div class="progress-track"><div class="progress-bar purple" :style="{ width: dashboard.break.pct + '%' }"></div></div>
        </div>
        <div class="stat-card">
          <div class="card-label">溯源累计</div>
          <div class="card-num">{{ dashboard.origin.curr }}</div>
          <div class="progress-track"><div class="progress-bar gold" :style="{ width: dashboard.origin.pct + '%' }"></div></div>
        </div>
      </div>
    </div>

    <div class="mode-switcher">
      <button class="mode-btn" :class="{ active: activeMode === 'numeric' }" @click="activeMode = 'numeric'">数值快速输入</button>
      <button class="mode-btn" :class="{ active: activeMode === 'roster' }" @click="activeMode = 'roster'">角色详细勾选</button>
    </div>

    <div v-show="activeMode === 'numeric'" class="mode-content fade-in">
      <div class="input-groups">
        
        <div class="group-panel compact-panel">
          <div class="compact-header"><span class="group-title">1. 基础数据 (自动互算)</span></div>
          <div class="compact-content">
            <div class="compact-grid-2">
              <div class="compact-item">
                <span class="item-label">角色数量</span>
                <input 
                  type="number" 
                  v-model.number="numericData.roleCount" 
                  @input="sanitizeInput(numericData, 'roleCount')" 
                  @blur="onCountBlur"
                  class="compact-input"
                >
              </div>
              <div class="compact-item">
                <span class="item-label">首获总经验</span>
                <input 
                  type="number" 
                  v-model.number="numericData.baseExp" 
                  @input="sanitizeInput(numericData, 'baseExp')" 
                  @blur="onBaseExpBlur"
                  class="compact-input"
                >
              </div>
            </div>
          </div>
        </div>

        <div class="group-panel compact-panel">
          <div class="compact-header">
            <span class="group-title">2. 突破数据</span>
            <div class="header-right">
              <span class="guess-tag">自动推导猜测</span>
            </div>
          </div>
          <div class="compact-content">
            <div class="input-row-lg">
              <label>角色突破总经验:</label>
              <input type="number" v-model.number="numericData.breakExp" @input="sanitizeInput(numericData, 'breakExp')" class="input-lg" placeholder="输入总经验">
            </div>
            
            <div class="guess-result-grid" v-if="numericData.breakExp > 0">
              <div v-for="(c, i) in numericData.breakCounts" :key="i" class="guess-item" :class="{ 'zero': c === 0 }">
                <span class="guess-lv">{{ i+1 }}阶</span>
                <span class="guess-count">{{ c }}</span>
              </div>
            </div>
            <div class="calc-diff" v-if="numericData.breakExp > 0">
              (误差: {{ numericData.breakExp - numericStats.breakE }})
            </div>
          </div>
        </div>

        <div class="group-panel compact-panel">
          <div class="compact-header">
            <span class="group-title">3. 溯源数据</span>
            <div class="header-right">
              <span class="guess-tag">自动推导猜测</span>
            </div>
          </div>
          <div class="compact-content">
            <div class="input-row-lg">
              <label>角色溯源总经验:</label>
              <input type="number" v-model.number="numericData.originExp" @input="sanitizeInput(numericData, 'originExp')" class="input-lg" placeholder="输入总经验">
            </div>
            
            <div class="guess-result-grid" v-if="numericData.originExp > 0">
              <div v-for="(c, i) in numericData.originCounts" :key="i" class="guess-item" :class="{ 'zero': c === 0 }">
                <span class="guess-lv">{{ i+1 }}溯</span>
                <span class="guess-count">{{ c }}</span>
              </div>
            </div>
            <div class="calc-diff" v-if="numericData.originExp > 0">
              (误差: {{ numericData.originExp - numericStats.originE }})
            </div>
          </div>
        </div>

      </div>
    </div>

    <div v-show="activeMode === 'roster'" class="mode-content fade-in">
       <div class="roster-list">
        <div v-for="(roles, element) in rosterData" :key="element" class="element-group">
          <div class="group-header" :class="{ 'active': rosterUI[element] }" @click="toggleRoster(element)">
            <div class="header-left">
              <span class="ele-indicator" :class="`bg-${element}`"></span>
              <span class="ele-name">{{ element }}系</span>
              <span class="ele-count-badge">{{ roles.filter(r=>r.owned).length }}/{{ roles.length }}</span>
            </div>
            <div class="header-arrow" :class="{ rotated: rosterUI[element] }">▼</div>
          </div>
          <div v-show="rosterUI[element]" class="cards-container">
            <div v-for="role in roles" :key="role.name" class="role-card" :class="{ 'is-owned': role.owned }">
              <div class="card-top">
                <label class="check-label">
                  <input type="checkbox" v-model="role.owned" class="hidden-checkbox">
                  <div class="custom-checkbox"><svg viewBox="0 0 24 24" class="check-icon"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
                  <span class="role-name">{{ role.name }}</span>
                </label>
              </div>
              <div class="card-actions" v-if="role.owned">
                <div class="select-wrapper">
                  <span class="mini-label">阶</span>
                  <select v-model.number="role.breakLv"><option :value="0">0</option><option v-for="c in CONFIG.break" :key="c.lv" :value="c.lv">{{ c.lv }}</option></select>
                </div>
                <div class="select-wrapper">
                  <span class="mini-label">溯</span>
                  <select v-model.number="role.originLv"><option :value="0">0</option><option v-for="c in CONFIG.origin" :key="c.lv" :value="c.lv">{{ c.lv }}</option></select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* 全局基础 */
.light-theme-container { font-family: "Inter", sans-serif; color: #333; padding-bottom: 50px; }
.fade-in { animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

/* 仪表盘 */
.dashboard-panel { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); margin-bottom: 20px; position: relative; overflow: hidden; }
.mode-badge { position: absolute; top: 0; right: 0; background: #f3f4f6; color: #6b7280; font-size: 11px; padding: 4px 10px; border-bottom-left-radius: 8px; font-weight: bold; }
.main-stat-card { margin-bottom: 20px; }
.stat-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
.stat-title { font-weight: 600; font-size: 16px; color: #1f2937; }
.stat-value { font-family: "JetBrains Mono", monospace; font-size: 24px; font-weight: 700; color: #111827; }
.stat-value small { font-size: 14px; color: #9ca3af; font-weight: 400; }
.progress-track { background: #eef2f7; height: 8px; border-radius: 4px; overflow: hidden; }
.main-track { height: 12px; }
.progress-bar { height: 100%; transition: width 0.4s ease; border-radius: 4px; }
.main-bar { background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%); }
.sub-stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.stat-card { background: #f8f9fa; padding: 12px; border-radius: 8px; border: 1px solid #e9ecef; }
.card-label { font-size: 12px; color: #666; margin-bottom: 5px; }
.card-num { font-family: "JetBrains Mono", monospace; font-size: 15px; font-weight: 600; }
.blue { background: #3498db; } .purple { background: #9b59b6; } .gold { background: #f1c40f; }

/* 模式切换 */
.mode-switcher { display: flex; background: #e5e7eb; padding: 4px; border-radius: 8px; margin-bottom: 16px; }
.mode-btn { flex: 1; border: none; background: transparent; padding: 10px; font-size: 14px; font-weight: 600; color: #6b7280; cursor: pointer; border-radius: 6px; transition: all 0.2s; }
.mode-btn.active { background: #fff; color: #3b82f6; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

/* --- 紧凑型数值输入样式 --- */
.compact-panel { background: #fff; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 12px; overflow: hidden; }
.compact-header { background: #f9fafb; padding: 8px 12px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; }
.group-title { font-weight: 600; font-size: 13px; color: #374151; }
.guess-tag { font-size: 10px; background: #e0e7ff; color: #4338ca; padding: 2px 6px; border-radius: 4px; }
.compact-content { padding: 12px; }

/* 两列大输入 */
.compact-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.compact-item { display: flex; align-items: center; background: #fdfdfd; border: 1px solid #eee; border-radius: 4px; padding: 6px 10px; }
.item-label { font-size: 12px; color: #6b7280; margin-right: 8px; white-space: nowrap; }
.compact-input { flex: 1; width: 100%; border: none; background: transparent; font-size: 14px; text-align: right; font-family: "JetBrains Mono"; outline: none; font-weight: 600; }

/* 单行大输入 */
.input-row-lg { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.input-row-lg label { font-size: 13px; font-weight: 500; color: #374151; }
.input-lg { flex: 1; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; text-align: right; font-family: "JetBrains Mono"; }
.input-lg:focus { border-color: #3b82f6; outline: none; background: #eff6ff; }

/* 猜测结果网格 */
.guess-result-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; background: #f3f4f6; padding: 6px; border-radius: 6px; }
.guess-item { display: flex; flex-direction: column; align-items: center; background: #fff; padding: 4px; border-radius: 4px; border: 1px solid #e5e7eb; }
.guess-item.zero { opacity: 0.4; }
.guess-lv { font-size: 10px; color: #9ca3af; margin-bottom: 2px; }
.guess-count { font-size: 13px; font-weight: bold; color: #111827; font-family: "JetBrains Mono"; }

.calc-diff { font-size: 11px; text-align: right; color: #9ca3af; margin-top: 6px; font-family: monospace; }

/* Roster 样式 (复用) */
.group-header { padding: 14px 16px; background: #fff; cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none; }
.group-header:hover { background: #f9fafb; }
.group-header.active { background: #f3f4f6; border-bottom: 1px solid #e5e7eb; }
.ele-name { font-weight: 600; font-size: 14px; }
.header-left { display: flex; align-items: center; gap: 10px; }
.ele-indicator { width: 8px; height: 8px; border-radius: 50%; }
.bg-火 { background: #e74c3c; } .bg-水 { background: #3498db; } .bg-雷 { background: #9b59b6; } .bg-风 { background: #2ecc71; } .bg-光 { background: #f1c40f; } .bg-暗 { background: #34495e; }
.element-group { background: #fff; border-radius: 8px; border: 1px solid #e5e7eb; overflow: hidden; margin-bottom: 12px; }
.cards-container { padding: 12px; display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
.role-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; }
.role-card.is-owned { border-color: #cbd5e0; box-shadow: 0 2px 6px rgba(0,0,0,0.03); background: #fff; }
.role-card:not(.is-owned) { opacity: 0.6; background: #fafafa; }
.card-top { display: flex; align-items: center; margin-bottom: 8px; }
.check-label { display: flex; align-items: center; cursor: pointer; width: 100%; }
.hidden-checkbox { display: none; }
.custom-checkbox { width: 16px; height: 16px; border: 2px solid #cbd5e0; border-radius: 4px; margin-right: 8px; display: flex; align-items: center; justify-content: center; }
.check-icon { width: 12px; height: 12px; stroke: white; stroke-width: 3; fill: none; opacity: 0; }
.hidden-checkbox:checked + .custom-checkbox { background: #3498db; border-color: #3498db; }
.hidden-checkbox:checked + .custom-checkbox .check-icon { opacity: 1; }
.role-name { font-size: 13px; font-weight: 600; }
.card-actions { display: flex; gap: 5px; flex-direction: column; }
.select-wrapper { display: flex; align-items: center; background: #f7fafc; padding: 2px 5px; border-radius: 4px; }
.mini-label { font-size: 10px; color: #a0aec0; margin-right: 4px; }
select { border: none; background: transparent; font-size: 12px; font-weight: bold; flex: 1; text-align: right; outline: none;}

@media (max-width: 600px) {
  .sub-stats-grid { grid-template-columns: 1fr; }
  .compact-grid-2 { grid-template-columns: 1fr; }
}
</style>