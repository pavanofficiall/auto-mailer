import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { BrowserRouter, Link, Route, Routes, useNavigate } from 'react-router-dom'

// Use relative paths with Vite proxy by default
// If VITE_API_URL is set, use it; otherwise rely on dev proxy for /api
const API = import.meta.env.VITE_API_URL || ''

function App(){
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') return saved
    // fallback to system preference, default dark
    const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    return prefersDark ? 'dark' : 'dark'
  })
  const [file, setFile] = useState(null)
  const [headers, setHeaders] = useState([])
  const [sample, setSample] = useState([])
  const [mapping, setMapping] = useState({ email: '', name: '' })
  const [prompt, setPrompt] = useState('We help with fast, accurate employment-law research. Introduce briefly and request a short call next week.')
  const [preview, setPreview] = useState([])
  const [loading, setLoading] = useState(false)
  const [onlyValid, setOnlyValid] = useState(true)
  const [dedupe, setDedupe] = useState(true)
  // SMTP + send state
  const defaultSmtp = {
    host: 'smtp.zoho.in',
    port: 465,
    secure: true,
    user: 'pvn@yourcase.tech',
    pass: '',
    fromName: 'YourCase',
    fromEmail: 'pvn@yourcase.tech',
    subject: 'Quick intro from YourCase',
    remember: true,
  }
  const [smtp, setSmtp] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem('smtpConfig')||'null'); return { ...defaultSmtp, ...(saved||{}) } } catch { return defaultSmtp }
  })
  const [sending, setSending] = useState(false)
  const [sendResults, setSendResults] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    if (theme === 'dark') {
      html.classList.add('dark'); body.classList.add('dark')
    } else {
      html.classList.remove('dark'); body.classList.remove('dark')
    }
    html.setAttribute('data-theme', theme)
    body.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  async function apiFetch(path, options){
    const r = await fetch(`${API}${path}`, options)
    const ct = r.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      return j
    }
    const txt = await r.text()
    throw new Error(`Unexpected response (status ${r.status}). Body: ${txt.slice(0,200)}`)
  }

  const handleParse = async () => {
    if(!file) return
    const fd = new FormData()
    fd.append('file', file)
    setLoading(true)
    try{
      const j = await apiFetch('/api/parse', { method: 'POST', body: fd })
      setHeaders(j.headers||[])
      setSample(j.sample||[])
      if(j.headers?.length){
        setMapping(m => ({ ...m, email: m.email || j.headers.find(h=>/mail/i.test(h)) || j.headers[0] }))
        setMapping(m => ({ ...m, name: m.name || j.headers.find(h=>/name/i.test(h)) || j.headers[0] }))
      }
    }catch(e){ alert(e.message) }
    finally{ setLoading(false) }
  }

  const handlePersonalize = async () => {
    setLoading(true)
    try{
      const rows = rowsForPreview()
      const j = await apiFetch('/api/personalize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, rows, mapping }) })
      setPreview(j.messages||[])
    }catch(e){ alert(e.message) }
    finally{ setLoading(false) }
  }

  const validEmail = (v) => /^(?:[a-zA-Z0-9_.+-]+)@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(v||'')
  const emailOf = (row) => (row?.[mapping.email] ?? row?.email ?? '').trim()
  const nameOf  = (row) => (row?.[mapping.name]  ?? row?.name  ?? '').trim()
  const rowsForPreview = () => {
    let rows = [...sample]
    if (onlyValid) rows = rows.filter(r => validEmail(emailOf(r)))
    if (dedupe) {
      const seen = new Set()
      rows = rows.filter(r => { const e = emailOf(r).toLowerCase(); if(!e) return false; if(seen.has(e)) return false; seen.add(e); return true })
    }
    return rows
  }

  const stats = (() => {
    const total = sample.length
    const emails = sample.map(emailOf).filter(e=>e)
    const valid = emails.filter(validEmail)
    const uniqueValid = new Set(valid.map(e=>e.toLowerCase())).size
    return { total, withEmail: emails.length, valid: valid.length, uniqueValid }
  })()

  const handleSaveSmtp = () => {
    if (smtp.remember) localStorage.setItem('smtpConfig', JSON.stringify(smtp))
    else localStorage.removeItem('smtpConfig')
    alert('SMTP settings saved locally')
  }

  const handleSend = async () => {
    try{
      if (!preview.length) return alert('Generate preview first')
      if (!smtp.fromEmail || !smtp.user || !smtp.host || !smtp.pass) return alert('Fill SMTP fields')
      setSending(true); setSendResults(null)
      const payload = {
        from: `${smtp.fromName||''} <${smtp.fromEmail}>`,
        subject: smtp.subject || 'Hello',
        messages: preview.filter(m=> (m.to||'').trim()).map(m=> ({ to: m.to, name: m.name, body: m.body })),
        smtp: { host: smtp.host, port: Number(smtp.port)||465, secure: !!smtp.secure, user: smtp.user, pass: smtp.pass }
      }
      const j = await apiFetch('/api/send', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      setSendResults(j)
    }catch(e){ alert(e.message) }
    finally{ setSending(false) }
  }

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-secondary/50">
      <header className="sticky top-0 z-10 border-b border-border bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/50">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="text-sm uppercase tracking-wider text-muted-foreground">YourCase</div>
          <h1 className="text-base font-medium">CSV Mailer — Draft (M0–M2)</h1>
          <div className="flex items-center gap-3">
            <Link className="btn btn-outline h-8 px-3 text-xs" to="/history">History</Link>
            <button
              className="btn btn-outline h-8 w-8 p-0 text-foreground"
              onClick={()=>setTheme(t=> t==='dark' ? 'light' : 'dark')}
              aria-label={theme==='dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme==='dark' ? 'Light mode' : 'Dark mode'}
            >
              <span className="text-base leading-none" aria-hidden="true">{theme==='dark' ? '☀️' : '🌙'}</span>
            </button>
            <div className="text-xs text-muted-foreground">v0.1.0</div>
          </div>
        </div>
      </header>
      <div className="max-w-5xl mx-auto p-6">
        <div className="text-sm text-muted-foreground mb-2">Upload → Map → Prompt → Preview</div>

        <div className="grid gap-4 mt-4">
          <section className="card p-4">
            <h3 className="text-lg font-medium mb-2">1) Upload CSV</h3>
            <div
              className={`w-full min-h-[50vh] border-2 border-dashed rounded-xl text-center transition-all duration-300 flex flex-col items-center justify-center gap-2 select-none dropzone-spotlight
              ${isDragging
                ? 'border-primary ring-2 ring-primary/70 bg-gradient-to-br from-primary/10 via-secondary/20 to-transparent shadow-lg scale-[1.01]'
                : 'border-border hover:border-primary/60 hover:ring-1 hover:ring-primary/40 hover:bg-secondary/30'}
              `}
              onDragOver={(e)=>{ e.preventDefault(); setIsDragging(true) }}
              onDragLeave={()=> setIsDragging(false)}
              onDrop={(e)=>{ e.preventDefault(); setIsDragging(false); const f=e.dataTransfer.files?.[0]; if(f){ setFile(f) } }}
              onClick={()=> fileInputRef.current?.click()}
              role="button"
              aria-label="Upload CSV via drag and drop"
              tabIndex={0}
            >
              <div className="text-xl font-medium">Upload your CSV</div>
              <div className="text-sm text-muted-foreground">Drag & drop your .csv here</div>
              <div className="text-xs text-muted-foreground">or click to browse</div>
              <div className="mt-3 text-sm px-2 py-1 rounded bg-muted/40 border border-border">
                {file ? `Selected: ${file.name}` : 'No file selected'}
              </div>
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                accept=".csv,text/csv"
                onChange={e=>setFile(e.target.files?.[0]||null)}
              />
            </div>
            <div className="flex items-center gap-3 mt-3">
              <button className="btn btn-primary" onClick={handleParse} disabled={!file || loading}>
                {loading? 'Parsing…' : 'Parse'}
              </button>
            </div>
            {headers.length>0 && (
              <div className="text-sm text-muted-foreground mt-2">Detected columns: {headers.join(', ')}</div>
            )}
          </section>

          <section className="card p-4">
            <h3 className="text-lg font-medium mb-2">2) Map Columns</h3>
            <div className="flex items-center gap-3">
              <label className="text-sm">Email</label>
              <select className="select" value={mapping.email} onChange={e=>setMapping(m=>({ ...m, email: e.target.value }))}>
                {headers.map(h=> <option key={h} value={h}>{h}</option> )}
              </select>
              <label className="text-sm">Name</label>
              <select className="select" value={mapping.name} onChange={e=>setMapping(m=>({ ...m, name: e.target.value }))}>
                {headers.map(h=> <option key={h} value={h}>{h}</option> )}
              </select>
            </div>
            {sample.length>0 && (
              <div className="mt-3 grid sm:grid-cols-2 gap-2 text-sm">
                <div className="card p-3">
                  <div className="text-muted-foreground">Data summary</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-xs">Rows: {stats.total}</span>
                    <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-xs">With email: {stats.withEmail}</span>
                    <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-xs">Valid: {stats.valid}</span>
                    <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-xs">Unique valid: {stats.uniqueValid}</span>
                  </div>
                </div>
                <div className="card p-3">
                  <div className="text-muted-foreground">Filters</div>
                  <div className="mt-1 flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" className="accent-foreground" checked={onlyValid} onChange={e=>setOnlyValid(e.target.checked)} />
                      Only valid emails
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" className="accent-foreground" checked={dedupe} onChange={e=>setDedupe(e.target.checked)} />
                      Dedupe by email
                    </label>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="card p-4">
            <h3 className="text-lg font-medium mb-2">3) Prompt</h3>
            <textarea className="input h-32" value={prompt} onChange={e=>setPrompt(e.target.value)} />
            <button className="btn btn-outline mt-3" onClick={handlePersonalize} disabled={loading || sample.length===0}>
              {loading? 'Generating…' : 'Dry‑run personalize (first 20)'}
            </button>
          </section>

          <section className="card p-4">
            <h3 className="text-lg font-medium mb-2">4) Preview</h3>
            {preview.length===0 ? <div className="text-sm text-muted-foreground">No preview yet.</div> : (
              <ul className="grid gap-3">
                {preview.map((m,i)=> (
                  <li key={i} className="border border-border rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">To: {m.to || '(no email)'} {m.name? `• ${m.name}` : ''}</div>
                    <pre className="whitespace-pre-wrap text-sm">{m.body}</pre>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-4">
            <h3 className="text-lg font-medium mb-2">5) Send via SMTP (Zoho)</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-sm">From name
                <input className="input mt-1" value={smtp.fromName} onChange={e=>setSmtp(s=>({...s, fromName:e.target.value}))} />
              </label>
              <label className="text-sm">From email
                <input className="input mt-1" value={smtp.fromEmail} onChange={e=>setSmtp(s=>({...s, fromEmail:e.target.value}))} />
              </label>
              <label className="text-sm">Subject
                <input className="input mt-1" value={smtp.subject} onChange={e=>setSmtp(s=>({...s, subject:e.target.value}))} />
              </label>
              <div></div>
              <label className="text-sm">SMTP host
                <input className="input mt-1" value={smtp.host} onChange={e=>setSmtp(s=>({...s, host:e.target.value}))} />
              </label>
              <label className="text-sm">Port
                <input className="input mt-1" type="number" value={smtp.port} onChange={e=>setSmtp(s=>({...s, port:e.target.value}))} />
              </label>
              <label className="text-sm">Secure (SSL)
                <select className="select mt-1" value={String(smtp.secure)} onChange={e=>setSmtp(s=>({...s, secure: e.target.value==='true'}))}>
                  <option value="true">true (465)</option>
                  <option value="false">false (587)</option>
                </select>
              </label>
              <div></div>
              <label className="text-sm">Username
                <input className="input mt-1" value={smtp.user} onChange={e=>setSmtp(s=>({...s, user:e.target.value}))} />
              </label>
              <label className="text-sm">App password
                <input className="input mt-1" type="password" value={smtp.pass} onChange={e=>setSmtp(s=>({...s, pass:e.target.value}))} />
              </label>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <label className="text-sm flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={smtp.remember} onChange={e=>setSmtp(s=>({...s, remember:e.target.checked}))} /> Save SMTP in this browser
              </label>
              <button className="btn btn-outline" onClick={handleSaveSmtp}>Save</button>
              <button className="btn btn-primary" disabled={sending || preview.length===0} onClick={handleSend}>{sending? 'Sending…' : `Send ${preview.length} emails`}</button>
            </div>
            {sendResults && (
              <div className="mt-3 text-sm">
                <div className="text-muted-foreground">Result: sent {sendResults.sent} messages</div>
                <ul className="mt-2 grid gap-1 max-h-48 overflow-auto">
                  {sendResults.results?.map((r,i)=> (
                    <li key={i} className="text-xs">{r.to}: {r.messageId ? `sent (${r.messageId})` : r.error || 'done'}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function HistoryPage(){
  const [items, setItems] = useState([])
  const [active, setActive] = useState(null)
  useEffect(() => {
    (async () => {
      try { const j = await (await fetch('/api/history')).json(); setItems(j.items||[]) } catch (e) { /* noop */ }
    })()
  }, [])
  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Send History</h2>
        <Link className="btn btn-outline h-8 px-3 text-xs" to="/">Back</Link>
      </div>
      <div className="mt-3 overflow-auto max-h-[70vh] card p-4">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-1 pr-3">Date</th>
              <th className="py-1 pr-3">Time</th>
              <th className="py-1 pr-3">Name</th>
              <th className="py-1 pr-3">Email</th>
              <th className="py-1 pr-3">More</th>
            </tr>
          </thead>
          <tbody>
            {items.map(h => {
              const d = new Date(h.at)
              const dateStr = d.toLocaleDateString()
              const timeStr = d.toLocaleTimeString()
              return (
                <tr key={h.id} className="border-t border-border">
                  <td className="py-1 pr-3 whitespace-nowrap">{dateStr}</td>
                  <td className="py-1 pr-3 whitespace-nowrap">{timeStr}</td>
                  <td className="py-1 pr-3">
                    {h.name ? (
                      <span className="inline-block rounded px-2 py-0.5 bg-emerald-500 text-white">{h.name}</span>
                    ) : '-'}
                  </td>
                  <td className="py-1 pr-3">{h.to}</td>
                  <td className="py-1 pr-3"><button className="btn btn-outline h-7 px-2 text-xs" onClick={()=>setActive(h)}>More</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {active && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="card max-w-2xl w-full p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-medium">Message Details</h3>
              <button className="btn btn-outline h-8 px-3 text-xs" onClick={()=>setActive(null)}>Close</button>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">To:</span> {active.name ? `${active.name} <${active.to}>` : active.to}</div>
              <div><span className="text-muted-foreground">Time:</span> {new Date(active.at).toLocaleString()}</div>
              <div><span className="text-muted-foreground">From:</span> {active.from}</div>
              <div><span className="text-muted-foreground">Provider:</span> {active.provider}</div>
              <div className="col-span-2"><span className="text-muted-foreground">Subject:</span> {active.subject}</div>
              <div className="col-span-2"><span className="text-muted-foreground">Message:</span>
                <pre className="whitespace-pre-wrap mt-1 text-xs p-2 rounded bg-muted/50">{active.body || active.preview}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Root(){
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/history" element={<HistoryPage />} />
      </Routes>
    </BrowserRouter>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('Root container missing')
let root = container.__reactRoot || null
if (!root) { root = createRoot(container); container.__reactRoot = root }
root.render(<Root />)
