<template>
  <div class="container">
    <div class="card">
      <h3>数据备份 / JSON 接口</h3>
      <p class="desc">在此处导出当前配置，或导入已有配置。</p>
      
      <textarea 
        v-model="jsonString" 
        rows="6" 
        placeholder='在此处粘贴 JSON 配置...'
      ></textarea>
      
      <div class="btn-group">
        <button @click="importJson" class="btn primary">导入 JSON</button>
        <button @click="exportJson" class="btn outline">复制导出 JSON</button>
      </div>
    </div>

    <div class="card danger-zone">
      <h3>危险区域</h3>
      <p class="desc">清除所有本地缓存的数据（包括等级计算器、魔之楔等所有模块）。</p>
      <button @click="handleClearCache" class="btn danger">一键删除用户缓存</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
// 引入工具函数
import { exportAllData, clearAllCache, updateModule, updateUiState } from '../utils/userData';

const jsonString = ref('');

// 定义需要识别的业务模块列表 (与 userData.js 保持一致)
const KNOWN_MODULES = ['exp_calc', 'wedge_calc', 'role', 'weapon', 'Spirit', 'other'];

// 导出：从工具获取完整聚合数据
const exportJson = () => {
  // exportAllData 会返回 dna_userdata 的完整内容
  const data = exportAllData();
  
  if (data && Object.keys(data).length > 0) {
    // 格式化 JSON，缩进 2 格，方便阅读
    const str = JSON.stringify(data, null, 2);
    jsonString.value = str;
    
    // 自动复制
    navigator.clipboard.writeText(str).then(() => {
      alert('JSON 已复制到剪贴板');
    }).catch(() => {
      alert('已生成 JSON，请手动复制');
    });
  } else {
    jsonString.value = '{}';
    alert('暂无本地缓存数据');
  }
};

// 导入：解析 JSON 并分发到各个独立模块
const importJson = () => {
  try {
    if (!jsonString.value) return;
    const parsed = JSON.parse(jsonString.value);
    
    if (typeof parsed !== 'object') throw new Error('无效的 JSON 格式');

    // 1. 恢复业务模块数据
    // 必须使用 updateModule，这样才能同时写入 'exp_calc_userdata' 和 'dna_userdata'
    let importCount = 0;
    KNOWN_MODULES.forEach(moduleName => {
      if (parsed[moduleName]) {
        updateModule(moduleName, parsed[moduleName]);
        importCount++;
      }
    });

    // 2. 恢复 UI 状态
    if (parsed.uiState) {
      updateUiState(parsed.uiState);
    }

    if (importCount > 0 || parsed.uiState) {
      alert(`导入成功！已更新 ${importCount} 个模块的数据。`);
    } else {
      alert('导入完成，但 JSON 中未发现有效的模块数据 (如 exp_calc, wedge_calc)。');
    }

  } catch (e) {
    alert('JSON 解析失败: ' + e.message);
  }
};

// 清除缓存：调用工具类的清除方法
const handleClearCache = () => {
  if (confirm('确定要删除所有本地缓存数据吗？\n此操作将清除所有模块（等级、魔之楔、角色等）的数据，且不可恢复。')) {
    clearAllCache(); // 这会同时删除 dna_userdata 和 exp_calc_userdata 等所有键
    jsonString.value = ''; // 清空文本框
    alert('所有缓存已清除');
  }
};

onMounted(() => {
  // 页面加载时自动显示当前数据
  const data = exportAllData();
  if (data && Object.keys(data).length > 0) {
    jsonString.value = JSON.stringify(data, null, 2);
  }
});
</script>

<style scoped>
/* 样式保持不变 */
.container {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}
.card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
.desc {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 15px;
}
textarea {
  width: 100%;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 10px;
  font-family: monospace;
  box-sizing: border-box;
  margin-bottom: 15px;
  resize: vertical;
  font-size: 14px; /* JSON 代码稍微小一点 */
}
.btn-group {
  display: flex;
  gap: 10px;
}
.btn {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: opacity 0.2s;
}
.btn:active { opacity: 0.8; }
.primary { background: #42b983; color: white; }
.outline { background: transparent; border: 1px solid #42b983; color: #42b983; }
.danger { background: #ff4d4f; color: white; width: 100%; }
.danger-zone { border: 1px solid #ffccc7; background: #fff1f0; }
.danger-zone h3 { color: #cf1322; }
</style>