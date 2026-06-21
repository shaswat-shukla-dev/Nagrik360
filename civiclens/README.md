# 🛡️ Nagrik360 — AI-Powered Civic Sense Reporting Platform

> **See it. Report it. Fix it.**
> Report litter, spitting, potholes, dust, bad AQI, open burning, illegal tree-cutting, and smoke-belching vehicles — verified with live photos, instantly analyzed by AI (Groq/Llama), and routed straight to your local government.

![status](https://img.shields.io/badge/status-active-success) ![node](https://img.shields.io/badge/node-%3E%3D18-green) ![license](https://img.shields.io/badge/license-MIT-blue)

---

## ✨ Why Nagrik360 exists

Civic apathy thrives on friction: people see a problem, don't know who to tell, assume nothing will happen, and walk on. Nagrik360 removes every excuse:

1. **One tap to report**, with a live, geo-tagged photo (so it can't be faked from a stock image).
2. **Groq-powered AI** instantly classifies severity, explains health/environmental impact, and drafts a ready-to-send government complaint — citizens don't need to know legal/bureaucratic language.
3. **Direct-to-government routing** via email/grievance-cell integration, with a tracked reference ID.
4. **Social sharing** to amplify pressure publicly (X/Twitter, WhatsApp, Facebook) with an AI-written caption.
5. **Community feed + upvotes** so repeat offenders/hotspots get visibility and priority.
6. **Live AQI lookup** for any location, with practical health guidance.
7. **Gamified leaderboard** rewarding active citizens with points & badges.
8. **In-app AI assistant** to answer civic questions ("How do I report illegal tree felling?").

---

## 🧩 Core Features

| Category | Feature |
|---|---|
| **Reporting** | 15 issue categories: littering/dumping, public spitting, potholes, road dust, bad AQI, open burning of waste, illegal tree-cutting, vehicle smoke emission, sewage overflow, water leakage, broken streetlight, noise pollution, stray-animal hazard, illegal construction, other |
| **Verification** | Dual live-photo capture (primary + verification angle), camera-only capture on mobile (`capture="environment"`), GPS geo-tagging |
| **AI Analysis (Groq)** | Severity scoring (low/medium/high/critical), plausibility/confidence score, one-line officer-ready summary, 3–5 point health & environmental impact list, multi-stakeholder solution plan (Citizen / Community / Local Authority / Government), suggested government department |
| **Government Routing** | Auto-drafted formal complaint letter, one-click "Send to government" via email (SMTP) with tracked reference ID, status pipeline (`submitted → forwarded_to_authorities → in_progress → resolved/rejected`) |
| **Social Amplification** | AI-generated awareness caption + hashtags, one-click share to X, WhatsApp, Facebook, copy-to-clipboard |
| **Community** | Live public feed with filtering by category, upvote/confirm system (prevents duplicate votes via fingerprinting), comment threads |
| **Air Quality** | Live AQI/PM2.5/PM10/NO₂/Ozone lookup (Open-Meteo, no key required), color-coded AQI bands, plain-language health guidance & reduction tips |
| **AI Assistant** | Conversational chat (Groq) for civic education — waste segregation, tree-cutting laws, AQI health effects, how to write strong complaints |
| **Gamification** | Points & badges, public leaderboard |
| **Accounts** | Email/password signup & login (JWT), guest mode supported for reporting |
| **Dashboard/Stats** | Live counters: total reports, forwarded to government, resolved |
| **Security** | Helmet hardening, rate limiting, file-type/size validated uploads, bcrypt password hashing, JWT auth |
| **UX** | Mobile-first responsive design, floating report button, dark "asphalt" civic theme, accessible focus states, toast notifications |

---

## 🏗️ Architecture

```
nagrik360/
├── backend/                  # Node.js + Express REST API
│   ├── server.js             # App entrypoint
│   ├── db.js                 # SQLite schema & connection
│   ├── routes/
│   │   ├── reports.js        # Report CRUD, AI analysis, gov routing, voting
│   │   ├── ai.js              # Chat assistant + AQI lookup
│   │   └── auth.js            # Signup/login/leaderboard
│   ├── utils/
│   │   ├── groqClient.js      # Groq LLM integration (analysis, chat)
│   │   ├── aqi.js              # Open-Meteo AQI fetch
│   │   └── mailer.js           # SMTP government-report dispatch
│   ├── uploads/                # User-submitted photos (gitignored)
│   ├── data/                   # SQLite database file (gitignored)
│   ├── Dockerfile
│   ├── package.json
│   └── .env.example
├── frontend/                  # Static SPA (vanilla JS, no build step)
│   ├── index.html
│   ├── css/style.css
│   └── js/{config.js, api.js, app.js}
├── docker-compose.yml          # Full-stack local/prod orchestration
├── DEPLOYMENT.md                # Exhaustive deployment guide
├── .gitignore
└── README.md
```

**Stack:** Node.js · Express · SQLite (zero-config, swap for Postgres in production if needed) · Groq API (Llama 3.3 70B) · Vanilla JS/HTML/CSS frontend (no build tooling required — deploy anywhere static) · Multer (uploads) · Nodemailer (SMTP) · JWT + bcrypt (auth) · Open-Meteo (free AQI data).

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js ≥ 18
- A free [Groq API key](https://console.groq.com/keys)
- (Optional) Gmail/SMTP credentials for live government email delivery — without it, the app runs in **simulated send mode** so you can fully test the flow

### 1. Clone & install
```bash
git clone <your-repo-url> nagrik360
cd nagrik360/backend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# then edit .env and set at minimum:
#   GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
#   JWT_SECRET=<any long random string>
```

### 3. Run the backend
```bash
npm run dev      # nodemon, auto-restarts on change
# or
npm start
```
Backend runs at `http://localhost:5000`. Health check: `GET /api/health`.

### 4. Run the frontend
The frontend is a static SPA — no build step needed. Easiest options:
```bash
cd ../frontend
npx serve .          # or
python3 -m http.server 5500
```
Open `http://localhost:5500`. It auto-detects `localhost` and points to `http://localhost:5000/api`.

### 5. Try it out
- Go to **Report** tab → pick a category → capture/upload a photo → allow location → submit.
- Watch the AI severity card populate in real time.
- Click **Send directly to government** (simulated unless SMTP is configured).
- Click **Post on X / WhatsApp** to test social sharing.
- Check the **Air Quality** tab for live AQI at your location.
- Chat with the **AI Assistant** tab.

---

## 🔑 Environment Variables Reference

See [`backend/.env.example`](backend/.env.example) for the full annotated list — covers server port, Groq model selection, JWT secret, SMTP credentials for government routing, upload limits, and rate limiting.

---

## 🧠 How the AI Blend Works (Groq)

Every report is sent to Groq's `llama-3.3-70b-versatile` model (configurable via `GROQ_MODEL`) with a structured-JSON system prompt that returns:

```json
{
  "severity": "high",
  "confidence": 0.86,
  "is_plausible": true,
  "summary": "Garbage dumped on footpath blocking pedestrian access near bus stop.",
  "health_impact": ["...", "..."],
  "solutions": [{"who": "Citizen", "action": "..."}, {"who": "Local Authority", "action": "..."}],
  "suggested_department": "Municipal Sanitation Department",
  "gov_complaint_text": "Dear Sir/Madam, ...",
  "social_caption": "Garbage dumped near Sector 12 bus stop for 3 days! ... #SwachhBharat"
}
```
This single call powers the severity badge, health-impact list, solution plan, government complaint draft, and social caption — one inference, five UI surfaces.

---

## 🗺️ Roadmap / Ideas for Contributors
- Image-based AI verification using Groq's vision-capable models (currently text/metadata-based)
- Push notifications when a nearby report changes status
- PostgreSQL + PostGIS for production-scale geo queries
- Admin/officer dashboard with map clustering
- Multi-language support (Hindi, regional languages)
- PWA offline queueing for poor-connectivity areas

---

## 📄 License
MIT — built for civic good. Fork it, deploy it for your city, make it better.

## ⚠️ Disclaimer
Nagrik360 is an independent citizen tool and is **not affiliated with any government body**. Reports are routed as citizen grievances to the email address configured by the deployer; actual resolution depends on the receiving authority.
