<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
// 引入你的数据管理工具
import { updateModule, getModule } from '../utils/userData';

// --- 1. 静态数据配置 ---
// 假设这里配置了 24 个角色以匹配你的目标数值
const ROLES_DB = {
  '暗': ['幻景', '贝蕾妮卡'],
  '火': ['海尔法', '耶尔与奥利弗', '希尔妲', '琳恩', '玛尔洁'],
  '水': ['扶疏', '丽蓓卡', '塔比瑟', '水系角色A'], // 补齐示例
  '雷': ['止流', '煜明', '黎瑟', '兰迪', '西比尔'],
  '光': ['刻舟', '莉兹贝尔', '妮弗尔夫人', '狩月人', '菲娜'],
  '风': ['松露与榛子', '奥特赛德', '赛琪', '达芙涅']
};
// 注意：如果实际名字列表不够24个，分母会自动变小，建议自行补全 ROLES_DB

const EXP_CONFIG = {
  base: 500, // 首次获得
  // 0-6 阶数值 (最大 3150)
  break: [0, 50, 150, 350, 750, 1550, 3150], 
  // 0-6 溯数值 (最大 1500)
  origin: [0, 250, 500, 750, 1000, 1250, 1500] 
};

// --- 2. 状态管理 ---
const activeElements = reactive({
  '暗': false, '火': false, '水': false, '雷': false, '光': false, '风': false
});

const roleData = reactive({});

// 初始化数据结构
const initData = () => {
  for (const [element, names] of Object.entries(ROLES_DB)) {
    roleData[element] = names.map(name => ({
      name,
      owned: false,
      breakLv: 0,
      originLv: 0
    }));
  }
};

// --- 3. 核心计算 ---
const totalRolesCount = computed(() => {
  let count = 0;
  for (const group of Object.values(ROLES_DB)) count += group.length;
  return count;
});

const stats = computed(() => {
  let ownedCount = 0;
  let currentBaseExp = 0;
  let currentBreakExp = 0;
  let currentOriginExp = 0;

  for (const element in roleData) {
    roleData[element].forEach(role => {
      if (role.owned) {
        ownedCount++;
        currentBaseExp += EXP_CONFIG.base;
        currentBreakExp += EXP_CONFIG.break[role.breakLv];
        currentOriginExp += EXP_CONFIG.origin[role.originLv];
      }
    });
  }

  // 动态计算分母 (根据实际配置的角色数量)
  const maxBaseExp = totalRolesCount.value * EXP_CONFIG.base;
  const maxBreakExp = totalRolesCount.value * EXP_CONFIG.break[6];
  const maxOriginExp = totalRolesCount.value * EXP_CONFIG.origin[6];
  
  const totalCurrent = currentBaseExp + currentBreakExp + currentOriginExp;
  const totalMax = maxBaseExp + maxBreakExp + maxOriginExp;

  return {
    ownedCount,
    totalRoles: totalRolesCount.value,
    base: { curr: currentBaseExp, max: maxBaseExp },
    break: { curr: currentBreakExp, max: maxBreakExp },
    origin: { curr: currentOriginExp, max: maxOriginExp },
    total: { curr: totalCurrent, max: totalMax }
  };
});

const getRoleExp = (role) => {
  if (!role.owned) return 0;
  return EXP_CONFIG.base + EXP_CONFIG.break[role.breakLv] + EXP_CONFIG.origin[role.originLv];
};

// --- 4. 存储逻辑 (适配 dna_userdata.js) ---

// 监听变化并自动保存
watch(roleData, () => {
  saveToStorage();
}, { deep: true });

const saveToStorage = () => {
  // 根据规则，写入 'role' 模块
  updateModule('role', {
    detail: roleData,   // 详细列表数据
    summary: stats.value // 统计摘要 (可选，方便外部直接读)
  });
};

const loadFromStorage = () => {
  // 根据规则，读取 'role' 模块
  const saved = getModule('role');
  
  if (saved && saved.detail) {
    // 恢复数据 (保留响应式结构)
    for (const ele in saved.detail) {
      if (roleData[ele]) {
        saved.detail[ele].forEach((savedRole, idx) => {
           // 名字匹配校验，防止配置修改导致错位
           if (roleData[ele][idx] && roleData[ele][idx].name === savedRole.name) {
             roleData[ele][idx].owned = savedRole.owned;
             roleData[ele][idx].breakLv = savedRole.breakLv;
             roleData[ele][idx].originLv = savedRole.originLv;
           }
        });
      }
    }
  }
};

onMounted(() => {
  initData();
  loadFromStorage();
});

const toggleElement = (ele) => activeElements[ele] = !activeElements[ele];
</script>

<template>
  <div class="light-theme-container">
    
    <div class="dashboard-panel">
      <div class="main-stat-card">
        <div class="stat-header">
          <span class="stat-title">角色培养总进度</span>
          <span class="stat-value">{{ stats.total.curr }} <small>/ {{ stats.total.max }}</small></span>
        </div>
        <div class="progress-track main-track">
          <div class="progress-bar main-bar" :style="{ width: (stats.total.curr / stats.total.max * 100) + '%' }"></div>
        </div>
      </div>

      <div class="sub-stats-grid">
        <div class="stat-card">
          <div class="card-label">
            首次获得 
            <span class="badge">{{ stats.ownedCount }}/{{ stats.totalRoles }}</span>
          </div>
          <div class="card-num">{{ stats.base.curr }} <span class="dim">/ {{ stats.base.max }}</span></div>
          <div class="progress-track">
            <div class="progress-bar blue" :style="{ width: (stats.base.curr / stats.base.max * 100) + '%' }"></div>
          </div>
        </div>

        <div class="stat-card">
          <div class="card-label">角色突破</div>
          <div class="card-num">{{ stats.break.curr }} <span class="dim">/ {{ stats.break.max }}</span></div>
          <div class="progress-track">
            <div class="progress-bar purple" :style="{ width: (stats.break.curr / stats.break.max * 100) + '%' }"></div>
          </div>
        </div>

        <div class="stat-card">
          <div class="card-label">角色溯源</div>
          <div class="card-num">{{ stats.origin.curr }} <span class="dim">/ {{ stats.origin.max }}</span></div>
          <div class="progress-track">
            <div class="progress-bar gold" :style="{ width: (stats.origin.curr / stats.origin.max * 100) + '%' }"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="roster-list">
      <div v-for="(roles, element) in roleData" :key="element" class="element-group">
        
        <div 
          class="group-header" 
          :class="{ 'active': activeElements[element] }"
          @click="toggleElement(element)"
        >
          <div class="header-left">
            <span class="ele-indicator" :class="`bg-${element}`"></span>
            <span class="ele-name">{{ element }}系</span>
            <span class="ele-count-badge">{{ roles.filter(r=>r.owned).length }}/{{ roles.length }}</span>
          </div>
          <div class="header-arrow" :class="{ rotated: activeElements[element] }">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
        </div>

        <div v-show="activeElements[element]" class="cards-container">
          <div 
            v-for="role in roles" 
            :key="role.name" 
            class="role-card"
            :class="{ 'is-owned': role.owned }"
          >
            <div class="card-top">
              <label class="check-label">
                <input type="checkbox" v-model="role.owned" class="hidden-checkbox">
                <div class="custom-checkbox">
                  <svg viewBox="0 0 24 24" class="check-icon"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <span class="role-name">{{ role.name }}</span>
              </label>
              <div class="role-exp-tag" v-if="role.owned">{{ getRoleExp(role) }} exp</div>
            </div>

            <div class="card-actions" v-if="role.owned">
              <div class="select-wrapper">
                <span class="mini-label">突破</span>
                <select v-model.number="role.breakLv">
                  <option v-for="n in 7" :key="n" :value="n-1">{{ n-1 }}阶</option>
                </select>
              </div>
              <div class="select-wrapper">
                <span class="mini-label">溯源</span>
                <select v-model.number="role.originLv">
                  <option v-for="n in 7" :key="n" :value="n-1">{{ n-1 }}溯</option>
                </select>
              </div>
            </div>
            
            <div class="card-actions disabled" v-else>
              <span class="text-placeholder">未获得角色</span>
            </div>
          </div>
        </div>

      </div>
    </div>

  </div>
</template>

<style scoped>
/* --- 全局容器：亮色系 --- */
.light-theme-container {
  font-family:
    "Inter",
    "Noto Sans SC",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
  letter-spacing: 0.1px;
}


/* --- 1. 仪表盘样式 --- */
.dashboard-panel {
  background: #ffffff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); /* 柔和阴影 */
  margin-bottom: 24px;
}

/* 总进度条区域 */
.main-stat-card {
  margin-bottom: 24px;
}
.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
}
.stat-title {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: #1f2937;
}

.stat-value {
  font-family: "JetBrains Mono", monospace;
  font-size: 26px;
  font-weight: 600;
  color: #111827;
}
.stat-value small {
  font-size: 13px;
  font-weight: 400;
  color: #9ca3af;
}

.progress-track {
  background-color: #eef2f7;
  border-radius: 6px;
  height: 8px;
  overflow: hidden;
}
.main-track { height: 12px; }
.progress-bar {
  height: 100%;
  border-radius: 6px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
.main-bar { background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%); }

/* 子统计网格 */
.sub-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.stat-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #e9ecef;
}
.card-label {
  font-size: 12px;
  color: #666;
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}
.badge {
  background: #e2e6ea;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 11px;
}
.card-num {
  font-family: "JetBrains Mono", monospace;
  font-size: 15px;
  font-weight: 500;
}

.dim { color: #adb5bd; font-size: 12px; font-weight: 400; }

/* 进度条颜色 */
.blue { background-color: #3498db; }
.purple { background-color: #9b59b6; }
.gold { background-color: #f1c40f; }

/* --- 2. 列表样式 --- */
.roster-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.element-group {
  background: #ffffff;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
  border: 1px solid #eaeaea;
  overflow: hidden;
}

/* 分组标题 */
.group-header {
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: background 0.2s;
  user-select: none;
}
.group-header:hover { background-color: #fcfcfc; }
.group-header.active { background-color: #f8f9fa; border-bottom: 1px solid #f0f0f0; }

.header-left { display: flex; align-items: center; gap: 10px; }
.ele-indicator {
  width: 8px; height: 8px; border-radius: 50%;
}
/* 元素颜色 */
.bg-火 { background: #e74c3c; box-shadow: 0 0 6px rgba(231, 76, 60, 0.4); }
.bg-水 { background: #3498db; box-shadow: 0 0 6px rgba(52, 152, 219, 0.4); }
.bg-雷 { background: #9b59b6; box-shadow: 0 0 6px rgba(155, 89, 182, 0.4); }
.bg-风 { background: #2ecc71; box-shadow: 0 0 6px rgba(46, 204, 113, 0.4); }
.bg-光 { background: #f1c40f; box-shadow: 0 0 6px rgba(241, 196, 15, 0.4); }
.bg-暗 { background: #34495e; box-shadow: 0 0 6px rgba(52, 73, 94, 0.4); }

.ele-name { font-weight: 600; font-size: 15px; }
.ele-count-badge {
  background: #edf2f7; color: #718096;
  font-size: 11px; padding: 2px 6px; border-radius: 4px;
}
.header-arrow { color: #cbd5e0; transition: transform 0.3s; }
.header-arrow.rotated { transform: rotate(180deg); }

/* 卡片网格 */
.cards-container {
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
  background-color: #fff;
}

.role-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  transition: all 0.2s;
  background: #ffffff;
}
.role-card.is-owned {
  border-color: #cbd5e0;
  box-shadow: 0 2px 6px rgba(0,0,0,0.03);
}
.role-card:not(.is-owned) {
  opacity: 0.55;
  filter: grayscale(0.15);
}


.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

/* 自定义复选框 (亮色版) */
.check-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
}
.hidden-checkbox { display: none; }
.custom-checkbox {
  width: 18px; height: 18px;
  border: 2px solid #cbd5e0;
  border-radius: 4px;
  margin-right: 8px;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
}
.check-icon {
  width: 14px; height: 14px;
  stroke: white; stroke-width: 3; fill: none;
  opacity: 0; transition: opacity 0.1s;
}
/* 选中状态 */
.hidden-checkbox:checked + .custom-checkbox {
  background-color: #3498db;
  border-color: #3498db;
}
.hidden-checkbox:checked + .custom-checkbox .check-icon { opacity: 1; }

.role-name {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: #1f2937;
}

.role-exp-tag {
  font-family: "JetBrains Mono";
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(52, 152, 219, 0.1);
  color: #2563eb;
}


/* 底部操作区 */
.card-actions {
  display: flex; gap: 8px;
}
.card-actions.disabled { justify-content: center; }
.text-placeholder { font-size: 12px; color: #cbd5e0; font-style: italic; }

.select-wrapper {
  flex: 1;
  background: #f7fafc;
  border: 1px solid #edf2f7;
  border-radius: 6px;
  padding: 4px 8px;
  display: flex; align-items: center;
}
.mini-label { font-size: 10px; color: #a0aec0; margin-right: 4px; font-weight: bold; }

select {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 13px;
  color: #4a5568;
  font-weight: 600;
  outline: none;
  cursor: pointer;
  text-align: right;
  appearance: none; /* 移除默认箭头，为了更整洁，或者保留也可 */
}

.dashboard-panel,
.element-group,
.role-card {
  transition: box-shadow 0.25s ease, transform 0.2s ease;
}

.role-card.is-owned:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(0,0,0,0.06);
}


/* 移动端适配 */
@media (max-width: 600px) {
  .sub-stats-grid { grid-template-columns: 1fr; }
  .cards-container { grid-template-columns: 1fr; }
  .dashboard-panel { padding: 16px; }
}
</style>