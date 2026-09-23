# Production deploy

Vercel can host the **frontend only**. Live drawing needs a long-lived Node process, **MongoDB**, and **Redis**. Putting the API on Vercel serverless will not work.

Local development is still `npm run dev` from the repo root. See [data store setup](./MONGODB_SETUP.md) and [architecture](./ARCHITECTURE.md).

Use the `backend/` folder in **this** repo. The older CollaboardBackend project is behind.

## Free-tier stack

This is enough for a public demo (register, draw, second browser). It is not an always-on, high-traffic host.

| Piece | Service | Free allowance | Catch |
| --- | --- | --- | --- |
| Frontend | [Vercel Hobby](https://vercel.com/pricing) | Static React, HTTPS, env vars | Personal / non-commercial on Hobby |
| MongoDB | [Atlas M0](https://www.mongodb.com/pricing) | 512 MB, free forever | Shared CPU; one free cluster per project |
| Redis | [Redis Cloud](https://redis.io/cloud/) free DB, or [Upstash](https://upstash.com/pricing/redis) | Tens of MB (Cloud) or 256 MB (Upstash) | Upstash: **500k commands/month** — easy to burn while drawing |
| API | [Render](https://render.com) free web service | Node + WebSockets | Sleeps when idle; first hit can take ~1 minute; sockets drop |

**Pick Redis Cloud** if you want a real TCP Redis for `ioredis` and the Socket.IO adapter. Use Upstash only for a short demo.

Do **not** use AWS for this deploy (no EC2, Lightsail, ElastiCache, DocumentDB, or Lambda). Socket.IO needs a long-lived Node process; AWS free tier is credits for a few months, not a lasting $0 host.

Always-on without sleep means ~$5/month on **Render Starter** or **Railway Hobby**, not more architecture.

### Host choices (no AWS)

| Option | Stack | When to use |
| --- | --- | --- |
| **A. Free demo (do this first)** | Vercel + Render free + Atlas M0 + Redis Cloud | $0 public demo. Render sleeps when idle. |
| **B. Always-on cheap** | Vercel + Render Starter or Railway + Atlas + Redis Cloud | ~$5–7/month. Sockets stay up. |
| **C. Oracle always-free VM** | Vercel + one VM for the API (+ Redis in Docker) + Atlas | $0 and always-on, more setup. Optional later. |

## 1. MongoDB Atlas

1. Create a project at [cloud.mongodb.com](https://cloud.mongodb.com).
2. Build a **Free (M0)** cluster. Choose a region close to the API (same as Render if you can).
3. Create a database user. Save the password.
4. Network Access: allow the API. For a first deploy, `0.0.0.0/0` works; lock it to Render egress later if you have a static outbound IP.
5. Connect → Drivers → copy the `mongodb+srv://...` URI. Database name can stay `collaboard`.

Example:

```env
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/collaboard?retryWrites=true&w=majority
```

Do not commit this URI.

Atlas M0 pauses after about 60 days with no connections. Render free sleeps, so the API will not touch Atlas while nobody is using the app. `.github/workflows/mongo-keepalive.yml` runs `keepClusterAwake` on the 1st and 16th of each month (about every 15 days). It only opens a connection and sends `ping`.

Add the same Atlas URI as a GitHub Actions secret named `MONGODB_URI` (Settings → Secrets and variables → Actions). Network Access must allow the runner. `0.0.0.0/0` from the step above covers that. Run the workflow once with **Run workflow** to confirm it is green. GitHub turns scheduled workflows off after 60 days with no commits in the repo.

## 2. Redis

### Redis Cloud (recommended)

1. Create a free database at [redis.io/cloud](https://redis.io/cloud/).
2. Copy the public endpoint and password.

```env
REDIS_URL=redis://default:PASSWORD@HOST:PORT
```

### Upstash (short demo)

1. Create one Redis database. Use the **TCP** URL if offered (`rediss://...`), not only REST.
2. Watch the monthly command count. Preview strokes and the Socket.IO adapter each use Redis commands. Cursors are broadcast only and do not HSET.

## 3. API on Render

The API is Express + Socket.IO in `backend/`. It already reads `PORT` (Render sets this) and listens on all interfaces.

1. Push `main` to GitHub.
2. [Render](https://dashboard.render.com) → **New Web Service** → this repo.
3. Settings:

   | Field | Value |
   | --- | --- |
   | Root directory | `backend` |
   | Runtime | Node |
   | Build command | `npm install && npm run build` |
   | Start command | `npm start` |
   | Health check path | `/health` |

4. Environment:

   ```env
   NODE_ENV=production
   PORT=10000
   JWT_SECRET=<long random string>
   JWT_EXPIRES_IN=7d
   MONGODB_URI=<atlas uri>
   REDIS_URL=<redis uri>
   CORS_ORIGIN=https://YOUR-APP.vercel.app
   RATE_LIMIT_ENABLED=true
   ```

   Render overrides `PORT`; you can omit it. Generate `JWT_SECRET` with:

   ```bash
   openssl rand -base64 48
   ```

   Production **does not** seed `slide@example.com`. Register a real account.

5. Create a public `onrender.com` URL. Wait until `https://YOUR-API.onrender.com/health` returns:

   ```json
   { "status": "ok", "mongo": true, "redis": true }
   ```

   `503` / `degraded` means Mongo or Redis is unreachable (URI, IP allowlist, or TLS).

If the first request after idle is slow, that is Render sleep. Open `/health` once, then use the app.

## 4. Frontend on Vercel

The React app lives at the **repo root**, not in `backend/`. Vercel only serves the built static files. All API and socket traffic goes to Render.

Vite bakes `VITE_*` into the JS at **build** time. Changing env on Vercel does nothing until you **Redeploy**.

You need the Render URL first (step 3). Example: `https://collaboard-api.onrender.com`.

### Create the project

1. Open [vercel.com](https://vercel.com) and sign in with GitHub.
2. **Add New…** → **Project**.
3. Import the **collaboard** repo (the same one Render uses).
4. Leave **Root Directory** as `.` (repo root). Do **not** set it to `backend`.
5. Framework Preset: **Vite**. Vercel should fill in:

   | Field | Value |
   | --- | --- |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |
   | Install Command | `npm install` |

   If the preset is empty, type those in. Node 18+ is fine.
6. **Do not deploy yet.** Open **Environment Variables** on this screen (or **Environment Variables** after create, then redeploy).

### Environment variables

Add these for **Production** (and Preview if you want PR deploys to hit the same API):

| Name | Value | Notes |
| --- | --- | --- |
| `VITE_API_URL` | `https://YOUR-API.onrender.com/api` | Must end with `/api`. No trailing slash after `api`. |
| `VITE_SOCKET_URL` | `https://YOUR-API.onrender.com` | Same host as the API, **no** `/api`, **no** trailing slash. |

Wrong:

```env
VITE_API_URL=https://YOUR-API.onrender.com
VITE_API_URL=https://YOUR-API.onrender.com/api/
VITE_SOCKET_URL=https://YOUR-API.onrender.com/api
VITE_SOCKET_URL=https://YOUR-API.onrender.com/
```

Right:

```env
VITE_API_URL=https://YOUR-API.onrender.com/api
VITE_SOCKET_URL=https://YOUR-API.onrender.com
```

Do **not** set `VITE_TEMPO`. Do **not** put `MONGODB_URI`, `REDIS_URL`, or `JWT_SECRET` on Vercel. Those belong on Render only.

### Deploy

1. **Deploy**. Wait until the build is green. `tsc --noEmit && vite build` must pass.
2. Open the `.vercel.app` URL. You should see sign-in, **not** "Use demo account".
3. Copy the origin only: `https://YOUR-APP.vercel.app` (no path, no trailing slash).

### Point Render CORS at Vercel

1. Render → the web service → **Environment**.
2. Set `CORS_ORIGIN` to that exact Vercel origin.
3. Save. Render restarts the API.
4. If you later add a custom domain on Vercel, change `CORS_ORIGIN` to `https://your-domain.com` and restart again.

Until `CORS_ORIGIN` matches the browser origin, login and sockets fail even if the URLs look right.

### If something is wrong

| Symptom | Likely cause |
| --- | --- |
| Login fails / network error | `VITE_API_URL` missing `/api`, or you changed env and did not redeploy |
| Sign-in works, drawing / chat does not | `VITE_SOCKET_URL` has `/api` or a trailing slash |
| Browser CORS error | `CORS_ORIGIN` on Render is not the exact Vercel origin |
| First load is slow, then it works | Render free slept; open `https://YOUR-API.onrender.com/health` once |
| Build fails on Vercel | Root directory is `backend`, or Node is too old |

## 5. Smoke test

1. Open the Vercel URL. There is no **Use demo account** button.
2. Register and sign in.
3. Create a board. Draw, insert a shape, undo.
4. Open the same `?boardId=` in a private window as a second user (share the board, or use a second account).
5. Confirm the other cursor, live preview while dragging, and commit on mouseup.
6. Refresh after leave. The stroke should still be there (Mongo).

If login fails, check `VITE_API_URL` and that you redeployed. If sockets fail, check `VITE_SOCKET_URL`, `CORS_ORIGIN`, and that Render is awake.

## What this stack can handle

A few people on a board is the intended free-tier load. A usual canvas site tops out around **25–50 live editors per board** even when optimized. This deploy will not survive large public rooms or 24/7 idle-free hosting.

See [architecture](./ARCHITECTURE.md) for preview vs commit and Redis keys.

## If you outgrow free

| Pain | Next spend |
| --- | --- |
| Render sleep / dropped sockets | Render Starter or Railway Hobby (~$5–7/month) |
| Upstash command cap | Redis Cloud paid, or Redis on a VM |
| Atlas 512 MB | Atlas Flex / M10 |
| One API process maxed | Second Render instance; Redis adapter is already in the server |

You do not need Docker images, job queues, or Kubernetes for the first production deploy.
