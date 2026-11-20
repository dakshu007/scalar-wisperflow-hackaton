import type { Helper, LedgerEntry, Message, State } from './types'
import { addDays, iso, today } from './dates'

export const HELPER_COLORS = ['#F0D7FF', '#CFF5DC', '#FFE58A', '#FFD1C2', '#C9E4FF', '#E4E4D0']

export const SEED_HELPERS: Helper[] = [
  { id: 'sunita', name: 'Sunita', role: 'cook', lang: 'bn', pay: { kind: 'monthly', amount: 6000 }, color: '#F0D7FF', upi: 'sunita@upi' },
  { id: 'ramesh', name: 'Ramesh', role: 'milkman', lang: 'hi', pay: { kind: 'perUnit', unitPrice: 30, defaultQty: 2, unit: 'packets' }, color: '#CFF5DC', upi: 'ramesh@upi' },
  { id: 'raju', name: 'Raju', role: 'press', lang: 'or', pay: { kind: 'perItem', rate: 10, unit: 'clothes' }, color: '#FFE58A', upi: 'raju@upi' },
  { id: 'lakshmi', name: 'Lakshmi', role: 'maid', lang: 'ta', pay: { kind: 'monthly', amount: 4500 }, color: '#FFD1C2', upi: 'lakshmi@upi' },
  { id: 'manoj', name: 'Manoj', role: 'paper', lang: 'te', pay: { kind: 'perUnit', unitPrice: 8, defaultQty: 1, unit: 'papers' }, color: '#C9E4FF', upi: 'manoj@upi' },
]

/** A believable month so far, so the hisaab screen looks alive on first open. */
function seedLedger(): LedgerEntry[] {
  const t = today()
  const first = new Date(t.getFullYear(), t.getMonth(), 1)
  const out: LedgerEntry[] = []
  const add = (helperId: string, day: number, e: Partial<LedgerEntry>) => {
    const d = addDays(first, day - 1)
    if (d >= t) return
    out.push({ id: `seed-${helperId}-${day}-${e.type}`, helperId, date: iso(d), source: 'seed', createdAt: d.getTime(), type: 'leave', ...e } as LedgerEntry)
  }
  add('sunita', 9, { type: 'leave', paid: true })
  add('sunita', 12, { type: 'advance', amount: 500 })
  add('ramesh', 2, { type: 'pause' })
  add('ramesh', 14, { type: 'extra', qty: 1 })
  add('ramesh', 15, { type: 'extra', qty: 2 })
  for (const [day, qty] of [[3, 12], [7, 9], [10, 15], [14, 11], [17, 14]] as const) add('raju', day, { type: 'count', qty })
  add('lakshmi', 6, { type: 'leave', paid: false })
  add('lakshmi', 10, { type: 'advance', amount: 300 })
  add('manoj', 15, { type: 'pause' })
  add('manoj', 16, { type: 'pause' })
  return out
}

function seedMessages(): Message[] {
  const t = today()
  const yesterday = addDays(t, -1)
  const at = (h: number, m: number) => {
    const d = new Date(yesterday)
    d.setHours(h, m)
    return d.getTime()
  }
  const actions = [{ type: 'extra' as const, dates: [iso(t)], qty: 1 }]
  return [
    {
      id: 'seed-m1',
      helperId: 'ramesh',
      from: 'employer',
      createdAt: at(19, 42),
      en: 'Ramesh, please bring 1 extra packet tomorrow.',
      native: 'रमेश, कल 1 पैकेट ज़्यादा देना।',
      nativeLang: 'hi',
      actions,
      translated: 'template',
      heard: true,
      kind: 'instruction',
    },
    {
      id: 'seed-m2',
      helperId: 'ramesh',
      from: 'helper',
      createdAt: at(19, 50),
      en: 'Okay sister, I will bring one extra packet tomorrow.',
      native: 'ठीक है दीदी, कल एक पैकेट ज़्यादा ले आऊँगा।',
      nativeLang: 'hi',
      translated: 'preset',
      kind: 'reply',
      chips: [],
    },
  ]
}

export function seedState(): State {
  return {
    helpers: SEED_HELPERS,
    ledger: seedLedger(),
    messages: seedMessages(),
    shopping: [
      { id: 'seed-s1', name: 'Coriander', addedBy: 'Sunita', createdAt: Date.now() - 86400000, done: false },
    ],
    settings: {
      employerName: 'Dakshesh',
      geminiKey: '',
      model: 'gemini-2.5-flash',
      upiId: '',
      recogLang: 'en-IN',
    },
  }
}
