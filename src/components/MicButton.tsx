import { useRef } from 'react'
import { motion } from 'framer-motion'
import { Mic, Square } from 'lucide-react'

/**
 * Hold to talk, or tap once to start and tap again to stop.
 * Big, high-contrast, one-thumb friendly.
 */
export function MicButton({
  listening,
  onStart,
  onStop,
  size = 148,
  disabled,
  label,
  tone = 'lilac',
}: {
  listening: boolean
  onStart: () => void
  onStop: () => void
  size?: number
  disabled?: boolean
  label?: string
  tone?: 'lilac' | 'forest'
}) {
  const pressedAt = useRef(0)
  const holdMode = useRef(false)
  const bg = tone === 'lilac' ? (listening ? '#1A1A1A' : '#F0D7FF') : listening ? '#1A1A1A' : '#034F46'
  const fg = tone === 'lilac' ? (listening ? '#FFFFEB' : '#1A1A1A') : '#FFFFEB'

  return (
    <div className="pointer-events-none relative grid place-items-center" style={{ width: size * 1.6, height: size * 1.6 }}>
      {listening &&
        [0, 0.5, 1].map((d) => (
          <span
            key={d}
            className="absolute rounded-full border-2 border-ink/40"
            style={{ width: size, height: size, animation: `ripple 1.6s ${d}s ease-out infinite` }}
          />
        ))}
      <motion.button
        type="button"
        aria-label={label || (listening ? 'Stop and send' : 'Hold or tap to speak')}
        aria-pressed={listening}
        disabled={disabled}
        whileTap={{ scale: 0.94 }}
        animate={{ scale: listening ? 1.04 : 1 }}
        className="pointer-events-auto relative grid select-none place-items-center rounded-full border-2 border-ink outline-none transition-colors disabled:opacity-50"
        style={{ width: size, height: size, background: bg, color: fg, boxShadow: listening ? '0 0 0 8px rgba(240,215,255,.6)' : '6px 6px 0 #1A1A1A', touchAction: 'none' }}
        onPointerDown={(e) => {
          if (disabled) return
          e.currentTarget.setPointerCapture(e.pointerId)
          pressedAt.current = Date.now()
          if (!listening) {
            holdMode.current = true
            onStart()
          } else {
            holdMode.current = false
            onStop()
          }
        }}
        onPointerUp={() => {
          if (disabled) return
          const held = Date.now() - pressedAt.current
          if (holdMode.current && held > 450) onStop() // released after holding → send
          holdMode.current = false // short tap → stays on until tapped again
        }}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            listening ? onStop() : onStart()
          }
        }}
      >
        {listening ? <Square size={size * 0.24} fill="currentColor" strokeWidth={0} /> : <Mic size={size * 0.32} strokeWidth={1.8} />}
      </motion.button>
    </div>
  )
}
