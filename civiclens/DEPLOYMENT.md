# 🚀 Nagrik360 — Deployment Guide

This guide takes you from a fresh clone to a live production app:
**Render** (backend + Postgres) + **Vercel** (frontend) + **Cloudinary** (photos).

---

## Overview — what runs where

```
┌──────────────────────┐      ┌──────────────────────────┐
│  Vercel (Frontend)   │─────▶│  Render (Backend API)    │
│  Static HTML/CSS/JS  │      │  Node.js + Express       │
│  Free                │      │  Free                    │
└──────────────────────┘      └───────────┬──────────────┘
                                          │
                         ┌────────────────┴────────────────┐
                         │                                  │
              ┌──────────▼──────────┐      ┌───────────────▼──────────────┐
              │  Render Postgres    │      │  Cloudinary                  │
              │  Free (1 GB)        │      │  Photo storage + CDN         │
              │  Auto-provisioned   │      │  Free (25 GB, no credit card)│
              └─────────────────────┘      └──────────────────────────────┘
```

---

## Step 1 — Collect your free accounts and keys

Before deploying, sign up for these (all free, no credit card):

| Service | Sign up link | What you get |
|---|---|---|
| Groq AI | https://console.groq.com/keys | AI key for report analysis |
| Cloudinary | https://cloudinary.com/users/register_free | Photo storage credentials |
| Render | https://render.com | Backend + Postgres hosting |
| Vercel | https://vercel.com | Frontend hosting |

---

## Step 2 — Get your Cloudinary credentials

This is the easiest storage setup you'll do — 2 minutes, no card, no config pages.

1. Go to **https://cloudinary.com/users/register_free**
2. Enter your name, email, password — click **Create Account**
3. Verify your email if prompted
4. You land on the **Cloudinary Dashboard**
5. Right on the home screen you'll see a box labelled **Product Environment Credentials** with three values:

```
Cloud Name    →  e.g.  dxyz1234abc
API Key       →  e.g.  123456789012345
API Secret    →  e.g.  aBcDeFgHiJkLmNoPqRsTuVwXyZ
```

Copy all three. These go into your `.env` as:
```
CLOUDINARY_CLOUD_NAME=dxyz1234abc
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=aBcDeFgHiJkLmNoPqRsTuVwXyZ
```

That's it — no bucket creation, no public access settings, no token pages. Cloudinary handles all of that automatically.

---

## Step 3 — Push your code to GitHub

Render and Vercel deploy from GitHub.

```bash
cd nagrik360
git init
git add .
git commit -m "feat: production-ready — postgres, cloudinary, render+vercel deploy"
git branch -M main

# Create a repo on github.com first, then:
git remote add origin https://github.com/your-username/nagrik360.git
git push -u origin main
```

---

## Step 4 — Deploy backend on Render

### Option A — One-click Blueprint (recommended)

Render reads `render.yaml` from your repo and provisions everything automatically.

1. Go to **https://dashboard.render.com**
2. Click **New** → **Blueprint**
3. Connect your GitHub account and select your nagrik360 repo
4. Render shows you what it will create:
   - `nagrik360-backend` (Node.js web service)
   - `nagrik360-db` (PostgreSQL database)
5. Click **Apply**
6. Render asks you to fill in env vars marked `sync: false`. Fill them in:

   | Variable | Value |
   |---|---|
   | `CLIENT_URL` | Leave blank for now — fill after Vercel deploy |
   | `GROQ_API_KEY` | Your Groq key from console.groq.com |
   | `CLOUDINARY_CLOUD_NAME` | From Step 2 |
   | `CLOUDINARY_API_KEY` | From Step 2 |
   | `CLOUDINARY_API_SECRET` | From Step 2 |
   | `GOV_REPORT_EMAIL` | Any email for testing (yours works fine) |
   | `SMTP_HOST` | `smtp.gmail.com` (or leave blank for simulated mode) |
   | `SMTP_USER` | Your Gmail address |
   | `SMTP_PASS` | Your Gmail App Password (see Step 7 below) |

7. Click **Deploy**. Render builds and starts the service (~2 minutes).
8. Note your backend URL — it looks like:
   ```
   https://nagrik360-backend.onrender.com
   ```
9. Verify it's running:
   ```bash
   curl https://nagrik360-backend.onrender.com/api/health
   # → {"status":"ok","service":"nagrik360-backend",...}
   ```

### Option B — Manual (if you prefer not using render.yaml)

1. Render dashboard → **New** → **PostgreSQL**
   - Name: `nagrik360-db`, Plan: Free → Create
   - Copy the **Internal Database URL**

2. Render dashboard → **New** → **Web Service**
   - Connect your GitHub repo
   - Root Directory: `civiclens/backend`
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: Free
   - Add all env vars from `.env.example`

---

## Step 5 — Deploy frontend on Vercel

Before deploying, update the API URL in your code:

Open `civiclens/frontend/js/config.js` and change:
```js
const CONFIG = {
  API_BASE: 'https://nagrik360-backend.onrender.com/api',
};
```
Commit and push this change to GitHub.

Then:

1. Go to **https://vercel.com** → **Add New Project**
2. Import your GitHub repo
3. Configure:
   - **Root Directory**: `civiclens/frontend`
   - **Framework Preset**: Other
   - **Build Command**: *(leave completely blank)*
   - **Output Directory**: `.`
4. Click **Deploy** — takes about 30 seconds
5. Note your frontend URL:
   ```
   https://nagrik360.vercel.app
   ```

---

## Step 6 — Connect frontend URL back to backend

Now that you have both URLs:

1. Render dashboard → `nagrik360-backend` → **Environment**
2. Add or update:
   ```
   CLIENT_URL = https://nagrik360.vercel.app
   ```
3. Click **Save Changes** — Render redeploys automatically (~1 minute)

This allows CORS — without it, your frontend will get a browser error when calling the API.

---

## Step 7 — Gmail App Password (for SMTP email)

Skip this if you just want to test — without SMTP, "Send to government" runs in simulated mode (logs the action, returns a reference ID, just doesn't actually send email).

To enable real email:

1. Your Gmail must have **2-Step Verification** enabled
   - Google Account → Security → 2-Step Verification → Turn On
2. Generate an App Password:
   - Go to https://myaccount.google.com/apppasswords
   - App: **Mail**, Device: **Other** → name it `nagrik360`
   - Google shows a 16-character password — copy it
3. In your Render env vars:
   ```
   SMTP_HOST = smtp.gmail.com
   SMTP_PORT = 587
   SMTP_USER = youremail@gmail.com
   SMTP_PASS = xxxx xxxx xxxx xxxx   (the 16 chars, spaces optional)
   SMTP_FROM = Nagrik360 <youremail@gmail.com>
   ```

---

## Step 8 — Verify everything end to end

```bash
# Backend health
curl https://nagrik360-backend.onrender.com/api/health

# Submit a test report (no photo)
curl -X POST https://nagrik360-backend.onrender.com/api/reports \
  -F "category=pothole" \
  -F "description=Large pothole near bus stop causing accidents" \
  -F "latitude=28.6139" \
  -F "longitude=77.2090"

# Check AQI
curl "https://nagrik360-backend.onrender.com/api/ai/aqi?lat=28.6139&lon=77.2090"

# Check feed
curl https://nagrik360-backend.onrender.com/api/reports
```

Then open your Vercel URL in a browser:
- [ ] Report form submits and AI analysis card appears
- [ ] Photo upload works — image appears in the feed with a `res.cloudinary.com` URL
- [ ] "Send to government" returns a reference ID
- [ ] Live feed shows submitted reports
- [ ] AQI tab loads real data for your location
- [ ] AI assistant chat responds

---

## Local development without Cloudinary

If you want to run locally and skip setting up Cloudinary, leave the three `CLOUDINARY_*` vars blank in `.env`. The server will start with a warning:

```
⚠️  Cloudinary is not fully configured. Photo uploads will fail.
   → CLOUDINARY_CLOUD_NAME is missing or still a placeholder
```

Everything except photo upload works fine — you can submit text-only reports, test AI analysis, leaderboard, AQI, and chat without Cloudinary.

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `ENOTFOUND host` on startup | `DATABASE_URL` still has placeholder `host` | Set a real Postgres connection string |
| `⚠️ Cloudinary is not fully configured` | Missing Cloudinary vars | Fill in all three `CLOUDINARY_*` vars from your dashboard |
| `Must supply api_key` from Cloudinary | `CLOUDINARY_API_KEY` not set | Check `.env` — make sure you saved and restarted |
| CORS error in browser | `CLIENT_URL` not set on Render | Set `CLIENT_URL` to your Vercel URL in Render env vars |
| Frontend shows `/api` 404 | `config.js` still points to localhost | Update `API_BASE` in `config.js` to your Render URL |
| `GROQ_API_KEY is not configured` | Missing Groq key | Add `GROQ_API_KEY` to `.env` |
| Photos upload but 404 in browser | Cloudinary account inactive | Check your Cloudinary dashboard — verify account if needed |
| "Send to government" does nothing visible | SMTP not configured | Normal — it's in simulated mode. Check terminal logs for the reference ID |
