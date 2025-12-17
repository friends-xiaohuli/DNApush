// 注意：Vercel Serverless Function 运行在 Node 环境
import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  try {
    // 1. 获取文件路径
    // process.cwd() 在 Vercel 中通常指向项目根目录
    const filePath = path.join(process.cwd(), 'build-info.json');

    // 2. 读取文件内容
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const buildData = JSON.parse(fileContents);

    // 3. 返回数据
    res.status(200).json({
      success: true,
      data: buildData
    });

  } catch (error) {
    // 如果还没构建过（比如刚 clone 下来），可能会报错，做个容错
    res.status(500).json({
      success: false,
      error: 'Build info not found',
      message: error.message
    });
  }
}