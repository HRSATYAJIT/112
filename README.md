# Labour Code Pay Kit

Compliant salary structures and offer letters for Indian SMEs and CAs, under the new Labour Codes
(in force from 21 Nov 2025). States: Karnataka, Maharashtra, Telangana, Haryana, Tamil Nadu.

## What's here

| Path | What it does |
|---|---|
| `public/index.html` | The app: salary structure + offer letter screens |
| `public/engine.js` | Salary engine. All statutory rates live in `RULES` |
| `public/letter-template.js` | Standard letter template, shared by browser and API |
| `api/letter.js` | `POST /api/letter`: Claude drafts the letter prose. Salary figures never go to the model |
| `scripts/` | Local dev server, tests, artifact preview build |

## Run locally

```bash
npm run dev      # http://localhost:3000
npm test         # 91,020 engine cases + letter API tests
```

Without `ANTHROPIC_API_KEY` the letter API returns the standard template, so everything works offline.

## Deploy on Vercel

1. vercel.com → Add New → Project → import this GitHub repo. Framework preset: **Other**. No build command.
2. Settings → Environment Variables:
   - `ANTHROPIC_API_KEY` — from console.anthropic.com
   - `CLAUDE_MODEL` (optional) — defaults to `claude-sonnet-5`
3. Deploy. Every push to `main` redeploys.

## Updating statutory rates

Edit `RULES` in `public/engine.js`, update `asOf`, run `npm test`.
