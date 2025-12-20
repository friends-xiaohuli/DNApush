<script setup>
import { ref, reactive } from 'vue';
import Tesseract from 'tesseract.js';
import { updateModule, getModule } from '../utils/userData';

// ==========================================
// 1. 状态管理
// ==========================================
const isProcessing = ref(false);
const isDragging = ref(false); // 新增：拖拽状态
const progress = ref(0);
const statusText = ref('等待上传...');
const showPreview = ref(false);

// 预览数据容器
const tempData = reactive({
  role: { count: null, base: null, break: null, origin: null },
  spirit: { count: null, base: null, break: null },
  weapon: { count: null, base: null, break: null, smelt: null },
  wedge: { count: null, base: null, isTaskDone: false },
  other: { quest: null, daily: null },
  currentLevelExp: null
});

// ==========================================
// 2. 图像预处理 (Layer 1: Canvas Binarization)
// ==========================================
const preprocessImage = (file) => {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    
    reader.onload = (e) => {
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // 二值化处理：增强文字对比度，消除背景干扰
        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          // 阈值设为 170 (经验值，针对游戏深色背景浅色文字效果较好)
          const val = avg > 170 ? 0 : 255; // 白底黑字
          
          data[i] = val;     // R
          data[i + 1] = val; // G
          data[i + 2] = val; // B
        }
        
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg')); 
      };
    };
    reader.readAsDataURL(file);
  });
};

// ==========================================
// 3. 模糊匹配算法 (Layer 2: Fuzzy Matching)
// ==========================================
const levenshtein = (a, b) => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
      }
    }
  }
  return matrix[b.length][a.length];
};

const identifyCategory = (cleanLine) => {
  const targets = [
    { key: 'role_base', words: ['首次获得角色'] },
    { key: 'role_break', words: ['角色突破'] },
    { key: 'role_origin', words: ['角色溯源'] },
    { key: 'spirit_base', words: ['首次获得魔灵'] },
    { key: 'spirit_break', words: ['魔灵突破'] },
    { key: 'wedge_base', words: ['首次获得魔之楔', '首次获得魔之枫', '首次获得魔之模'] }, 
    { key: 'wedge_task', words: ['魔之楔任务', '魔之模任务'] },
    { key: 'weapon_base', words: ['首次获得武器'] },
    { key: 'weapon_break', words: ['武器突破'] },
    { key: 'weapon_smelt', words: ['武器熔炼', '武器精炼'] },
    { key: 'other_quest', words: ['主线', '支线', '探索奖励'] },
    { key: 'other_daily', words: ['每日任务'] },
    { key: 'level_exp', words: ['当前等级经验'] }
  ];

  let bestMatch = null;
  let minDistance = 3; 

  for (const t of targets) {
    for (const w of t.words) {
      if (cleanLine.includes(w)) return t.key;
      const sub = cleanLine.substring(0, w.length + 1); 
      const dist = levenshtein(sub, w);
      if (dist < minDistance) {
        minDistance = dist;
        bestMatch = t.key;
      }
    }
  }
  return bestMatch;
};

// ==========================================
// 4. 数字解析逻辑 (Layer 3: Logic Fix)
// ==========================================

// 智能切分粘连数字
const smartSplitProgress = (digits) => {
  if (!digits || digits.length < 5) return null;
  if (!/^\d+$/.test(digits)) return null;

  for (let i = 2; i < digits.length - 2; i++) {
    const a = digits.slice(0, i);
    const b = digits.slice(i); 
    const bSkip = digits.slice(i + 1); 

    const na = parseInt(a);
    const nb = parseInt(b);
    const nbSkip = parseInt(bSkip);

    if (na <= nbSkip && na > 0 && nbSkip > 1000) {
      return { curr: na, total: nbSkip };
    }
    if (na <= nb && na > 0 && nb > 1000) {
      return { curr: na, total: nb };
    }
  }
  return null;
};

// 提取当前值 (锚点法)
const extractCurrentValue = (line, maxAnchor) => {
  const clean = line.replace(/[^0-9/|7lI1\s]/g, '');
  
  if (maxAnchor) {
    const regex = new RegExp(`(\\d+)[\\s\\/|7lI1]*${maxAnchor}`);
    const match = clean.match(regex);
    if (match && match[1]) {
      const val = parseInt(match[1]);
      if (val <= maxAnchor) return val;
    }
  }

  const numOnly = line.replace(/[^0-9]/g, '');
  const splitRes = smartSplitProgress(numOnly);
  if (splitRes) return splitRes.curr;

  const nums = line.replace(/[^0-9]/g, ' ').trim().split(/\s+/);
  const lastNum = nums[nums.length - 1];
  return lastNum ? parseInt(lastNum) : null;
};

const parseOCRResult = (text) => {
  // --- LOG: 输出原始文本 ---
  console.log("🟦 [OCR 原始文本]:\n", text);
  
  const lines = text.split('\n').filter(l => l.trim().length > 2);

  // 清空旧数据
  Object.keys(tempData).forEach(k => {
    if (typeof tempData[k] === 'object') Object.keys(tempData[k]).forEach(sk => tempData[k][sk] = null);
    else tempData[k] = null;
  });

  lines.forEach(line => {
    const cleanLine = line.replace(/\s+/g, '');
    const category = identifyCategory(cleanLine);

    if (!category) return;

    if (category === 'level_exp') {
      const split = smartSplitProgress(line.replace(/[^0-9]/g, ''));
      if (split) tempData.currentLevelExp = split.curr;
    } 
    else if (category === 'role_base') {
      tempData.role.count = extractCurrentValue(line, 19) ?? extractCurrentValue(line, 18);
      tempData.role.base = extractCurrentValue(line, 9000); 
    }
    else if (category === 'role_break') tempData.role.break = extractCurrentValue(line, 59850);
    else if (category === 'role_origin') tempData.role.origin = extractCurrentValue(line, 28500);
    else if (category === 'spirit_base') {
      tempData.spirit.count = extractCurrentValue(line, 61) ?? extractCurrentValue(line, 60);
      tempData.spirit.base = extractCurrentValue(line, 6100);
    }
    else if (category === 'spirit_break') tempData.spirit.break = extractCurrentValue(line, 10200); 
    else if (category === 'wedge_base') {
      tempData.wedge.count = extractCurrentValue(line, 473);
      tempData.wedge.base = extractCurrentValue(line, 51590);
    }
    else if (category === 'wedge_task') {
      const val = extractCurrentValue(line, 1430);
      tempData.wedge.isTaskDone = (val > 1000); 
    }
    else if (category === 'weapon_base') {
      tempData.weapon.count = extractCurrentValue(line, 45);
      tempData.weapon.base = extractCurrentValue(line, 18000);
    }
    else if (category === 'weapon_break') tempData.weapon.break = extractCurrentValue(line, 113400);
    else if (category === 'weapon_smelt') tempData.weapon.smelt = extractCurrentValue(line, 45000);
    else if (category === 'other_quest') tempData.other.quest = extractCurrentValue(line);
    else if (category === 'other_daily') tempData.other.daily = extractCurrentValue(line);
  });

  // --- LOG: 输出解析后的数据对象 ---
  // 使用 JSON.parse(JSON.stringify()) 来深拷贝一个纯净对象用于打印，避免 Proxy 干扰
  console.log("🟩 [OCR 解析结果]:", JSON.parse(JSON.stringify(tempData)));

  showPreview.value = true;
};

// ==========================================
// 5. 保存与交互
// ==========================================
const confirmImport = () => {
  // ... (保持原有的保存逻辑不变) ...
  if (tempData.wedge.base !== null) {
    updateModule('wedge_calc', {
      count: tempData.wedge.count || 0,
      exp: tempData.wedge.base || 0,
      isTaskCompleted: tempData.wedge.isTaskDone,
      totalExp: (tempData.wedge.base || 0) + (tempData.wedge.isTaskDone ? 1430 : 0)
    });
  }
  if (tempData.role.base !== null) {
    updateModule('role', {
      activeMode: 'numeric',
      numeric: {
        roleCount: tempData.role.count || 0,
        baseExp: tempData.role.base || 0,
        breakExp: tempData.role.break || 0,
        originExp: tempData.role.origin || 0,
        breakCounts: [0,0,0,0,0,0], originCounts: [0,0,0,0,0,0]
      }
    });
  }
  if (tempData.spirit.base !== null) {
    updateModule('Spirit', {
      count: tempData.spirit.count || 0,
      baseExp: tempData.spirit.base || 0,
      breakExp: tempData.spirit.break || 0,
      breakCounts: [0,0,0]
    });
  }
  if (tempData.weapon.base !== null) {
    updateModule('weapon', {
      count: tempData.weapon.count || 0,
      baseExp: tempData.weapon.base || 0,
      breakExp: tempData.weapon.break || 0,
      smeltExp: tempData.weapon.smelt || 0,
      breakCounts: [0,0,0,0,0,0], smeltCounts: [0,0,0,0,0]
    });
  }
  if (tempData.other.quest !== null) {
    updateModule('other', {
      questExp: tempData.other.quest || 0,
      dailyExp: tempData.other.daily || 0
    });
  }
  if (tempData.currentLevelExp !== null) {
    const d = getModule('exp_calc') || {};
    d.currentExp = tempData.currentLevelExp;
    updateModule('exp_calc', d);
  }

  showPreview.value = false;
  alert('数据已覆盖导入！各计算器已根据导入数据自动推测分布。');
};

// ==========================================
// 6. 统一文件处理 (支持点击和拖拽)
// ==========================================
const startOcr = async (file) => {
  if (!file) return;
  
  isProcessing.value = true;
  progress.value = 0;
  statusText.value = '正在预处理图片...';

  try {
    // 1. 预处理
    const processedImgDataUrl = await preprocessImage(file);
    
    statusText.value = 'OCR 识别中...';
    
    // 2. 识别
    const { data: { text } } = await Tesseract.recognize(
      processedImgDataUrl, 
      'chi_sim', 
      {
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
        logger: m => {
          if (m.status === 'recognizing text') {
            progress.value = Math.floor(m.progress * 100);
          }
        }
      }
    );

    // 3. 解析
    parseOCRResult(text);

  } catch (err) {
    console.error("OCR Error:", err);
    alert('识别失败，请重试');
  } finally {
    isProcessing.value = false;
    isDragging.value = false; // 确保拖拽状态复位
    statusText.value = '等待上传...';
  }
};

// Input Change 事件
const handleFileChange = (event) => {
  startOcr(event.target.files[0]);
  // 清空 value 允许重复上传同一文件
  event.target.value = '';
};

// Drop 事件
const handleDrop = (event) => {
  const file = event.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    startOcr(file);
  } else {
    alert("请拖入有效的图片文件");
    isDragging.value = false;
  }
};
</script>

<template>
  <div class="ocr-wrapper">
    <div 
      class="upload-area" 
      :class="{ processing: isProcessing, dragging: isDragging }" 
      v-if="!showPreview"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
    >
      <input type="file" accept="image/*" @change="handleFileChange" :disabled="isProcessing" id="ocr-up"/>
      <label for="ocr-up" class="upload-label">
        <div class="icon">📷</div>
        <div class="text" v-if="!isProcessing">
          {{ isDragging ? '释放以解析图片' : '点击上传或拖拽截图到此处' }}
        </div>
        <div class="text" v-else>{{ statusText }} ({{ progress }}%)</div>
      </label>
      <div class="progress-bar" v-if="isProcessing"><div class="bar-fill" :style="{ width: progress + '%' }"></div></div>
    </div>

    <div class="preview-panel" v-if="showPreview">
      <div class="panel-header">
        <h3>数据校对</h3>
        <button class="close-btn" @click="showPreview = false">×</button>
      </div>

      <div class="data-grid">
        <div class="data-row highlight" v-if="tempData.currentLevelExp !== null">
          <span class="label">当前等级经验</span>
          <input type="number" v-model.number="tempData.currentLevelExp">
        </div>

        <div class="section-title">魔之楔 (Wedge)</div>
        <div class="data-row">
          <span class="label">首次获得 (数量/经验)</span>
          <div class="inputs">
            <input type="number" v-model.number="tempData.wedge.count" placeholder="Num">
            <input type="number" v-model.number="tempData.wedge.base" placeholder="Exp">
          </div>
        </div>
        <div class="data-row check-row">
          <span class="label">任务奖励 (1430)</span>
          <label><input type="checkbox" v-model="tempData.wedge.isTaskDone"> 完成</label>
        </div>

        <div class="section-title">角色 (Role)</div>
        <div class="data-row">
          <span class="label">首次获得 (数量/经验)</span>
          <div class="inputs">
            <input type="number" v-model.number="tempData.role.count" placeholder="Num">
            <input type="number" v-model.number="tempData.role.base" placeholder="Exp">
          </div>
        </div>
        <div class="data-row">
          <span class="label">突破 / 溯源</span>
          <div class="inputs">
            <input type="number" v-model.number="tempData.role.break" placeholder="Brk">
            <input type="number" v-model.number="tempData.role.origin" placeholder="Org">
          </div>
        </div>

        <div class="section-title">魔灵 (Spirit)</div>
        <div class="data-row">
          <span class="label">首次获得 / 突破</span>
          <div class="inputs">
            <input type="number" v-model.number="tempData.spirit.base" placeholder="Base">
            <input type="number" v-model.number="tempData.spirit.break" placeholder="Brk">
          </div>
        </div>

        <div class="section-title">其他 (Other)</div>
        <div class="data-row">
          <span class="label">探索 / 每日</span>
          <div class="inputs">
            <input type="number" v-model.number="tempData.other.quest" placeholder="Quest">
            <input type="number" v-model.number="tempData.other.daily" placeholder="Daily">
          </div>
        </div>
      </div>

      <div class="action-bar">
        <button class="btn confirm" @click="confirmImport">确认并覆盖数据</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ocr-wrapper { margin-bottom: 20px; font-family: sans-serif; }
.upload-area { position: relative; background: #f8fafc; border: 2px dashed #94a3b8; border-radius: 8px; text-align: center; cursor: pointer; transition: all 0.2s; }
.upload-area:hover, .upload-area.dragging { border-color: #3b82f6; background: #eff6ff; }
.upload-label { padding: 20px; pointer-events: none; display: block; }
.icon { font-size: 24px; margin-bottom: 5px; }
.text { color: #475569; font-size: 14px; font-weight: 500; }
input[type="file"] { display: none; }
.progress-bar { position: absolute; bottom: 0; left: 0; width: 100%; height: 4px; background: #e2e8f0; }
.bar-fill { height: 100%; background: #3b82f6; transition: width 0.2s; }

.preview-panel { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
.panel-header h3 { margin: 0; font-size: 16px; color: #1e293b; }
.close-btn { background: none; border: none; font-size: 20px; cursor: pointer; color: #94a3b8; }

.data-grid { display: flex; flex-direction: column; gap: 6px; max-height: 450px; overflow-y: auto; padding-right: 4px; }
.section-title { font-size: 12px; font-weight: bold; color: #3b82f6; margin-top: 8px; background: #eff6ff; padding: 2px 6px; border-radius: 4px; width: fit-content; }
.data-row { display: flex; align-items: center; justify-content: space-between; font-size: 13px; margin-bottom: 4px; }
.data-row.highlight { background: #fff7ed; padding: 6px; border-radius: 4px; border: 1px solid #ffedd5; }
.label { color: #475569; flex: 1; }
.inputs { display: flex; gap: 5px; width: 150px; }
input[type="number"] { width: 70px; padding: 4px; border: 1px solid #cbd5e1; border-radius: 4px; text-align: right; font-family: "JetBrains Mono"; font-size: 13px; }
.check-row label { font-size: 13px; display: flex; align-items: center; cursor: pointer; }
.check-row input { width: auto; margin-right: 4px; }

.action-bar { margin-top: 15px; text-align: right; }
.btn.confirm { background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; width: 100%; }
.btn.confirm:hover { background: #059669; }
</style>