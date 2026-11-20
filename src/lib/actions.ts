/** Store mutations shared by screens. */
import type { Action, Chip, Draft, Helper, LedgerEntry, Message, State } from './types'
import { getState, setState, uid } from './store'
import { iso, today } from './dates'
import { billSentence } from './i18n'
import { computeBill } from './ledger'

function entriesFor(helperId: string, actions: Action[], source: LedgerEntry['source']): LedgerEntry[] {
  const out: LedgerEntry[] = []
  const now = Date.now()
  for (const a of actions) {
    if (a.type === 'note') continue
    const dates = a.dates.length ? a.dates : [iso(today())]
    if (a.type === 'advance') {
      out.push({ id: uid(), helperId, date: dates[0], type: 'advance', amount: a.amount, source, createdAt: now })
      continue
    }
    for (const date of dates) {
      out.push({ id: uid(), helperId, date, type: a.type, qty: a.qty, paid: a.paid, source, createdAt: now })
    }
  }
  return out
}

/** Send all confirmed drafts. Returns ids so the caller can offer an undo. */
export function sendDrafts(drafts: Draft[]) {
  const now = Date.now()
  const s = getState()
  const msgs: Message[] = drafts.map((d, i) => {
    const h = s.helpers.find((x) => x.id === d.helperId)!
    return {
      id: uid(),
      helperId: d.helperId,
      from: 'employer',
      createdAt: now + i,
      en: d.en,
      native: d.native || d.en,
      nativeLang: d.native ? h.lang : 'en',
      actions: d.actions,
      translated: d.translated,
      kind: 'instruction',
    }
  })
  const entries = drafts.flatMap((d) => entriesFor(d.helperId, d.actions, 'voice'))
  setState((st) => ({ ...st, messages: [...st.messages, ...msgs], ledger: [...st.ledger, ...entries] }))
  return { messageIds: msgs.map((m) => m.id), entryIds: entries.map((e) => e.id) }
}

export function undoSend(ids: { messageIds: string[]; entryIds: string[] }) {
  setState((st) => ({
    ...st,
    messages: st.messages.filter((m) => !ids.messageIds.includes(m.id)),
    ledger: st.ledger.filter((e) => !ids.entryIds.includes(e.id)),
  }))
}

export function addReply(msg: Omit<Message, 'id' | 'createdAt' | 'from' | 'kind'>) {
  const m: Message = { ...msg, id: uid(), createdAt: Date.now(), from: 'helper', kind: 'reply' }
  setState((st) => ({ ...st, messages: [...st.messages, m] }))
  return m
}

export function applyChip(messageId: string, chip: Chip, helper: Helper) {
  setState((st: State) => {
    const next: State = { ...st }
    const now = Date.now()
    if (chip.kind === 'shopping' && chip.item) {
      next.shopping = [...st.shopping, { id: uid(), name: chip.item, addedBy: helper.name, createdAt: now, done: false }]
    } else if (chip.kind === 'advance' && chip.amount) {
      next.ledger = [...st.ledger, { id: uid(), helperId: helper.id, date: iso(today()), type: 'advance', amount: chip.amount, source: 'reply', createdAt: now }]
    } else if (chip.kind === 'leave') {
      next.ledger = [...st.ledger, ...(chip.dates ?? [iso(today())]).map((date) => ({ id: uid(), helperId: helper.id, date, type: 'leave' as const, paid: true, source: 'reply' as const, createdAt: now }))]
    } else if (chip.kind === 'count' && chip.qty) {
      next.ledger = [...st.ledger, { id: uid(), helperId: helper.id, date: iso(today()), type: 'count', qty: chip.qty, source: 'reply', createdAt: now }]
    } else if (chip.kind === 'rate' && chip.amount) {
      next.helpers = st.helpers.map((h) =>
        h.id !== helper.id ? h : h.pay.kind === 'perUnit' ? { ...h, pay: { ...h.pay, unitPrice: chip.amount! } } : h.pay.kind === 'perItem' ? { ...h, pay: { ...h.pay, rate: chip.amount! } } : h,
      )
    }
    next.messages = st.messages.map((m) => (m.id === messageId ? { ...m, chips: m.chips?.map((c) => (c.id === chip.id ? { ...c, done: true } : c)) } : m))
    return next
  })
}

export function markHeard(id: string) {
  setState((st) => ({ ...st, messages: st.messages.map((m) => (m.id === id ? { ...m, heard: true } : m)) }))
}

export function sendBill(h: Helper) {
  const t = today()
  const st = getState()
  const bill = computeBill(h, st.ledger, t.getFullYear(), t.getMonth(), true)
  const native = billSentence(h, h.lang, bill.work, bill.advance, bill.total)
  const en = billSentence(h, 'en', bill.work, bill.advance, bill.total)
  const m: Message = { id: uid(), helperId: h.id, from: 'employer', createdAt: Date.now(), en, native, nativeLang: h.lang, translated: 'template', kind: 'bill' }
  setState((s) => ({ ...s, messages: [...s.messages, m] }))
  return { bill, message: m }
}

export function toggleShopping(id: string) {
  setState((st) => ({ ...st, shopping: st.shopping.map((s) => (s.id === id ? { ...s, done: !s.done } : s)) }))
}
export function clearDoneShopping() {
  setState((st) => ({ ...st, shopping: st.shopping.filter((s) => !s.done) }))
}
