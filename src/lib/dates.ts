export const pad = (n: number) => String(n).padStart(2, '0')

export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const fromIso = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const today = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate()

export const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`

export const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** Spoken weekday words in English, Hinglish and Tanglish → weekday index. */
const WEEKDAY_WORDS: [RegExp, number][] = [
  [/\b(sunday|sun|ravivar|itwar|nyayiru|gnayiru)\b|ஞாயிறு|रविवार/i, 0],
  [/\b(monday|mon|somvar|thingal)\b|திங்கள்|सोमवार/i, 1],
  [/\b(tuesday|tue|tues|mangalvar|sevvai)\b|செவ்வாய்|मंगलवार/i, 2],
  [/\b(wednesday|wed|budhvar|budhan|pudhan)\b|புதன்|बुधवार/i, 3],
  [/\b(thursday|thu|thurs|guruvar|viyazhan|vyazhan)\b|வியாழன்|गुरुवार/i, 4],
  [/\b(friday|fri|shukravar|velli)\b|வெள்ளி|शुक्रवार/i, 5],
  [/\b(saturday|sat|shanivar|sani)\b|சனி|शनिवार/i, 6],
]

const nextWeekday = (from: Date, wd: number) => {
  const diff = (wd - from.getDay() + 7) % 7
  return addDays(from, diff)
}

const range = (a: Date, b: Date) => {
  const out: string[] = []
  let d = new Date(a)
  let guard = 0
  while (d <= b && guard++ < 62) {
    out.push(iso(d))
    d = addDays(d, 1)
  }
  return out
}

interface Found { index: number; dates: string[]; text: string }

/** Find all date expressions in text with their positions. */
export function findDates(text: string, base = today()): Found[] {
  const found: Found[] = []
  const lower = text.toLowerCase()

  // Weekday ranges: "friday to sunday", "fri se sun tak", "friday la irundhu sunday varai"
  const wdSrc = WEEKDAY_WORDS.map(([r]) => r.source).join('|')
  const rangeRe = new RegExp(`(${wdSrc})\\s*(?:to|till|until|se|-|–|la irundhu|lerndhu|muthal|mudhal|thru|through)\\s*(${wdSrc})`, 'gi')
  let m: RegExpExecArray | null
  const covered: [number, number][] = []
  while ((m = rangeRe.exec(lower))) {
    const seg = m[0]
    const hits = WEEKDAY_WORDS
      .map(([r, wd]) => ({ wd, i: seg.search(new RegExp(r.source, 'i')) }))
      .filter((h) => h.i >= 0)
      .sort((x, y) => x.i - y.i)
    if (hits.length < 2) continue
    const a = hits[0].wd
    const b = hits[hits.length - 1].wd
    const start = nextWeekday(base, a)
    let end = nextWeekday(start, b)
    if (end < start) end = addDays(end, 7)
    found.push({ index: m.index, dates: range(start, end), text: m[0] })
    covered.push([m.index, m.index + m[0].length])
  }

  const isCovered = (i: number) => covered.some(([s, e]) => i >= s && i < e)

  // Single weekdays
  for (const [re, wd] of WEEKDAY_WORDS) {
    const g = new RegExp(re.source, 'gi')
    while ((m = g.exec(lower))) {
      if (isCovered(m.index)) continue
      found.push({ index: m.index, dates: [iso(nextWeekday(base, wd))], text: m[0] })
    }
  }

  const rel: [RegExp, number][] = [
    [/\b(today|tonight|aaj|aj|inniki|inniku|innaikku|indru|ippo)\b|இன்று|आज|আজ|ଆଜି|ఈరోజు/gi, 0],
    [/\b(day after tomorrow|parso|parson|nalaniku|naalanniku|naala marunaal)\b|परसों/gi, 2],
    [/\b(tomorrow|kal|naalaiku|nalaiku|naalai|nalai|naaliki|repu)\b|நாளை|कल|কাল|କାଲି|రేపు/gi, 1],
  ]
  for (const [re, n] of rel) {
    while ((m = re.exec(lower))) {
      if (isCovered(m.index)) continue
      // "day after tomorrow" contains "tomorrow" — skip the inner match
      if (n === 1 && /day after\s*$/i.test(lower.slice(0, m.index))) continue
      found.push({ index: m.index, dates: [iso(addDays(base, n))], text: m[0] })
      covered.push([m.index, m.index + m[0].length])
    }
  }

  // Durations: "two days", "2 din", "rendu naal" — resolved later against context
  return found.sort((a, b) => a.index - b.index)
}

const DUR_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5,
  oru: 1, onnu: 1, rendu: 2, moonu: 3, naalu: 4, anju: 5,
}

/** "two days", "2 din", "rendu naal" → 2 */
export function findDuration(text: string): number | undefined {
  const m = text.toLowerCase().match(/\b(\d+|one|two|three|four|five|six|seven|ek|do|teen|chaar|char|paanch|oru|onnu|rendu|moonu|naalu|anju)\s*(days?|din|naal|naatkal|naal)\b/)
  if (!m) return undefined
  return /^\d+$/.test(m[1]) ? Number(m[1]) : DUR_WORDS[m[1]]
}

export function expandDuration(start: string, n: number) {
  return range(fromIso(start), addDays(fromIso(start), n - 1))
}

/** Human readable date list in English: "Fri 21 – Sun 23 Nov" */
export function describeDates(dates: string[]): string {
  if (!dates.length) return ''
  const t = iso(today())
  const tm = iso(addDays(today(), 1))
  const one = (s: string) => {
    if (s === t) return 'today'
    if (s === tm) return 'tomorrow'
    const d = fromIso(s)
    return `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()}`
  }
  if (dates.length === 1) return one(dates[0])
  if (isContiguous(dates)) return `${one(dates[0])} – ${one(dates[dates.length - 1])}`
  return dates.map(one).join(', ')
}

export function isContiguous(dates: string[]) {
  for (let i = 1; i < dates.length; i++) {
    if (iso(addDays(fromIso(dates[i - 1]), 1)) !== dates[i]) return false
  }
  return true
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
