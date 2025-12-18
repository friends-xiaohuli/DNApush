import fs from 'node:fs';
import path from 'node:path';

// 1. 获取当前时间
const now = new Date();
const buildTime = now.toLocaleString('zh-CN', { 
  hour12: false, 
  timeZone: 'Asia/Shanghai' 
});

// 2. 准备数据
const data = {
  version: 'v1.0.12', 
  buildTime: buildTime,
  author: '皎皎角wiki组'
};

try {
  // 3. 确定文件路径
  const outputPath = path.resolve(process.cwd(), 'build-info.json');

  // 4. 写入文件
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

  console.log(`✅ 构建信息已生成: ${buildTime}`);
} catch (e) {
  console.error('❌ 生成失败:', e);
}