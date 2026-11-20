export type Lang = 'en' | 'hi' | 'bn' | 'or' | 'ta' | 'te'
export type Role = 'cook' | 'maid' | 'milkman' | 'paper' | 'press' | 'driver' | 'other'

export type PayRule =
  | { kind: 'monthly'; amount: number }
  | { kind: 'perUnit'; unitPrice: number; defaultQty: number; unit: string }
  | { kind: 'perItem'; rate: number; unit: string }

export interface Helper {
  id: string
  name: string
  role: Role
  lang: Lang
  pay: PayRule
  color: string
  upi?: string
}

export type LedgerType = 'leave' | 'pause' | 'extra' | 'count' | 'advance'

export interface LedgerEntry {
  id: string
  helperId: string
  date: string // YYYY-MM-DD
  type: LedgerType
  qty?: number
  amount?: number
  paid?: boolean
  note?: string
  source: 'voice' | 'reply' | 'manual' | 'seed'
  createdAt: number
}

export type ActionType = LedgerType | 'note'

export interface Action {
  type: ActionType
  dates: string[]
  qty?: number
  amount?: number
  paid?: boolean
  item?: string
  noteKey?: 'only_iron'
  noteText?: string
}

export type ChipKind = 'shopping' | 'advance' | 'leave' | 'count' | 'rate'

export interface Chip {
  id: string
  kind: ChipKind
  label: string
  item?: string
  amount?: number
  qty?: number
  dates?: string[]
  done?: boolean
}

export interface Message {
  id: string
  helperId: string
  from: 'employer' | 'helper'
  createdAt: number
  en: string
  native: string
  nativeLang: Lang
  actions?: Action[]
  audio?: string
  chips?: Chip[]
  translated?: 'ai' | 'template' | 'free' | 'none' | 'preset'
  heard?: boolean
  kind?: 'instruction' | 'bill' | 'reply'
}

export interface ShoppingItem {
  id: string
  name: string
  addedBy: string
  createdAt: number
  done: boolean
}

export interface Settings {
  employerName: string
  geminiKey: string
  model: string
  upiId: string
  recogLang: 'en-IN' | 'hi-IN' | 'ta-IN'
}

export interface State {
  helpers: Helper[]
  ledger: LedgerEntry[]
  messages: Message[]
  shopping: ShoppingItem[]
  settings: Settings
}

/** One planned outgoing message per helper, shown on the confirmation sheet. */
export interface Draft {
  helperId: string
  actions: Action[]
  en: string
  native: string
  confidence: number
  translated: Message['translated']
}

export type Clarification =
  | { id: string; kind: 'who'; text: string; guessId?: string; segment: string; actions: Action[] }
  | { id: string; kind: 'amount'; helperId: string; text: string; dates: string[] }
