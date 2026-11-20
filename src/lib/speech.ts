import { useCallback, useEffect, useRef, useState } from 'react'
import type { Lang } from './types'
import { LANGS } from './i18n'

/* ---------------- Speech recognition ---------------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SR = any

export const recognitionSupported = () =>
  typeof window !== 'undefined' && !!((window as unknown as { SpeechRecognition?: SR }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: SR }).webkitSpeechRecognition)

function makeRecognizer(lang: string): SR | null {
  const W = window as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR }
  const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition
  if (!Ctor) return null
  const r = new Ctor()
  r.lang = lang
  r.interimResults = true
  r.continuous = true
  r.maxAlternatives = 1
  return r
}

export interface ListenResult {
  transcript: string
  audio?: string
  durationMs: number
  error?: string
}

/**
 * Mic + live transcript + audio level + optional recording, as one hook.
 * Works with press-and-hold and with tap-to-toggle.
 */
export function useVoice(opts: { lang: string; record?: boolean }) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [level, setLevel] = useState(0)
  const [levels, setLevels] = useState<number[]>(() => Array(24).fill(0.05))
  const rec = useRef<SR | null>(null)
  const finalText = useRef('')
  const stream = useRef<MediaStream | null>(null)
  const ctx = useRef<AudioContext | null>(null)
  const raf = useRef(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const started = useRef(0)
  const resolver = useRef<((r: ListenResult) => void) | null>(null)
  const errorRef = useRef<string | undefined>()
  const interimRef = useRef('')

  const cleanupAudio = () => {
    cancelAnimationFrame(raf.current)
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    ctx.current?.close().catch(() => {})
    ctx.current = null
    setLevel(0)
    setLevels(Array(24).fill(0.05))
  }

  const finish = useCallback(async () => {
    const durationMs = Date.now() - started.current
    let audio: string | undefined
    if (recorder.current && recorder.current.state !== 'inactive') {
      audio = await new Promise<string | undefined>((resolve) => {
        const r = recorder.current!
        r.onstop = () => {
          const blob = new Blob(chunks.current, { type: r.mimeType || 'audio/webm' })
          if (blob.size < 800) return resolve(undefined)
          const fr = new FileReader()
          fr.onload = () => resolve(fr.result as string)
          fr.readAsDataURL(blob)
        }
        r.stop()
      })
    }
    cleanupAudio()
    setListening(false)
    const transcript = finalText.current.trim()
    resolver.current?.({ transcript: transcript || interimRef.current.trim(), audio, durationMs, error: errorRef.current })
    resolver.current = null
  }, [])

  const start = useCallback(async (): Promise<ListenResult> => {
    finalText.current = ''
    interimRef.current = ''
    errorRef.current = undefined
    setInterim('')
    started.current = Date.now()
    setListening(true)

    const done = new Promise<ListenResult>((resolve) => (resolver.current = resolve))

    // Audio level meter (+ recording for helper replies)
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      stream.current = s
      const ac = new AudioContext()
      ctx.current = ac
      const src = ac.createMediaStreamSource(s)
      const an = ac.createAnalyser()
      an.fftSize = 512
      src.connect(an)
      const buf = new Uint8Array(an.fftSize)
      const hist: number[] = Array(24).fill(0.05)
      const tick = () => {
        an.getByteTimeDomainData(buf)
        let sum = 0
        for (const v of buf) sum += ((v - 128) / 128) ** 2
        const rms = Math.min(1, Math.sqrt(sum / buf.length) * 4)
        hist.push(Math.max(0.06, rms))
        hist.shift()
        setLevel(rms)
        setLevels([...hist])
        raf.current = requestAnimationFrame(tick)
      }
      tick()
      if (opts.record && typeof MediaRecorder !== 'undefined') {
        chunks.current = []
        const mr = new MediaRecorder(s, { audioBitsPerSecond: 24000 })
        mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
        mr.start()
        recorder.current = mr
      }
    } catch {
      errorRef.current = 'mic-denied'
    }

    const r = makeRecognizer(opts.lang)
    rec.current = r
    if (r) {
      r.onresult = (e: SR) => {
        let fin = ''
        let int = ''
        for (let i = 0; i < e.results.length; i++) {
          const res = e.results[i]
          if (res.isFinal) fin += res[0].transcript + ' '
          else int += res[0].transcript
        }
        finalText.current = fin
        interimRef.current = fin + int
        setInterim((fin + int).trim())
      }
      r.onerror = (e: SR) => {
        if (e.error !== 'no-speech' && e.error !== 'aborted') errorRef.current = e.error
      }
      r.onend = () => {
        if (resolver.current) finish()
      }
      try {
        r.start()
      } catch {
        /* already started */
      }
    } else {
      errorRef.current = errorRef.current || 'no-recognition'
    }
    return done
  }, [opts.lang, opts.record, finish])

  const stop = useCallback(() => {
    if (!resolver.current) return
    if (rec.current) {
      try {
        rec.current.stop()
      } catch {
        finish()
      }
      // Some browsers never fire onend after stop(); guarantee completion.
      setTimeout(() => resolver.current && finish(), 1200)
    } else finish()
  }, [finish])

  const cancel = useCallback(() => {
    resolver.current = null
    try { rec.current?.abort() } catch { /* noop */ }
    try { recorder.current?.state !== 'inactive' && recorder.current?.stop() } catch { /* noop */ }
    cleanupAudio()
    setListening(false)
    setInterim('')
  }, [])

  useEffect(() => () => cancel(), [cancel])

  return { listening, interim, level, levels, start, stop, cancel }
}

/** Listen briefly for a yes / no style answer ("seri", "haan", "send", "venaam"). */
export function listenForYesNo(timeoutMs = 6000): { promise: Promise<'yes' | 'no' | null>; cancel: () => void } {
  const r = makeRecognizer('en-IN')
  if (!r) return { promise: Promise.resolve(null), cancel: () => {} }
  r.continuous = false
  let settled = false
  let timer = 0
  const promise = new Promise<'yes' | 'no' | null>((resolve) => {
    const done = (v: 'yes' | 'no' | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { r.abort() } catch { /* noop */ }
      resolve(v)
    }
    r.onresult = (e: SR) => {
      const t = Array.from(e.results as ArrayLike<SR>).map((x: SR) => x[0].transcript).join(' ').toLowerCase()
      if (/\b(yes|yeah|yep|send|seri|sari|haan|ha|han|ok|okay|done|po|anuppu|bhej|confirm|correct)\b/.test(t)) done('yes')
      else if (/\b(no|nope|change|venaam|vendam|venam|nahi|cancel|wait|stop|edit)\b/.test(t)) done('no')
    }
    r.onend = () => done(null)
    r.onerror = () => done(null)
    timer = window.setTimeout(() => done(null), timeoutMs)
    try { r.start() } catch { done(null) }
  })
  return { promise, cancel: () => { settled = true; clearTimeout(timer); try { r.abort() } catch { /* noop */ } } }
}

/* ---------------- Text to speech ---------------- */

let voicesCache: SpeechSynthesisVoice[] = []
const loadVoices = () => {
  if (typeof speechSynthesis === 'undefined') return []
  voicesCache = speechSynthesis.getVoices()
  return voicesCache
}
if (typeof speechSynthesis !== 'undefined') {
  loadVoices()
  speechSynthesis.onvoiceschanged = loadVoices
}

export function voiceFor(lang: Lang): { voice?: SpeechSynthesisVoice; bcp: string; fallback: boolean } {
  const voices = voicesCache.length ? voicesCache : loadVoices()
  const bcp = LANGS[lang].bcp
  const prefix = bcp.split('-')[0]
  const exact = voices.find((v) => v.lang.replace('_', '-').toLowerCase() === bcp.toLowerCase()) || voices.find((v) => v.lang.toLowerCase().startsWith(prefix))
  if (exact) return { voice: exact, bcp, fallback: false }
  if (lang === 'en') return { voice: voices.find((v) => /en[-_]IN/i.test(v.lang)) || voices.find((v) => v.lang.startsWith('en')), bcp, fallback: false }
  const hi = voices.find((v) => v.lang.toLowerCase().startsWith('hi'))
  return { voice: hi, bcp: hi ? 'hi-IN' : bcp, fallback: true }
}

export function speak(text: string, lang: Lang, opts: { rate?: number; onEnd?: () => void } = {}): { fallback: boolean } {
  if (typeof speechSynthesis === 'undefined' || !text) {
    opts.onEnd?.()
    return { fallback: true }
  }
  speechSynthesis.cancel()
  const { voice, bcp, fallback } = voiceFor(lang)
  const u = new SpeechSynthesisUtterance(text)
  u.lang = bcp
  if (voice) u.voice = voice
  u.rate = opts.rate ?? 0.95
  u.onend = () => opts.onEnd?.()
  u.onerror = () => opts.onEnd?.()
  speechSynthesis.speak(u)
  return { fallback }
}

export function stopSpeaking() {
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
}

/** Short two-note "sent" chime. */
export function chime() {
  try {
    const ac = new AudioContext()
    const now = ac.currentTime
    ;[660, 990].forEach((f, i) => {
      const o = ac.createOscillator()
      const g = ac.createGain()
      o.frequency.value = f
      o.type = 'sine'
      g.gain.setValueAtTime(0.0001, now + i * 0.12)
      g.gain.exponentialRampToValueAtTime(0.18, now + i * 0.12 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.25)
      o.connect(g).connect(ac.destination)
      o.start(now + i * 0.12)
      o.stop(now + i * 0.12 + 0.3)
    })
    setTimeout(() => ac.close(), 800)
  } catch {
    /* no audio */
  }
}
