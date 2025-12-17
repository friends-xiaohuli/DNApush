export default function handler(req, res) {
  // 允许 GET 或 POST 测试访问
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  // 获取客户端 IP
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  if (ip && typeof ip === 'string' && ip.includes(',')) {
    ip = ip.split(',')[0].trim()
  }
  if (ip === '::1') ip = '127.0.0.1'

  // 读取请求参数（POST body 或 GET query）
  const { name, age } = req.body || req.query || {}

  // 简单校验
  if (!name || !age) {
    return res.status(400).json({ error: 'name 或 age 缺失' })
  }

  res.status(200).json({
    success: true,
    message: '校验通过',
    client_ip: ip,
    data: { name, age }
  })
}
