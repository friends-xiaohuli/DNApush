// server.js
import express from 'express'
const app = express()

app.use(express.json())

app.post('/api/check', (req, res) => {
  res.json({ ok: true })
})

app.listen(3000, () => {
  console.log('API running at http://localhost:3000')
})
