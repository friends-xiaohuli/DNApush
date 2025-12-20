// Vercel Serverless Function (Node.js)
export default async function handler(req, res) {
  // 1. Info 接口 (外部获取)
  const URL_INFO = 'https://www.gamekee.com/v1/dna/instanceInfo';

  // 2. 设置伪造请求头
  const headers = {
    'Referer': 'https://www.gamekee.com/dna/',
    'Origin': 'https://www.gamekee.com',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'game-alias': 'dna',
    'device-num': '1',
    'Content-Type': 'application/json'
  };

  try {
    // 3. 并行处理：获取远程 Info + 本地计算 Status
    // 注意：我们将 fetch 放在这里，status 计算很快，几乎瞬间完成
    const infoResponse = await fetch(URL_INFO, { method: 'GET', headers });
    const infoData = await infoResponse.json();

    // 4. 本地计算 Status 数据 (纯时间戳逻辑)
    // ---------------------------------------------------------
    
    // 锚点配置: 2025-11-25 05:00:00 (北京) -> 1764018000000 (UTC毫秒)
    const ANCHOR_TIMESTAMP = 1764018000000; 
    const ANCHOR_ID = 2; 
    const CYCLE_DAYS = 3;
    const CYCLE_MS = CYCLE_DAYS * 24 * 60 * 60 * 1000; // 259200000 ms

    // 获取当前服务器时间
    const now = Date.now();

    // 计算经过的周期数 (向下取整)
    // 逻辑：(当前时间 - 锚点时间) / 周期时长
    let cyclesPassed = Math.floor((now - ANCHOR_TIMESTAMP) / CYCLE_MS);

    // ID 推导 (线性增长)
    const currentId = ANCHOR_ID + cyclesPassed;

    // 时间段推导
    const currentStartTimeMs = ANCHOR_TIMESTAMP + (cyclesPassed * CYCLE_MS);
    const currentEndTimeMs = currentStartTimeMs + CYCLE_MS;

    // 格式化工具: 转为北京时间字符串 YYYY-MM-DD HH:mm:ss
    const formatBJ = (ms) => {
      return new Date(ms).toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        // year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        // second: '2-digit',
        hour12: false
      }).replace(/\//g, '-');
    };

    // 构造模拟 Status 响应
    const statusData = {
      code: 0,
      msg: "success (timestamp calc)",
      data: {
        id: currentId,
        content_id: currentId,
        start_time: formatBJ(currentStartTimeMs),
        end_time: formatBJ(currentEndTimeMs),
        server_time: formatBJ(now)
      }
    };
    // ---------------------------------------------------------

    // 5. 错误处理与返回
    if (infoData.code !== 0) {
      return res.status(502).json({ error: 'GameKee Info 接口异常' });
    }

    return res.status(200).json({
      statusResult: statusData,
      infoResult: infoData
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}