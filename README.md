# GharBolo — one voice line for your home

> Don't call everyone, *just speak once.*

Speak one sentence in English, Tanglish or Hinglish. GharBolo splits it per helper (cook, maid, milkman, paper boy, press-wala), translates it into each helper's own language (Bengali, Odia, Hindi, Tamil, Telugu), delivers it as a voice note they can play without reading, and writes the monthly hisaab from everything both sides said.

Built for the Voice-First India hackathon (Scalar × Wispr Flow).

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173 in **Chrome or Edge** (they have the Web Speech API).

| Route | What it is |
|---|---|
| `/` | Landing page |
| `/app` | Employer: hold the mic and speak |
| `/app/hisaab` | Monthly ledger: calendar, voice bill, UPI QR |
| `/app/helpers` | Add helpers, settings, optional AI key |
| `/h/:id` | A helper's phone (e.g. `/h/sunita`): big play buttons + one mic |
| `/stage` | **Demo stage**: the employer and 3 helper phones live, side by side |

All screens sync live across tabs and iframes (BroadcastChannel + localStorage), so the stage is a real multi-device demo on one laptop.

## 2-minute demo script

1. Open `/stage`.
2. On the employer phone, hold the mic and say:
   *"Friday to Sunday naanga ooru la irukka maatom, so paal vendam, paper vendam. Sunita akka ku two days paid leave. Raju, school uniform mattum iron pannunga."*
   (or tap the **Tanglish** example chip)
3. The confirm sheet shows 4 cards in 4 scripts and reads back a summary. Say **"seri"** (or tap Send).
4. Voice notes appear on Sunita's, Raju's and Ramesh's phones. Press play.
5. On Sunita's phone, open **Demo replies** and tap the Bengali one (or hold the mic and speak Bengali).
6. The employer sees *"Didi, the gas is almost finished, and I need a ₹500 advance"* with chips: **Add gas to shopping list**, **Approve ₹500 advance**.
7. Open **Hisaab**: leaves, pauses and the advance are already there. Tap **Send to Sunita** and she hears her bill in Bengali.
8. Show the error handling: the **Misheard** chip ("Ramessh…" → "Did you mean Ramesh?") and the **Money** chip (never guesses an amount).

## How it handles the messy real world

- **Mixed languages**: an offline parser understands everyday English/Hinglish/Tanglish (weekday ranges, *kal / naalaiku / parso*, *vendam / mat / nahi*, *dhai sau / ainooru*). With a free Gemini key it understands any sentence.
- **Noise**: recordings under 1 s or with an empty transcript get "Sorry, couldn't hear that, konjam closer to the phone", and a live volume meter shows you're being heard.
- **Misheard names**: fuzzy matching asks "Did you mean Ramesh?" before sending.
- **Money**: an amount is never guessed. If it's missing, you're asked.
- **Always confirm**: a spoken one-line summary, per-person cards with numbers and dates highlighted, voice "yes/seri/haan", and a 10-second undo.
- **Missing TTS voice** (e.g. Odia on many devices): it plays in Hindi and the text is shown large.
- **Untranslatable reply**: the original audio stays playable, marked "Couldn't translate, tap to listen".

## Free stack

- React + Vite + Tailwind + Framer Motion
- Browser Web Speech API for speech-to-text and text-to-speech (free, on-device / browser)
- Verified message templates in 6 languages for structured instructions
- Optional: Google Gemini free tier (key stays in the browser) for any-sentence understanding and translation
- MyMemory free translation API as a keyless fallback
- `qrcode` for UPI payment QR codes

## Deploy

Static site: `npm run build` produces `dist/`. Works on Vercel or Netlify (SPA rewrites included in `vercel.json` and `public/_redirects`).
