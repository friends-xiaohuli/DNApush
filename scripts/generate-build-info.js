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
  version: 'v1.0.5', 
  buildTime: buildTime,
  author: '胶胶角wiki组'
};

try {
  // 3. 确定文件路径
  // process.cwd() 获取的是你运行 npm 命令时的根目录，正好是 build-info.json 应该在的地方
  const outputPath = path.resolve(process.cwd(), 'build-info.json');

  // 4. 写入文件
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

  console.log(`✅ 构建信息已生成: ${buildTime}`);
} catch (e) {
  console.error('❌ 生成失败:', e);
}