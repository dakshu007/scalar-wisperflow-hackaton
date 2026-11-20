import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, ExternalLink, Pause, Play, ShoppingBasket, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Helper, Message } from '../lib/types'
import { LANGS, langStyle } from '../lib/i18n'
import { speak, stopSpeaking } from '../lib/speech'
import { applyChip } from '../lib/actions'
import { Avatar, useToast } from './ui'

const time = (t: number) => new Date(t).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })

export function PlayButton({ text, lang, audio, small = false, dark = false }: { text: string; lang: Message['nativeLang']; audio?: string; small?: boolean; dark?: boolean }) {
  const [playing, setPlaying] = useState(false)
  const toast = useToast()
  const s = small ? 32 : 40
  return (
    <button
      type="button"
      aria-label={playing ? 'Stop' : 'Play'}
      className={`grid shrink-0 place-items-center rounded-full transition ${dark ? 'bg-cream text-ink' : 'bg-ink text-cream'} hover:scale-105`}
      style={{ width: s, height: s }}
      onClick={() => {
        if (playing) {
          stopSpeaking()
          setPlaying(false)
          return
        }
        setPlaying(true)
        if (audio) {
          const a = new Audio(audio)
          a.onended = () => setPlaying(false)
          a.play().catch(() => setPlaying(false))
          return
        }
        const { fallback } = speak(text, lang, { onEnd: () => setPlaying(false) })
        if (fallback && lang !== 'en') toast({ text: `No ${LANGS[lang].name} voice on this device — playing in Hindi. Text is shown large.` })
      }}
    >
      {playing ? <Pause size={s * 0.4} fill="currentColor" strokeWidth={0} /> : <Play size={s * 0.4} fill="currentColor" strokeWidth={0} className="translate-x-[1px]" />}
    </button>
  )
}

export function FeedItem({ m, helper }: { m: Message; helper: Helper }) {
  const toast = useToast()
  if (m.from === 'employer') {
    return (
      <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card flex gap-3 p-4">
        <Avatar helper={helper} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
            <span className="font-semibold text-ink">To {helper.name}</span>
            <span>· {LANGS[m.nativeLang].native}</span>
            {m.kind === 'bill' && <span className="rounded-full bg-butter px-2 py-0.5 text-[11px] font-semibold text-ink">Monthly bill</span>}
            <span className="ml-auto">{time(m.createdAt)}</span>
          </div>
          <p className="mt-1 text-[15px] leading-snug">{m.en}</p>
          {m.nativeLang !== 'en' && (
            <p className="mt-1 text-[15px] leading-snug text-ink-2" style={langStyle(m.nativeLang)}>
              {m.native}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2 text-[12px] text-muted">
            <PlayButton text={m.native} lang={m.nativeLang} small />
            <span>{m.heard ? <span className="inline-flex items-center gap-1 text-forest"><Check size={13} /> Heard by {helper.name}</span> : 'Delivered as a voice note'}</span>
          </div>
        </div>
      </motion.div>
    )
  }
  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 rounded-[20px] bg-forest p-4 text-cream">
      <Avatar helper={helper} size={38} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 text-[13px] text-cream/70">
          <span className="font-semibold text-cream">{helper.name} replied</span>
          <span>· in {LANGS[m.nativeLang].name}</span>
          <span className="ml-auto">{time(m.createdAt)}</span>
        </div>
        {m.translated === 'none' ? (
          <p className="serif mt-1 text-[20px] italic leading-snug">Couldn't translate — tap to listen.</p>
        ) : (
          <p className="serif mt-1 text-[21px] leading-snug">“{m.en}”</p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <PlayButton text={m.native} lang={m.nativeLang} audio={m.audio} small dark />
          <p className="min-w-0 truncate text-[13px] text-cream/70" style={langStyle(m.nativeLang)}>
            {m.native}
          </p>
        </div>
        {!!m.chips?.length && (
          <div className="mt-3 flex flex-wrap gap-2">
            {m.chips.map((c) => (
              <button
                key={c.id}
                disabled={c.done || (c.kind === 'advance' && !c.amount)}
                onClick={() => {
                  applyChip(m.id, c, helper)
                  toast({ text: c.kind === 'shopping' ? `${c.item} added to the shopping list` : c.kind === 'advance' ? `₹${c.amount} advance written in ${helper.name}'s hisaab` : 'Done — hisaab updated' })
                }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${c.done ? 'border-cream/30 bg-cream/10 text-cream/70' : 'border-ink bg-lilac text-ink hover:-translate-y-0.5'}`}
              >
                {c.done ? <Check size={14} /> : c.kind === 'shopping' ? <ShoppingBasket size={14} /> : <Sparkles size={14} />}
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

export function OpenHelperLink({ helper }: { helper: Helper }) {
  return (
    <Link to={`/h/${helper.id}`} target="_blank" className="inline-flex items-center gap-1 text-[12px] font-semibold text-forest hover:underline">
      Open {helper.name}'s phone <ExternalLink size={12} />
    </Link>
  )
}
