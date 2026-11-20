import type { Helper, LedgerEntry } from './types'
import { daysInMonth, iso, pad, today } from './dates'

export type DayStatus = 'present' | 'leave' | 'leave-unpaid' | 'paused' | 'future' | 'none'

export interface DayCell {
  date: string
  day: number
  status: DayStatus
  qty: number // delivered units / clothes for that day
  extra: number
  advance: number
  isToday: boolean
}

export interface Bill {
  cells: DayCell[]
  work: number // days worked / units delivered / clothes
  leaveDays: number
  unpaidLeave: number
  pausedDays: number
  extras: number
  advance: number
  gross: number
  total: number
  lines: { label: string; amount: number }[]
}

/**
 * Compute a helper's month. `projectToMonthEnd` assumes normal service for
 * remaining days (what the 1st-of-month bill will look like).
 */
export function computeBill(h: Helper, ledger: LedgerEntry[], year: number, month: number, projectToMonthEnd = true): Bill {
  const n = daysInMonth(year, month)
  const t = iso(today())
  const mine = ledger.filter((e) => e.helperId === h.id && e.date.startsWith(`${year}-${pad(month + 1)}`))
  const cells: DayCell[] = []
  let work = 0, leaveDays = 0, unpaidLeave = 0, pausedDays = 0, extras = 0, advance = 0

  for (let d = 1; d <= n; d++) {
    const date = `${year}-${pad(month + 1)}-${pad(d)}`
    const es = mine.filter((e) => e.date === date)
    const future = date > t
    const leave = es.find((e) => e.type === 'leave')
    const paused = es.some((e) => e.type === 'pause')
    const extra = es.filter((e) => e.type === 'extra').reduce((a, e) => a + (e.qty ?? 0), 0)
    const count = es.filter((e) => e.type === 'count').reduce((a, e) => a + (e.qty ?? 0), 0)
    const adv = es.filter((e) => e.type === 'advance').reduce((a, e) => a + (e.amount ?? 0), 0)
    advance += adv

    let status: DayStatus = future ? 'future' : 'present'
    if (leave) status = leave.paid === false ? 'leave-unpaid' : 'leave'
    else if (paused) status = 'paused'

    let qty = 0
    if (h.pay.kind === 'perUnit') {
      qty = status === 'paused' || status.startsWith('leave') ? 0 : (future && !projectToMonthEnd ? 0 : h.pay.defaultQty) + extra
      extras += extra
    } else if (h.pay.kind === 'perItem') {
      qty = count
    }

    const counts = !future || projectToMonthEnd
    if (counts) {
      if (h.pay.kind === 'monthly') {
        if (status === 'leave' || status === 'paused') leaveDays++
        else if (status === 'leave-unpaid') unpaidLeave++
        else work++
      } else {
        if (status === 'paused' || status.startsWith('leave')) pausedDays++
        work += qty
      }
    }
    cells.push({ date, day: d, status, qty, extra, advance: adv, isToday: date === t })
  }

  const lines: { label: string; amount: number }[] = []
  let gross = 0
  if (h.pay.kind === 'monthly') {
    gross = h.pay.amount
    lines.push({ label: `Monthly salary`, amount: h.pay.amount })
    if (unpaidLeave) {
      const cut = Math.round((h.pay.amount / n) * unpaidLeave)
      lines.push({ label: `${unpaidLeave} unpaid leave day${unpaidLeave > 1 ? 's' : ''}`, amount: -cut })
      gross -= cut
    }
    work = work + leaveDays // paid leave counts as paid days
  } else if (h.pay.kind === 'perUnit') {
    gross = work * h.pay.unitPrice
    lines.push({ label: `${work} ${h.pay.unit} × ₹${h.pay.unitPrice}`, amount: gross })
  } else {
    gross = work * h.pay.rate
    lines.push({ label: `${work} ${h.pay.unit} × ₹${h.pay.rate}`, amount: gross })
  }
  if (advance) lines.push({ label: 'Advance already paid', amount: -advance })
  const total = Math.max(0, gross - advance)
  return { cells, work, leaveDays, unpaidLeave, pausedDays, extras, advance, gross, total, lines }
}

export function todayStatus(h: Helper, ledger: LedgerEntry[]): { label: string; tone: 'ok' | 'off' | 'note' } {
  const t = iso(today())
  const es = ledger.filter((e) => e.helperId === h.id && e.date === t)
  if (es.some((e) => e.type === 'leave')) return { label: 'On leave today', tone: 'off' }
  if (es.some((e) => e.type === 'pause')) return { label: 'Paused today', tone: 'off' }
  const extra = es.filter((e) => e.type === 'extra').reduce((a, e) => a + (e.qty ?? 0), 0)
  if (extra) return { label: `+${extra} extra today`, tone: 'note' }
  return { label: 'Coming today', tone: 'ok' }
}

export function upiLink(h: Helper, amount: number, payeeName = h.name) {
  const pa = h.upi || 'helper@upi'
  return `upi://pay?pa=${encodeURIComponent(pa)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent('GharBolo monthly hisaab')}`
}
