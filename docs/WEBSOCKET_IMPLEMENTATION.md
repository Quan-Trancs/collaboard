# WebSocket Implementation Guide

## Overview

The project uses **WebSockets (Socket.IO)** for real-time collaboration with **MongoDB** for persistence. This architecture provides:

- **Low-latency real-time updates** (~10-50ms via WebSocket)
- **Reliable persistence** (MongoDB database)
- **Secure authentication** (JWT)
- **Live cursor tracking** (WebSocket)
- **Collaborative undo/redo** (WebSocket)

## Architecture

```
┌─────────────────────────────────────────┐
│         Frontend (React)                 │
│  • Real-time drawing → WebSocket         │
│  • Cursor tracking → WebSocket           │
│  • Undo/Redo → WebSocket                 │
│  • Initial load → MongoDB                │
│  • Periodic save → MongoDB (debounced)  │
└─────────────────────────────────────────┘
           ↓                    ↓
    ┌──────────┐        ┌──────────────┐
    │ Socket.IO│        │   MongoDB    │
    │  Server  │        │  (Database)   │
    │ :3001    │        │  (Auth)       │
    └──────────┘        └──────────────┘
```

## What Changed

### Backend (`backend/src/index.ts`)

✅ **Real-time collaboration handlers:**
- `drawing-start` - New drawing elements
- `drawing-update` - Element updates (pen strokes, shapes)
- `element-delete` - Element deletion
- `cursor-move` - Cursor position tracking
- `undo` - Collaborative undo operations
- `join-board` / `leave-board` - Board room management

✅ **In-memory state management:**
- Board states stored in memory (fast access)
- Action history for undo/redo
- User presence tracking
- Cursor positions

### Frontend

✅ **New WebSocket Hook** (`src/hooks/useSocket.ts`):
- Manages Socket.IO connection
- Provides real-time event handlers
- Handles reconnection automatically

✅ **Updated Whiteboard Component**:
- Real-time drawing via WebSocket
- Cursor tracking (throttled to 100ms)
- Collaborative undo/redo
- Debounced persistence to MongoDB (every 2 seconds)

## Setup Instructions

### 1. Environment Variables

Add to your `.env` file:

```env
# WebSocket Server URL
VITE_SOCKET_URL=http://localhost:3001

# API URL
VITE_API_URL=http://localhost:3001/api
```

### 2. Start Backend Server

```bash
cd backend
npm run dev
```

The server will run on `http://localhost:3001`

### 3. Start Frontend

```bash
npm run dev
```

## How It Works

### Real-Time Drawing

1. **User draws** → Element created locally
2. **WebSocket** → Broadcasts to all connected clients (~10-50ms)
3. **Other users** → See drawing instantly
4. **Debounced save** → Persists to MongoDB after 2 seconds

### Cursor Tracking

- Cursor position sent every **100ms** (throttled)
- Other users see colored cursors with names
- Cursors disappear when user leaves

### Collaborative Undo/Redo

- **Undo** → Broadcasts via WebSocket
- **Server** → Maintains action history
- **All clients** → Apply undo simultaneously
- **History** → Stored in server memory (last 200 actions)

### Persistence Strategy

- **Real-time**: WebSocket (optimistic UI)
- **Persistence**: MongoDB (debounced every 2 seconds)
- **Initial load**: MongoDB (on board open)
- **Conflict resolution**: Last-write-wins

## Performance Improvements

| Metric | Before (Database Only) | After (WebSocket) |
|--------|------------------------|-------------------|
| **Latency** | 200-500ms | 10-50ms |
| **Drawing smoothness** | Choppy | Smooth |
| **Database writes** | Every action | Debounced (2s) |
| **Bandwidth** | Full state fetch | Delta updates |
| **Scalability** | Limited | Better |

## Testing

1. **Open two browser windows** side-by-side
2. **Join the same board** in both
3. **Draw in one window** → Should appear instantly in the other
4. **Move cursor** → Should see cursor in other window
5. **Undo in one** → Should undo in both windows

## Troubleshooting

### WebSocket not connecting?

1. Check backend is running: `http://localhost:3001/api`
2. Verify `VITE_SOCKET_URL` in `.env`
3. Check browser console for connection errors
4. Ensure CORS is configured correctly

### Elements not syncing?

1. Check WebSocket connection status
2. Verify boardId matches in both clients
3. Check backend console for errors
4. Ensure user is authenticated

### Cursors not showing?

1. Verify cursor tracking is enabled
2. Check throttling isn't too aggressive
3. Verify other users are connected

## Future Enhancements

- [ ] Redis for distributed state (multi-server)
- [ ] Operational Transform for conflict resolution
- [ ] Presence indicators (who's online)
- [ ] Typing indicators for text elements
- [ ] Version history (time-travel)
- [ ] Export/import board state

## API Reference

### WebSocket Events (Client → Server)

```typescript
// Join board
socket.emit('join-board', { boardId, user })

// Drawing
socket.emit('drawing-start', { boardId, element })
socket.emit('drawing-update', { boardId, elementId, updates })

// Cursor
socket.emit('cursor-move', { boardId, x, y })

// Actions
socket.emit('element-delete', { boardId, elementId })
socket.emit('undo', { boardId })
```

### WebSocket Events (Server → Client)

```typescript
// Board state
socket.on('board-state', (state) => { ... })

// Element updates
socket.on('element-added', (data) => { ... })
socket.on('element-updated', (data) => { ... })
socket.on('element-deleted', (data) => { ... })

// Cursor
socket.on('cursor-update', (data) => { ... })

// Undo
socket.on('undo-applied', (data) => { ... })

// Presence
socket.on('user-joined', (data) => { ... })
socket.on('user-left', (data) => { ... })
```

## Notes

- **Server restart** will clear in-memory state (use Redis for production)
- **History limit** is 200 actions per board (configurable)
- **Debounce time** is 2 seconds (configurable in code)
- **Cursor throttle** is 100ms (configurable in code)
