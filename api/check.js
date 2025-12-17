export default function handler(req, res) {
  // 1. 获取 IP 地址的逻辑
  // 大多数生产环境（Vercel, Nginx等）会将真实 IP 放在 x-forwarded-for 头中
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  // 如果经过多层代理，x-forwarded-for 可能是逗号分隔的字符串 (例如: "client_ip, proxy_ip")
  // 我们通常取第一个 IP
  if (ip && typeof ip === 'string' && ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }

  // 针对本地开发 IPv6 的特殊情况 (::1) 也可以做个简单的处理（可选）
  if (ip === '::1') {
    ip = '127.0.0.1';
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { name, age } = req.body || {}

  // 参数校验
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'name 参数错误' })
  }

  if (!age || typeof age !== 'number') {
    return res.status(400).json({ error: 'age 参数错误' })
  }

  // 2. 将获取到的 IP 返回（或者用于你的业务逻辑）
  res.status(200).json({
    success: true,
    message: '校验通过',
    client_ip: ip, // 这里返回 IP
    data: { name, age }
  })
}