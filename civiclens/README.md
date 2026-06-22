# 🛡️ Nagrik360 — AI-Powered Civic Reporting Platform

> **See it. Report it. Fix it.**
> Citizens report litter, potholes, bad AQI, open burning, sewage overflow, illegal tree-cutting and more — verified with live photos, instantly analysed by AI, and routed straight to the right government department.

![node](https://img.shields.io/badge/node-%3E%3D18-green) ![license](https://img.shields.io/badge/license-MIT-blue)

---

## What it does

1. **Report a civic issue** — pick a category, attach a live photo, allow GPS, submit.
2. **AI analysis (Groq / Llama 3.3 70B)** — severity rating, health impact, solution plan, government complaint text, social caption — all in one inference call.
3. **Forward to government** — one click emails the complaint to the configured grievance address with a tracked reference ID.
4. **Community feed** — public feed of all reports, upvote to confirm, comment threads.
5. **Live AQI** — real-time air quality (PM2.5, PM10, NO₂, Ozone) via Open-Meteo (free, no key needed).
6. **AI assistant** — in-app chat for civic questions.
7. **Leaderboard** — points and badges for active reporters.

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Database | PostgreSQL |
| Photo storage | **Cloudinary** (free 25GB, no credit card, global CDN) |
| AI | Groq API — Llama 3.3 70B |
| Email | Nodemailer (SMTP / Gmail) |
| Auth | JWT + bcrypt |
| Frontend | Vanilla JS / HTML / CSS — no build step |
| Backend deploy | Render.com (free Web Service + Postgres) |
| Frontend deploy | Vercel (free static hosting) |

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
│   │   │   ├── reports.js         ← Report CRUD, photo upload → Cloudinary, AI, gov routing
│   │   │   ├── ai.js              ← Chat assistant + AQI lookup
│   │   │   └── auth.js            ← Signup, login, leaderboard
│   │   └── utils/
│   │       ├── s3.js              ← Cloudinary upload/delete (named s3.js for consistency)
│   │       ├── groqClient.js      ← Groq AI calls
│   │       ├── aqi.js             ← Open-Meteo AQI fetch
│   │       └── mailer.js          ← SMTP government email
│   ├── frontend/
│   │   ├── index.html
│   │   ├── css/
│   │   │   ├── style.css
│   │   │   └── animations.css
│   │   ├── js/
│   │   │   ├── config.js          ← API base URL (update for production)
│   │   │   ├── api.js             ← All fetch calls to the backend
│   │   │   ├── app.js             ← App logic and UI rendering
│   │   │   └── animations.js      ← Motion and interaction layer
│   │   └── vercel.json
│   ├── README.md
│   ├── DEPLOYMENT.md              ← Step-by-step deploy guide
│   └── .gitignore
└── render.yaml                    ← Render Blueprint (one-click backend + DB deploy)
```

---

## Local development

### Prerequisites
- Node.js ≥ 18
- PostgreSQL running locally (or a free cloud Postgres from Render / Supabase / Neon)
- A free [Groq API key](https://console.groq.com/keys)
- A free [Cloudinary account](https://cloudinary.com/users/register_free) — no credit card

### 1. Install dependencies
```bash
cd civiclens/backend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```

Open `.env` and fill in:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Your Postgres connection string |
| `PGSSL` | `false` for local Postgres |
| `GROQ_API_KEY` | https://console.groq.com/keys |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary dashboard home page |
| `CLOUDINARY_API_KEY` | Cloudinary dashboard home page |
| `CLOUDINARY_API_SECRET` | Cloudinary dashboard home page |

### 3. Start the backend
```bash
npm run dev
```

First run auto-creates all database tables — no migration script needed.

Verify:
```bash
curl http://localhost:5000/api/health
# → {"status":"ok","service":"nagrik360-backend",...}
```

### 4. Start the frontend
```bash
cd ../frontend
npx serve .
```
Opens at `http://localhost:3000`. The frontend auto-detects localhost and points to `http://localhost:5000/api`.

---

## How photo storage works (Cloudinary flow)

```
User picks a photo
        ↓
multer.memoryStorage() holds it in RAM
(never written to server disk)
        ↓
uploadToCloudinary(file, 'nagrik360/reports')
        ↓
Cloudinary stores + auto-optimises the image
        ↓
Returns: https://res.cloudinary.com/<cloud>/image/upload/.../<id>.jpg
        ↓
URL saved in reports.image_path in Postgres
        ↓
Frontend renders <img src="https://res.cloudinary.com/..."> via Cloudinary CDN
```

Photos are served from Cloudinary's global CDN — fast anywhere in the world. The server never stores files locally, so Render redeploys never lose any photos.

---

## Environment variables quick reference

See `backend/.env.example` for the full annotated list.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `PGSSL` | `true` for cloud Postgres, `false` for local |
| `JWT_SECRET` | Secret for signing auth tokens |
| `GROQ_API_KEY` | Groq AI key for report analysis + chat |
| `CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `GOV_REPORT_EMAIL` | Email address to forward civic reports to |
| `SMTP_*` | Gmail / SMTP credentials for sending government emails |

---

## License
MIT — built for civic good. Fork it, localise it, deploy it for your city.

## Disclaimer
Nagrik360 is an independent citizen tool, not affiliated with any government body. Reports are routed to the email address configured by the deployer — actual resolution depends on the receiving authority.
