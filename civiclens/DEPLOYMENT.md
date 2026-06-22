# 🚀 Nagrik360 — Deployment Guide

This guide takes you from a fresh clone to a live production app:
**Render** (backend + Postgres) + **Vercel** (frontend) + **Cloudflare R2** (photos).

---

## Overview of what runs where

```
┌─────────────────────────┐     ┌──────────────────────────┐
│  Vercel (Frontend)      │────▶│  Render (Backend API)    │
│  Static HTML/CSS/JS     │     │  Node.js + Express       │
│  Free tier              │     │  Free tier               │
└─────────────────────────┘     └────────────┬─────────────┘
                                             │
                          ┌──────────────────┴──────────────────┐
                          │                                      │
               ┌──────────▼──────────┐             ┌────────────▼────────────┐
               │  Render Postgres    │             │  Cloudflare R2          │
               │  Free (1 GB)        │             │  Photo storage          │
               │  Auto-provisioned   │             │  Free (10GB / 1M req)   │
               └─────────────────────┘             │  Zero egress fees       │
                                                   └─────────────────────────┘
```

---

## Step 1 — Get your API keys

Before touching any deploy button, collect these:

- [ ] **Groq API key** → https://console.groq.com/keys (free, takes 30 seconds)
- [ ] **Cloudflare account** → https://dash.cloudflare.com/sign-up (free)
- [ ] **Render account** → https://render.com (free)
- [ ] **Vercel account** → https://vercel.com (free)

---

## Step 2 — Push your code to GitHub

Render and Vercel both deploy from GitHub.

```bash
cd nagrik360           # your project root
git init
git add .
git commit -m "initial commit"
git branch -M main

# create a repo on github.com first, then:
git remote add origin https://github.com/your-username/nagrik360.git
git push -u origin main
```

---

## Step 3 — Set up Cloudflare R2 (photo storage)

### 3a. Create a bucket

1. Log in to https://dash.cloudflare.com
2. In the left sidebar → **R2 Object Storage**
3. If prompted, click **Enable R2** (free, no charge)
4. Click **Create bucket**
5. Bucket name: `nagrik360-uploads`
6. Location: leave as Automatic
7. Click **Create bucket**

### 3b. Enable public access

You need photos to be publicly viewable (anyone can open the URL in a browser).

1. Open `nagrik360-uploads` bucket
2. Click the **Settings** tab
3. Scroll to **Public Access**
4. Click **Allow Access** → confirm
5. Copy the **Public R2.dev Bucket URL** — it looks like:
   ```
   https://pub-a1b2c3d4e5f6a1b2c3d4e5f6.r2.dev
   ```
   Save this — this is your `R2_PUBLIC_URL`.

### 3c. Create API credentials

1. Back on the R2 overview page, click **Manage R2 API Tokens** (top right)
2. Click **Create API Token**
3. Token name: `nagrik360-backend`
4. Permissions: **Object Read & Write**
5. Bucket access: select **Specific bucket** → `nagrik360-uploads`
6. Click **Create API Token**
7. You will see three values — copy all three now (the secret is shown once):
   - **Access Key ID** → this is your `R2_ACCESS_KEY_ID`
   - **Secret Access Key** → this is your `R2_SECRET_ACCESS_KEY`
   - **Endpoint URL** → this is your `R2_ENDPOINT`
     (format: `https://a1b2c3d4e5f6.r2.cloudflarestorage.com`)

---

## Step 4 — Deploy backend on Render

### Option A — One-click via Blueprint (recommended)

Render reads `render.yaml` from your repo and provisions everything automatically.

1. Go to https://dashboard.render.com
2. Click **New** → **Blueprint**
3. Connect your GitHub repo
4. Render detects `render.yaml` and shows you what it will create:
   - `nagrik360-backend` (Node.js web service)
   - `nagrik360-db` (PostgreSQL database)
5. Click **Apply**
6. Render will ask you to fill in the env vars marked `sync: false`. Fill them in now:

   | Variable | Value |
   |---|---|
   | `CLIENT_URL` | Leave blank for now — you'll fill this after deploying Vercel |
   | `GROQ_API_KEY` | Your Groq API key |
   | `R2_ACCESS_KEY_ID` | From Step 3c |
   | `R2_SECRET_ACCESS_KEY` | From Step 3c |
   | `R2_BUCKET` | `nagrik360-uploads` |
   | `R2_ENDPOINT` | From Step 3c |
   | `R2_PUBLIC_URL` | From Step 3b |
   | `GOV_REPORT_EMAIL` | Email to send reports to (yours for testing) |
   | `SMTP_HOST` | `smtp.gmail.com` (or leave blank to use simulated mode) |
   | `SMTP_USER` | Your Gmail address |
   | `SMTP_PASS` | Your 16-character Gmail App Password |

7. Click **Deploy**. Render builds and starts the service. First deploy takes ~2 minutes.
8. Once live, note your backend URL:
   ```
   https://nagrik360-backend.onrender.com
   ```
9. Verify it's working:
   ```bash
   curl https://nagrik360-backend.onrender.com/api/health
   # → {"status":"ok","service":"nagrik360-backend",...}
   ```

### Option B — Manual setup (if you prefer not using render.yaml)

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
   - Add all environment variables from `.env.example` (use the Internal Database URL as `DATABASE_URL`)

---

## Step 5 — Deploy frontend on Vercel

1. Go to https://vercel.com → **Add New Project**
2. Import your GitHub repo
3. Configure:
   - **Root Directory**: `civiclens/frontend`
   - **Framework Preset**: Other
   - **Build Command**: *(leave blank)*
   - **Output Directory**: `.`
4. Before clicking Deploy, update `civiclens/frontend/js/config.js` in your repo:
   ```js
   const CONFIG = {
     API_BASE: 'https://nagrik360-backend.onrender.com/api',
   };
   ```
   Push this change to GitHub first, then deploy.
5. Click **Deploy**. Vercel deploys in ~30 seconds.
6. Note your frontend URL:
   ```
   https://nagrik360.vercel.app
   ```

---

## Step 6 — Connect frontend URL back to backend (CORS)

Now that you have both URLs:

1. Go to Render dashboard → `nagrik360-backend` → **Environment**
2. Set `CLIENT_URL` to your Vercel URL:
   ```
   https://nagrik360.vercel.app
   ```
3. Click **Save Changes** — Render redeploys automatically.

---

## Step 7 — Verify everything end to end

```bash
# 1. Backend health
curl https://nagrik360-backend.onrender.com/api/health

# 2. Submit a test report (no photo)
curl -X POST https://nagrik360-backend.onrender.com/api/reports \
  -F "category=pothole" \
  -F "description=Large pothole near bus stop causing accidents" \
  -F "latitude=28.6139" \
  -F "longitude=77.2090"

# 3. Check AQI
curl "https://nagrik360-backend.onrender.com/api/ai/aqi?lat=28.6139&lon=77.2090"

# 4. Check reports feed
curl https://nagrik360-backend.onrender.com/api/reports
```

Then open your Vercel URL in a browser and confirm:
- [ ] Report form submits and AI severity card appears
- [ ] Photo upload works (image appears in the feed with an `r2.dev` URL)
- [ ] "Send to government" returns a reference ID
- [ ] Live feed shows submitted reports
- [ ] AQI tab loads real data
- [ ] AI assistant chat responds

---

## Gmail App Password (for SMTP)

If you want real email to actually send (instead of simulated mode):

1. Your Gmail must have **2-Factor Authentication** enabled
2. Go to: https://myaccount.google.com/apppasswords
3. Select App: **Mail**, Device: **Other** → name it `nagrik360`
4. Google generates a 16-character password — use that as `SMTP_PASS`
5. `SMTP_USER` = your full Gmail address

Without SMTP configured, "Send to government" still works — it just logs the action and returns a reference ID instead of sending real email.

---

## Local development (without cloud services)

If you want to develop locally without R2 and without a cloud Postgres:

1. Install Postgres locally and create a database:
   ```sql
   CREATE DATABASE nagrik360;
   ```
2. In `.env`:
   ```
   DATABASE_URL=postgres://postgres:yourpassword@localhost:5432/nagrik360
   PGSSL=false
   ```
3. For photos locally, you can either:
   - Set up R2 (takes 5 minutes, works fine on local)
   - Leave R2 vars blank — the server will start and warn you, but everything except photo upload will work fine for testing

---

## Updating the app

Push to GitHub — both Render and Vercel auto-deploy on every push to `main`. Zero downtime on Vercel. Render free tier restarts the service.

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `ENOTFOUND host` on startup | `DATABASE_URL` still has the placeholder `host` | Set a real Postgres connection string in `.env` |
| `InvalidAccessKeyId` on photo upload | R2 key is still placeholder | Fill in `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` |
| `R2_PUBLIC_URL is not set` warning | Missing R2 public URL | Set `R2_PUBLIC_URL` to your `https://pub-xxx.r2.dev` URL |
| `GROQ_API_KEY is not configured` | Missing Groq key | Add `GROQ_API_KEY` to `.env` |
| Photos upload but URL gives 403 | Bucket not set to public | R2 bucket → Settings → Public Access → Allow Access |
| CORS error in browser | `CLIENT_URL` not set on Render | Set `CLIENT_URL` to your Vercel URL in Render env vars |
| Frontend shows `/api` 404 | `config.js` still points to localhost | Update `API_BASE` in `config.js` to your Render URL |
