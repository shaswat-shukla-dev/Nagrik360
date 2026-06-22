# 🛡️ Nagrik360 — AI-Powered Civic Reporting Platform

> **See it. Report it. Fix it.**
> Citizens report litter, potholes, bad AQI, open burning, sewage overflow, illegal tree-cutting and more — verified with live photos, instantly analysed by AI, and routed straight to the right government department.

![node](https://img.shields.io/badge/node-%3E%3D18-green) ![license](https://img.shields.io/badge/license-MIT-blue)

---

## What it does

1. **Report a civic issue** — pick a category, attach a live photo, allow GPS location, submit.
2. **AI analysis (Groq / Llama 3.3 70B)** — severity rating, health impact, solution plan, formal government complaint text, social media caption — all generated in one inference call.
3. **Forward to government** — one click sends the drafted complaint to the configured grievance email with a tracked reference ID.
4. **Community feed** — public feed of all reports, upvote to confirm, comment threads.
5. **Live AQI** — real-time air quality (PM2.5, PM10, NO₂, Ozone) via Open-Meteo (free, no key needed).
6. **AI assistant** — in-app chat for civic questions (waste laws, tree protection, complaint tips).
7. **Leaderboard** — points and badges for active reporters.

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Database | PostgreSQL (via `pg`) |
| Photo storage | **Cloudflare R2** (S3-compatible, zero egress fees) |
| AI | Groq API — `llama-3.3-70b-versatile` |
| Email | Nodemailer (SMTP) |
| Auth | JWT + bcrypt |
| Frontend | Vanilla JS / HTML / CSS — no build step |
| Backend deploy | Render.com (Web Service + Postgres) |
| Frontend deploy | Vercel (static) |

---

## Project structure

```
nagrik360/
├── civiclens/
│   ├── backend/
│   │   ├── server.js              ← Express app entrypoint
│   │   ├── db.js                  ← PostgreSQL pool + schema (auto-creates tables on first run)
│   │   ├── .env.example           ← Copy to .env and fill in your values
│   │   ├── package.json
│   │   ├── routes/
│   │   │   ├── reports.js         ← Report CRUD, photo upload → R2, AI analysis, gov routing
│   │   │   ├── ai.js              ← Chat assistant + AQI lookup
│   │   │   └── auth.js            ← Signup, login, leaderboard
│   │   └── utils/
│   │       ├── s3.js              ← Cloudflare R2 upload/delete
│   │       ├── groqClient.js      ← Groq AI calls (report analysis + chat)
│   │       ├── aqi.js             ← Open-Meteo AQI fetch
│   │       └── mailer.js          ← SMTP government email dispatch
│   ├── frontend/
│   │   ├── index.html
│   │   ├── css/
│   │   │   ├── style.css
│   │   │   └── animations.css
│   │   ├── js/
│   │   │   ├── config.js          ← API base URL (change for production)
│   │   │   ├── api.js             ← All fetch calls to the backend
│   │   │   ├── app.js             ← App logic, UI rendering
│   │   │   └── animations.js      ← Motion/interaction layer
│   │   └── vercel.json
│   ├── README.md                  ← You are here
│   ├── DEPLOYMENT.md              ← Step-by-step deploy guide
│   └── .gitignore
└── render.yaml                    ← Render Blueprint (one-click backend + DB deploy)
```

---

## Local development

### Prerequisites
- Node.js ≥ 18
- PostgreSQL running locally (or a free cloud Postgres from Render/Supabase/Neon)
- A free [Groq API key](https://console.groq.com/keys)
- A [Cloudflare account](https://dash.cloudflare.com) with R2 bucket set up (see DEPLOYMENT.md §3)

### 1. Install dependencies
```bash
cd civiclens/backend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Open `.env` and fill in at minimum:
- `DATABASE_URL` — your Postgres connection string
- `PGSSL=false` — for local Postgres without SSL
- `GROQ_API_KEY` — from console.groq.com
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`, `R2_PUBLIC_URL` — from Cloudflare R2

See DEPLOYMENT.md §3 for exact steps to get R2 credentials.

### 3. Start the backend
```bash
npm run dev
```
The server starts at `http://localhost:5000`. On first run it auto-creates all database tables — no migration script needed.

Check it's working:
```bash
curl http://localhost:5000/api/health
# → {"status":"ok","service":"nagrik360-backend",...}
```

### 4. Start the frontend
The frontend is pure static HTML — no build step.

```bash
cd ../frontend
npx serve .
# opens at http://localhost:3000
```
Or just open `index.html` directly in a browser (though `file://` blocks some browser APIs — a local server is better).

### 5. What to set in config.js for production
Before deploying the frontend, update `frontend/js/config.js`:
```js
const CONFIG = {
  API_BASE: 'https://your-backend.onrender.com/api',
};
```
(For local dev it auto-uses `http://localhost:5000/api` when on localhost — no change needed.)

---

## Environment variables

All variables are documented with explanations in `backend/.env.example`. Here's a quick reference:

| Variable | What it does |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `PGSSL` | `true` for cloud Postgres, `false` for local |
| `JWT_SECRET` | Secret for signing auth tokens — make it long and random |
| `GROQ_API_KEY` | Groq AI API key |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret key |
| `R2_BUCKET` | Your R2 bucket name (e.g. `nagrik360-uploads`) |
| `R2_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
| `R2_PUBLIC_URL` | `https://pub-xxxx.r2.dev` (public access URL for the bucket) |
| `SMTP_*` | Email credentials for sending reports to government (optional) |
| `GOV_REPORT_EMAIL` | Government grievance email address to send reports to |

---

## How photos work (R2 flow)

```
User picks photo
      ↓
multer.memoryStorage() holds it in RAM (never touches server disk)
      ↓
uploadToR2(file, 'reports') streams it to Cloudflare R2
      ↓
R2 stores it at: nagrik360-uploads/reports/<uuid>.jpg
      ↓
Public URL returned: https://pub-xxxx.r2.dev/reports/<uuid>.jpg
      ↓
Stored in reports.image_path in Postgres
      ↓
Frontend renders <img src="https://pub-xxxx.r2.dev/..."> directly from R2/CDN
```

The server never stores files locally — this means Render redeploys never lose any photos.

---

## License
MIT — built for civic good. Fork it, localise it, deploy it for your city.

## Disclaimer
Nagrik360 is an independent citizen tool, not affiliated with any government. Reports are routed to the email address configured by the deployer — actual resolution depends on the receiving authority.
