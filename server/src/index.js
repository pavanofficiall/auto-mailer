import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { parse } from 'csv-parse'
import { createRequire } from 'module'
import fs from 'fs/promises'
import path from 'path'

const require = createRequire(import.meta.url)

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
      parse(req.file.buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
        // Be tolerant to rows with fewer/more fields than header
        relax_column_count: true,
        relax_column_count_less: true,
        relax_column_count_more: true,
        skip_records_with_error: true,
      }, (err, records) => {
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
    // Support ESM + CJS resolution of nodemailer
    let nodemailer
    try {
      nodemailer = require('nodemailer')
    } catch (e) {
      const mod = await import('nodemailer')
      nodemailer = mod.default || mod
    }
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: Number(smtp.port) || 465,
      secure: smtp.secure ?? true,
      auth: { user: smtp.user, pass: smtp.pass }
    })
    const results = []
    const historyBatch = []
    for (const m of messages) {
      if (!m?.to) { results.push({ to: m?.to || '', error: 'missing to' }); continue }
      const info = await transporter.sendMail({
        from,
        to: m.to,
        subject,
        text: m.body,
      })
      const entry = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
        to: m.to,
        name: m.name || '',
        subject,
        from,
        provider: smtp.host,
        messageId: info.messageId || '',
        status: 'sent',
        at: new Date().toISOString(),
        // Store body and a short preview
        body: m.body || '',
        preview: (m.body || '').slice(0, 320),
        meta: m.meta || null
      }
      results.push({ to: m.to, messageId: info.messageId })
      historyBatch.push(entry)
      await new Promise(r => setTimeout(r, 500)) // simple throttle ~2/sec
    }
    if (historyBatch.length) await appendHistory(historyBatch)
    res.json({ sent: results.length, results })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Simple file-backed history store
const DATA_DIR = path.resolve(process.cwd(), 'data')
const HISTORY_FILE = process.env.HISTORY_FILE || path.join(DATA_DIR, 'sent-log.json')

async function ensureHistory() {
  await fs.mkdir(DATA_DIR, { recursive: true })
  try { await fs.access(HISTORY_FILE) } catch { await fs.writeFile(HISTORY_FILE, '[]', 'utf8') }
}

async function readHistory() {
  await ensureHistory()
  const raw = await fs.readFile(HISTORY_FILE, 'utf8')
  try { return JSON.parse(raw) } catch { return [] }
}

async function appendHistory(items) {
  const list = await readHistory()
  list.push(...items)
  await fs.writeFile(HISTORY_FILE, JSON.stringify(list, null, 2), 'utf8')
}

app.get('/api/history', async (req, res) => {
  try {
    const limit = Math.max(0, Math.min(1000, Number(req.query.limit) || 200))
    const list = await readHistory()
    // newest first
    list.sort((a,b) => (b.at||'').localeCompare(a.at||''))
    res.json({ count: list.length, items: list.slice(0, limit) })
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
