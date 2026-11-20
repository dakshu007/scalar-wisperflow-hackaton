import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import QRCode from 'qrcode'
import { Mic, MessageCircle, Send, Trash2, Volume2 } from 'lucide-react'
import { setState, useStore } from '../lib/store'
import type { Helper, LedgerEntry } from '../lib/types'
import { MONTHS, WEEKDAYS_SHORT, fromIso, today } from '../lib/dates'
import { LANGS, ROLES, billSentence, langStyle } from '../lib/i18n'
import { computeBill, upiLink, type DayCell } from '../lib/ledger'
import { sendBill } from '../lib/actions'
import { speak } from '../lib/speech'
import { AppNav, Avatar, Eyebrow, useToast } from '../components/ui'

function Cell({ c, h }: { c: DayCell; h: Helper }) {
  const base = 'relative flex aspect-square flex-col items-center justify-center rounded-xl text-[13px] font-medium transition'
  let cls = 'bg-[#FFFFF5] border border-ink/10'
  let tag = ''
  if (c.status === 'future') cls = 'border border-dashed border-ink/15 text-muted'
  if (c.status === 'leave') { cls = 'bg-lilac border border-ink/20'; tag = 'leave' }
  if (c.status === 'leave-unpaid') { cls = 'bg-[#FFD1C2] border border-ink/20'; tag = 'unpaid' }
  if (c.status === 'paused') { cls = 'striped border border-ink/15 text-muted'; tag = 'paused' }
  if (c.isToday) cls += ' ring-2 ring-ink'
  const showQty = h.pay.kind !== 'monthly' && c.qty > 0 && c.status !== 'future'
  return (
    <div className={`${base} ${cls}`} title={`${c.date} · ${c.status}`}>
      <span>{c.day}</span>
      {tag && <span className="text-[9px] uppercase tracking-wide opacity-70">{tag}</span>}
      {showQty && <span className="text-[10px] font-semibold text-forest">{c.qty}</span>}
      {c.status === 'present' && h.pay.kind === 'monthly' && <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-forest" />}
      {c.extra > 0 && <span className="absolute -top-1.5 -right-1 rounded-full bg-coral px-1 text-[9px] font-bold text-white">+{c.extra}</span>}
      {c.advance > 0 && <span className="absolute -bottom-1.5 rounded-full bg-butter px-1 text-[9px] font-bold">₹{c.advance}</span>}
    </div>
  )
}

const typeLabel: Record<LedgerEntry['type'], string> = { leave: 'Leave', pause: 'Paused', extra: 'Extra', count: 'Clothes', advance: 'Advance' }

export default function Hisaab() {
  const helpers = useStore((s) => s.helpers)
  const ledger = useStore((s) => s.ledger)
  const [sel, setSel] = useState(helpers[0]?.id)
  const [qr, setQr] = useState('')
  const toast = useToast()
  const h = helpers.find((x) => x.id === sel) ?? helpers[0]
  const t = useMemo(() => today(), [])
  const bill = useMemo(() => (h ? computeBill(h, ledger, t.getFullYear(), t.getMonth(), true) : null), [h, ledger, t])
  const sofar = useMemo(() => (h ? computeBill(h, ledger, t.getFullYear(), t.getMonth(), false) : null), [h, ledger, t])
  const entries = useMemo(() => ledger.filter((e) => e.helperId === h?.id).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 12), [ledger, h])

  useEffect(() => {
    if (!h || !bill) return
    QRCode.toDataURL(upiLink(h, bill.total), { margin: 1, width: 220, color: { dark: '#1A1A1A', light: '#FFFFEB' } }).then(setQr)
  }, [h, bill])

  if (!h || !bill || !sofar) return null
  const first = fromIso(bill.cells[0].date).getDay()
  const voiceBill = billSentence(h, h.lang, bill.work, bill.advance, bill.total)

  return (
    <div className="min-h-screen pb-24">
      <AppNav />
      <main className="mx-auto max-w-5xl px-4">
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>{MONTHS[t.getMonth()]} {t.getFullYear()}</Eyebrow>
            <h1 className="serif mt-2 text-[48px] leading-[0.95] sm:text-[60px]">
              The hisaab, <em>written by voice.</em>
            </h1>
          </div>
          <button
            className="btn-lilac inline-flex items-center gap-2 px-4 py-2.5"
            onClick={() => {
              helpers.forEach((x) => sendBill(x))
              toast({ text: `Voice bills sent to all ${helpers.length} helpers, each in their own language.` })
            }}
          >
            <Send size={16} /> Send all bills
          </button>
        </div>

        <div className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4">
          {helpers.map((x) => (
            <button key={x.id} onClick={() => setSel(x.id)} className={`flex shrink-0 items-center gap-2 rounded-full border py-1.5 pr-4 pl-1.5 text-[14px] font-semibold transition ${x.id === h.id ? 'border-ink bg-ink text-cream' : 'border-ink/15 bg-cream hover:border-ink'}`}>
              <Avatar helper={x} size={28} /> {x.name}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
          <motion.section key={h.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
            <div className="mb-4 flex items-center gap-3">
              <Avatar helper={h} size={44} />
              <div className="leading-tight">
                <p className="text-[18px] font-semibold">{h.name}</p>
                <p className="text-[13px] text-muted">
                  {ROLES[h.role].label} · {LANGS[h.lang].name} ·{' '}
                  {h.pay.kind === 'monthly' ? `₹${h.pay.amount.toLocaleString('en-IN')}/month` : h.pay.kind === 'perUnit' ? `${h.pay.defaultQty} ${h.pay.unit}/day × ₹${h.pay.unitPrice}` : `₹${h.pay.rate} per ${h.pay.unit.replace(/s$/, '')}`}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
              {WEEKDAYS_SHORT.map((d) => <div key={d}>{d.slice(0, 2)}</div>)}
            </div>
            <div className="mt-1.5 grid grid-cols-7 gap-1.5">
              {Array.from({ length: first }).map((_, i) => <div key={`b${i}`} />)}
              {bill.cells.map((c) => <Cell key={c.date} c={c} h={h} />)}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-lilac" /> Paid leave</span>
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-[#FFD1C2]" /> Unpaid leave</span>
              <span className="inline-flex items-center gap-1"><span className="striped h-3 w-3 rounded border border-ink/15" /> Paused</span>
              <span className="inline-flex items-center gap-1"><span className="rounded bg-coral px-1 text-[9px] font-bold text-white">+1</span> Extra</span>
              <span className="inline-flex items-center gap-1"><span className="rounded bg-butter px-1 text-[9px] font-bold">₹</span> Advance</span>
            </div>

            <h3 className="mt-6 mb-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-muted">Every entry, and who said it</h3>
            <ul className="divide-y divide-ink/10">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2 text-[14px]">
                  <span className="w-20 shrink-0 text-muted">{fromIso(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  <span className="flex-1 font-medium">
                    {typeLabel[e.type]}
                    {e.qty ? ` · ${e.qty}` : ''}
                    {e.amount ? ` · ₹${e.amount}` : ''}
                    {e.type === 'leave' && e.paid === false ? ' · unpaid' : ''}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${e.source === 'voice' ? 'bg-lilac' : e.source === 'reply' ? 'bg-mint text-forest' : 'bg-sand text-ink-2'}`}>
                    {e.source === 'voice' ? <><Mic size={11} /> you said</> : e.source === 'reply' ? <><MessageCircle size={11} /> {h.name} said</> : 'earlier'}
                  </span>
                  <button aria-label="Remove entry" onClick={() => setState((s) => ({ ...s, ledger: s.ledger.filter((x) => x.id !== e.id) }))} className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-ink/5 hover:text-ink">
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
              {!entries.length && <li className="py-3 text-[14px] text-muted">No changes this month — normal service every day.</li>}
            </ul>
          </motion.section>

          <aside className="space-y-4">
            <motion.div key={h.id + bill.total} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="relative overflow-hidden rounded-[24px] bg-forest p-5 text-cream">
              <Eyebrow className="!text-cream/60">Bill on 1 {MONTHS[(t.getMonth() + 1) % 12]}</Eyebrow>
              <p className="serif mt-1 text-[60px] leading-none">₹{bill.total.toLocaleString('en-IN')}</p>
              <p className="mt-1 text-[13px] text-cream/70">So far this month: ₹{sofar.total.toLocaleString('en-IN')}</p>
              <ul className="mt-4 space-y-1.5 text-[14px]">
                {bill.lines.map((l) => (
                  <li key={l.label} className="flex justify-between gap-3">
                    <span className="text-cream/80">{l.label}</span>
                    <span className="font-semibold tabular-nums">{l.amount < 0 ? '−' : ''}₹{Math.abs(l.amount).toLocaleString('en-IN')}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-2xl bg-cream/10 p-3">
                <p className="text-[12px] uppercase tracking-[0.14em] text-cream/60">{h.name} will hear</p>
                <p className="mt-1 text-[16px] leading-snug" style={langStyle(h.lang)}>{voiceBill}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => speak(voiceBill, h.lang, { rate: 0.9 })} className="inline-flex items-center gap-1.5 rounded-lg bg-cream px-3 py-2 text-[14px] font-semibold text-ink">
                  <Volume2 size={15} /> Play
                </button>
                <button onClick={() => { sendBill(h); toast({ text: `Voice bill sent to ${h.name} in ${LANGS[h.lang].name}.` }) }} className="btn-lilac inline-flex items-center gap-1.5 px-3 py-2 text-[14px]">
                  <Send size={15} /> Send to {h.name}
                </button>
              </div>
            </motion.div>

            <div className="card flex items-center gap-4 p-4">
              {qr && <img src={qr} alt={`UPI QR for ₹${bill.total}`} className="h-28 w-28 rounded-lg border border-ink/10" />}
              <div className="min-w-0 text-[14px]">
                <p className="font-semibold">Pay by UPI</p>
                <p className="mt-0.5 truncate text-muted">{h.upi}</p>
                <a href={upiLink(h, bill.total)} className="mt-2 inline-block font-semibold text-forest hover:underline">Open UPI app →</a>
                <a
                  className="mt-1 block font-semibold text-forest hover:underline"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://wa.me/?text=${encodeURIComponent(`${voiceBill}\n\n${billSentence(h, 'en', bill.work, bill.advance, bill.total)}`)}`}
                >
                  Share on WhatsApp →
                </a>
              </div>
            </div>

            <div className="card p-4 text-[13px] leading-relaxed text-muted">
              <p className="font-semibold text-ink">Fair to both sides</p>
              Every entry shows who said it. {h.name} hears the same bill in {LANGS[h.lang].name} and can reply by voice to dispute anything — no amount is final until both agree.
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
