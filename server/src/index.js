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
app.get('/health', (_req, res) => {
  const gemini = !!process.env.GEMINI_API_KEY
  res.json({ ok: true, ai: gemini ? { provider: 'gemini', model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' } : null })
})

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
  const { prompt, rows, mapping, requireAi } = req.body || {}
  if (!prompt || !rows || !Array.isArray(rows)) return res.status(400).json({ error: 'prompt and rows[] required' })

  const useGemini = !!process.env.GEMINI_API_KEY
  let client
  if (useGemini) {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    } catch (e) {
      console.error('Gemini SDK load failed:', e)
      client = undefined
    }
  }

  const results = []
  let aiUsedCount = 0
  let lastAiError = ''
  for (const r of rows) {
    const vars = { ...r, email: r[mapping?.email] || r.email, name: r[mapping?.name] || r.name }
    let text = ''
    let usedAI = false
    if (client) {
      try {
        const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-pro'
        const model = client.getGenerativeModel({ model: modelName })
        const promptText = buildAiPrompt(prompt, vars)
        // Preferred structured call with generation config
        let resp = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: promptText }]}],
          generationConfig: { temperature: 0.7, topP: 0.95, maxOutputTokens: 220 },
        })
        let maybe = resp && resp.response && typeof resp.response.text === 'function' ? resp.response.text() : ''
        if (!maybe) {
          // Final attempt: REST call (works without SDK helpers)
          try {
            const rest = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: promptText }]}],
                generationConfig: { temperature: 0.7, topP: 0.95, maxOutputTokens: 220 },
              })
            })
            if (rest.ok) {
              const data = await rest.json()
              // Best-effort extract
              maybe = data?.candidates?.[0]?.content?.parts?.map(p=>p.text).join('\n') || ''
            } else {
              const t = await rest.text().catch(()=> '')
              console.error('Gemini REST failed:', rest.status, t)
              lastAiError = `REST ${rest.status}: ${t.slice(0,200)}`
            }
          } catch (e) { console.error('Gemini REST error:', e) }
        }
        if (maybe) { text = maybe; usedAI = true }
      } catch (e) {
        console.error('Gemini generate failed:', e)
        lastAiError = e?.message || String(e)
      }
    } else {
    }
    if (!text) text = fallbackTemplate(prompt, vars)
    if (usedAI) aiUsedCount++
    results.push({ to: (vars.email || '').trim(), name: (vars.name || '').trim(), body: (text || '').trim(), ai: usedAI })
  }
  // Always 200 with whatever we could generate; never 500 for AI issues
  if (requireAi && aiUsedCount === 0) {
    return res.status(502).json({ error: 'AI generation unavailable (Gemini did not return content).', detail: lastAiError || 'No AI output received.' })
  }
  res.json({ count: results.length, ai: aiUsedCount > 0, aiCount: aiUsedCount, messages: results.slice(0, 50) })
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
  // Compose a short, professional outreach without echoing the prompt verbatim
  const subject = 'Quick hello about employment‑law research'
  const lines = [
    `Subject: ${subject}`,
    '',
    `Hi ${name},`,
    '',
    'I work with YourCase, an India‑focused legal research assistant that helps employment‑law teams find relevant citations and draft faster.',
    'We combine AI with a large case‑law index so you can get reliable references, summaries, and quick next‑step suggestions in minutes.',
    '',
    'If helpful, I can share a brief walkthrough or set up a quick call next week.',
    '',
    'Regards,',
    'Team YourCase'
  ]
  return lines.join('\n')
}

function buildAiPrompt(userBrief, vars) {
  return [
    'System: You are a helpful outreach copywriter for an India‑focused legal research product (YourCase).',
    'Constraints: 120–180 words, en‑IN tone, concise, professional, no markdown. Include a Subject line as the first line (prefix with "Subject:"). Do not repeat the user brief verbatim; synthesize it.',
    '',
    'Recipient (JSON):',
    JSON.stringify(vars, null, 2),
    '',
    'User brief:',
    userBrief,
    '',
    'Write the email now.'
  ].join('\n')
}

const port = process.env.PORT || 4000
app.listen(port, () => console.log(`API on :${port}`))
