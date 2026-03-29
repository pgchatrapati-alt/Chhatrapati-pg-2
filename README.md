# 🏠 PG Tenant Manager

Ek PG management app — tenants, rent collection, aur Google Sheets sync.

## Local Development

```bash
npm install
npm run dev
```

## Vercel Deploy (3 steps)

### Option A — GitHub se (Recommended)
1. Yeh folder GitHub repo mein push karo
2. [vercel.com](https://vercel.com) → New Project → GitHub repo select karo
3. Deploy karo — bas itna hi!

### Option B — Vercel CLI se
```bash
npm install -g vercel
vercel
```

## Google Sheets Sync Setup

1. Apni Google Sheet kholo → **Extensions → Apps Script**
2. `GoogleAppsScript_PG_Sync.js` ka code `Code.gs` mein paste karo
3. **Deploy → New Deployment → Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
4. URL copy karo
5. App mein **⚙ Settings** → URL paste karo → Save

Bas! Ab jab bhi app mein save karoge, Google Sheet automatically update hogi. 🎉

## File Structure

```
pg-manager/
├── index.html
├── vite.config.js
├── package.json
├── vercel.json
├── .gitignore
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx          # Entry point
    ├── App.jsx           # Main app
    ├── index.css         # Global styles
    ├── data.js           # Tenant data + constants
    ├── sync.js           # Google Sheets API helper
    └── useStorage.js     # localStorage hook
```
