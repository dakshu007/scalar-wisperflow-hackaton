/** Normalise Indic digits to ASCII. */
export function asciiDigits(s: string) {
  const blocks = [0x0966, 0x09e6, 0x0b66, 0x0be6, 0x0c66] // Devanagari, Bengali, Odia, Tamil, Telugu
  return s.replace(/[०-९০-৯୦-୯௦-௯౦-౯]/g, (ch) => {
    const c = ch.charCodeAt(0)
    for (const b of blocks) if (c >= b && c <= b + 9) return String(c - b)
    return ch
  })
}

const WORDS: [RegExp, number][] = [
  // Hindi / Hinglish money words
  [/\bdhai\s*(sau|so)\b/i, 250],
  [/\bdedh\s*(sau|so)\b/i, 150],
  [/\bsaade\s*teen\s*(sau|so)\b/i, 350],
  [/\b(ek|1)\s*hazaa?r\b/i, 1000],
  [/\b(do|2)\s*hazaa?r\b/i, 2000],
  [/\bpaanch\s*(sau|so)\b/i, 500],
  [/\bchaar\s*(sau|so)\b/i, 400],
  [/\bteen\s*(sau|so)\b/i, 300],
  [/\bdo\s*(sau|so)\b/i, 200],
  [/\bek\s*(sau|so)\b/i, 100],
  // Tamil / Tanglish
  [/\b(oru\s*)?aayiram\b|ஆயிரம்/i, 1000],
  [/\bainnoo?ru\b|ஐநூறு/i, 500],
  [/\bnaanoo?ru\b|நானூறு/i, 400],
  [/\bmunnoo?ru\b|முன்னூறு/i, 300],
  [/\biranoo?ru\b|\birunoo?ru\b|இருநூறு/i, 200],
  [/\bnoo?ru\b|நூறு/i, 100],
  // English
  [/\bone thousand\b/i, 1000],
  [/\bfive hundred\b/i, 500],
  [/\bthree hundred\b/i, 300],
  [/\btwo hundred\b/i, 200],
  [/\bhundred\b/i, 100],
]

const SMALL: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20,
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, chhe: 6, saat: 7, aath: 8, das: 10,
  oru: 1, onnu: 1, rendu: 2, moonu: 3, naalu: 4, anju: 5, aaru: 6, ezhu: 7, ettu: 8, pathu: 10,
}

/** First money-ish or count number in text, with Hinglish/Tanglish number words. */
export function findNumber(text: string): number | undefined {
  const t = asciiDigits(text).replace(/(\d),(\d)/g, '$1$2')
  for (const [re, n] of WORDS) if (re.test(t)) return n
  const d = t.match(/(?:₹|rs\.?\s*|rupees?\s*)?(\d+(?:\.\d+)?)/i)
  if (d) return Number(d[1])
  const w = t.toLowerCase().match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|ek|do|teen|chaar|char|paanch|chhe|saat|aath|das|oru|onnu|rendu|moonu|naalu|anju|aaru|ezhu|ettu|pathu)\b/)
  if (w) return SMALL[w[1]]
  return undefined
}
