# Data store setup (MongoDB + Redis)

Collaboard stores durable data in **MongoDB** and live collaboration state in **Redis**.

How the stores sit in the app: [Architecture topology](./ARCHITECTURE.md).

## What lives where

- **MongoDB** — users, boards, slide objects, ink strokes, collaborators (written on commit, leave, disconnect, Save, or Clear)
- **Redis** — live objects/drawings, presence, undo history, viewport. Cursors are socket broadcast only.

A board is one open slide (no deck). Non-drawing items are `SlideObject` documents. Pen strokes are `InkStroke` documents.

## Local development (recommended)

Install Docker Desktop, then from the repo root:

```bash
npm run db:up
```

This starts:

- MongoDB on `127.0.0.1:27017`
- Redis on `127.0.0.1:6379` (AOF enabled)

Stop with `npm run db:down`.

Copy `backend/env.example` to `backend/.env`, then from the repo root:

```bash
npm run dev
```

That starts Mongo, Redis, the API, and Vite. Open http://localhost:5173 and sign in with `slide@example.com` / `devpass123` (seeded in development).

To run stores only:

```bash
npm run db:up
```

## MongoDB Atlas (optional)

You can point `MONGODB_URI` at Atlas. Redis still needs to run locally or in your host. Do not commit real Atlas passwords or JWT secrets.

## Collections

- **users** — accounts
- **boards** — one slide per board (`background`, `viewport`)
- **slideobjects** — text, shape, image, table, chart, icon
- **inkstrokes** — freehand pen paths
- **boardcollaborators** — sharing and permissions
- **boardelements** — legacy mixed collection; migrated on startup / board load

## Canvas limits

The canvas has no visible page border. Coordinates must stay in **±32000**. The client also keeps work inside a content leash (existing content + 2000px, or a 4000×4000 start area).
