// Vercel Serverless Function (Node.js)
export default async function handler(req, res) {
  // 1. 定义目标 URL (对应你原来的 rewrite 逻辑 /api_gamekee -> /v1)
  const URL_STATUS = 'https://www.gamekee.com/v1/dnaPetConfig/getCurrentData';
  const URL_INFO = 'https://www.gamekee.com/v1/dna/instanceInfo';

  // 2. 设置伪造的请求头 (完全复刻你 vite.config.js 里的配置)
  const headers = {
    'Referer': 'https://www.gamekee.com/dna/',
    'Origin': 'https://www.gamekee.com',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'game-alias': 'dna',
    'device-num': '1',
    'Content-Type': 'application/json'
  };

  try {
    // 3. 并行发起请求 (服务端请求，速度更快)
    const [statusResponse, infoResponse] = await Promise.all([
      fetch(URL_STATUS, { method: 'GET', headers }),
      fetch(URL_INFO, { method: 'GET', headers })
    ]);

    // 4. 解析 JSON
    const statusData = await statusResponse.json();
    const infoData = await infoResponse.json();

    // 5. 检查上游接口状态 (可选，根据对方接口返回结构调整)
    if (statusData.code !== 0 || infoData.code !== 0) {
      return res.status(502).json({ error: 'GameKee 接口返回异常' });
    }

    // 6. 将合并后的数据返回给你的前端
    // 为了方便前端使用，我们构造一个统一的结构
    return res.status(200).json({
      statusResult: statusData,
      infoResult: infoData
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: '服务端请求失败' });
  }
}