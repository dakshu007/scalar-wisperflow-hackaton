/**
 * Offline parser: understands everyday English, Hinglish and Tanglish household
 * instructions without any API key. The Gemini path (ai.ts) handles everything
 * else; this keeps the demo working with zero setup and no network.
 */
import type { Action, Clarification, Draft, Helper, Role } from './types'
import { addDays, expandDuration, findDates, findDuration, iso, today } from './dates'
import { findNumber } from './numbers'
import { canTemplate, composeMessage } from './i18n'
import { uid } from './store'

const ROLE_WORDS: Record<Role, RegExp> = {
  milkman: /\b(milk|milkman|doodh|dudh|doodhwala|paal|paalkaran|pal)\b|பால்|दूध/gi,
  paper: /\b(paper|papers|newspaper|news paper|akhbar|pepar|paperboy)\b|பேப்பர்|अखबार/gi,
  press: /\b(press|presswala|press-wala|iron|ironing|istri|isthiri|dhobi|clothes|kapde|kapda|thuni|uniforms?)\b|இஸ்திரி|प्रेस/gi,
  cook: /\b(cook|cooking|khana|samayal|roti|rotis|chapati|chapathi|dinner|lunch|breakfast|tiffin|sabzi)\b|சமையல்|खाना/gi,
  maid: /\b(maid|bai|jhadu|pocha|cleaning|vessels|bartan|paathiram|house ?help)\b/gi,
  driver: /\b(driver|car|gaadi|vandi|pick ?up|drop)\b/gi,
  other: /$^/g,
}

const NEG = /\b(no|not|don'?t|dont|stop|cancel|band|bandh|mat|nahi|nahin|vendam|venda|vendaam|venam|vaenam|venaam|skip|off|illa|vaa?ndaam)\b|வேண்டாம்|मत|नहीं/i
const LEAVE = /\b(leave|chutti|chhutti|holiday|liv|leev|off day|day off|lev)\b|லீவு|छुट्टी/i
const UNPAID = /\b(unpaid|without pay|salary cut|cut pannu|katna|kaatna|pay cut)\b/i
const PAID = /\b(paid|with pay|full pay|salary cut illa|no cut)\b/i
const EXTRA = /\b(extra|more|zyada|jyada|adhigama|innoru|kooda|additional|aur)\b|அதிகமா|ज़्यादा/i
const ADVANCE = /\b(advance|adv|udhaar|udhar|kadan)\b|அட்வான்ஸ்|एडवांस/i
const ONLY = /\b(only|mattum|sirf|bas|matram|maatram)\b|மட்டும்|सिर्फ़/i
const GIVEN = /\b(gave|given|kuduthen|kuduthom|diye|diya|handed)\b/i

interface Mention { helperId: string; start: number; end: number; how: 'name' | 'fuzzy' | 'role' }

function lev(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length]
}

const STOP = new Set(['the', 'and', 'so', 'to', 'for', 'akka', 'didi', 'anna', 'bhaiya', 'ku', 'ko', 'ki', 'la', 'ji', 'amma', 'please', 'only', 'pannunga', 'iron', 'mattum', 'sirf', 'bas', 'karo', 'karna', 'press', 'do', 'tell', 'that', 'him', 'her'])

function findMentions(text: string, helpers: Helper[]): Mention[] {
  const out: Mention[] = []
  const lower = text.toLowerCase()
  for (const h of helpers) {
    const re = new RegExp(`\\b${h.name.toLowerCase()}\\b`, 'g')
    let m: RegExpExecArray | null
    while ((m = re.exec(lower))) out.push({ helperId: h.id, start: m.index, end: m.index + m[0].length, how: 'name' })
  }
  // Fuzzy names ("Sunitha", "Ramessh") — only for capitalised-ish words of similar length
  const words = [...lower.matchAll(/[a-z]{4,}/g)]
  for (const w of words) {
    if (out.some((o) => w.index! >= o.start && w.index! < o.end)) continue
    if (STOP.has(w[0])) continue
    for (const h of helpers) {
      const n = h.name.toLowerCase()
      const d = lev(w[0], n)
      if (d > 0 && d <= (n.length > 5 ? 2 : 1) && Math.abs(w[0].length - n.length) <= 2) {
        out.push({ helperId: h.id, start: w.index!, end: w.index! + w[0].length, how: 'fuzzy' })
      }
    }
  }
  for (const h of helpers) {
    const re = new RegExp(ROLE_WORDS[h.role].source, 'gi')
    let m: RegExpExecArray | null
    while ((m = re.exec(lower))) {
      if (out.some((o) => m!.index >= o.start && m!.index < o.end)) continue
      out.push({ helperId: h.id, start: m.index, end: m.index + m[0].length, how: 'role' })
    }
  }
  out.sort((a, b) => a.start - b.start)
  // Merge consecutive mentions of the same helper (e.g. "Raju … uniform … iron")
  const merged: Mention[] = []
  for (const m of out) {
    const last = merged[merged.length - 1]
    if (last && last.helperId === m.helperId) {
      last.end = Math.max(last.end, m.end)
      if (m.how === 'name') last.how = 'name'
      continue
    }
    merged.push({ ...m })
  }
  return merged
}

function onlyIronItem(seg: string, helper: Helper) {
  const cleaned = seg
    .toLowerCase()
    .replace(new RegExp(`\\b${helper.name.toLowerCase()}\\b`, 'g'), ' ')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
  return cleaned.join(' ').trim() || undefined
}

export interface ParseResult {
  drafts: Draft[]
  clarifications: Clarification[]
}

export function parseOffline(transcript: string, helpers: Helper[]): ParseResult {
  const text = transcript.replace(/\s+/g, ' ').trim()
  const allDates = findDates(text)
  const mentions = findMentions(text, helpers)
  const byHelper = new Map<string, { actions: Action[]; confidence: number }>()
  const clarifications: Clarification[] = []

  const contextDatesAt = (pos: number) => {
    const before = allDates.filter((d) => d.index <= pos)
    return before.length ? before[before.length - 1].dates : undefined
  }

  // Sentences without any helper mention → ask "who is this for?"
  const sentences = text.split(/(?<=[.!?।])\s+/)
  let cursor = 0
  for (const s of sentences) {
    const start = text.indexOf(s, cursor)
    cursor = start + s.length
    const has = mentions.some((m) => m.start >= start && m.start < start + s.length)
    if (!has && s.replace(/[^a-z]/gi, '').length > 12 && !/^(so|ok|okay|seri|haan|accha)\b/i.test(s)) {
      // Pure context sentences like "Friday to Sunday we're out of town" are fine.
      const isContext = findDates(s).length > 0 && !LEAVE.test(s) && !ADVANCE.test(s) && !EXTRA.test(s)
      if (!isContext) {
        clarifications.push({ id: uid(), kind: 'who', text: `Who is this for? “${s.trim()}”`, segment: s.trim(), actions: [{ type: 'note', dates: [], noteText: s.trim() }] })
      }
    }
  }

  mentions.forEach((m, i) => {
    const helper = helpers.find((h) => h.id === m.helperId)!
    const segStart = i === 0 ? sentenceStart(text, m.start) : Math.max(mentions[i - 1].end, sentenceStart(text, m.start))
    const segEnd = i + 1 < mentions.length ? Math.min(mentions[i + 1].start, sentenceEnd(text, m.end)) : sentenceEnd(text, m.end)
    const seg = text.slice(segStart, segEnd)
    const segDates = findDates(seg)
    let dates = segDates.length ? segDates.flatMap((d) => d.dates) : contextDatesAt(m.start)
    const dur = findDuration(seg)
    if (dur) {
      const startDate = dates?.[0] ?? iso(addDays(today(), 1))
      dates = expandDuration(startDate, dur)
    }
    const dateList = dates ?? [iso(addDays(today(), 1))]
    const datesGuessed = !dates
    const num = findNumber(seg.replace(/\b(\d+|one|two|three|rendu|do)\s*(days?|din|naal)\b/gi, ''))

    const actions: Action[] = []
    let conf = m.how === 'name' ? 0.95 : m.how === 'role' ? 0.88 : 0.6

    if (ADVANCE.test(seg)) {
      if (num && num >= 50) actions.push({ type: 'advance', dates: [iso(today())], amount: num })
      else clarifications.push({ id: uid(), kind: 'amount', helperId: helper.id, text: `How much advance for ${helper.name}?`, dates: [iso(today())] })
    } else if (LEAVE.test(seg)) {
      actions.push({ type: 'leave', dates: dateList, paid: UNPAID.test(seg) ? false : PAID.test(seg) ? true : true })
      if (datesGuessed) conf = Math.min(conf, 0.75)
    } else if (helper.role === 'press' && ONLY.test(seg)) {
      actions.push({ type: 'note', dates: [], noteKey: 'only_iron', item: onlyIronItem(seg, helper) })
    } else if (helper.role === 'press' && num && (GIVEN.test(seg) || /clothes|kapde|thuni/i.test(seg))) {
      actions.push({ type: 'count', dates: segDates.length ? dateList : [iso(today())], qty: num })
    } else if (EXTRA.test(seg) && num) {
      actions.push({ type: 'extra', dates: dateList, qty: num, item: /roti|chapat/i.test(seg) ? 'roti' : undefined })
      if (datesGuessed) conf = Math.min(conf, 0.8)
    } else if (NEG.test(seg) || /out of town|ooru la irukka maatom|bahar|not home|veetla illa|away/i.test(seg)) {
      actions.push({ type: 'pause', dates: dateList })
      if (datesGuessed) conf = Math.min(conf, 0.75)
    } else {
      const note = seg.replace(/^[\s,.;-]+|[\s,.;-]+$/g, '')
      if (note) actions.push({ type: 'note', dates: [], noteText: note })
      conf = Math.min(conf, 0.7)
    }

    if (!actions.length) return
    const cur = byHelper.get(helper.id)
    if (cur) {
      cur.actions.push(...actions)
      cur.confidence = Math.min(cur.confidence, conf)
    } else byHelper.set(helper.id, { actions, confidence: conf })

    if (m.how === 'fuzzy') {
      clarifications.push({ id: uid(), kind: 'who', text: `Did you mean ${helper.name}?`, guessId: helper.id, segment: seg.trim(), actions: [] })
    }
  })

  const drafts: Draft[] = [...byHelper.entries()].map(([helperId, v]) => {
    const h = helpers.find((x) => x.id === helperId)!
    const templ = v.actions.every(canTemplate)
    return {
      helperId,
      actions: v.actions,
      en: composeMessage(h, v.actions, 'en'),
      native: templ ? composeMessage(h, v.actions, h.lang) : '',
      confidence: v.confidence,
      translated: templ ? 'template' : 'none',
    }
  })

  return { drafts, clarifications }
}

function sentenceStart(text: string, pos: number) {
  const before = text.slice(0, pos)
  const i = Math.max(before.lastIndexOf('. '), before.lastIndexOf('? '), before.lastIndexOf('! '), before.lastIndexOf('। '))
  return i < 0 ? 0 : i + 2
}
function sentenceEnd(text: string, pos: number) {
  const rest = text.slice(pos)
  const m = rest.search(/[.?!।](\s|$)/)
  return m < 0 ? text.length : pos + m + 1
}

/* ---------------- Helper replies (offline) ---------------- */

const SHOP_ITEMS: [RegExp, string][] = [
  [/\bgas\b|cylinder|गैस|গ্যাস|ଗ୍ୟାସ|கேஸ்|గ్యాస్|সিলিন্ডার/i, 'Gas cylinder'],
  [/\batta\b|आटा|আটা|ଅଟା|மாவு|పిండి/i, 'Atta'],
  [/\boil\b|tel\b|तेल|তেল|ତେଲ|எண்ணெய்|నూనె/i, 'Cooking oil'],
  [/\brice\b|chawal|चावल|চাল|ଚାଉଳ|அரிசி|బియ్యం/i, 'Rice'],
  [/\bsugar\b|cheeni|चीनी|চিনি|ଚିନି|சர்க்கரை|చక్కెర/i, 'Sugar'],
  [/\bdahi\b|curd|दही|দই|ଦହି|தயிர்|పెరుగు/i, 'Curd'],
  [/\bsoap\b|sabun|साबुन|সাবান|ସାବୁନ|சோப்பு|సబ్బు/i, 'Soap'],
  [/\bonions?\b|pyaz|प्याज|পেঁয়াজ|ପିଆଜ|வெங்காயம்|ఉల్లి/i, 'Onions'],
  [/\btomato(es)?\b|टमाटर|টমেটো|ଟମାଟୋ|தக்காளி|టమాటా/i, 'Tomatoes'],
  [/\bdish ?wash|vim\b|बर्तन साबुन/i, 'Dishwash liquid'],
]
const FINISHED = /போச்சு|khatam|khatm|over|finished|empty|shesh|theernthu|theernduchu|aayiduchu|ayipoyindi|खत्म|ख़त्म|শেষ|ଶେଷ|தீர்ந்து|முடிஞ்சு|అయిపోయింది|নেই|नहीं है|ନାହିଁ/i
const R_ADV = /advance|udhaar|udhar|एडवांस|उधार|অ্যাডভান্স|ধার|ଆଡଭାନ୍ସ|அட்வான்ஸ்|అడ్వాన్స్/i
const R_LEAVE = /leave|chutti|छुट्टी|नहीं आ|nahi aa|ছুটি|আসতে পারব না|ଛୁଟି|ଆସିପାରିବି ନାହିଁ|லீவு|வர முடியாது|సెలవు|రాలేను/i
const R_CLOTHES = /clothes|kapde|कपड़े|কাপড়|ଲୁଗା|துணி|బట్టలు/i
const R_RATE = /rate|price|रेट|दाम|দাম|ଦାମ|விலை|ధర/i

export function replyChips(text: string, helper: Helper) {
  const chips: import('./types').Chip[] = []
  const num = findNumber(text)
  if (FINISHED.test(text) || /lagbe|chahiye|vendum|kavali|चाहिए|লাগবে|ଦରକାର|வேணும்|కావాలి/i.test(text)) {
    for (const [re, name] of SHOP_ITEMS) if (re.test(text)) chips.push({ id: uid(), kind: 'shopping', label: `Add ${name.toLowerCase()} to shopping list`, item: name })
  }
  if (R_ADV.test(text)) {
    chips.push(num ? { id: uid(), kind: 'advance', label: `Approve ₹${num} advance`, amount: num } : { id: uid(), kind: 'advance', label: 'Advance requested — set amount', amount: 0 })
  }
  if (R_LEAVE.test(text)) {
    const d = findDates(text)
    const dates = d.length ? [...new Set(d.flatMap((x) => x.dates))].sort() : [iso(addDays(today(), 1))]
    chips.push({ id: uid(), kind: 'leave', label: `Approve leave (${dates.length} day${dates.length > 1 ? 's' : ''})`, dates })
  }
  if (R_CLOTHES.test(text) && num && helper.role === 'press') {
    chips.push({ id: uid(), kind: 'count', label: `Log ${num} clothes today`, qty: num, dates: [iso(today())] })
  }
  if (R_RATE.test(text) && num && helper.pay.kind !== 'monthly') {
    chips.push({ id: uid(), kind: 'rate', label: `Update rate to ₹${num}`, amount: num })
  }
  return chips
}
