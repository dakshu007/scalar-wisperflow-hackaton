import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, NavLink } from 'react-router-dom'
import type { Helper } from '../lib/types'
import { ROLES } from '../lib/i18n'

export function Logo({ dark = false, className = '' }: { dark?: boolean; className?: string }) {
  const c = dark ? '#FFFFEB' : '#1A1A1A'
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="26" height="24" viewBox="0 0 26 24" fill="none" aria-hidden>
        <path d="M2 11 13 2l11 9" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <g stroke={c} strokeWidth="2.4" strokeLinecap="round">
          <path d="M7 15v4" /><path d="M11 12v10" /><path d="M15 14v6" /><path d="M19 16v2" />
        </g>
      </svg>
      <span className="text-[21px] font-bold tracking-tight" style={{ color: c }}>GharBolo</span>
    </span>
  )
}

/** The black "flow pill" with live bars — the signature element. */
export function FlowPill({ levels, active, thinking, size = 'md' }: { levels?: number[]; active?: boolean; thinking?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const bars = levels ?? Array(14).fill(0.15)
  const shown = size === 'lg' ? bars : bars.slice(-14)
  const h = size === 'lg' ? 56 : size === 'md' ? 36 : 22
  return (
    <div className="inline-flex items-center justify-center gap-[3px] rounded-full bg-ink px-4 ring-2 ring-cream" style={{ height: h + 18, boxShadow: '0 0 0 1.5px #1A1A1A' }}>
      {shown.map((v, i) =>
        thinking ? (
          <span key={i} className="block w-[3px] rounded-full bg-cream" style={{ height: h * 0.7, animation: `barwave 0.9s ${(i * 0.07).toFixed(2)}s ease-in-out infinite` }} />
        ) : (
          <motion.span
            key={i}
            className="block w-[3px] rounded-full bg-cream"
            animate={{ height: Math.max(4, (active ? v : 0.12 + (i % 3) * 0.06) * h) }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          />
        ),
      )}
    </div>
  )
}

export function Bars({ n = 28, seed = 1, playing = false, color = 'currentColor', progress = 0 }: { n?: number; seed?: number; playing?: boolean; color?: string; progress?: number }) {
  const heights = useMemo(() => Array.from({ length: n }, (_, i) => 0.25 + 0.75 * Math.abs(Math.sin(seed * 7.13 + i * 1.71) * Math.cos(i * 0.37 + seed))), [n, seed])
  return (
    <div className="flex h-8 items-center gap-[3px]">
      {heights.map((v, i) => (
        <motion.span
          key={i}
          className="block w-[3px] rounded-full"
          style={{ background: color, opacity: i / n <= progress ? 1 : 0.35 }}
          animate={playing ? { height: [v * 28, Math.max(4, (1 - v) * 28), v * 28] } : { height: Math.max(4, v * 28) }}
          transition={playing ? { duration: 0.6 + (i % 5) * 0.08, repeat: Infinity } : { duration: 0.2 }}
        />
      ))}
    </div>
  )
}

export function Avatar({ helper, size = 40 }: { helper: Helper; size?: number }) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center rounded-full border border-ink/15 font-semibold text-ink"
      style={{ width: size, height: size, background: helper.color, fontSize: size * 0.4 }}
      aria-hidden
    >
      {helper.name[0]}
      <span className="absolute -bottom-1 -right-1 grid place-items-center rounded-full bg-cream text-[11px] leading-none" style={{ width: size * 0.48, height: size * 0.48, fontSize: size * 0.26 }}>
        {ROLES[helper.role].emoji}
      </span>
    </span>
  )
}

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-[12px] font-semibold uppercase tracking-[0.18em] text-muted ${className}`}>{children}</p>
}

export function AppNav() {
  const tab = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-3.5 py-1.5 text-[14px] font-medium transition ${isActive ? 'bg-cream text-ink shadow-[0_1px_0_rgba(0,0,0,.08)] ring-1 ring-ink/10' : 'text-ink-2 hover:text-ink'}`
  return (
    <div className="sticky top-0 z-30 bg-cream/85 px-4 pt-3 pb-2 backdrop-blur-md">
      <nav className="mx-auto flex max-w-5xl items-center gap-3 rounded-2xl border border-ink/10 bg-cream px-3 py-2">
        <Link to="/" className="shrink-0 pl-1" aria-label="GharBolo home">
          <Logo />
        </Link>
        <div className="mx-auto flex items-center rounded-full bg-sand/70 p-1">
          <NavLink to="/app" end className={tab}>Speak</NavLink>
          <NavLink to="/app/hisaab" className={tab}>Hisaab</NavLink>
          <NavLink to="/app/helpers" className={tab}>Helpers</NavLink>
        </div>
        <Link to="/stage" className="btn-lilac hidden shrink-0 px-3.5 py-2 text-[14px] sm:inline-block">
          Demo stage
        </Link>
      </nav>
    </div>
  )
}

/* ---------------- Toasts ---------------- */

interface ToastItem { id: number; text: string; action?: { label: string; run: () => void }; ms: number }
const ToastCtx = createContext<(t: Omit<ToastItem, 'id' | 'ms'> & { ms?: number }) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const n = useRef(0)
  const push = useCallback((t: Omit<ToastItem, 'id' | 'ms'> & { ms?: number }) => {
    const id = ++n.current
    const ms = t.ms ?? 4000
    setItems((x) => [...x, { ...t, id, ms }])
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), ms)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              className="pointer-events-auto relative flex max-w-md items-center gap-4 overflow-hidden rounded-2xl bg-ink px-4 py-3 text-[14px] text-cream shadow-xl"
            >
              <span>{t.text}</span>
              {t.action && (
                <button
                  className="shrink-0 rounded-lg bg-lilac px-2.5 py-1 text-[13px] font-semibold text-ink"
                  onClick={() => {
                    t.action!.run()
                    setItems((x) => x.filter((i) => i.id !== t.id))
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <motion.span className="absolute bottom-0 left-0 h-[3px] bg-lilac" initial={{ width: '100%' }} animate={{ width: 0 }} transition={{ duration: t.ms / 1000, ease: 'linear' }} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}

export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal
            className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] bg-cream p-5 shadow-2xl sm:rounded-[28px] sm:p-7"
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-ink/15 sm:hidden" />
            {title}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
