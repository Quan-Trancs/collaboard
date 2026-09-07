# WebSocket implementation

Real-time collaboration uses **Socket.IO**. Live board state is stored in **Redis**. MongoDB is the durable source of truth. Drawing and object edits stream over the socket — they are not saved with per-stroke REST calls.

Topology and data-store maps: [Architecture](./ARCHITECTURE.md).

```
Frontend  --draw/cursor/undo/viewport-->  Socket.IO  -->  Redis (live preview)
Server    --flush on commit/leave------>  MongoDB
Join      --hydrate empty Redis-------->  MongoDB
REST      --auth, board list, title---->  Express
```

## Events

- `join-board` / `leave-board` — room + presence; leave flushes Mongo
- `drawing-start` / `drawing-update` — live preview (Redis only, no Mongo flush)
- `drawing-commit` — persist Redis to Mongo after mouseup / insert
- `element-delete` — remove live item and flush
- `viewport-update` — last camera in Redis (flushed with the next commit or leave)
- `flush-board` / `clear-board` — persist now, or wipe live + Mongo
- `cursor-move` — presence at ~20 Hz; broadcast only (not written to Redis)
- `undo` — last 200 committed actions (in-progress previews skip history)
- `sync-elements` — seed live hashes

`board-state` payload:

```ts
{ objects, drawings, users, cursors, viewport, elements }
```

`elements` is a combined list for older clients.

## Redis keys

- `board:{id}:objects`
- `board:{id}:drawings`
- `board:{id}:history`
- `board:{id}:users`
- `board:{id}:viewport`
- `board:{id}:ready` — set after first hydrate so an empty canvas is not refilled from Mongo

## Persistence

Mongo is not written on every pointer move. Redis holds the in-flight board. The server flushes Redis to Mongo on **commit** (mouseup, insert, paste, delete), and immediately on leave, disconnect, Save, or Clear. Viewport stays Redis-only until that next flush. REST `/api/objects` and `/api/drawings` remain as a fallback when the socket is down.

## Client presence

Cursors are throttled to ~20 Hz and interpolated on the receiving client (`src/lib/livePresence.ts`). Drawing previews use the same interval with compact patches (only changed fields). Remote cursors lerp toward the last packet; rAF runs only while someone is moving.

## Setup

```env
VITE_SOCKET_URL=http://localhost:3001
VITE_API_URL=http://localhost:3001/api
REDIS_URL=redis://127.0.0.1:6379
```

From the repo root:

```bash
npm run dev
```

That starts Mongo, Redis, the API, and Vite. Sign in at http://localhost:5173 with `slide@example.com` / `devpass123` in development.
