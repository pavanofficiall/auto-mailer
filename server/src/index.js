import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { parse } from 'csv-parse'

const app = express()
app.use(cors())
app.use(express.json())

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

// Health
app.get('/health', (_req, res) => res.json({ ok: true }))

// Parse CSV and return headers + first N rows
app.post('/api/parse', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file required' })
    const rows = []
    await new Promise((resolve, reject) => {
      parse(req.file.buffer, { columns: true, skip_empty_lines: true }, (err, records) => {
        if (err) return reject(err)
        rows.push(...records)
        resolve()
      })
    })
    const headers = rows.length ? Object.keys(rows[0]) : []
    res.json({ headers, sample: rows.slice(0, 20), total: rows.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Personalize (dry-run): Accepts prompt + mapping + rows; returns generated messages
app.post('/api/personalize', async (req, res) => {
  try {
    const { prompt, rows, mapping } = req.body || {}
    if (!prompt || !rows || !Array.isArray(rows)) return res.status(400).json({ error: 'prompt and rows[] required' })
    const useGemini = !!process.env.GEMINI_API_KEY

    let client
    if (useGemini) {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    }

    const results = []
    for (const r of rows) {
      const vars = { ...r, email: r[mapping?.email] || r.email, name: r[mapping?.name] || r.name }
      let text
      if (client) {
        try {
          const model = client.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' })
          const promptText = `${prompt}\n\nRecipient:\n${JSON.stringify(vars, null, 2)}\n\nConstraints: 120-180 words, professional, en-IN.`
          const resp = await model.generateContent(promptText)
          text = resp.response.text()
        } catch (e) {
          text = fallbackTemplate(prompt, vars)
        }
      } else {
        text = fallbackTemplate(prompt, vars)
      }
      results.push({ to: vars.email || '', name: vars.name || '', body: text })
    }
    res.json({ count: results.length, messages: results.slice(0, 50) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// SMTP send (Zoho/SMTP): accepts { from, subject, messages:[{to,name,body}], smtp:{host,port,secure,user,pass} }
app.post('/api/send', async (req, res) => {
  try {
    const { from, subject, messages, smtp } = req.body || {}
    if (!from || !subject || !Array.isArray(messages) || !smtp?.host || !smtp?.user || !smtp?.pass) {
      return res.status(400).json({ error: 'from, subject, messages[], and smtp{host,user,pass} required' })
    }
    const nodemailer = (await import('nodemailer')).default
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: Number(smtp.port) || 465,
      secure: smtp.secure ?? true,
      auth: { user: smtp.user, pass: smtp.pass }
    })
    const results = []
    for (const m of messages) {
      if (!m?.to) { results.push({ to: m?.to || '', error: 'missing to' }); continue }
      const info = await transporter.sendMail({
        from,
        to: m.to,
        subject,
        text: m.body,
      })
      results.push({ to: m.to, messageId: info.messageId })
      await new Promise(r => setTimeout(r, 500)) // simple throttle ~2/sec
    }
    res.json({ sent: results.length, results })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

function fallbackTemplate(prompt, vars) {
  const name = vars.name || 'there'
  return `Subject: Quick hello about employment law research\n\nHi ${name},\n\n${prompt}\n\nRegards,\nTeam`
}

const port = process.env.PORT || 4000
app.listen(port, () => console.log(`API on :${port}`))
