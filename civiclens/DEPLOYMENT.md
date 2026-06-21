# 🚀 Nagrik360 — Exhaustive Deployment Guide

This guide covers every realistic way to deploy Nagrik360: local Docker, VPS, Render, Railway, Fly.io, Vercel (frontend) + Render (backend), and a managed-Postgres production upgrade path.

---

## 0. Pre-Deployment Checklist

- [ ] Groq API key obtained from [console.groq.com/keys](https://console.groq.com/keys)
- [ ] Decide DB strategy: SQLite (simple, single-instance) vs Postgres (production, multi-instance) — see §6
- [ ] SMTP credentials ready (Gmail App Password, SendGrid, or Mailgun) for live government-report emails — optional, app works in simulated mode without it
- [ ] Domain name (optional but recommended) for HTTPS + CORS clarity
- [ ] Generate a strong `JWT_SECRET`: `openssl rand -hex 32`

---

## 1. Local Docker Deployment (fastest full-stack test)

```bash
git clone <your-repo-url> nagrik360
cd nagrik360
cp backend/.env.example backend/.env
# edit backend/.env — set GROQ_API_KEY at minimum

docker compose up --build -d
```

- Backend → `http://localhost:5000`
- Frontend (nginx static) → `http://localhost:8080`

Before building, edit `frontend/js/config.js` so `API_BASE` points to your backend's public URL (for cross-origin setups) — or simply serve both through the same domain/reverse proxy (see §5).

Stop: `docker compose down`
Logs: `docker compose logs -f backend`
Rebuild after code changes: `docker compose up --build -d`

---

## 2. Backend on Render.com (recommended, free tier available)

1. Push your repo to GitHub.
2. On [render.com](https://render.com) → **New → Web Service** → connect your repo.
3. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** Free or Starter
4. Add Environment Variables (Render dashboard → Environment) — copy every key from `.env.example`:
   ```
   PORT=5000
   NODE_ENV=production
   CLIENT_URL=https://your-frontend-domain.com
   GROQ_API_KEY=gsk_xxx
   GROQ_MODEL=llama-3.3-70b-versatile
   DB_PATH=./data/nagrik360.db
   JWT_SECRET=<openssl rand -hex 32>
   JWT_EXPIRES_IN=7d
   MAX_FILE_SIZE_MB=8
   UPLOAD_DIR=./uploads
   GOV_REPORT_EMAIL=grievance-cell@example-municipal.gov.in
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_app_password
   SMTP_FROM=Nagrik360 Civic Alerts <alerts@nagrik360.app>
   AQI_API_BASE=https://air-quality-api.open-meteo.com/v1/air-quality
   RATE_LIMIT_WINDOW_MIN=15
   RATE_LIMIT_MAX_REQUESTS=100
   ```
5. ⚠️ **Persistent disk required for SQLite + uploads on Render**: Add a Render **Disk** (Settings → Disks), mount path `/opt/render/project/src/backend/data` and another for `uploads`, or switch to Postgres + S3-compatible storage for true persistence across deploys (see §6/§7). Render's filesystem is ephemeral on redeploy otherwise.
6. Deploy. Note your service URL, e.g. `https://nagrik360-api.onrender.com`.
7. Verify: `curl https://nagrik360-api.onrender.com/api/health`

---

## 3. Backend on Railway.app

1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**.
2. Set **Root Directory** to `backend` in service settings.
3. Railway auto-detects Node; ensure Start Command is `node server.js`.
4. Add the same environment variables as §2 under **Variables**.
5. Add a **Volume** mounted at `/app/data` and `/app/uploads` for persistence (Railway → service → Settings → Volumes).
6. Deploy → copy the generated public domain.

---

## 4. Backend on Fly.io (Docker-based)

```bash
cd backend
fly launch --no-deploy   # creates fly.toml, choose a region close to your users
fly volumes create nagrik360_data --size 1   # persistent volume for SQLite + uploads
```

Edit the generated `fly.toml` to mount the volume:
```toml
[mounts]
  source = "nagrik360_data"
  destination = "/app/data"
```

Set secrets:
```bash
fly secrets set GROQ_API_KEY=gsk_xxx JWT_SECRET=$(openssl rand -hex 32) \
  SMTP_USER=you@gmail.com SMTP_PASS=app_password GOV_REPORT_EMAIL=grievance@city.gov
```

Deploy:
```bash
fly deploy
```

---

## 5. Frontend Deployment

The frontend is a static SPA — deploy it anywhere that serves static files.

### Option A — Vercel (recommended)
1. [vercel.com](https://vercel.com) → **New Project** → import repo.
2. **Root Directory:** `frontend`
3. **Framework Preset:** Other / Static
4. **Build Command:** *(none)*  **Output Directory:** `.`
5. Deploy. Before deploying, edit `frontend/js/config.js`:
   ```js
   const CONFIG = {
     API_BASE: 'https://nagrik360-api.onrender.com/api', // your deployed backend
   };
   ```
6. Redeploy after the edit (Vercel auto-redeploys on git push).

### Option B — Netlify
1. [app.netlify.com](https://app.netlify.com) → **Add new site → Import from Git**.
2. **Base directory:** `frontend`  |  **Publish directory:** `frontend`
3. No build command needed.
4. Update `config.js` with your backend URL as above before pushing.

### Option C — GitHub Pages
```bash
cd frontend
git subtree push --prefix frontend origin gh-pages
```
Enable Pages in repo settings, source = `gh-pages` branch.

### Option D — Same-origin via Nginx reverse proxy (no CORS headaches)
Serve both frontend and backend under one domain so `config.js` can simply use `/api`:
```nginx
server {
  listen 80;
  server_name nagrik360.example.com;

  root /var/www/nagrik360/frontend;
  index index.html;

  location /api/ {
    proxy_pass http://localhost:5000/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  location /uploads/ {
    proxy_pass http://localhost:5000/uploads/;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```
Then in `config.js`, the existing logic already falls back to `'/api'` when not on `localhost` — no further change needed.

---

## 6. Production Database Upgrade (SQLite → PostgreSQL)

SQLite is great for demos/small deployments but doesn't survive ephemeral filesystems or scale across multiple instances. For production:

1. Provision Postgres (Render Postgres, Railway Postgres, Supabase, or Neon — all have generous free tiers).
2. Install `pg`: `npm install pg`
3. Replace `db.js` with a Postgres-backed equivalent using the same table shapes (the SQL in `db.js` is near-standard ANSI SQL — `AUTOINCREMENT`→`SERIAL`, `datetime('now')`→`NOW()` are the main changes).
4. Update queries that use SQLite-specific functions (`datetime('now')`) to Postgres equivalents (`NOW()`).
5. Set `DATABASE_URL` env var and update `db.js` to use it via `pg.Pool`.

This is the recommended path before any real-world multi-city rollout.

---

## 7. Production File Storage (local disk → S3-compatible)

Uploaded photos are core evidence — don't lose them on redeploy. For production:

1. Use any S3-compatible store: AWS S3, Cloudflare R2 (cheapest), Backblaze B2, or DigitalOcean Spaces.
2. Install `@aws-sdk/client-s3` (R2/B2/Spaces are S3-API compatible).
3. In `routes/reports.js`, swap `multer.diskStorage` for `multer-s3` or stream the buffer to your bucket after `multer.memoryStorage()`.
4. Store the resulting public URL in `image_path` instead of a local `/uploads/...` path.

---

## 8. SMTP Setup for Live Government Reporting

Without SMTP configured, "Send to government" runs in **simulated mode** (logs + a generated reference ID) so the full UX works in demos.

### Gmail (quick, dev/small-scale)
1. Enable 2FA on the Gmail account.
2. Generate an **App Password**: Google Account → Security → App Passwords.
3. Set:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=youraccount@gmail.com
   SMTP_PASS=<16-char app password>
   ```

### SendGrid / Mailgun (recommended for production volume)
Use their SMTP relay credentials in the same `SMTP_HOST/PORT/USER/PASS` fields — no code changes needed since Nagrik360 uses standard Nodemailer SMTP transport.

---

## 9. HTTPS / SSL

- **Render, Railway, Fly.io, Vercel, Netlify** all provision free HTTPS automatically — no action needed.
- **Self-hosted VPS:** use [Certbot](https://certbot.eff.org/) with Nginx:
  ```bash
  sudo certbot --nginx -d nagrik360.example.com
  ```

---

## 10. Post-Deployment Verification

```bash
# Backend health
curl https://your-backend-url/api/health

# Submit a test report (no image)
curl -X POST https://your-backend-url/api/reports \
  -F "category=pothole" \
  -F "description=Deep pothole near main market causing two-wheeler accidents" \
  -F "latitude=28.6139" -F "longitude=77.2090"

# AQI check
curl "https://your-backend-url/api/ai/aqi?lat=28.6139&lon=77.2090"
```
Then open the frontend URL in a browser, submit a real report with photo + location, and confirm:
- [ ] AI severity card renders
- [ ] "Send to government" returns a reference ID
- [ ] Social share buttons open correctly
- [ ] Live Feed tab shows the new report
- [ ] AQI tab fetches real data
- [ ] AI Assistant chat responds

---

## 11. Scaling & Monitoring Notes

- Rate limiting is enabled by default (`RATE_LIMIT_MAX_REQUESTS`) — tune for expected traffic.
- Add a process manager (`pm2`) if deploying on a raw VPS instead of a PaaS:
  ```bash
  npm install -g pm2
  pm2 start server.js --name nagrik360-api
  pm2 save && pm2 startup
  ```
- For multi-region/multi-city rollout, move to Postgres (§6) + S3 (§7) first — SQLite + local disk only suit single-instance deployments.
- Monitor Groq API usage/costs in the [Groq console](https://console.groq.com) — add response caching for repeated identical descriptions if volume grows large.

---

## 12. Rollback Strategy

- Render/Railway/Vercel/Netlify all keep deployment history — use their dashboard "Redeploy previous version" button.
- For Docker/VPS: tag images (`docker build -t nagrik360-backend:v1.2`) and keep the last 3 tags available for `docker run` rollback.

---

You now have everything needed to take Nagrik360 from `localhost` to a real, multi-user production deployment. 🛡️
