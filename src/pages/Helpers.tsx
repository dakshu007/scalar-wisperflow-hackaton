import { useState } from 'react'
import { motion } from 'framer-motion'
import { ExternalLink, KeyRound, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { resetState, setState, uid, useStore } from '../lib/store'
import type { Helper, Lang, PayRule, Role } from '../lib/types'
import { LANGS, ROLES } from '../lib/i18n'
import { HELPER_COLORS } from '../lib/seed'
import { AppNav, Avatar, Eyebrow, useToast } from '../components/ui'

const input = 'w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-[15px] outline-none focus:border-ink'

function defaultPay(role: Role): PayRule {
  if (role === 'milkman') return { kind: 'perUnit', unitPrice: 30, defaultQty: 2, unit: 'packets' }
  if (role === 'paper') return { kind: 'perUnit', unitPrice: 8, defaultQty: 1, unit: 'papers' }
  if (role === 'press') return { kind: 'perItem', rate: 10, unit: 'clothes' }
  return { kind: 'monthly', amount: 5000 }
}

function HelperForm({ initial, onSave, onCancel }: { initial?: Helper; onSave: (h: Helper) => void; onCancel: () => void }) {
  const [h, setH] = useState<Helper>(
    initial ?? { id: uid(), name: '', role: 'maid', lang: 'hi', pay: defaultPay('maid'), color: HELPER_COLORS[Math.floor(Math.random() * HELPER_COLORS.length)], upi: '' },
  )
  const pay = h.pay
  return (
    <form
      className="card grid gap-3 p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!h.name.trim()) return
        onSave({ ...h, name: h.name.trim(), id: initial?.id ?? (h.name.trim().toLowerCase().replace(/[^a-z]/g, '') || uid()) })
      }}
    >
      <label className="text-[13px] font-semibold">Name<input className={input} value={h.name} onChange={(e) => setH({ ...h, name: e.target.value })} placeholder="e.g. Kamala" autoFocus /></label>
      <label className="text-[13px] font-semibold">Role
        <select className={input} value={h.role} onChange={(e) => { const role = e.target.value as Role; setH({ ...h, role, pay: initial ? h.pay : defaultPay(role) }) }}>
          {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
        </select>
      </label>
      <label className="text-[13px] font-semibold">Hears messages in
        <select className={input} value={h.lang} onChange={(e) => setH({ ...h, lang: e.target.value as Lang })}>
          {Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v.native} — {v.name}</option>)}
        </select>
      </label>
      <label className="text-[13px] font-semibold">UPI ID<input className={input} value={h.upi ?? ''} onChange={(e) => setH({ ...h, upi: e.target.value })} placeholder="name@upi" /></label>
      <div className="text-[13px] font-semibold sm:col-span-2">
        Pay rule
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <select className={`${input} !w-auto`} value={pay.kind} onChange={(e) => setH({ ...h, pay: e.target.value === 'monthly' ? { kind: 'monthly', amount: 5000 } : e.target.value === 'perUnit' ? { kind: 'perUnit', unitPrice: 30, defaultQty: 1, unit: 'packets' } : { kind: 'perItem', rate: 10, unit: 'clothes' } })}>
            <option value="monthly">Monthly salary</option>
            <option value="perUnit">Daily delivery</option>
            <option value="perItem">Per item</option>
          </select>
          {pay.kind === 'monthly' && <>₹<input type="number" className={`${input} !w-28`} value={pay.amount} onChange={(e) => setH({ ...h, pay: { ...pay, amount: Number(e.target.value) } })} /> / month</>}
          {pay.kind === 'perUnit' && <><input type="number" className={`${input} !w-16`} value={pay.defaultQty} onChange={(e) => setH({ ...h, pay: { ...pay, defaultQty: Number(e.target.value) } })} /><input className={`${input} !w-24`} value={pay.unit} onChange={(e) => setH({ ...h, pay: { ...pay, unit: e.target.value } })} /> a day × ₹<input type="number" className={`${input} !w-20`} value={pay.unitPrice} onChange={(e) => setH({ ...h, pay: { ...pay, unitPrice: Number(e.target.value) } })} /></>}
          {pay.kind === 'perItem' && <>₹<input type="number" className={`${input} !w-20`} value={pay.rate} onChange={(e) => setH({ ...h, pay: { ...pay, rate: Number(e.target.value) } })} /> per <input className={`${input} !w-28`} value={pay.unit} onChange={(e) => setH({ ...h, pay: { ...pay, unit: e.target.value } })} /></>}
        </div>
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <button className="btn-lilac px-4 py-2">{initial ? 'Save' : 'Add helper'}</button>
        <button type="button" className="btn-ghost px-4 py-2" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

export default function Helpers() {
  const helpers = useStore((s) => s.helpers)
  const settings = useStore((s) => s.settings)
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const toast = useToast()
  const setSettings = (patch: Partial<typeof settings>) => setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }))

  return (
    <div className="min-h-screen pb-24">
      <AppNav />
      <main className="mx-auto max-w-3xl px-4">
        <Eyebrow className="mt-6">Your home's network</Eyebrow>
        <h1 className="serif mt-2 text-[48px] leading-[0.95] sm:text-[60px]">
          The people <em>who run your home.</em>
        </h1>
        <p className="mt-3 max-w-xl text-ink-2">Each helper gets a private link — their “WhatsApp”. No app, no login, no reading. Just big play buttons and one mic.</p>

        <div className="mt-6 space-y-3">
          {helpers.map((h) =>
            editing === h.id ? (
              <HelperForm key={h.id} initial={h} onCancel={() => setEditing(null)} onSave={(n) => { setState((s) => ({ ...s, helpers: s.helpers.map((x) => (x.id === h.id ? n : x)) })); setEditing(null) }} />
            ) : (
              <motion.div layout key={h.id} className="card flex items-center gap-3 p-3">
                <Avatar helper={h} size={44} />
                <button className="min-w-0 flex-1 text-left leading-tight" onClick={() => setEditing(h.id)}>
                  <p className="font-semibold">{h.name}</p>
                  <p className="text-[13px] text-muted">{ROLES[h.role].label} · hears {LANGS[h.lang].native} · {h.pay.kind === 'monthly' ? `₹${h.pay.amount}/mo` : h.pay.kind === 'perUnit' ? `₹${h.pay.unitPrice} × ${h.pay.defaultQty}/day` : `₹${h.pay.rate}/${h.pay.unit.replace(/s$/, '')}`}</p>
                </button>
                <Link to={`/h/${h.id}`} target="_blank" className="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px]">
                  Their phone <ExternalLink size={13} />
                </Link>
                <button aria-label={`Remove ${h.name}`} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-ink/5 hover:text-ink" onClick={() => { if (confirm(`Remove ${h.name}?`)) setState((s) => ({ ...s, helpers: s.helpers.filter((x) => x.id !== h.id) })) }}>
                  <Trash2 size={15} />
                </button>
              </motion.div>
            ),
          )}
          {adding ? (
            <HelperForm onCancel={() => setAdding(false)} onSave={(n) => { setState((s) => ({ ...s, helpers: [...s.helpers, n] })); setAdding(false); toast({ text: `${n.name} added. Share their link from “Their phone”.` }) }} />
          ) : (
            <button onClick={() => setAdding(true)} className="flex w-full items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-ink/20 py-4 font-semibold text-ink-2 transition hover:border-ink hover:text-ink">
              <Plus size={18} /> Add a helper
            </button>
          )}
        </div>

        <section className="mt-10">
          <h2 className="serif text-[32px] leading-none">Settings</h2>
          <div className="card mt-4 grid gap-4 p-5 sm:grid-cols-2">
            <label className="text-[13px] font-semibold">Your name<input className={input} value={settings.employerName} onChange={(e) => setSettings({ employerName: e.target.value })} /></label>
            <label className="text-[13px] font-semibold">I mostly speak
              <select className={input} value={settings.recogLang} onChange={(e) => setSettings({ recogLang: e.target.value as typeof settings.recogLang })}>
                <option value="en-IN">English / Tanglish / Hinglish (en-IN)</option>
                <option value="ta-IN">Tamil (ta-IN)</option>
                <option value="hi-IN">Hindi (hi-IN)</option>
              </select>
            </label>
          </div>

          <div className="mt-4 overflow-hidden rounded-[20px] bg-ink p-5 text-cream">
            <p className="flex items-center gap-2 font-semibold"><KeyRound size={17} /> AI brain (optional, free)</p>
            <p className="mt-1 text-[14px] text-cream/70">
              Works offline for everyday sentences. Add a free Google Gemini key to understand <em>any</em> sentence in any language mix, and translate replies.
              Get one at <a className="font-semibold text-lilac underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>. It stays in this browser only.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_200px]">
              <input type="password" className={`${input} !bg-cream text-ink`} placeholder="Paste Gemini API key" value={settings.geminiKey} onChange={(e) => setSettings({ geminiKey: e.target.value })} />
              <input className={`${input} !bg-cream text-ink`} value={settings.model} onChange={(e) => setSettings({ model: e.target.value })} aria-label="Model" />
            </div>
          </div>

          <button
            onClick={() => { if (confirm('Reset all demo data?')) { resetState(); toast({ text: 'Demo data restored.' }) } }}
            className="mt-6 inline-flex items-center gap-2 text-[14px] font-semibold text-muted hover:text-ink"
          >
            <RotateCcw size={15} /> Reset demo data
          </button>
        </section>
      </main>
    </div>
  )
}
