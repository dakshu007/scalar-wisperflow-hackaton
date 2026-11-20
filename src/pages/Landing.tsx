import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, ChevronDown, PhoneCall, MessageSquareX, Play, X } from 'lucide-react'
import { Bars, FlowPill, Logo } from '../components/ui'

const RAMBLE = 'umm so Friday to Sunday naanga ooru la irukka maatom… so paal vendam, paper um vendam, actually wait — Sunita akka ku two days paid leave, and Raju, school uniform mattum iron pannunga…'

const RIBBONS = [
  { d: 'M720 210 C 880 210, 960 70, 1500 40', text: 'সুনিতা, শুক্রবার থেকে শনিবার পর্যন্ত আপনার ছুটি, টাকা কাটা হবে না।   ·   ', font: "'Noto Sans Bengali'", dur: 26 },
  { d: 'M720 210 C 900 210, 1000 210, 1500 215', text: 'रमेश, शुक्रवार से रविवार तक दूध मत देना।   ·   ', font: "'Noto Sans Devanagari'", dur: 22 },
  { d: 'M720 210 C 880 210, 960 350, 1500 390', text: 'ରାଜୁ, କେବଳ school uniform ଇସ୍ତ୍ରି କରନ୍ତୁ।   ·   ', font: "'Noto Sans Oriya'", dur: 24 },
]

function HeroVisual() {
  return (
    <div className="relative -mx-4 mt-10 h-[260px] overflow-hidden sm:h-[360px]" aria-hidden>
      <svg viewBox="0 0 1440 420" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          <path id="ramble" d="M-60 120 C 120 40, 300 60, 360 160 S 520 260, 720 210" />
          {RIBBONS.map((r, i) => <path key={i} id={`rib${i}`} d={r.d} />)}
        </defs>
        <text className="fill-ink/40" style={{ fontSize: 22, fontFamily: 'Figtree' }}>
          <textPath href="#ramble" startOffset="0%">
            {RAMBLE} {RAMBLE}
            <animate attributeName="startOffset" from="0%" to="-100%" dur="30s" repeatCount="indefinite" />
          </textPath>
        </text>
        {RIBBONS.map((r, i) => (
          <g key={i}>
            <use href={`#rib${i}`} stroke="#1A1A1A" strokeWidth="44" fill="none" strokeLinecap="round" />
            <text style={{ fontSize: 19, fontFamily: `${r.font}, Figtree`, fontWeight: 600 }} fill="#FFFFEB" dy="6">
              <textPath href={`#rib${i}`} startOffset="0%">
                {r.text.repeat(4)}
                <animate attributeName="startOffset" from="0%" to="-60%" dur={`${r.dur}s`} repeatCount="indefinite" />
              </textPath>
            </text>
          </g>
        ))}
      </svg>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <motion.div animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 2.4, repeat: Infinity }}>
          <FlowPill thinking size="md" />
        </motion.div>
      </div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="absolute top-[18%] left-1/2 -translate-x-1/2 rounded-full bg-forest px-4 py-1.5 text-[14px] font-semibold text-cream">
        <Swap words={['Split into 3 messages', 'Translated to বাংলা · हिन्दी · ଓଡ଼ିଆ', 'Hisaab updated']} />
      </motion.div>
    </div>
  )
}

function Swap({ words, every = 2200 }: { words: string[]; every?: number }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % words.length), every)
    return () => clearInterval(t)
  }, [words.length, every])
  return (
    <AnimatePresence mode="wait">
      <motion.span key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="inline-block">
        {words[i]}
      </motion.span>
    </AnimatePresence>
  )
}

const LANG_MARQUEE = ['தமிழ்', 'বাংলা', 'ଓଡ଼ିଆ', 'हिन्दी', 'తెలుగు', 'English', 'Tanglish', 'Hinglish']

const FAQ = [
  { q: 'Does my helper need a smartphone app?', a: 'No. Each helper gets a private link that opens like a WhatsApp chat: big play buttons and one mic. Nothing to install, nothing to read, nothing to type.' },
  { q: 'What if it mishears me in a noisy kitchen?', a: 'GharBolo always reads back a one-line summary and shows a card per person before sending. If it is unsure of a name it asks “Did you mean Ramesh?”, it never guesses a money amount, and every send has a 10-second undo.' },
  { q: 'Which languages work?', a: 'You can speak English, Tanglish, Hinglish, Tamil or Hindi. Helpers hear Bengali, Odia, Hindi, Tamil, Telugu or English — the messages are written in their own script and read aloud.' },
  { q: 'Is it fair to the helper?', a: 'Every ledger entry shows who said it. Helpers hear the same monthly bill in their own language, can dispute it by voice, and get a voice payslip they can show for a loan or a rental agreement.' },
  { q: 'Does it cost anything?', a: 'The prototype runs entirely in your browser and works offline for everyday sentences. Add a free Google Gemini key to understand any sentence in any language mix.' },
]

export default function Landing() {
  const [open, setOpen] = useState(0)
  return (
    <div className="overflow-x-hidden">
      {/* Announcement */}
      <Link to="/stage" className="block bg-forest px-4 py-2.5 text-center text-[14px] font-semibold text-cream">
        Built for India's voice-first homes. <span className="ml-1 inline-flex items-center gap-1 text-lilac">See the live demo stage <ArrowRight size={14} /></span>
      </Link>

      {/* Nav */}
      <div className="sticky top-0 z-40 px-4 pt-4">
        <nav className="mx-auto flex max-w-5xl items-center gap-3 rounded-2xl border border-ink/10 bg-cream/90 px-3 py-2 backdrop-blur-md">
          <Logo className="pl-1" />
          <div className="ml-2 hidden items-center rounded-full bg-sand/70 p-1 sm:flex">
            <span className="rounded-full bg-cream px-3.5 py-1.5 text-[14px] font-medium ring-1 ring-ink/10">Home</span>
            <Link to="/app/hisaab" className="px-3.5 py-1.5 text-[14px] text-ink-2 hover:text-ink">Hisaab</Link>
          </div>
          <div className="ml-auto hidden items-center gap-5 text-[14px] text-ink-2 md:flex">
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#helpers" className="hover:text-ink">For helpers</a>
            <Link to="/stage" className="hover:text-ink">Demo</Link>
          </div>
          <Link to="/app" className="btn-lilac ml-auto px-4 py-2 text-[14px] md:ml-2">Open the app</Link>
        </nav>
      </div>

      {/* Hero */}
      <section className="px-4 pt-16 text-center sm:pt-24">
        <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-muted">GharBolo · one voice line for your home</p>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="serif mx-auto mt-5 max-w-4xl text-[58px] leading-[0.92] sm:text-[104px]">
          Don't call everyone,
          <br />
          <em>just speak once.</em>
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mx-auto mt-6 max-w-xl text-[19px] leading-snug text-ink-2">
          Say it the way you talk at home. Your cook, maid, milkman and press-wala each hear it in <em className="serif text-[22px]">their</em> language — and the monthly hisaab writes itself.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/app" className="btn-lilac px-6 py-3 text-[16px]">Try it free — just speak</Link>
          <Link to="/stage" className="btn-ghost inline-flex items-center gap-2 px-5 py-3 text-[16px]"><Play size={15} fill="currentColor" /> Watch every phone live</Link>
        </motion.div>
        <p className="mt-4 text-[13px] text-muted">Works in Chrome on phone and laptop · no sign-up · helpers need no app</p>
        <HeroVisual />
      </section>

      {/* Language marquee */}
      <section className="relative mt-4 rounded-t-[48px] bg-ink pt-14 pb-16 text-cream">
        <p className="text-center text-[12px] font-semibold uppercase tracking-[0.22em] text-cream/60">Spoken and understood in</p>
        <div className="mt-8 overflow-hidden">
          <div className="flex w-max animate-marquee gap-14 pr-14">
            {[...LANG_MARQUEE, ...LANG_MARQUEE].map((l, i) => (
              <span key={i} className="serif whitespace-nowrap text-[44px] text-cream/90 sm:text-[56px]" style={{ fontFamily: "'EB Garamond', 'Noto Sans Bengali', 'Noto Sans Tamil', 'Noto Sans Oriya', 'Noto Sans Devanagari', 'Noto Sans Telugu', serif" }}>
                {l}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Before / after */}
      <section className="-mt-8 rounded-t-[48px] bg-forest px-4 pt-20 pb-24 text-cream">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="serif text-[48px] leading-[0.95] sm:text-[80px]">
            Fifteen minutes of calls, <em>in one breath.</em>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-[18px] text-cream/80">An Indian home runs on five to seven daily helpers. One trip out of town today means four calls, three WhatsApps nobody can read — and a milk packet going sour at the door.</p>
        </div>
        <div className="mx-auto mt-14 grid max-w-5xl gap-5 md:grid-cols-2">
          <div className="rounded-[28px] bg-cream/5 p-6 ring-1 ring-cream/15">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-cream/60">Today</p>
            <ul className="mt-4 space-y-3 text-[16px]">
              {[
                [PhoneCall, 'Call Ramesh — no answer. Call again.'],
                [MessageSquareX, 'WhatsApp Sunita in English. She can’t read it.'],
                [PhoneCall, 'Explain to Raju in broken Hindi.'],
                [X, 'Forgot the paper boy. ₹48 wasted.'],
                [X, '1st of the month: “enna, evlo naal vandhaanga?”'],
              ].map(([Icon, t], i) => {
                const I = Icon as typeof PhoneCall
                return (
                  <li key={i} className="flex items-start gap-3 text-cream/85">
                    <I size={18} className="mt-0.5 shrink-0 text-coral" /> {t as string}
                  </li>
                )
              })}
            </ul>
          </div>
          <div className="rounded-[28px] bg-cream p-6 text-ink">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">With GharBolo</p>
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-ink p-3 text-cream">
              <FlowPill size="sm" thinking />
              <p className="serif text-[17px] italic leading-snug">“Friday to Sunday we're away — paal vendam, paper vendam…”</p>
            </div>
            <ul className="mt-4 space-y-2.5 text-[15px]">
              {[
                ['Ramesh', 'हिन्दी', 'No milk Fri – Sun'],
                ['Manoj', 'తెలుగు', 'No paper Fri – Sun'],
                ['Sunita', 'বাংলা', 'Paid leave Fri & Sat'],
                ['Raju', 'ଓଡ଼ିଆ', 'Only school uniforms'],
              ].map(([n, l, t]) => (
                <li key={n} className="flex items-center gap-3">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-mint text-forest"><Check size={14} /></span>
                  <span className="font-semibold">{n}</span>
                  <span className="rounded-full bg-lilac px-2 py-0.5 text-[12px]">{l}</span>
                  <span className="text-muted">{t}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[14px] font-semibold text-forest">One sentence. Four people. Hisaab updated.</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="-mt-8 rounded-t-[48px] bg-cream px-4 pt-20 pb-20">
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-[12px] font-semibold uppercase tracking-[0.22em] text-muted">How it works</p>
          <h2 className="serif mt-4 text-center text-[48px] leading-[0.95] sm:text-[72px]">
            Speak the way <em>you think,</em> in every language.
          </h2>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            <div className="card overflow-hidden p-6">
              <div className="rounded-2xl bg-cream-2 p-4 text-[15px] leading-relaxed">
                <span className="text-muted line-through decoration-coral">umm so</span> Friday to Sunday naanga ooru la irukka maatom, <span className="text-muted line-through decoration-coral">actually wait</span> paal vendam…
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                  <span className="rounded-full bg-[#FFF1EC] px-2 py-0.5 text-coral">Filler removed</span>
                  <span className="rounded-full bg-mint px-2 py-0.5 text-forest">3 people found</span>
                </div>
              </div>
              <h3 className="serif mt-5 text-[28px] leading-tight">Speak <em>naturally</em></h3>
              <p className="mt-2 text-ink-2">Ramble, mix Tamil and English, change your mind mid-sentence. GharBolo works out who needs to hear what.</p>
            </div>
            <div className="card overflow-hidden p-6">
              <div className="space-y-2">
                {[['সুনিতা', "'Noto Sans Bengali'"], ['ରାଜୁ', "'Noto Sans Oriya'"], ['रमेश', "'Noto Sans Devanagari'"]].map(([n, f], i) => (
                  <div key={n} className="flex items-center gap-3 rounded-2xl bg-forest px-3 py-2 text-cream">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cream text-forest"><Play size={15} fill="currentColor" /></span>
                    <Bars n={16} seed={i + 2} color="#FFFFEB" />
                    <span className="ml-auto text-[14px]" style={{ fontFamily: f }}>{n}</span>
                  </div>
                ))}
              </div>
              <h3 className="serif mt-5 text-[28px] leading-tight">Everyone hears it <em>in theirs</em></h3>
              <p className="mt-2 text-ink-2">Each helper gets a voice note in their own language. They reply by voice — you read it in English.</p>
            </div>
            <div className="card overflow-hidden p-6">
              <div className="rounded-2xl bg-cream-2 p-4">
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 21 }).map((_, i) => (
                    <span key={i} className={`aspect-square rounded-md ${[4, 5].includes(i) ? 'bg-lilac' : [11].includes(i) ? 'striped' : 'bg-white'} border border-ink/10`} />
                  ))}
                </div>
                <p className="serif mt-3 text-[34px] leading-none">₹5,500</p>
                <p className="text-[12px] text-muted">26 days · ₹500 advance · paid on UPI</p>
              </div>
              <h3 className="serif mt-5 text-[28px] leading-tight">The hisaab <em>writes itself</em></h3>
              <p className="mt-2 text-ink-2">Leaves, pauses, extras and advances from what both sides said. One fair bill, read aloud to both.</p>
            </div>
          </div>
        </div>
      </section>

      {/* For helpers */}
      <section id="helpers" className="mx-4 rounded-[40px] bg-lilac px-6 py-16 sm:px-12">
        <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-ink/60">Built for the helper too</p>
            <h2 className="serif mt-4 text-[44px] leading-[0.95] sm:text-[64px]">
              Every household app treats her as data. <em>This one gives her a voice.</em>
            </h2>
            <ul className="mt-6 space-y-2 text-[16px]">
              {['No app, no login, nothing to read', 'Hears every instruction in her own language', 'Replies by voice — “gas khatam”, “500 advance”', 'A voice payslip she can show for a loan or rent'].map((t) => (
                <li key={t} className="flex items-center gap-2"><Check size={18} className="text-forest" /> {t}</li>
              ))}
            </ul>
          </div>
          <div className="mx-auto w-full max-w-[320px] rounded-[40px] bg-ink p-2.5 shadow-2xl">
            <div className="overflow-hidden rounded-[32px] bg-cream">
              <div className="bg-forest px-4 py-3 text-cream" style={{ fontFamily: "'Noto Sans Bengali'" }}>বাড়ি থেকে বার্তা</div>
              <div className="space-y-3 p-3">
                <div className="rounded-2xl border border-ink/10 bg-white p-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-forest text-cream"><Play size={20} fill="currentColor" /></span>
                    <Bars n={18} seed={5} color="#034F46" />
                  </div>
                  <p className="mt-2 text-[15px]" style={{ fontFamily: "'Noto Sans Bengali'" }}>সুনিতা, শুক্রবার থেকে শনিবার পর্যন্ত আপনার ছুটি।</p>
                </div>
                <div className="ml-auto w-fit rounded-2xl rounded-br-sm bg-forest px-3 py-2 text-[14px] text-cream" style={{ fontFamily: "'Noto Sans Bengali'" }}>দিদি, গ্যাস প্রায় শেষ 🎤</div>
                <div className="grid place-items-center pt-2 pb-3">
                  <span className="grid h-16 w-16 place-items-center rounded-full border-2 border-ink bg-forest text-cream shadow-[4px_4px_0_#1A1A1A]">●</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto grid max-w-5xl gap-4 px-4 py-20 sm:grid-cols-3">
        {[
          ['4.75M+', 'domestic workers in India officially — up to 50M by other estimates'],
          ['0', 'words a helper has to read or type'],
          ['1', 'sentence to reach the whole household'],
        ].map(([n, t]) => (
          <div key={n} className="card p-6">
            <p className="serif text-[64px] leading-none">{n}</p>
            <p className="mt-3 text-ink-2">{t}</p>
          </div>
        ))}
      </section>

      {/* FAQ */}
      <section className="rounded-t-[48px] bg-ink px-4 pt-20 pb-20 text-cream">
        <div className="mx-auto max-w-3xl">
          <h2 className="serif text-center text-[52px] leading-none sm:text-[72px]">Good <em>questions.</em></h2>
          <div className="mt-10 divide-y divide-cream/15 border-y border-cream/15">
            {FAQ.map((f, i) => (
              <div key={f.q}>
                <button onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-center justify-between gap-4 py-5 text-left text-[18px] font-semibold">
                  {f.q} <ChevronDown className={`shrink-0 transition ${open === i ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence initial={false}>
                  {open === i && (
                    <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pb-5 text-[16px] leading-relaxed text-cream/75">
                      {f.a}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="-mt-8 rounded-t-[48px] bg-forest px-4 pt-24 pb-20 text-center text-cream">
        <h2 className="serif mx-auto max-w-4xl text-[52px] leading-[0.95] sm:text-[88px]">
          Your home has a way with words. <em>Now, every language.</em>
        </h2>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link to="/app" className="btn-lilac px-6 py-3 text-[16px]">Open GharBolo</Link>
          <Link to="/stage" className="inline-flex items-center gap-2 rounded-[10px] border-[1.5px] border-cream/40 px-5 py-3 font-semibold hover:bg-cream/10">Demo stage <ArrowRight size={16} /></Link>
        </div>
        <div className="mx-auto mt-20 flex max-w-5xl flex-wrap items-center justify-between gap-4 border-t border-cream/15 pt-6 text-[13px] text-cream/60">
          <Logo dark />
          <span>Made for the Voice-First India hackathon · speak once, everyone understands.</span>
        </div>
      </section>
    </div>
  )
}
