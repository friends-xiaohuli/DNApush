<template>
  <div class="mobile-container">
    <header class="header">
      <div class="header-left">
        <h2 class="app-title">DNA 监控助手</h2>
      </div>
      <div class="header-right">
        <div class="status-pill" :class="{ active: !loading }">
          <span class="dot"></span>
          {{ loading ? '更新中' : '在线' }}
        </div>
        <button class="refresh-btn" @click="handleRefresh" :disabled="loading || remainingTime > 0">
          <span v-if="remainingTime > 0" class="timer-text">{{ remainingTime }}s</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ spinning: loading }">
            <path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
        </button>
      </div>
    </header>

    <div class="global-status-bar" v-if="currentStatus">
      <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
      <span>数据更新于: {{ formatTime(currentStatus.updated) }}</span>
    </div>

    <main class="main-content">
      <div v-if="error" class="error-banner">{{ error }}</div>

      <section class="section-card refresh-card">
        <div class="card-header">
          <div class="header-title-row">
            <span class="icon-box bg-gradient-purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </span>
            <h3 class="section-title">魔灵刷新预测</h3>
          </div>
        </div>
        
        <div class="card-body" v-if="currentStatus">
          <div class="time-prediction-row">
            <div class="time-box">
              <div class="time-label">最近刷新</div>
              <div class="time-value">{{ currentStatus.start_time }}</div>
              <div class="time-sub">周期ID: {{ currentStatus.id }}</div>
            </div>
            
            <div class="time-arrow">
              <span class="cycle-badge">72h</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </div>

            <div class="time-box highlight">
              <div class="time-label">预计下次刷新</div>
              <div class="time-value bold">{{ currentStatus.end_time }}</div>
            </div>
          </div>
        </div>
        <div class="card-body" v-else-if="loading">
          <div class="skeleton-row"></div>
        </div>
      </section>

      <section class="section-card instance-card">
        <div class="card-header">
          <div class="header-title-row">
            <span class="icon-box bg-gradient-blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            </span>
            <h3 class="section-title">委托密函</h3>
          </div>
          <span class="badge-count" v-if="instanceGroups.length">共 {{ totalInstanceCount }} 个区域</span>
        </div>

        <div class="card-body no-padding">
          <div v-if="loading && !instanceGroups.length" class="skeleton-list">
            <div class="skeleton-row" v-for="n in 2" :key="n"></div>
          </div>

          <div 
            v-for="(group, gIndex) in instanceGroups" 
            :key="gIndex" 
            class="group-block"
          >
            <div class="group-label">{{ getGroupName(gIndex) }}</div>
            
            <div class="instance-list">
              <div 
                v-for="inst in group.instances" 
                :key="inst.id" 
                class="instance-item"
                :class="getColorTheme(inst.name)"
              >
                <div class="inst-icon">
                  <span class="icon-char">{{ inst.name.charAt(0) }}</span>
                </div>
                
                <div class="inst-info">
                  <div class="inst-name">{{ inst.name }}</div>
                  <div class="inst-id">ID: {{ inst.id }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
        <div class="info-row">
            <span class="label">· 数据来源：</span>
            <span class="value">@gamekee</span>
        </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

// --- 数据状态 ---
const currentStatus = ref(null);
const instanceGroups = ref([]);
const loading = ref(false);
const error = ref('');
const remainingTime = ref(0);
let timerInterval = null;

const CACHE_KEY = 'DNA_MONITOR_CACHE_V2';
const CACHE_DURATION = 60 * 1000; // 60秒冷却

// --- 分组名称定义 ---
const GROUP_NAMES = ['角色', '武器', '魔之楔'];
const getGroupName = (index) => {
  return GROUP_NAMES[index] || `区域 ${index + 1}`;
};

// --- 计算属性 ---
const totalInstanceCount = computed(() => {
  if (!instanceGroups.value) return 0;
  return instanceGroups.value.reduce((acc, group) => acc + (group.instances ? group.instances.length : 0), 0);
});

// --- 生命周期 ---
onMounted(() => {
  // 1. 页面初始化：强制刷新一次 (获取最新数据)
  // 如果你希望 F5 刷新也保持冷却，把 true 改为 false
  loadData(true); 

  // 2. 添加监听器：处理切屏、切后台、失焦后返回
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleWindowFocus);
});

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
  // 移除监听器，防止内存泄漏
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('focus', handleWindowFocus);
});

// --- 核心：智能刷新逻辑 ---
// 场景：手机切后台回来、浏览器切标签回来
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    trySmartRefresh();
  }
};

// 场景：电脑窗口失焦(点其他软件)后点回来
const handleWindowFocus = () => {
  trySmartRefresh();
};

// 尝试刷新：仅在冷却结束后才发起请求
const trySmartRefresh = () => {
  // 如果正在加载，或者还在冷却倒计时中，不进行请求
  if (loading.value || remainingTime.value > 0) {
    // 这里可以加一个逻辑：虽然不请求，但校验一下本地倒计时是否准确
    // (例如用户切走很久，回来时倒计时早该结束了)
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      const passed = Date.now() - parsed.timestamp;
      // 如果实际时间已经超过了冷却时间，强制刷新
      if (passed >= CACHE_DURATION) {
        loadData(true);
      }
    }
    return; 
  }
  // 冷却已结束，发起刷新
  loadData(true);
};

// --- 数据加载 ---
const loadData = async (forceRefresh = false) => {
  const cached = localStorage.getItem(CACHE_KEY);
  const now = Date.now();

  // 如果不是强制刷新，且有缓存，且缓存未过期 -> 使用缓存
  if (cached && !forceRefresh) {
    try {
      const parsed = JSON.parse(cached);
      // 检查缓存是否在有效期内
      if (now - parsed.timestamp < CACHE_DURATION) {
        currentStatus.value = parsed.currentStatus;
        instanceGroups.value = parsed.instanceGroups;
        // 恢复倒计时
        startCooldown(parsed.timestamp);
        return;
      }
    } catch (e) {
      // 缓存解析失败，继续执行 fetchData
    }
  }
  
  // 否则 -> 发起网络请求
  await fetchData();
};

const fetchData = async () => {
  loading.value = true;
  error.value = '';
  
  try {
    const response = await fetch('/api/gamekee');
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || '请求失败');
    }

    const { statusResult, infoResult } = result;

    if (statusResult.code !== 0 || infoResult.code !== 0) throw new Error('接口数据异常');

    // 使用本地时间修正 updated 字段
    statusResult.data.updated = Math.floor(Date.now() / 1000);

    currentStatus.value = statusResult.data;
    instanceGroups.value = infoResult.data;

    // 存入缓存并开始冷却
    const timestamp = Date.now();
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp,
      currentStatus: currentStatus.value,
      instanceGroups: instanceGroups.value
    }));
    startCooldown(timestamp);

  } catch (err) {
    console.error(err);
    error.value = '数据更新失败';
  } finally {
    loading.value = false;
  }
};

const handleRefresh = () => {
  // 手动点击按钮，必须等待冷却结束
  if (remainingTime.value > 0) return;
  loadData(true);
};

const startCooldown = (ts) => {
  if (timerInterval) clearInterval(timerInterval);
  
  const update = () => {
    const passed = Date.now() - ts;
    const left = Math.ceil((CACHE_DURATION - passed) / 1000);
    
    if (left <= 0) {
      remainingTime.value = 0;
      clearInterval(timerInterval);
    } else {
      remainingTime.value = left;
    }
  };
  
  update(); // 立即执行一次
  timerInterval = setInterval(update, 1000);
};

// --- 样式匹配逻辑 ---
const matchType = (name, keywords) => keywords.some(k => name.includes(k));

const getColorTheme = (name) => {
  if (matchType(name, ['无尽', '探险'])) return 'theme-blue';    
  if (matchType(name, ['护送'])) return 'theme-green';          
  if (matchType(name, ['避险','迁移'])) return 'theme-cyan';           
  if (matchType(name, ['调停'])) return 'theme-orange';         
  if (matchType(name, ['驱离'])) return 'theme-red';            
  if (matchType(name, ['驱逐'])) return 'theme-purple';    
  if (matchType(name, ['追缉'])) return 'theme-pink';
  if (matchType(name, ['拆解'])) return 'theme-gold';
  return 'theme-gray';                                  
};

// --- 时间格式化 ---
const formatTime = (ts) => {
  if (!ts) return '--';
  const d = new Date(ts * 1000);
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const h = d.getHours().toString().padStart(2, '0');
  const min = d.getMinutes().toString().padStart(2, '0');
  return `${m}/${day} ${h}:${min}`;
};
</script>

<style scoped>
/* --- 1. 多彩浅色系变量定义 --- */
.theme-blue { --bg: #e6f7ff; --border: #91d5ff; --text: #0050b3; --icon-bg: #40a9ff; }
.theme-green { --bg: #f6ffed; --border: #b7eb8f; --text: #389e0d; --icon-bg: #73d13d; }
.theme-cyan { --bg: #e6fffb; --border: #87e8de; --text: #006d75; --icon-bg: #36cfc9; }
.theme-orange { --bg: #fff7e6; --border: #ffd591; --text: #d46b08; --icon-bg: #fa8c16; }
.theme-red { --bg: #fff1f0; --border: #ffa39e; --text: #cf1322; --icon-bg: #ff4d4f; }
.theme-purple { --bg: #f9f0ff; --border: #d3adf7; --text: #531dab; --icon-bg: #9254de; }
.theme-gray { --bg: #f5f5f5; --border: #d9d9d9; --text: #595959; --icon-bg: #8c8c8c; }
.theme-pink { --bg: #fff0f6; --border: #ffadd2; --text: #c41d7f; --icon-bg: #eb2f96; }
.theme-gold { --bg: #fffbe6; --border: #ffe58f; --text: #d48806; --icon-bg: #faad14; }


.mobile-container {
  max-width: 100%;
  min-height: 100vh;
  background-color: #f7f8fa;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
  padding-bottom: 24px;
}

/* 顶部导航 */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #eee;
  position: sticky;
  top: 0;
  z-index: 100;
}
.app-title { margin: 0; font-size: 17px; font-weight: 700; color: #1f1f1f; }

/* 修改点：Header 右侧布局 */
.header-right {
  display: flex;
  align-items: center;
  gap: 8px; /* 元素间距 */
}

/* 修改点：在线状态胶囊样式 */
.status-pill {
  font-size: 11px;
  padding: 4px 8px;
  background: #f0f0f0;
  color: #999;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.status-pill.active {
  background: #e6fffb;
  color: #006d75;
  border: 1px solid #87e8de;
}
.status-pill .dot {
  width: 6px; height: 6px; border-radius: 50%; background: #ccc;
}
.status-pill.active .dot { background: #36cfc9; }

/* 修改点：优化后的刷新按钮 */
.refresh-btn {
  background: #fff;
  border: 1px solid #e0e0e0;
  padding: 4px 8px;
  border-radius: 20px;
  cursor: pointer;
  color: #333;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 26px; /* 固定高度确保对齐 */
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}
.refresh-btn:active:not(:disabled) {
  transform: scale(0.95);
  background: #f5f5f5;
}
.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: #f9f9f9;
}
.refresh-btn svg { width: 16px; height: 16px; }
.timer-text { font-size: 12px; color: #1890ff; font-weight: 600; min-width: 20px; text-align: center; }
.spinning { animation: spin 1s linear infinite; }

/* 全局状态条 (更新时间) */
.global-status-bar {
  background: #fffbe6;
  border-bottom: 1px solid #ffe58f;
  color: #faad14;
  font-size: 12px;
  padding: 6px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.info-icon { width: 14px; height: 14px; }

/* 主内容 */
.main-content { padding: 16px; }

.section-card {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.03);
  margin-bottom: 16px;
  overflow: hidden;
}

.card-header {
  padding: 14px 16px;
  border-bottom: 1px solid #f7f7f7;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-title-row { display: flex; align-items: center; gap: 10px; }
.section-title { margin: 0; font-size: 15px; font-weight: 700; color: #333; }
.badge-count { font-size: 11px; color: #999; background: #f5f5f5; padding: 2px 8px; border-radius: 10px; }

.icon-box {
  width: 28px; height: 28px; border-radius: 8px; display: flex;
  align-items: center; justify-content: center; color: #fff;
}
.icon-box svg { width: 16px; height: 16px; }
.bg-gradient-purple { background: linear-gradient(135deg, #9254de, #b37feb); }
.bg-gradient-blue { background: linear-gradient(135deg, #1890ff, #69c0ff); }

.card-body { padding: 16px; }
.card-body.no-padding { padding: 0; }

/* 预测时间样式 (左右布局+箭头) */
.time-prediction-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.time-box {
  flex: 1;
  display: flex; flex-direction: column; align-items: center; text-align: center;
}
.time-label { font-size: 11px; color: #999; margin-bottom: 4px; }
.time-value { font-size: 15px; font-weight: 600; color: #333; }
.time-value.bold { font-size: 16px; color: #722ed1; }
.time-sub { font-size: 10px; color: #bbb; margin-top: 2px; }

.time-arrow {
  display: flex; flex-direction: column; align-items: center;
  color: #d9d9d9; margin: 0 8px;
}
.time-arrow svg { width: 20px; height: 20px; }
.cycle-badge {
  font-size: 9px; background: #f0f0f0; color: #999;
  padding: 1px 4px; border-radius: 4px; margin-bottom: 2px;
}

/* 副本列表样式 */
.group-block {
  padding: 12px 16px;
  border-bottom: 1px dashed #f0f0f0;
}
.group-block:last-child { border-bottom: none; }
.group-label {
  font-size: 12px; color: #999; margin-bottom: 10px; font-weight: 600;
  display: flex; align-items: center;
}
.group-label::before {
  content: ''; display: inline-block; width: 3px; height: 10px;
  background: #d9d9d9; margin-right: 6px; border-radius: 2px;
}

.instance-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.instance-item {
  width: calc(50% - 5px); /* 一行两个 */
  display: flex;
  align-items: center;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  box-sizing: border-box;
  transition: transform 0.1s;
}
.instance-item:active { transform: scale(0.98); }

.inst-icon {
  width: 32px; height: 32px;
  border-radius: 8px;
  background: #fff;
  display: flex; align-items: center; justify-content: center;
  margin-right: 10px;
  color: var(--icon-bg);
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}
.icon-char { font-size: 14px; font-weight: 800; }

.inst-info { overflow: hidden; display: flex; flex-direction: column; }
.inst-name { font-size: 13px; font-weight: 700; color: var(--text); white-space: nowrap; }
.inst-id { font-size: 10px; color: #999; margin-top: 2px; }

/* 错误与骨架屏 */
.error-banner { background: #fff1f0; color: #f5222d; padding: 12px; font-size: 12px; text-align: center; margin-bottom: 16px; border-radius: 8px; }
.skeleton-row { height: 60px; background: #f5f5f5; margin-bottom: 10px; border-radius: 8px; animation: pulse 1.5s infinite; }
@keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 0.4; } 100% { opacity: 0.6; } }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.info-row {
  justify-content: auto;
  flex-direction: column;
  align-items:end;
  font-size: 10px;
  color: #444;
}
.info-row .label {
  color: #666;
}
.info-row .value {
  font-weight: bold;
  color: #333;
}
</style>