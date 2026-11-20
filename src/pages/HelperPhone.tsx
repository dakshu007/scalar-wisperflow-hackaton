import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useParams, Link } from 'react-router-dom'
import { ChevronDown, Home as HomeIcon, IndianRupee, Pause, Play } from 'lucide-react'
import { useStore } from '../lib/store'
import type { Helper, Lang, Message } from '../lib/types'
import { LANGS, ROLES, UI, billSentence, langStyle } from '../lib/i18n'
import { chime, speak, stopSpeaking, useVoice } from '../lib/speech'
import { addReply, markHeard } from '../lib/actions'
import { hasAI, freeTranslate, understandReply } from '../lib/ai'
import { replyChips } from '../lib/parser'
import { computeBill } from '../lib/ledger'
import { today } from '../lib/dates'
import { Avatar, Bars, FlowPill } from '../components/ui'
import { MicButton } from '../components/MicButton'

interface Preset { native: string; en: string }
const PRESETS: Record<string, Preset[]> = {
  sunita: [
    { native: 'দিদি, গ্যাস প্রায় শেষ, আর আমার ৫০০ টাকা অ্যাডভান্স লাগবে।', en: 'Didi, the gas is almost finished, and I need a ₹500 advance.' },
    { native: 'কাল আমি আসতে পারব না, শরীর খারাপ।', en: "I can't come tomorrow, I'm not feeling well." },
  ],
  ramesh: [
    { native: 'भैया, कल से दूध का रेट 32 रुपये हो जाएगा।', en: 'From tomorrow the milk rate becomes ₹32.' },
    { native: 'ठीक है, समझ गया।', en: 'Okay, understood.' },
  ],
  raju: [
    { native: 'ଆଜି 14ଟି ଲୁଗା ନେଲି।', en: 'I took 14 clothes today.' },
    { native: 'ଠିକ ଅଛି, କେବଳ ୟୁନିଫର୍ମ ଇସ୍ତ୍ରି କରିବି।', en: "Okay, I'll iron only the uniforms." },
  ],
  lakshmi: [
    { native: 'அம்மா, சோப்பு தீர்ந்து போச்சு, நாளைக்கு லீவு வேணும்.', en: 'Amma, the soap is finished, and I need leave tomorrow.' },
    { native: 'சரி அம்மா, புரிஞ்சுது.', en: 'Okay amma, understood.' },
  ],
  manoj: [
    { native: 'సరే సార్, ఆదివారం వరకు పేపర్ వేయను.', en: "Okay sir, I won't deliver the paper until Sunday." },
  ],
}

const RECOG: Record<Lang, string> = { en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN', or: 'or-IN', ta: 'ta-IN', te: 'te-IN' }

function VoiceNote({ m, helper, autoMark }: { m: Message; helper: Helper; autoMark: boolean }) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const timer = useRef(0)
  const lang = m.nativeLang
  const isBill = m.kind === 'bill'
  const play = () => {
    if (playing) {
      stopSpeaking()
      setPlaying(false)
      clearInterval(timer.current)
      return
    }
    setPlaying(true)
    setProgress(0)
    const start = Date.now()
    const est = Math.max(2500, m.native.length * 85)
    timer.current = window.setInterval(() => setProgress(Math.min(1, (Date.now() - start) / est)), 100)
    speak(m.native, lang, {
      rate: 0.9,
      onEnd: () => {
        setPlaying(false)
        setProgress(1)
        clearInterval(timer.current)
        if (autoMark && !m.heard) markHeard(m.id)
      },
    })
  }
  useEffect(() => () => clearInterval(timer.current), [])
  return (
    <motion.div layout initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={`relative rounded-[26px] p-4 ${isBill ? 'bg-butter' : 'bg-[#FFFFF5]'} border border-ink/10`}>
      {!m.heard && <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full border-2 border-cream bg-coral" aria-label="New" />}
      <div className="flex items-center gap-4">
        <button onClick={play} aria-label={UI[helper.lang].listen} className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full bg-forest text-cream shadow-[4px_4px_0_#1A1A1A] transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
          {playing ? <Pause size={30} fill="currentColor" strokeWidth={0} /> : <Play size={30} fill="currentColor" strokeWidth={0} className="translate-x-[2px]" />}
        </button>
        <div className="min-w-0 flex-1 text-forest">
          {isBill ? (
            <div className="flex items-center gap-1 text-ink">
              <IndianRupee size={22} />
              <span className="serif text-[40px] leading-none">{m.native.match(/₹([\d,]+)/g)?.pop()?.replace('₹', '') ?? ''}</span>
            </div>
          ) : (
            <Bars n={26} seed={m.createdAt % 97} playing={playing} progress={progress} color="#034F46" />
          )}
          <p className="mt-1 text-[12px] text-muted">{new Date(m.createdAt).toLocaleString('en-IN', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</p>
        </div>
      </div>
      <p className="mt-3 text-[19px] leading-snug text-ink" style={langStyle(lang)}>
        {m.native}
      </p>
    </motion.div>
  )
}

export default function HelperPhone() {
  const { id } = useParams()
  const helpers = useStore((s) => s.helpers)
  const messages = useStore((s) => s.messages)
  const ledger = useStore((s) => s.ledger)
  const settings = useStore((s) => s.settings)
  const helper = helpers.find((h) => h.id === id)
  const embed = new URLSearchParams(location.search).has('embed')
  const voice = useVoice({ lang: helper ? RECOG[helper.lang] : 'en-IN', record: true })
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [showDemo, setShowDemo] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const thread = useMemo(() => messages.filter((m) => m.helperId === id).sort((a, b) => a.createdAt - b.createdAt), [messages, id])
  const incoming = thread.filter((m) => m.from === 'employer')

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [thread.length])

  if (!helper) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <p className="serif text-[32px]">No helper here.</p>
          <Link to="/app" className="btn-lilac mt-4 inline-block px-4 py-2">Back to home</Link>
        </div>
      </div>
    )
  }
  const ui = UI[helper.lang]

  const submitReply = async (native: string, audio?: string, presetEn?: string) => {
    setStatus('sending')
    let en = presetEn ?? ''
    let chips = replyChips(native + ' ' + (presetEn ?? ''), helper)
    let translated: Message['translated'] = presetEn ? 'preset' : 'none'
    if (!presetEn && native) {
      if (hasAI(settings)) {
        try {
          const r = await understandReply(native, helper, settings)
          en = r.en
          chips = r.chips
          translated = 'ai'
        } catch {
          /* fall through */
        }
      }
      if (!en) {
        const t = helper.lang === 'en' ? native : await freeTranslate(native, helper.lang, 'en')
        if (t) {
          en = t
          translated = 'free'
          chips = replyChips(native + ' ' + t, helper)
        }
      }
    }
    addReply({ helperId: helper.id, en: en || 'Voice reply', native: native || '🎤', nativeLang: helper.lang, audio, chips, translated })
    chime()
    setStatus('sent')
    speak(ui.received, helper.lang)
    setTimeout(() => setStatus('idle'), 2200)
  }

  const start = async () => {
    stopSpeaking()
    const r = await voice.start()
    if (r.durationMs < 800 && !r.transcript) return setStatus('idle')
    if (!r.transcript && !r.audio) {
      setStatus('error')
      return setTimeout(() => setStatus('idle'), 2500)
    }
    submitReply(r.transcript, r.audio)
  }

  const t = today()
  const bill = computeBill(helper, ledger, t.getFullYear(), t.getMonth(), true)
  const playHisaab = () => speak(billSentence(helper, helper.lang, bill.work, bill.advance, bill.total), helper.lang, { rate: 0.9 })
  const presets = PRESETS[helper.id] ?? []

  return (
    <div className={`mx-auto flex h-[100dvh] max-w-md flex-col bg-cream ${embed ? '' : 'sm:border-x sm:border-ink/10'}`}>
      <header className={`flex items-center gap-3 bg-forest px-4 pb-4 text-cream ${embed ? 'pt-10' : 'pt-[max(env(safe-area-inset-top),14px)]'}`}>
        <div className="grid h-11 w-11 place-items-center rounded-full bg-cream/15">
          <HomeIcon size={22} />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[17px] font-semibold" style={langStyle(helper.lang)}>{ui.from}</p>
          <p className="text-[12px] text-cream/70">{helper.name} · {ROLES[helper.role].label} · {LANGS[helper.lang].native}</p>
        </div>
        <button onClick={playHisaab} className="inline-flex items-center gap-1.5 rounded-full bg-lilac px-3 py-2 text-[13px] font-semibold text-ink" style={langStyle(helper.lang)}>
          <IndianRupee size={14} /> {ui.hisaab}
        </button>
      </header>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {!incoming.length && <p className="mt-10 text-center text-muted" style={langStyle(helper.lang)}>{ui.noMsgs}</p>}
        <AnimatePresence initial={false}>
          {thread.map((m) =>
            m.from === 'employer' ? (
              <VoiceNote key={m.id} m={m} helper={helper} autoMark />
            ) : (
              <motion.div key={m.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="ml-auto flex max-w-[85%] items-center gap-3 rounded-[22px] rounded-br-md bg-forest px-4 py-3 text-cream">
                <Avatar helper={helper} size={30} />
                <p className="text-[16px] leading-snug" style={langStyle(helper.lang)}>{m.native}</p>
              </motion.div>
            ),
          )}
        </AnimatePresence>
      </div>

      <div className="border-t border-ink/10 bg-[#FFFFF2] px-4 pt-2 pb-[max(env(safe-area-inset-bottom),12px)]">
        <div className="flex flex-col items-center">
          <div className="h-[46px]">
            {voice.listening ? (
              <FlowPill levels={voice.levels} active size="sm" />
            ) : status === 'sending' ? (
              <FlowPill thinking size="sm" />
            ) : status === 'sent' ? (
              <p className="pt-3 text-[15px] font-semibold text-forest" style={langStyle(helper.lang)}>✓ {ui.received}</p>
            ) : status === 'error' ? (
              <p className="pt-3 text-[14px] text-coral">🎤 ?</p>
            ) : (
              <p className="pt-3 text-[15px] font-medium text-ink-2" style={langStyle(helper.lang)}>{ui.reply}</p>
            )}
          </div>
          <div className="pointer-events-none -my-6">
            <MicButton listening={voice.listening} onStart={start} onStop={voice.stop} size={96} tone="forest" label={ui.reply} disabled={status === 'sending'} />
          </div>
        </div>
        {presets.length > 0 && (
          <div className="mt-1">
            <button onClick={() => setShowDemo((v) => !v)} className="mx-auto flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              Demo replies <ChevronDown size={13} className={`transition ${showDemo ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {showDemo && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="flex flex-col gap-2 pt-2">
                    {presets.map((p) => (
                      <button key={p.native} onClick={() => { speak(p.native, helper.lang); submitReply(p.native, undefined, p.en) }} className="rounded-xl border border-ink/15 bg-cream px-3 py-2 text-left text-[14px] hover:border-ink" style={langStyle(helper.lang)}>
                        {p.native}
                        <span className="block font-sans text-[11px] text-muted">{p.en}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
