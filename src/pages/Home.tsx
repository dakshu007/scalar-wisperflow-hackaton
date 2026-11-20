import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, Keyboard, ShoppingBasket, Sparkles, Wand2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import type { Clarification, Draft } from '../lib/types'
import { greeting, iso, today, addDays } from '../lib/dates'
import { LANGS, ROLES } from '../lib/i18n'
import { parseOffline } from '../lib/parser'
import { hasAI, parseWithAI, translateText } from '../lib/ai'
import { chime, recognitionSupported, speak, useVoice } from '../lib/speech'
import { clearDoneShopping, sendDrafts, toggleShopping, undoSend } from '../lib/actions'
import { todayStatus } from '../lib/ledger'
import { AppNav, Avatar, Eyebrow, FlowPill, useToast } from '../components/ui'
import { MicButton } from '../components/MicButton'
import { ConfirmSheet } from '../components/ConfirmSheet'
import { FeedItem } from '../components/Feed'

const EXAMPLES = [
  { tag: 'Tanglish', text: 'Friday to Sunday naanga ooru la irukka maatom, so paal vendam, paper vendam. Sunita akka ku two days paid leave. Raju, school uniform mattum iron pannunga.' },
  { tag: 'Hinglish', text: 'Kal guests aa rahe hain, Sunita didi 6 roti extra banana. Ramesh bhaiya kal 1 packet extra doodh dena.' },
  { tag: 'Money', text: 'Lakshmi ku advance kudukanum.' },
  { tag: 'Misheard', text: 'Ramessh tomorrow no milk.' },
]

const THINKING = ['Cleaning up what you said…', 'Working out who needs to know…', 'Translating into বাংলা · ଓଡ଼ିଆ · हिन्दी · தமிழ்…', 'Writing the hisaab…']

export default function Home() {
  const helpers = useStore((s) => s.helpers)
  const messages = useStore((s) => s.messages)
  const ledger = useStore((s) => s.ledger)
  const shopping = useStore((s) => s.shopping)
  const settings = useStore((s) => s.settings)
  const toast = useToast()

  const voice = useVoice({ lang: settings.recogLang })
  const [phase, setPhase] = useState<'idle' | 'listening' | 'thinking' | 'error'>('idle')
  const [errorText, setErrorText] = useState('')
  const [thinkStep, setThinkStep] = useState(0)
  const [heard, setHeard] = useState('')
  const [typed, setTyped] = useState('')
  const [showType, setShowType] = useState(!recognitionSupported())
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [clar, setClar] = useState<Clarification[]>([])
  const [sheet, setSheet] = useState(false)
  const typedRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (phase !== 'thinking') return
    const t = setInterval(() => setThinkStep((s) => (s + 1) % THINKING.length), 700)
    return () => clearInterval(t)
  }, [phase])

  const understand = useCallback(
    async (text: string) => {
      setHeard(text)
      setPhase('thinking')
      setThinkStep(0)
      const started = Date.now()
      let result
      if (hasAI(settings)) {
        try {
          result = await parseWithAI(text, helpers, settings)
        } catch (e) {
          console.warn(e)
          toast({ text: 'AI is unreachable — understood it offline instead.' })
          result = parseOffline(text, helpers)
        }
      } else result = parseOffline(text, helpers)

      // Free-text notes without a template → try a keyless translation.
      const filled = await Promise.all(
        result.drafts.map(async (d) => {
          if (d.native) return d
          const h = helpers.find((x) => x.id === d.helperId)!
          const t = await translateText(d.en, h.lang, settings)
          return t ? { ...d, native: t.text, translated: t.via } : d
        }),
      )
      // Keep the "thinking" moment visible long enough to read.
      const wait = Math.max(0, 1100 - (Date.now() - started))
      await new Promise((r) => setTimeout(r, wait))
      setDrafts(filled)
      setClar(result.clarifications)
      setPhase('idle')
      setSheet(true)
    },
    [helpers, settings, toast],
  )

  const startListening = async () => {
    setErrorText('')
    setPhase('listening')
    const r = await voice.start()
    if (r.error === 'mic-denied' || r.error === 'not-allowed' || r.error === 'no-recognition') {
      setPhase('error')
      setErrorText(r.error === 'no-recognition' ? 'This browser can’t do speech recognition. Use Chrome or Edge — or type / dictate with Wispr Flow below.' : 'I need microphone permission. Allow it in the address bar, or type below.')
      setShowType(true)
      return
    }
    if (r.durationMs < 1000 || !r.transcript.trim()) {
      setPhase('error')
      const msg = 'Sorry, couldn’t hear that. Konjam closer to the phone, try again.'
      setErrorText(msg)
      speak(msg, 'en')
      return
    }
    understand(r.transcript)
  }

  const doSend = useCallback(() => {
    const ids = sendDrafts(drafts)
    chime()
    setSheet(false)
    const names = drafts.map((d) => helpers.find((h) => h.id === d.helperId)?.name).join(', ')
    toast({ text: `Sent to ${names}. Hisaab updated.`, action: { label: 'Undo', run: () => undoSend(ids) }, ms: 10000 })
    speak(`Sent.`, 'en')
    setDrafts([])
    setClar([])
    setHeard('')
  }, [drafts, helpers, toast])

  const startRef = useRef(startListening)
  startRef.current = startListening
  const respeak = useCallback(() => {
    setSheet(false)
    setTimeout(() => startRef.current(), 250)
  }, [])

  const feed = useMemo(() => {
    const since = addDays(today(), -2).getTime()
    return [...messages].filter((m) => m.createdAt >= since).sort((a, b) => b.createdAt - a.createdAt).slice(0, 30)
  }, [messages])

  const openShopping = shopping.filter((s) => !s.done)
  const listening = voice.listening

  return (
    <div className="min-h-screen pb-28">
      {new URLSearchParams(location.search).has('embed') && <div className="h-7" />}
      <AppNav />
      <main className="mx-auto max-w-5xl px-4">
        {/* Speak hero */}
        <section className="relative mt-4 overflow-hidden rounded-[32px] border border-ink/10 bg-[#FFFFF2] px-5 pt-10 pb-8 text-center sm:px-10">
          <Eyebrow>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</Eyebrow>
          <h1 className="serif mt-3 text-[44px] leading-[0.95] sm:text-[64px]">
            {greeting()}, <em>{settings.employerName}.</em>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[17px] text-ink-2">Speak once, in any language. Everyone at home hears it in theirs.</p>

          <div className="mt-6 flex flex-col items-center">
            <MicButton listening={listening} onStart={startListening} onStop={voice.stop} disabled={phase === 'thinking'} />
            <div className="-mt-4 h-[68px]">
              <AnimatePresence mode="wait">
                {listening ? (
                  <motion.div key="l" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-1">
                    <FlowPill levels={voice.levels} active size="md" />
                    <p className="text-[12px] font-medium text-muted">Listening · release or tap to finish</p>
                  </motion.div>
                ) : phase === 'thinking' ? (
                  <motion.div key="t" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-1">
                    <FlowPill size="md" thinking />
                    <p className="text-[12px] font-medium text-muted">{THINKING[thinkStep]}</p>
                  </motion.div>
                ) : (
                  <motion.p key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-3 text-[14px] font-medium text-muted">
                    Hold to talk · or tap once to start
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Live transcript, Wispr-style */}
          <div className={`mx-auto mt-2 max-w-2xl ${listening || phase !== 'idle' ? 'min-h-[64px]' : ''}`}>
            {(listening || phase === 'thinking') && (voice.interim || heard) && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="serif text-[22px] italic leading-snug text-ink-2 sm:text-[26px]">
                “{listening ? voice.interim : heard}”
              </motion.p>
            )}
            {phase === 'error' && (
              <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mx-auto inline-block rounded-2xl bg-[#FFF1EC] px-4 py-2 text-[15px] font-medium text-[#B33A1F]">
                {errorText}
              </motion.p>
            )}
          </div>

          {/* Type / Wispr Flow fallback */}
          <div className="mx-auto mt-2 max-w-2xl">
            {showType ? (
              <form
                className="flex items-end gap-2 rounded-2xl border border-ink/15 bg-white p-2 text-left"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (typed.trim()) understand(typed.trim())
                }}
              >
                <textarea
                  ref={typedRef}
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      if (typed.trim()) understand(typed.trim())
                    }
                  }}
                  rows={2}
                  placeholder="Type, or dictate here with Wispr Flow — any language mix works"
                  className="min-h-[52px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] outline-none"
                />
                <button disabled={!typed.trim() || phase === 'thinking'} className="btn-lilac inline-flex items-center gap-1.5 px-3.5 py-2 text-[14px]">
                  Go <ArrowRight size={15} />
                </button>
              </form>
            ) : (
              <button onClick={() => { setShowType(true); setTimeout(() => typedRef.current?.focus(), 50) }} className="inline-flex items-center gap-2 text-[14px] font-medium text-muted hover:text-ink">
                <Keyboard size={16} /> Prefer typing or Wispr Flow?
              </button>
            )}
          </div>

          <div className="mx-auto mt-6 max-w-3xl">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">Try saying</p>
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:flex-wrap sm:justify-center">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.tag}
                  onClick={() => { setTyped(ex.text); understand(ex.text) }}
                  disabled={phase === 'thinking'}
                  className="group flex max-w-[300px] shrink-0 items-start gap-2 rounded-2xl border border-ink/10 bg-cream px-3 py-2 text-left text-[13px] leading-snug transition hover:border-ink hover:bg-white"
                >
                  <span className="mt-0.5 shrink-0 rounded-full bg-lilac px-2 py-0.5 text-[11px] font-semibold">{ex.tag}</span>
                  <span className="line-clamp-2 text-ink-2">{ex.text}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-[12px] text-muted">
            {hasAI(settings) ? (
              <><Sparkles size={14} className="text-forest" /> Gemini AI on — understands any sentence</>
            ) : (
              <><Wand2 size={14} /> Offline brain · <Link to="/app/helpers" className="font-semibold text-ink underline">add a free AI key</Link> for any sentence</>
            )}
          </div>
        </section>

        {/* Today at home */}
        <section className="mt-8">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="serif text-[32px] leading-none">Today <em>at home</em></h2>
            <Link to="/app/helpers" className="text-[14px] font-semibold text-forest hover:underline">Manage</Link>
          </div>
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
            {helpers.map((h) => {
              const st = todayStatus(h, ledger)
              return (
                <Link key={h.id} to={`/h/${h.id}`} target="_blank" className="card flex min-w-[200px] items-center gap-3 p-3 transition hover:-translate-y-0.5 hover:border-ink">
                  <Avatar helper={h} size={42} />
                  <div className="min-w-0 leading-tight">
                    <p className="font-semibold">{h.name}</p>
                    <p className="text-[12px] text-muted">{ROLES[h.role].label} · {LANGS[h.lang].native}</p>
                    <p className={`mt-1 text-[12px] font-semibold ${st.tone === 'off' ? 'text-coral' : st.tone === 'note' ? 'text-[#9A6B00]' : 'text-forest'}`}>{st.label}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <section>
            <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.16em] text-muted">Conversations</h3>
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {feed.map((m) => {
                  const h = helpers.find((x) => x.id === m.helperId)
                  return h ? <FeedItem key={m.id} m={m} helper={h} /> : null
                })}
              </AnimatePresence>
              {!feed.length && (
                <div className="card p-8 text-center text-muted">Nothing yet today. Press the mic and say what's happening at home.</div>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="card p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-semibold"><ShoppingBasket size={18} /> Shopping list</h3>
                {shopping.some((s) => s.done) && <button onClick={clearDoneShopping} className="text-[12px] text-muted underline">Clear done</button>}
              </div>
              {shopping.length ? (
                <ul className="space-y-1">
                  {shopping.map((s) => (
                    <li key={s.id}>
                      <button onClick={() => toggleShopping(s.id)} className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left hover:bg-ink/5">
                        <span className={`grid h-5 w-5 place-items-center rounded-md border ${s.done ? 'border-forest bg-forest text-cream' : 'border-ink/30'}`}>{s.done && <Check size={13} />}</span>
                        <span className={`flex-1 text-[15px] ${s.done ? 'text-muted line-through' : ''}`}>{s.name}</span>
                        <span className="text-[11px] text-muted">via {s.addedBy}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[14px] text-muted">When a helper says “gas khatam”, it lands here.</p>
              )}
              {openShopping.length > 0 && (
                <a
                  className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-forest hover:underline"
                  href={`https://wa.me/?text=${encodeURIComponent('Shopping list:\n' + openShopping.map((s) => `• ${s.name}`).join('\n'))}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Share on WhatsApp <ArrowRight size={13} />
                </a>
              )}
            </div>

            <Link to="/app/hisaab" className="group block overflow-hidden rounded-[20px] bg-ink p-5 text-cream">
              <Eyebrow className="!text-cream/60">Month so far</Eyebrow>
              <p className="serif mt-2 text-[30px] leading-tight">The hisaab <em>writes itself.</em></p>
              <p className="mt-2 text-[14px] text-cream/70">Leaves, pauses, extras and advances from everything said — both sides hear the same bill.</p>
              <span className="mt-4 inline-flex items-center gap-1 text-[14px] font-semibold text-lilac">Open hisaab <ArrowRight size={15} className="transition group-hover:translate-x-1" /></span>
            </Link>

            <div className="card p-4 text-[13px] text-muted">
              <p className="font-semibold text-ink">Next up</p>
              <p className="mt-1">Bills go out on {new Date(today().getFullYear(), today().getMonth() + 1, 1).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}. Tomorrow is {iso(addDays(today(), 1)) && addDays(today(), 1).toLocaleDateString('en-IN', { weekday: 'long' })}.</p>
            </div>
          </aside>
        </div>
      </main>

      <ConfirmSheet
        open={sheet}
        drafts={drafts}
        setDrafts={setDrafts}
        clarifications={clar}
        setClarifications={setClar}
        helpers={helpers}
        onSend={doSend}
        onClose={() => setSheet(false)}
        onRespeak={respeak}
      />
    </div>
  )
}
