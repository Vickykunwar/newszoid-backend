# Newszoid Deployment Guide

This repo is split into two deployable apps:

```text
NEWSZOID/
  FRONTEND/   Static site deployed on Vercel
  BACKEND/    Node/Express API deployed on Vercel Serverless Functions
```

## Production URLs

```text
Frontend: https://newszoid.com
Backend:  https://api.newszoid.com
Health:   https://api.newszoid.com/api/health
Sitemap:  https://newszoid.com/sitemap.xml
Robots:   https://newszoid.com/robots.txt
```

## Frontend: Vercel

Create a Vercel project for the frontend from the GitHub repo and set the project root directory to `FRONTEND`.

Recommended Vercel settings:

```text
Framework Preset: Other
Build Command:    leave empty
Output Directory: leave empty
Install Command:  leave empty
Root Directory:   FRONTEND
```

The frontend reads its API host from `FRONTEND/config.js`:

```js
window.NEWSZOID_CONFIG = {
  API_BASE_URL: 'https://api.newszoid.com',
};
```

Update that value if your Cloudflare backend uses a different API domain.

Before deploying, check these frontend files:

```text
FRONTEND/config.js
FRONTEND/robots.txt
FRONTEND/sitemap.xml
FRONTEND/manifest.json
FRONTEND/service-worker.js
```

## Backend: Vercel

Create a second Vercel project for the backend from the same GitHub repo.

Recommended Vercel backend settings:

```text
Framework Preset: Other
Root Directory:   /
Build Command:    npm run vercel-build
Output Directory: leave empty
Install Command:  npm install
```

The Vercel serverless entry point is `api/index.js`, which imports the existing Express app from `BACKEND/server.js`. The root `vercel.json` provides the API rewrite; `FRONTEND/vercel.json` is intentionally separate because the frontend is a separate Vercel project and owns its cache headers.

Required environment variables:

```text
NODE_ENV=production
MONGO_URI=...
GEMINI_API_KEY=...
GROQ_API_KEY=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
JWT_SECRET=<random secret of at least 32 characters>
JWT_EXPIRES_IN=7d
FRONTEND_ORIGINS=https://newszoid.com,https://www.newszoid.com,https://newszoid.vercel.app
SERVE_FRONTEND=false
```

After deploying, the backend health check should work at:

```text
https://your-backend-project.vercel.app/api/health
```

## Data and WhatsApp safeguards

- Dashboard news is sourced from Google News RSS and is not AI-generated.
- A market rate is shown only after its cited page was fetched and matched to
  both the requested item and quoted price. When this check cannot be made,
  the dashboard shows no new rate rather than an unverified value.
- WhatsApp is **not** a daily briefing service by default. The Share button
  creates a manual briefing. Do not claim automatic delivery until you have a
  verified user opt-in flow, a WhatsApp provider, and the required provider
  credentials configured server-side.

If you later build an authenticated background worker, it can use the private
`/api/whatsapp-alert` route. Set these only in the backend Vercel project:

```text
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WA_NUMBER=whatsapp:+...
WHATSAPP_ALERT_SECRET=<long-random-secret>
```

Never put these values in `FRONTEND/config.js` or browser JavaScript.

## DNS

Use one canonical frontend hostname. The app currently uses `https://newszoid.com`.

```text
newszoid.com      -> Vercel frontend project
www.newszoid.com  -> redirect to newszoid.com
api.newszoid.com  -> Vercel backend project
```

Keep `FRONTEND_ORIGINS` in the backend aligned with every browser origin that is allowed to call the API.

## Verification Checklist

After deployment:

```text
1. Open https://newszoid.com and confirm the dashboard loads.
2. Open https://newszoid.com/robots.txt.
3. Open https://newszoid.com/sitemap.xml and confirm it contains the canonical URL.
4. Open https://api.newszoid.com/api/health and confirm ok=true.
5. POST a valid signed-in profile to https://api.newszoid.com/api/biz-agent/profile and confirm it is not a platform 404.
6. Open https://api.newszoid.com/api/news-proxy and confirm it is not a platform 404.
7. In the browser dev tools, confirm API calls go to https://api.newszoid.com.
8. If the UI looks stale after deploy, unregister the old service worker once and refresh.
```

## Local Checks

From the repo root:

```bash
npm test
npm run lint
```

The backend reads `.env` from the repo root. Use the root `.env.example` as the template, then keep the real `.env` private.

## GitHub Push Checklist

Before pushing to GitHub, make sure these files/folders are included:

```text
api/index.js
BACKEND/
FRONTEND/
package.json
package-lock.json
.env.example
.gitignore
DEPLOYMENT.md
```

Do not push:

```text
.env
node_modules/
BACKEND/node_modules/
coverage/
.vercel/
```

Recommended commands:

```bash
git status
git add api BACKEND FRONTEND package.json package-lock.json .env.example .gitignore DEPLOYMENT.md
git commit -m "Prepare Vercel deployment"
git push origin main
```
