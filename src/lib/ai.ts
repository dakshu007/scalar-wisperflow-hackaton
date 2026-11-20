/**
 * Optional AI layer (Google Gemini free tier). With a key, any sentence in any
 * mix of languages is understood and translated; without one, the offline
 * parser + templates handle the common cases and MyMemory handles free text.
 */
import type { Action, Chip, Clarification, Draft, Helper, Lang, Settings } from './types'
import { iso, today, WEEKDAYS_EN } from './dates'
import { LANGS, canTemplate, composeMessage } from './i18n'
import { uid } from './store'

const SYSTEM = `You are the brain of GharBolo, a voice app an Indian household uses to instruct its daily helpers (cook, maid, milkman, newspaper vendor, press-wala, driver).
The employer speaks casually and often mixes Indian languages with English (Tanglish, Hinglish, Kanglish). Speech recognition may mishear words. Understand the meaning, not the exact words. Keep Indian words like paal, doodh, roti, akka, didi when natural.
Rules:
- Split the instruction into one entry per helper it concerns. A sentence can concern several helpers.
- Action types: "leave" (helper is off; paid true/false, default true), "pause" (no delivery / don't come), "extra" (qty more than usual, optional item: "roti"), "count" (number of clothes given to press-wala), "advance" (money given; amount required), "note" (anything else; put a clean English instruction in noteText).
- Resolve relative dates ("kal", "naalaiku" = tomorrow, "parso" = day after, weekday names = next occurrence on/after today, "two days" = consecutive days starting from the dates in context or tomorrow) into ISO dates.
- Normalise spoken numbers ("dhai sau" = 250, "ainooru" = 500).
- NEVER guess a money amount. If an advance has no clear amount, add a clarification of kind "amount".
- If a name is not in the helper list or you are unsure who is meant, set confidence below 0.7 and add a clarification of kind "who" with your best guessId.
- "en" is a short, warm instruction addressed to the helper by name, in simple English.
- "native" is the same message translated naturally into the helper's language, in that language's script, addressed by name, simple spoken style a non-reader would understand when read aloud.`

interface AIItem {
  helperId: string
  confidence: number
  actions: Action[]
  en: string
  native: string
}
interface AIClar { kind: 'who' | 'amount'; text: string; helperId?: string; guessId?: string }

async function gemini(settings: Settings, prompt: string, schemaHint: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.model || 'gemini-2.5-flash')}:generateContent?key=${encodeURIComponent(settings.geminiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: `${prompt}\n\nRespond ONLY with JSON matching: ${schemaHint}` }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const text: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
  return JSON.parse(text.replace(/^```json\s*|```$/g, ''))
}

export async function parseWithAI(transcript: string, helpers: Helper[], settings: Settings): Promise<{ drafts: Draft[]; clarifications: Clarification[] }> {
  const t = today()
  const helperList = helpers.map((h) => `- id "${h.id}": ${h.name}, ${h.role}, speaks ${LANGS[h.lang].name} (${h.lang})`).join('\n')
  const prompt = `Today is ${WEEKDAYS_EN[t.getDay()]} ${iso(t)}.
Helpers:
${helperList}

Employer said (raw speech transcript): """${transcript}"""`
  const schema = `{"items":[{"helperId":string,"confidence":number,"actions":[{"type":"leave|pause|extra|count|advance|note","dates":[ "YYYY-MM-DD" ],"qty"?:number,"amount"?:number,"paid"?:boolean,"item"?:string,"noteText"?:string}],"en":string,"native":string}],"clarifications":[{"kind":"who|amount","text":string,"helperId"?:string,"guessId"?:string}]}`
  const out = (await gemini(settings, prompt, schema)) as { items: AIItem[]; clarifications?: AIClar[] }
  const drafts: Draft[] = (out.items || [])
    .filter((i) => helpers.some((h) => h.id === i.helperId))
    .map((i) => {
      const h = helpers.find((x) => x.id === i.helperId)!
      const actions = (i.actions || []).map((a) => ({ ...a, dates: a.dates || [] }))
      // Structured actions get our verified templates; free text keeps the AI translation.
      const templ = actions.length > 0 && actions.every(canTemplate)
      return {
        helperId: i.helperId,
        actions,
        en: i.en || composeMessage(h, actions, 'en'),
        native: i.native || (templ ? composeMessage(h, actions, h.lang) : ''),
        confidence: typeof i.confidence === 'number' ? i.confidence : 0.9,
        translated: 'ai' as const,
      }
    })
  const clarifications: Clarification[] = (out.clarifications || []).map((c) =>
    c.kind === 'amount'
      ? { id: uid(), kind: 'amount', helperId: c.helperId || drafts[0]?.helperId || helpers[0].id, text: c.text, dates: [iso(t)] }
      : { id: uid(), kind: 'who', text: c.text, guessId: c.guessId, segment: '', actions: [] },
  )
  return { drafts, clarifications }
}

export async function understandReply(text: string, helper: Helper, settings: Settings): Promise<{ en: string; chips: Chip[] }> {
  const prompt = `A ${helper.role} named ${helper.name} replied by voice in ${LANGS[helper.lang].name}. Transcript: """${text}"""
Translate it to natural English for the employer and extract any requests:
- shopping: something in the house is finished/needed (item = short English name)
- advance: they ask for money in advance (amount if stated, else 0)
- leave: they can't come (dates as ISO; today is ${iso(today())})
- count: number of clothes taken for ironing (qty)
- rate: new price per unit (amount)`
  const schema = `{"en":string,"chips":[{"kind":"shopping|advance|leave|count|rate","label":string,"item"?:string,"amount"?:number,"qty"?:number,"dates"?:string[]}]}`
  const out = await gemini(settings, prompt, schema)
  return { en: out.en, chips: (out.chips || []).map((c: Chip) => ({ ...c, id: uid() })) }
}

/** Free, keyless translation fallback for short phrases. */
export async function freeTranslate(text: string, from: Lang, to: Lang): Promise<string | null> {
  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`)
    if (!res.ok) return null
    const data = await res.json()
    const out: string | undefined = data?.responseData?.translatedText
    if (!out || /MYMEMORY WARNING|INVALID/i.test(out)) return null
    return out
  } catch {
    return null
  }
}

export const hasAI = (s: Settings) => s.geminiKey.trim().length > 10

/** Translate a short English instruction into the helper's language (AI if available, else free API). */
export async function translateText(text: string, to: Lang, settings: Settings): Promise<{ text: string; via: 'ai' | 'free' } | null> {
  if (to === 'en') return { text, via: 'free' }
  if (hasAI(settings)) {
    try {
      const out = await gemini(settings, `Translate this instruction for a household helper into ${LANGS[to].name}, in its native script, simple spoken style: """${text}"""`, `{"text":string}`)
      if (out?.text) return { text: out.text, via: 'ai' }
    } catch {
      /* fall back */
    }
  }
  const free = await freeTranslate(text, 'en', to)
  return free ? { text: free, via: 'free' } : null
}
