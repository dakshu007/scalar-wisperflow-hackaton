import type { CSSProperties } from 'react'
import type { Action, Helper, Lang, Role } from './types'
import { addDays, fromIso, iso, isContiguous, today } from './dates'

export const LANGS: Record<Lang, { name: string; native: string; bcp: string; font: string }> = {
  en: { name: 'English', native: 'English', bcp: 'en-IN', font: '' },
  hi: { name: 'Hindi', native: 'हिन्दी', bcp: 'hi-IN', font: "'Noto Sans Devanagari'" },
  bn: { name: 'Bengali', native: 'বাংলা', bcp: 'bn-IN', font: "'Noto Sans Bengali'" },
  or: { name: 'Odia', native: 'ଓଡ଼ିଆ', bcp: 'or-IN', font: "'Noto Sans Oriya'" },
  ta: { name: 'Tamil', native: 'தமிழ்', bcp: 'ta-IN', font: "'Noto Sans Tamil'" },
  te: { name: 'Telugu', native: 'తెలుగు', bcp: 'te-IN', font: "'Noto Sans Telugu'" },
}

export const ROLES: Record<Role, { label: string; emoji: string }> = {
  cook: { label: 'Cook', emoji: '🍳' },
  maid: { label: 'House help', emoji: '🧹' },
  milkman: { label: 'Milkman', emoji: '🥛' },
  paper: { label: 'Newspaper', emoji: '📰' },
  press: { label: 'Press-wala', emoji: '👔' },
  driver: { label: 'Driver', emoji: '🚗' },
  other: { label: 'Helper', emoji: '🙂' },
}

const WD: Record<Lang, string[]> = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  hi: ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'],
  bn: ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'],
  or: ['ରବିବାର', 'ସୋମବାର', 'ମଙ୍ଗଳବାର', 'ବୁଧବାର', 'ଗୁରୁବାର', 'ଶୁକ୍ରବାର', 'ଶନିବାର'],
  ta: ['ஞாயிறு', 'திங்கள்', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி'],
  te: ['ఆదివారం', 'సోమవారం', 'మంగళవారం', 'బుధవారం', 'గురువారం', 'శుక్రవారం', 'శనివారం'],
}

const REL: Record<Lang, [string, string]> = {
  en: ['today', 'tomorrow'],
  hi: ['आज', 'कल'],
  bn: ['আজ', 'কাল'],
  or: ['ଆଜି', 'କାଲି'],
  ta: ['இன்று', 'நாளை'],
  te: ['ఈరోజు', 'రేపు'],
}

const RANGE: Record<Lang, (a: string, b: string) => string> = {
  en: (a, b) => `${a} to ${b}`,
  hi: (a, b) => `${a} से ${b} तक`,
  bn: (a, b) => `${a} থেকে ${b} পর্যন্ত`,
  or: (a, b) => `${a}ରୁ ${b} ପର୍ଯ୍ୟନ୍ତ`,
  ta: (a, b) => `${a} முதல் ${b} வரை`,
  te: (a, b) => `${a} నుండి ${b} వరకు`,
}

function dayWord(s: string, lang: Lang) {
  if (s === iso(today())) return REL[lang][0]
  if (s === iso(addDays(today(), 1))) return REL[lang][1]
  return WD[lang][fromIso(s).getDay()]
}

function enDates(dates: string[]) {
  if (!dates.length) return ''
  const w = (x: string) => dayWord(x, 'en')
  const on = (x: string) => (/today|tomorrow/.test(w(x)) ? w(x) : `on ${w(x)}`)
  if (dates.length === 1) return on(dates[0])
  if (dates.length === 2) return `${on(dates[0])} and ${w(dates[1])}`
  if (isContiguous(dates)) return `from ${w(dates[0])} to ${w(dates[dates.length - 1])}`
  return `on ${dates.map(w).join(', ')}`
}

export function datesIn(dates: string[], lang: Lang) {
  if (!dates.length) return ''
  if (dates.length === 1) return dayWord(dates[0], lang)
  if (isContiguous(dates)) return RANGE[lang](dayWord(dates[0], lang), dayWord(dates[dates.length - 1], lang))
  return dates.map((d) => dayWord(d, lang)).join(', ')
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

type ItemKey = 'milk' | 'paper' | 'roti' | 'clothes' | 'packet'
const ITEMS: Record<ItemKey, Record<Lang, string>> = {
  milk: { en: 'milk', hi: 'दूध', bn: 'দুধ', or: 'ଦୁଧ', ta: 'பால்', te: 'పాలు' },
  paper: { en: 'newspaper', hi: 'अखबार', bn: 'খবরের কাগজ', or: 'ଖବରକାଗଜ', ta: 'பேப்பர்', te: 'పేపర్' },
  roti: { en: 'rotis', hi: 'रोटी', bn: 'রুটি', or: 'ରୁଟି', ta: 'சப்பாத்தி', te: 'చపాతీలు' },
  clothes: { en: 'clothes', hi: 'कपड़े', bn: 'কাপড়', or: 'ଲୁଗା', ta: 'துணி', te: 'బట్టలు' },
  packet: { en: 'packets', hi: 'पैकेट', bn: 'প্যাকেট', or: 'ପ୍ୟାକେଟ', ta: 'பாக்கெட்', te: 'ప్యాకెట్లు' },
}

function itemFor(role: Role, item?: string): ItemKey | undefined {
  if (item && item in ITEMS) return item as ItemKey
  if (role === 'milkman') return 'milk'
  if (role === 'paper') return 'paper'
  if (role === 'press') return 'clothes'
  return undefined
}

/** Render one structured action as a sentence in the given language. */
export function actionSentence(a: Action, h: Helper, lang: Lang): string {
  const d = datesIn(a.dates, lang)
  const e = enDates(a.dates)
  const item = itemFor(h.role, a.item)
  const it = item ? ITEMS[item][lang] : ''
  const q = a.qty ?? 1
  switch (a.type) {
    case 'pause':
      if (item) {
        return {
          en: `No ${it} needed ${e}.`,
          hi: `${d} ${it} मत देना।`,
          bn: `${d} ${it} দিও না।`,
          or: `${d} ${it} ଦିଅନ୍ତୁ ନାହିଁ।`,
          ta: `${d} ${it} வேண்டாம்.`,
          te: `${d} ${it} వద్దు.`,
        }[lang]
      }
      return {
        en: `No need to come ${e}.`,
        hi: `${d} आने की ज़रूरत नहीं है।`,
        bn: `${d} আসার দরকার নেই।`,
        or: `${d} ଆସିବା ଦରକାର ନାହିଁ।`,
        ta: `${d} வர வேண்டாம்.`,
        te: `${d} రావద్దు.`,
      }[lang]
    case 'leave':
      return a.paid !== false
        ? {
            en: `You have paid leave ${e} — no salary cut.`,
            hi: `${d} आपकी छुट्टी है, पैसे नहीं कटेंगे।`,
            bn: `${d} আপনার ছুটি, টাকা কাটা হবে না।`,
            or: `${d} ଆପଣଙ୍କ ଛୁଟି, ଟଙ୍କା କଟିବ ନାହିଁ।`,
            ta: `${d} உங்களுக்கு லீவு, சம்பளம் பிடிக்க மாட்டோம்.`,
            te: `${d} మీకు సెలవు, జీతం కట్ అవ్వదు.`,
          }[lang]
        : {
            en: `Leave noted ${e}.`,
            hi: `${d} छुट्टी लिख ली है।`,
            bn: `${d} ছুটি লিখে রাখা হলো।`,
            or: `${d} ଛୁଟି ଲେଖି ରଖାଗଲା।`,
            ta: `${d} லீவு குறிச்சு வச்சாச்சு.`,
            te: `${d} సెలవు రాసుకున్నాం.`,
          }[lang]
    case 'extra': {
      const make = h.role === 'cook'
      const label = it || ITEMS.packet[lang]
      return {
        en: `${make ? 'Please make ' : ''}${q} extra ${label} ${e}.`,
        hi: `${d} ${q} ${label} ज़्यादा ${make ? 'बनाना' : 'देना'}।`,
        bn: `${d} ${q}টা ${label} বেশি ${make ? 'বানিও' : 'দিও'}।`,
        or: `${d} ${q}ଟି ${label} ଅଧିକ ${make ? 'ବନାନ୍ତୁ' : 'ଦିଅନ୍ତୁ'}।`,
        ta: `${d} ${q} ${label} எக்ஸ்ட்ரா ${make ? 'செய்யுங்க' : 'குடுங்க'}.`,
        te: `${d} ${q} ${label} ఎక్స్ట్రా ${make ? 'చేయండి' : 'ఇవ్వండి'}.`,
      }[lang]
    }
    case 'count':
      return {
        en: `${q} clothes given ${e}.`,
        hi: `${d} ${q} कपड़े दिए।`,
        bn: `${d} ${q}টা কাপড় দেওয়া হলো।`,
        or: `${d} ${q}ଟି ଲୁଗା ଦିଆଗଲା।`,
        ta: `${d} ${q} துணி குடுத்தோம்.`,
        te: `${d} ${q} బట్టలు ఇచ్చాము.`,
      }[lang]
    case 'advance':
      return {
        en: `₹${a.amount} advance noted.`,
        hi: `₹${a.amount} एडवांस लिख लिया है।`,
        bn: `₹${a.amount} অ্যাডভান্স লিখে রাখা হলো।`,
        or: `₹${a.amount} ଆଡଭାନ୍ସ ଲେଖି ରଖାଗଲା।`,
        ta: `₹${a.amount} அட்வான்ஸ் எழுதி வச்சாச்சு.`,
        te: `₹${a.amount} అడ్వాన్స్ రాసుకున్నాం.`,
      }[lang]
    case 'note':
      if (a.noteKey === 'only_iron') {
        const x = a.item || 'these clothes'
        return {
          en: `Iron only the ${x}.`,
          hi: `सिर्फ़ ${x} प्रेस करना।`,
          bn: `শুধু ${x} ইস্ত্রি করবে।`,
          or: `କେବଳ ${x} ଇସ୍ତ୍ରି କରନ୍ତୁ।`,
          ta: `${x} மட்டும் இஸ்திரி பண்ணுங்க.`,
          te: `${x} మాత్రమే ఇస్త్రీ చేయండి.`,
        }[lang]
      }
      return lang === 'en' ? cap(a.noteText || '') : ''
  }
}

export function canTemplate(a: Action) {
  return a.type !== 'note' || a.noteKey === 'only_iron'
}

export function composeMessage(h: Helper, actions: Action[], lang: Lang) {
  const body = actions.map((a) => actionSentence(a, h, lang)).filter(Boolean).join(' ')
  const first = lang === 'en' && !/^(I |I'|₹)/.test(body) ? body.charAt(0).toLowerCase() + body.slice(1) : body
  return `${h.name}, ${first}`
}

export const UI: Record<Lang, { listen: string; reply: string; hisaab: string; received: string; listening: string; from: string; noMsgs: string; tapStop: string }> = {
  en: { listen: 'Listen', reply: 'Hold to reply', hisaab: 'My hisaab', received: 'Message received.', listening: 'Listening…', from: 'Messages from home', noMsgs: 'No messages yet', tapStop: 'Tap to send' },
  hi: { listen: 'सुनें', reply: 'बोलकर जवाब दें', hisaab: 'मेरा हिसाब', received: 'संदेश मिल गया।', listening: 'सुन रहे हैं…', from: 'घर से संदेश', noMsgs: 'अभी कोई संदेश नहीं', tapStop: 'भेजने के लिए दबाएँ' },
  bn: { listen: 'শুনুন', reply: 'বলে উত্তর দিন', hisaab: 'আমার হিসাব', received: 'বার্তা পৌঁছে গেছে।', listening: 'শুনছি…', from: 'বাড়ি থেকে বার্তা', noMsgs: 'এখনও কোনো বার্তা নেই', tapStop: 'পাঠাতে চাপুন' },
  or: { listen: 'ଶୁଣନ୍ତୁ', reply: 'କହି ଉତ୍ତର ଦିଅନ୍ତୁ', hisaab: 'ମୋ ହିସାବ', received: 'ବାର୍ତ୍ତା ମିଳିଗଲା।', listening: 'ଶୁଣୁଛି…', from: 'ଘରୁ ବାର୍ତ୍ତା', noMsgs: 'ଏପର୍ଯ୍ୟନ୍ତ କୌଣସି ବାର୍ତ୍ତା ନାହିଁ', tapStop: 'ପଠାଇବାକୁ ଦବାନ୍ତୁ' },
  ta: { listen: 'கேளுங்க', reply: 'பேசி பதில் சொல்லுங்க', hisaab: 'என் கணக்கு', received: 'செய்தி கிடைச்சுது.', listening: 'கேட்டுக்கிட்டு இருக்கு…', from: 'வீட்டிலிருந்து செய்திகள்', noMsgs: 'இன்னும் செய்தி இல்லை', tapStop: 'அனுப்ப அழுத்துங்க' },
  te: { listen: 'వినండి', reply: 'మాట్లాడి జవాబు ఇవ్వండి', hisaab: 'నా లెక్క', received: 'సందేశం అందింది.', listening: 'వింటున్నాం…', from: 'ఇంటి నుండి సందేశాలు', noMsgs: 'ఇంకా సందేశాలు లేవు', tapStop: 'పంపడానికి నొక్కండి' },
}

/** Month-end voice bill. */
export function billSentence(h: Helper, lang: Lang, work: number, advance: number, total: number) {
  const kind = h.pay.kind
  const workTxt = {
    en: kind === 'monthly' ? `${work} days worked` : kind === 'perUnit' ? `${work} ${h.pay.unit}` : `${work} ${h.pay.unit}`,
    hi: kind === 'monthly' ? `${work} दिन काम` : kind === 'perUnit' ? `${work} पैकेट` : `${work} कपड़े`,
    bn: kind === 'monthly' ? `${work} দিন কাজ` : kind === 'perUnit' ? `${work} প্যাকেট` : `${work}টা কাপড়`,
    or: kind === 'monthly' ? `${work} ଦିନ କାମ` : kind === 'perUnit' ? `${work} ପ୍ୟାକେଟ` : `${work}ଟି ଲୁଗା`,
    ta: kind === 'monthly' ? `${work} நாள் வேலை` : kind === 'perUnit' ? `${work} பாக்கெட்` : `${work} துணி`,
    te: kind === 'monthly' ? `${work} రోజులు పని` : kind === 'perUnit' ? `${work} ప్యాకెట్లు` : `${work} బట్టలు`,
  }[lang]
  const adv = advance
    ? {
        en: `, minus ₹${advance} advance`,
        hi: `, ₹${advance} एडवांस कटा`,
        bn: `, ₹${advance} অ্যাডভান্স বাদ`,
        or: `, ₹${advance} ଆଡଭାନ୍ସ କଟା`,
        ta: `, ₹${advance} அட்வான்ஸ் கழிச்சு`,
        te: `, ₹${advance} అడ్వాన్స్ తీసివేసి`,
      }[lang]
    : ''
  const t = total.toLocaleString('en-IN')
  return {
    en: `${h.name}, this month ${workTxt}${adv}. Total ₹${t}.`,
    hi: `${h.name}, इस महीने ${workTxt}${adv}। कुल ₹${t}।`,
    bn: `${h.name}, এই মাসে ${workTxt}${adv}। মোট ₹${t}।`,
    or: `${h.name}, ଏହି ମାସରେ ${workTxt}${adv}। ମୋଟ ₹${t}।`,
    ta: `${h.name}, இந்த மாசம் ${workTxt}${adv}. மொத்தம் ₹${t}.`,
    te: `${h.name}, ఈ నెల ${workTxt}${adv}. మొత్తం ₹${t}.`,
  }[lang]
}

export function langStyle(lang: Lang): CSSProperties {
  return LANGS[lang].font ? { fontFamily: `${LANGS[lang].font}, var(--font-sans)` } : {}
}
