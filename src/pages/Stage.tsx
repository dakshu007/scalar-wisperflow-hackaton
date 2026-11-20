import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink, RotateCcw } from 'lucide-react'
import { resetState, useStore } from '../lib/store'
import { LANGS, ROLES } from '../lib/i18n'
import { Logo } from '../components/ui'

function Phone({ src, w, h, label, sub }: { src: string; w: number; h: number; label: string; sub: string }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-3">
      <div className="rounded-[46px] bg-ink p-[10px] shadow-[0_30px_80px_-20px_rgba(0,0,0,.6)] ring-1 ring-white/10" style={{ width: w + 20 }}>
        <div className="relative overflow-hidden rounded-[36px] bg-cream" style={{ width: w, height: h }}>
          <div className="absolute top-2 left-1/2 z-10 h-[22px] w-[90px] -translate-x-1/2 rounded-full bg-ink" />
          <iframe title={label} src={src} className="h-full w-full border-0" allow="microphone; autoplay" />
        </div>
      </div>
      <div className="text-center leading-tight text-cream">
        <p className="font-semibold">{label}</p>
        <p className="text-[12px] text-cream/60">{sub}</p>
      </div>
    </div>
  )
}

const STAGE_W = 1500
const STAGE_H = 870

function useFitScale() {
  const calc = () => Math.min(1, (window.innerWidth - 48) / STAGE_W, (window.innerHeight - 190) / STAGE_H)
  const [s, setS] = useState(calc)
  useEffect(() => {
    const on = () => setS(calc())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return Math.max(0.45, s)
}

export default function Stage() {
  const helpers = useStore((s) => s.helpers)
  const scale = useFitScale()
  const shown = ['sunita', 'raju', 'ramesh'].map((id) => helpers.find((h) => h.id === id)).filter(Boolean).concat(helpers.filter((h) => !['sunita', 'raju', 'ramesh'].includes(h.id))).slice(0, 3)
  return (
    <div className="grain relative min-h-screen overflow-hidden bg-forest">
      <header className="relative z-10 mx-auto flex max-w-[1500px] items-center gap-4 px-6 pt-5">
        <Link to="/" className="inline-flex items-center gap-2 text-cream/80 hover:text-cream"><ArrowLeft size={18} /></Link>
        <Logo dark />
        <span className="ml-auto hidden text-[13px] text-cream/60 md:block">Every screen is live and in sync — speak on the left, watch the helpers' phones on the right.</span>
        <button onClick={() => { if (confirm('Reset demo data?')) resetState() }} className="inline-flex items-center gap-1.5 rounded-lg border border-cream/30 px-3 py-1.5 text-[13px] font-semibold text-cream hover:bg-cream/10">
          <RotateCcw size={14} /> Reset
        </button>
      </header>

      <div className="relative z-10 mx-auto max-w-[1500px] px-6 pt-8 text-center">
        <h1 className="serif text-[52px] leading-none text-cream sm:text-[72px]">
          One voice. <em>Every language.</em>
        </h1>
      </div>

      {/* Desktop stage */}
      <div className="relative z-10 hidden justify-center pt-8 pb-10 lg:flex" style={{ height: STAGE_H * scale + 60 }}>
        <div className="flex items-end justify-center gap-8" style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: 'top center' }}>
          <Phone src={`${import.meta.env.BASE_URL}app?embed=1`} w={400} h={780} label="You (employer)" sub="Speaks Tanglish" />
          <div className="flex items-end gap-6">
            {shown.map((h) => h && <Phone key={h.id} src={`${import.meta.env.BASE_URL}h/${h.id}?embed=1`} w={300} h={620} label={`${h.name} · ${ROLES[h.role].label}`} sub={`Hears ${LANGS[h.lang].native}`} />)}
          </div>
        </div>
      </div>

      {/* Mobile fallback */}
      <div className="relative z-10 mx-auto max-w-md space-y-3 px-6 pt-8 pb-14 lg:hidden">
        <p className="text-center text-cream/70">Open the stage on a laptop to see every phone side by side. On a phone, open each screen in its own tab:</p>
        <Link to="/app" className="btn-lilac block px-4 py-3 text-center">Employer — speak</Link>
        {helpers.map((h) => (
          <Link key={h.id} to={`/h/${h.id}`} className="flex items-center justify-between rounded-xl border border-cream/25 px-4 py-3 text-cream">
            <span>{h.name} · {ROLES[h.role].label} · {LANGS[h.lang].native}</span> <ExternalLink size={15} />
          </Link>
        ))}
      </div>
    </div>
  )
}
