/**
 * DNA UserData Manager
 * 核心策略：
 * 1. 独立存储优先 (Source of Truth)：每个模块有自己的 localStorage key (如 exp_calc_userdata)。
 * 2. 主键聚合备份 (One-way Sync)：所有模块数据会自动同步到 dna_userdata 用于整体备份/导出。
 * 3. 读写分离：读取时优先读独立 Key，写入时双写 (独立 Key + 主 Key)。
 */

// 1. 配置主键 (Master Key)
const MASTER_KEY = 'dna_userdata';

// 2. 配置模块键名映射 (Module Map)
// key: 模块名称 (在代码中调用的名字，也会作为 dna_userdata 里的子字段名)
// value: 独立存储的 localStorage 键名
const MODULE_KEYS = {
  // --- 业务数据 ---
  exp_calc:   'exp_calc_userdata',   // [新增] 专门存储等级、经验、目标等级
  wedge_calc: 'wedge_calc_userdata', // 魔之楔相关 (数量、配置等)
  role:       'role_userdata',       // 角色数据
  weapon:     'weapon_userdata',     // 武器数据
  Spirit:     'Spirit_userdata',     // 魔灵数据
  other:      'other_userdata'       // 其他通用数据
};

// --- 内部辅助函数 (Private Helpers) ---

// 安全读取 JSON
function _read(key) {
  const str = localStorage.getItem(key);
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch (e) {
    console.error(`[UserData] Error parsing ${key}:`, e);
    return null;
  }
}

// 安全写入 JSON
function _write(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`[UserData] Error writing ${key}:`, e);
  }
}

// 读取主数据 (Master)
function _getMaster() {
  return _read(MASTER_KEY) || {};
}

// --- 核心导出 API (Public API) ---

/**
 * 核心：更新指定模块的数据
 * 流程：
 * 1. 找到该模块对应的独立 Key。
 * 2. 写入独立 Key (完全覆盖该模块旧数据)。
 * 3. 读取 Master 数据，更新对应的模块字段，并更新时间戳。
 * 4. 写入 Master Key。
 * * @param {('exp_calc'|'wedge_calc'|'role'|'weapon'|'Spirit'|'other')} moduleName 
 * @param {Object} data - 该模块的数据对象
 */
export const updateModule = (moduleName, data) => {
  // 1. 校验模块名
  const individualKey = MODULE_KEYS[moduleName];
  if (!individualKey) {
    console.warn(`[UserData] Unknown module: ${moduleName}`);
    return;
  }

  // 2. 【独立存储】写入独立的 UserData Key
  // 例如：写入 'exp_calc_userdata'
  _write(individualKey, data);

  // 3. 【聚合存储】写入 Master Key
  // 仅单向覆盖 dna_userdata 下的对应字段，不会反向读取
  const masterData = _getMaster();
  masterData[moduleName] = data; 
  masterData.updatedAt = Date.now(); // 更新总时间戳
  
  _write(MASTER_KEY, masterData);
};

/**
 * 核心：获取指定模块的数据
 * 流程：
 * 1. 优先读取独立 Key (这是最新、最准确的数据)。
 * 2. 如果独立 Key 不存在 (如清了缓存或首次迁移)，尝试从 Master Key 读取。
 * * @param {string} moduleName 
 * @returns {Object|null}
 */
export const getModule = (moduleName) => {
  const individualKey = MODULE_KEYS[moduleName];
  if (!individualKey) return null;

  // 1. 优先：读取独立 Key
  const individualData = _read(individualKey);
  if (individualData) {
    return individualData;
  }

  // 2. 兜底：尝试从 Master 恢复
  const masterData = _getMaster();
  return masterData[moduleName] || null;
};

/**
 * 获取 UI 状态
 * UI 状态不属于业务数据，直接存放在 Master 的 uiState 字段下
 */
export const getUiState = () => {
  const masterData = _getMaster();
  return masterData.uiState || {};
};

/**
 * 更新 UI 状态
 * 支持部分更新 (浅合并)
 * @param {Object} newState - 例如 { expCalc_isInputExpanded: true }
 */
export const updateUiState = (newState) => {
  const masterData = _getMaster();
  
  // 合并 UI 状态
  masterData.uiState = {
    ...(masterData.uiState || {}),
    ...newState
  };
  masterData.updatedAt = Date.now();

  _write(MASTER_KEY, masterData);
};

/**
 * 工具：导出所有数据 (用于备份)
 */
export const exportAllData = () => {
  return _getMaster();
};

/**
 * 工具：清除所有相关缓存 (危险操作)
 */
export const clearAllCache = () => {
  // 1. 清除 Master
  localStorage.removeItem(MASTER_KEY);
  // 2. 遍历清除所有独立模块
  Object.values(MODULE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
  console.log('[UserData] All cache cleared.');
};