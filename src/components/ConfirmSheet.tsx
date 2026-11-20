import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, Check, Mic, Pencil, Send, Trash2, X } from 'lucide-react'
import type { Action, Clarification, Draft, Helper } from '../lib/types'
import { LANGS, ROLES, composeMessage, langStyle } from '../lib/i18n'
import { describeDates } from '../lib/dates'
import { findNumber } from '../lib/numbers'
import { listenForYesNo, speak } from '../lib/speech'
import { translateText } from '../lib/ai'
import { getState } from '../lib/store'
import { Avatar, FlowPill, Sheet } from './ui'
import { PlayButton } from './Feed'

function shortSummary(d: Draft, h: Helper) {
  const parts = d.actions.map((a: Action) => {
    const dt = describeDates(a.dates)
    switch (a.type) {
      case 'leave': return `${a.paid === false ? 'unpaid ' : ''}leave ${dt}`
      case 'pause': return h.role === 'milkman' ? `no milk ${dt}` : h.role === 'paper' ? `no paper ${dt}` : `don't come ${dt}`
      case 'extra': return `${a.qty} extra ${dt}`
      case 'count': return `${a.qty} clothes`
      case 'advance': return `${a.amount} rupees advance`
      case 'note': return a.noteKey === 'only_iron' ? `only ${a.item}` : 'a note'
    }
  })
  return `${h.name}, ${parts.join(', ')}`
}

export function summarySpeech(drafts: Draft[], helpers: Helper[]) {
  const n = drafts.length
  const lines = drafts.map((d) => shortSummary(d, helpers.find((h) => h.id === d.helperId)!))
  return `${n === 1 ? 'One message' : `${n} messages`}. ${lines.join('. ')}. Say yes to send.`
}

/** Highlight numbers and date words so mistakes are easy to spot. */
function Highlight({ text }: { text: string }) {
  const parts = text.split(/(₹?\d[\d,]*|\b(?:today|tomorrow|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b)/g)
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-butter px-1 text-ink">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}

export function ConfirmSheet({
  open,
  drafts,
  setDrafts,
  clarifications,
  setClarifications,
  helpers,
  onSend,
  onClose,
  onRespeak,
}: {
  open: boolean
  drafts: Draft[]
  setDrafts: (d: Draft[] | ((d: Draft[]) => Draft[])) => void
  clarifications: Clarification[]
  setClarifications: (c: Clarification[] | ((c: Clarification[]) => Clarification[])) => void
  helpers: Helper[]
  onSend: () => void
  onClose: () => void
  onRespeak: () => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [voiceState, setVoiceState] = useState<'idle' | 'speaking' | 'awaiting'>('idle')
  const [amount, setAmount] = useState('')
  const cancelListen = useRef<() => void>(() => {})
  const spokeFor = useRef('')
  const H = (id: string) => helpers.find((h) => h.id === id)!

  // Read back the summary, then listen for "yes / seri / haan" or "no / venaam".
  const latest = useRef({ drafts, clarifications, helpers, onSend, onRespeak })
  latest.current = { drafts, clarifications, helpers, onSend, onRespeak }
  const speakKey = open && drafts.length ? drafts.map((d) => d.helperId + d.en).join('|') + '#' + clarifications.length : ''
  useEffect(() => {
    if (!speakKey || spokeFor.current === speakKey) return
    spokeFor.current = speakKey
    cancelListen.current()
    const { drafts: ds, clarifications: cs, helpers: hs } = latest.current
    const first = cs[0]
    const text = first ? `Before I send, one question. ${first.text.replace(/[“”]/g, '')}` : summarySpeech(ds, hs)
    setVoiceState('speaking')
    speak(text, 'en', {
      rate: 1.02,
      onEnd: () => {
        if (first || spokeFor.current !== speakKey) return setVoiceState('idle')
        setVoiceState('awaiting')
        const l = listenForYesNo(7000)
        cancelListen.current = l.cancel
        l.promise.then((v) => {
          setVoiceState('idle')
          if (spokeFor.current !== speakKey) return
          if (v === 'yes') latest.current.onSend()
          else if (v === 'no') latest.current.onRespeak()
        })
      },
    })
  }, [speakKey])

  useEffect(() => {
    if (!open) {
      spokeFor.current = ''
      cancelListen.current()
      setVoiceState('idle')
    }
  }, [open])

  const blocking = clarifications.length > 0

  const resolveWho = (c: Extract<Clarification, { kind: 'who' }>, helperId: string | null) => {
    setClarifications((cs) => cs.filter((x) => x.id !== c.id))
    if (c.guessId && helperId === null) {
      setDrafts((ds) => ds.filter((d) => d.helperId !== c.guessId))
      return
    }
    if (c.guessId && helperId === c.guessId) {
      setDrafts((ds) => ds.map((d) => (d.helperId === c.guessId ? { ...d, confidence: 0.95 } : d)))
      return
    }
    if (helperId && c.actions.length) {
      const h = H(helperId)
      const en = `${h.name}, ${c.segment}`
      const draft: Draft = { helperId, actions: c.actions, en, native: '', confidence: 0.9, translated: 'none' }
      setDrafts((ds) => [...ds.filter((d) => d.helperId !== helperId), ...ds.filter((d) => d.helperId === helperId).map((d) => ({ ...d, actions: [...d.actions, ...c.actions], en: `${d.en} ${c.segment}` })), ...(ds.some((d) => d.helperId === helperId) ? [] : [draft])])
      translateText(en, h.lang, getState().settings).then((t) => t && setDrafts((ds) => ds.map((d) => (d.helperId === helperId && !d.native ? { ...d, native: t.text, translated: t.via } : d))))
    }
  }

  const resolveAmount = (c: Extract<Clarification, { kind: 'amount' }>, value: number) => {
    const h = H(c.helperId)
    const action: Action = { type: 'advance', dates: c.dates, amount: value }
    setDrafts((ds) => {
      const has = ds.find((d) => d.helperId === h.id)
      if (has) {
        const actions = [...has.actions, action]
        return ds.map((d) => (d.helperId === h.id ? { ...d, actions, en: composeMessage(h, actions, 'en'), native: d.translated === 'ai' ? d.native : composeMessage(h, actions, h.lang) } : d))
      }
      return [...ds, { helperId: h.id, actions: [action], en: composeMessage(h, [action], 'en'), native: composeMessage(h, [action], h.lang), confidence: 0.95, translated: 'template' }]
    })
    setClarifications((cs) => cs.filter((x) => x.id !== c.id))
    setAmount('')
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        <div className="mb-5 flex items-start gap-3">
          <div className="flex-1">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Check before sending</p>
            <h2 className="serif mt-1 text-[34px] leading-none">
              {drafts.length} {drafts.length === 1 ? 'message' : 'messages'}, <em>{(() => { const n = new Set(drafts.map((d) => H(d.helperId).lang)).size; return `${n} ${n === 1 ? 'language' : 'languages'}` })()}</em>
            </h2>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-ink/5" aria-label="Close">
            <X size={18} />
          </button>
        </div>
      }
    >
      <AnimatePresence>
        {clarifications.map((c) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="mb-3 rounded-2xl border-2 border-coral bg-[#FFF1EC] p-4">
            <p className="flex items-center gap-2 font-semibold">
              <AlertCircle size={18} className="text-coral" /> {c.text}
            </p>
            {c.kind === 'who' && c.guessId && (
              <div className="mt-3 flex gap-2">
                <button className="btn-lilac px-4 py-1.5 text-[14px]" onClick={() => resolveWho(c, c.guessId!)}>Yes, {H(c.guessId).name}</button>
                <button className="btn-ghost px-4 py-1.5 text-[14px]" onClick={() => resolveWho(c, null)}>No, remove</button>
              </div>
            )}
            {c.kind === 'who' && !c.guessId && (
              <div className="mt-3 flex flex-wrap gap-2">
                {helpers.map((h) => (
                  <button key={h.id} className="btn-ghost inline-flex items-center gap-2 px-3 py-1.5 text-[14px]" onClick={() => resolveWho(c, h.id)}>
                    <Avatar helper={h} size={22} /> {h.name}
                  </button>
                ))}
                <button className="px-3 py-1.5 text-[14px] text-muted underline" onClick={() => resolveWho(c, null)}>Ignore</button>
              </div>
            )}
            {c.kind === 'amount' && (
              <div className="mt-3">
                <p className="mb-2 text-[13px] text-muted">I never guess money. Say or type the amount.</p>
                <div className="flex flex-wrap items-center gap-2">
                  {[200, 500, 1000].map((v) => (
                    <button key={v} className="btn-ghost px-3 py-1.5 text-[14px]" onClick={() => resolveAmount(c, v)}>₹{v}</button>
                  ))}
                  <form
                    className="flex items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const n = findNumber(amount)
                      if (n) resolveAmount(c, n)
                    }}
                  >
                    <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 750 or dhai sau" className="w-40 rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-[14px] outline-none focus:border-ink" />
                    <button className="btn-lilac px-3 py-1.5 text-[14px]">Set</button>
                  </form>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="space-y-3">
        {drafts.map((d, i) => {
          const h = H(d.helperId)
          const isEditing = editing === d.helperId
          return (
            <motion.div
              key={d.helperId}
              layout
              initial={{ opacity: 0, x: -20, rotate: -1 }}
              animate={{ opacity: 1, x: 0, rotate: 0 }}
              transition={{ delay: i * 0.12, type: 'spring', stiffness: 260, damping: 24 }}
              className="card overflow-hidden"
            >
              <div className="flex items-center gap-3 border-b border-ink/10 px-4 py-3">
                <Avatar helper={h} size={36} />
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="font-semibold">{h.name}</p>
                  <p className="text-[13px] text-muted">{ROLES[h.role].label} · hears {LANGS[h.lang].native}</p>
                </div>
                {d.confidence < 0.7 && <span className="rounded-full bg-[#FFF1EC] px-2 py-0.5 text-[11px] font-semibold text-coral">Unsure</span>}
                <button aria-label="Edit" onClick={() => { setEditing(isEditing ? null : d.helperId); setEditText(d.en) }} className="grid h-8 w-8 place-items-center rounded-full hover:bg-ink/5"><Pencil size={15} /></button>
                <button aria-label="Remove" onClick={() => setDrafts((ds) => ds.filter((x) => x.helperId !== d.helperId))} className="grid h-8 w-8 place-items-center rounded-full hover:bg-ink/5"><Trash2 size={15} /></button>
              </div>
              <div className="px-4 py-3">
                {isEditing ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault()
                      setEditing(null)
                      setDrafts((ds) => ds.map((x) => (x.helperId === d.helperId ? { ...x, en: editText, native: '', translated: 'none', actions: x.actions.filter((a) => a.type !== 'note').concat([]) } : x)))
                      const t = await translateText(editText, h.lang, getState().settings)
                      setDrafts((ds) => ds.map((x) => (x.helperId === d.helperId ? { ...x, native: t?.text ?? '', translated: t?.via ?? 'none' } : x)))
                    }}
                  >
                    <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={2} autoFocus className="w-full rounded-xl border border-ink/20 bg-white p-3 text-[15px] outline-none focus:border-ink" />
                    <div className="mt-2 flex gap-2">
                      <button className="btn-lilac px-3 py-1.5 text-[13px]">Save & translate</button>
                      <button type="button" className="btn-ghost px-3 py-1.5 text-[13px]" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <p className="text-[15px] leading-snug"><Highlight text={d.en} /></p>
                )}
                <div className="mt-3 flex items-center gap-3 rounded-xl bg-cream-2 p-3">
                  {d.native ? (
                    <>
                      <PlayButton text={d.native} lang={h.lang} small />
                      <p className="text-[18px] leading-snug" style={langStyle(h.lang)}>{d.native}</p>
                    </>
                  ) : (
                    <p className="text-[13px] text-muted">Translation unavailable offline — add a free Gemini key in Helpers → AI to translate any sentence. {h.name} will hear it in English for now.</p>
                  )}
                </div>
              </div>
            </motion.div>
          )
        })}
        {!drafts.length && !clarifications.length && (
          <div className="card p-6 text-center">
            <p className="serif text-[24px]">I didn't catch who that was for.</p>
            <p className="mt-1 text-muted">Try mentioning a name or role — “Sunita”, “milk”, “press-wala”.</p>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 -mx-5 mt-5 flex flex-wrap items-center gap-3 border-t border-ink/10 bg-cream px-5 pt-4 pb-1 sm:-mx-7 sm:px-7">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-muted">
          {voiceState === 'speaking' && <><FlowPill size="sm" thinking /> Reading it back…</>}
          {voiceState === 'awaiting' && <><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-coral opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-coral" /></span> Say <b className="text-ink">“yes”, “seri”</b> or <b className="text-ink">“haan”</b> to send</>}
          {voiceState === 'idle' && blocking && <>Answer the question above first</>}
        </div>
        <button className="btn-ghost inline-flex items-center gap-2 px-4 py-2.5 text-[15px]" onClick={onRespeak}>
          <Mic size={16} /> Change
        </button>
        <button disabled={blocking || !drafts.length} onClick={onSend} className="btn-lilac inline-flex items-center gap-2 px-5 py-2.5 text-[15px]">
          <Send size={16} /> Send to {drafts.length}
        </button>
      </div>
    </Sheet>
  )
}

export function SentBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-mint px-2 py-0.5 text-[12px] font-semibold text-forest">
      <Check size={12} /> Sent
    </span>
  )
}
