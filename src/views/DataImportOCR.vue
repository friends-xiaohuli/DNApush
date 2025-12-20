<script setup>
import { ref, reactive } from 'vue';
import Tesseract from 'tesseract.js';
import { updateModule } from '../utils/userData';

// ----------------------------------------------------------------
// 1. 状态管理
// ----------------------------------------------------------------
const isProcessing = ref(false);
const progress = ref(0);
const statusText = ref('等待上传...');
const showPreview = ref(false);

// 临时存储 (新增 exp_calc 用于存放当前等级经验)
const tempData = reactive({
  exp_calc: { level: null, current: null, total: null }, // 新增：等级与当前经验
  role: { count: null, base: null, break: null, origin: null },
  spirit: { count: null, base: null, break: null },
  weapon: { count: null, base: null, break: null, smelt: null },
  wedge: { count: null, base: null, isTaskDone: false },
  other: { quest: null, daily: null }
});

// ----------------------------------------------------------------
// 2. 核心解析逻辑 (智能纠错)
// ----------------------------------------------------------------

/**
 * 专门修复 "7860711660" 这种斜杠被识别为7的问题
 * @param {string} str - 纯数字字符串
 */
const fixSlashSevenError = (str) => {
  // 如果包含除数字外的字符（如 / | l），直接交给正则处理，这里只处理纯数字灾难
  if (!/^\d+$/.test(str)) return null;

  // 暴力尝试：以每一个 '7' 为界进行分割
  // 寻找最佳分割点：使得 前半部分 <= 后半部分
  for (let i = 1; i < str.length - 1; i++) {
    if (str[i] === '7') {
      const partA = str.substring(0, i);
      const partB = str.substring(i + 1);
      const numA = parseInt(partA);
      const numB = parseInt(partB);
      
      // 逻辑校验：通常当前经验 <= 总经验
      // 且两边数字长度不能悬殊太大 (比如 1 和 100000)
      if (numA <= numB && Math.abs(partA.length - partB.length) <= 3) {
        return { current: numA, total: numB };
      }
    }
  }
  return null;
};

/**
 * 提取进度条类型的数值 (例如: 7860/11660)
 * 返回 { current, total } 或仅返回 current
 */
const extractProgress = (line) => {
  // 1. 移除中文和空格
  let clean = line.replace(/[\u4e00-\u9fa5\s,]/g, '');
  
  // 2. 尝试标准匹配 (数字+分隔符+数字)
  // 分隔符可能是 / | l I 1 7
  const match = clean.match(/(\d+)[/|lI](\d+)/);
  if (match) {
    return { current: parseInt(match[1]), total: parseInt(match[2]) };
  }

  // 3. 尝试 "7" 误读修复 (针对 7860711660)
  const fix7 = fixSlashSevenError(clean);
  if (fix7) return fix7;

  // 4. 兜底：只提取前面的数字
  const simpleMatch = clean.match(/^(\d+)/);
  return simpleMatch ? { current: parseInt(simpleMatch[1]), total: 0 } : null;
};

/**
 * 提取特定分母的分数 (例如: 249/473)
 */
const extractFraction = (line, maxCap) => {
  const clean = line.replace(/[\s,]/g, '');
  // 动态正则：寻找 "数字" + "分隔符或7" + "已知最大值"
  const regex = new RegExp(`(\\d+)[\\/|7lI]${maxCap}`);
  const match = clean.match(regex);
  return match ? parseInt(match[1]) : null;
};

// --- 解析主入口 ---
const parseOCRResult = (text) => {
  console.log("Raw OCR:", text);
  const lines = text.split('\n').filter(line => line.trim() !== '');

  // 重置数据
  Object.keys(tempData).forEach(k => {
    Object.keys(tempData[k]).forEach(subK => tempData[k][subK] = null);
  });

  lines.forEach(line => {
    const str = line.replace(/\s+/g, '');

    // 1. 顶部等级栏 (57 当前等级经验 7860/11660)
    if (str.includes('当前等级经验')) {
      // 提取等级 (行首数字)
      const lvMatch = line.match(/^(\d+)/);
      if (lvMatch) tempData.exp_calc.level = parseInt(lvMatch[1]);
      
      // 提取经验
      const expData = extractProgress(line.replace(/^\d+/, '')); // 去掉等级再提取
      if (expData) {
        tempData.exp_calc.current = expData.current;
        tempData.exp_calc.total = expData.total;
      }
    }

    // 2. 魔灵 Spirit
    else if (str.includes('首次获得魔灵')) {
      tempData.spirit.count = extractFraction(line, 61) ?? extractFraction(line, 60);
      const exp = extractProgress(line);
      if(exp) tempData.spirit.base = exp.current;
    } else if (str.includes('魔灵突破')) {
      const exp = extractProgress(line);
      if(exp) tempData.spirit.break = exp.current;
    }

    // 3. 魔之楔 Wedge
    else if (str.includes('首次获得魔之楔')) {
      tempData.wedge.count = extractFraction(line, 473);
      const exp = extractProgress(line);
      if(exp) tempData.wedge.base = exp.current;
    } else if (str.includes('魔之楔任务')) {
      const exp = extractProgress(line);
      // 只要识别出的当前值 > 100，就认为任务已完成 (通常是 1430)
      tempData.wedge.isTaskDone = (exp && exp.current > 100);
    }

    // 4. 其他 Other
    else if (str.includes('主线') || str.includes('探索奖励')) {
      const exp = extractProgress(line);
      if(exp) tempData.other.quest = exp.current;
    } else if (str.includes('每日任务')) {
      const exp = extractProgress(line);
      if(exp) tempData.other.daily = exp.current;
    }
    
    // 5. 角色 Role (防止遗漏)
    else if (str.includes('首次获得角色')) {
      tempData.role.count = extractFraction(line, 18) ?? extractFraction(line, 19);
      const exp = extractProgress(line);
      if(exp) tempData.role.base = exp.current;
    } else if (str.includes('角色突破')) {
      const exp = extractProgress(line);
      if(exp) tempData.role.break = exp.current;
    } else if (str.includes('角色溯源')) {
      const exp = extractProgress(line);
      if(exp) tempData.role.origin = exp.current;
    }
  });

  showPreview.value = true;
};

// ----------------------------------------------------------------
// 3. 确认导入
// ----------------------------------------------------------------
const confirmImport = () => {
  // 1. 等级计算器 (exp_calc)
  if (tempData.exp_calc.current !== null) {
    updateModule('exp_calc', {
      level: tempData.exp_calc.level,
      currentExp: tempData.exp_calc.current,
      // 可以在这里计算 targetLevel 或其他逻辑
    });
  }

  // 2. Wedge (魔之楔)
  if (tempData.wedge.base !== null) {
    updateModule('wedge_calc', {
      count: tempData.wedge.count || 0,
      exp: tempData.wedge.base || 0,
      isTaskCompleted: tempData.wedge.isTaskDone
    });
  }

  // 3. Spirit (魔灵)
  if (tempData.spirit.base !== null) {
    updateModule('Spirit', {
      count: tempData.spirit.count || 0,
      baseExp: tempData.spirit.base || 0,
      breakExp: tempData.spirit.break || 0,
      breakCounts: [0,0,0] // 重置推导
    });
  }

  // 4. Other (其他)
  if (tempData.other.quest !== null) {
    updateModule('other', {
      questExp: tempData.other.quest || 0,
      dailyExp: tempData.other.daily || 0
    });
  }
  
  // 5. Role (角色 - 如果识别到了)
  if (tempData.role.base !== null) {
    updateModule('role', {
      activeMode: 'numeric',
      numeric: {
        roleCount: tempData.role.count || 0,
        baseExp: tempData.role.base || 0,
        breakExp: tempData.role.break || 0,
        originExp: tempData.role.origin || 0,
        breakCounts: [0,0,0,0,0,0],
        originCounts: [0,0,0,0,0,0]
      }
    });
  }

  showPreview.value = false;
  alert('数据已导入！请刷新页面或查看各模块。');
};

const cancelImport = () => showPreview.value = false;

// ----------------------------------------------------------------
// 4. 文件上传
// ----------------------------------------------------------------
const handleFile = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  isProcessing.value = true;
  progress.value = 0;
  statusText.value = 'OCR启动中...';

  try {
    const { data: { text } } = await Tesseract.recognize(
      file,
      'chi_sim',
      {
        logger: m => {
          if (m.status === 'recognizing text') {
            progress.value = Math.floor(m.progress * 100);
            statusText.value = `识别中... ${progress.value}%`;
          }
        }
      }
    );
    parseOCRResult(text);
  } catch (err) {
    console.error(err);
    alert("识别失败：请将图片【另存为】到本地后再上传，不要直接从聊天窗口拖拽。");
  } finally {
    isProcessing.value = false;
    statusText.value = '等待上传...';
    event.target.value = '';
  }
};
</script>

<template>
  <div class="ocr-wrapper">
    
    <div class="upload-area" :class="{ processing: isProcessing }" v-if="!showPreview">
      <input type="file" accept="image/*" @change="handleFile" :disabled="isProcessing" id="ocr-upload"/>
      <label for="ocr-upload" class="upload-label">
        <div class="icon">📷</div>
        <div class="text" v-if="!isProcessing">点击上传“历练经验”截图 (请先保存图片)</div>
        <div class="text" v-else>{{ statusText }}</div>
      </label>
      <div class="progress-bar" v-if="isProcessing"><div class="bar-fill" :style="{ width: progress + '%' }"></div></div>
    </div>

    <div class="preview-panel" v-if="showPreview">
      <div class="panel-header">
        <h3>数据校对</h3>
        <span class="sub-tip">请确认自动修复的数据是否正确</span>
      </div>

      <div class="form-grid">
        
        <div class="form-group highlight" v-if="tempData.exp_calc.current !== null">
          <div class="group-title">当前等级 (Level)</div>
          <div class="row">
            <label>等级</label> <input type="number" v-model.number="tempData.exp_calc.level">
          </div>
          <div class="row">
            <label>当前经验</label> <input type="number" v-model.number="tempData.exp_calc.current">
          </div>
        </div>

        <div class="form-group" v-if="tempData.wedge.base !== null">
          <div class="group-title">魔之楔 (Wedge)</div>
          <div class="row">
            <label>数量</label> <input type="number" v-model.number="tempData.wedge.count">
          </div>
          <div class="row">
            <label>首获经验</label> <input type="number" v-model.number="tempData.wedge.base">
          </div>
          <div class="row check-row">
            <label>任务已完成?</label> <input type="checkbox" v-model="tempData.wedge.isTaskDone">
          </div>
        </div>

        <div class="form-group" v-if="tempData.spirit.base !== null">
          <div class="group-title">魔灵 (Spirit)</div>
          <div class="row">
            <label>数量</label> <input type="number" v-model.number="tempData.spirit.count">
          </div>
          <div class="row">
            <label>首获经验</label> <input type="number" v-model.number="tempData.spirit.base">
          </div>
          <div class="row">
            <label>突破经验</label> <input type="number" v-model.number="tempData.spirit.break">
          </div>
        </div>

        <div class="form-group" v-if="tempData.other.quest !== null">
          <div class="group-title">其他 (Other)</div>
          <div class="row">
            <label>探索/任务</label> <input type="number" v-model.number="tempData.other.quest">
          </div>
          <div class="row">
            <label>每日任务</label> <input type="number" v-model.number="tempData.other.daily">
          </div>
        </div>

      </div>

      <div class="action-btns">
        <button class="btn cancel" @click="cancelImport">放弃</button>
        <button class="btn confirm" @click="confirmImport">确认覆盖</button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.ocr-wrapper { margin-bottom: 20px; font-family: "Inter", sans-serif; }
.upload-area { position: relative; background: #f9fafb; border: 2px dashed #d1d5db; border-radius: 8px; text-align: center; transition: all 0.2s; cursor: pointer; }
.upload-area:hover { border-color: #3b82f6; background: #eff6ff; }
input[type="file"] { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
.upload-label { padding: 20px; pointer-events: none; }
.icon { font-size: 24px; margin-bottom: 8px; }
.text { font-size: 13px; color: #4b5563; }
.progress-bar { position: absolute; bottom: 0; left: 0; width: 100%; height: 4px; background: #e5e7eb; }
.bar-fill { height: 100%; background: #3b82f6; transition: width 0.2s; }

.preview-panel { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
.panel-header { margin-bottom: 15px; border-bottom: 1px solid #f3f4f6; padding-bottom: 10px; }
.panel-header h3 { margin: 0; font-size: 16px; color: #111827; }
.sub-tip { font-size: 12px; color: #6b7280; }

.form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; }
.form-group { background: #f9fafb; padding: 10px; border-radius: 6px; border: 1px solid #f3f4f6; }
.form-group.highlight { border-color: #bfdbfe; background: #eff6ff; } /* 高亮等级栏 */
.group-title { font-weight: bold; font-size: 13px; color: #3b82f6; margin-bottom: 8px; }
.row { display: flex; align-items: center; margin-bottom: 6px; }
.row label { flex: 1; font-size: 12px; color: #4b5563; }
.row input[type="number"] { width: 70px; padding: 4px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px; text-align: right; }
.row.check-row { justify-content: space-between; }

.action-btns { display: flex; gap: 10px; justify-content: flex-end; }
.btn { padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; }
.btn.cancel { background: #f3f4f6; color: #4b5563; }
.btn.confirm { background: #10b981; color: white; }
</style>