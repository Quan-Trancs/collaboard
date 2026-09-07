import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const possiblePaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
  path.join(process.cwd(), 'backend', '.env'),
];

let envLoaded = false;
for (const envPath of possiblePaths) {
  if (existsSync(envPath) && !envLoaded) {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      envLoaded = true;
      break;
    }
  }
}

if (!envLoaded) {
  dotenv.config();
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import rateLimit from 'express-rate-limit';
import { createAdapter } from '@socket.io/redis-adapter';
import { connectDatabase, isMongoReady } from './config/database.js';
import { connectRedis, createRedisClient, isRedisReady } from './config/redis.js';
import authRoutes from './routes/auth.js';
import boardRoutes from './routes/boards.js';
import elementRoutes from './routes/elements.js';
import objectRoutes from './routes/objects.js';
import drawingRoutes from './routes/drawings.js';
import { errorHandler } from './middleware/errorHandler.js';
import { migrateLegacyElements } from './lib/migrateElements.js';
import {
  getLiveBoardState,
  setUser,
  removeUser,
  upsertLiveItem,
  deleteLiveItem,
  getLiveItem,
  popHistory,
  restoreLiveItem,
  syncLiveItems,
  setLiveViewport,
  scheduleBoardFlush,
  flushBoardNow,
  clearBoardLiveItems,
} from './lib/boardState.js';
import { isInHardWorld } from './lib/canvasBounds.js';
import { getBoardAccess } from './lib/boardAccess.js';
import { seedDevelopmentUser } from './lib/devSeed.js';

const app = express();
const PORT = process.env.PORT || 3001;
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

app.use(helmet());
app.use(compression());
app.use(morgan('dev'));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

const isProduction = process.env.NODE_ENV === 'production';
const rateLimitEnabled =
  process.env.RATE_LIMIT_ENABLED === 'true' ||
  (isProduction && process.env.RATE_LIMIT_ENABLED !== 'false');

if (rateLimitEnabled) {
  app.use('/api/', rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || (isProduction ? '1000' : '5000'), 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many requests. Wait a minute and try again.',
      code: 'RATE_LIMITED',
    },
  }));
}

app.get('/health', (req, res) => {
  const mongo = isMongoReady();
  const redis = isRedisReady();
  res.status(mongo && redis ? 200 : 503).json({
    status: mongo && redis ? 'ok' : 'degraded',
    mongo,
    redis,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api', (req, res) => {
  res.json({ message: 'Collaboard API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/elements', elementRoutes);
app.use('/api/objects', objectRoutes);
app.use('/api/drawings', drawingRoutes);

io.on('connection', (socket: Socket) => {
  let currentBoardId: string | null = null;
  let currentUser: { userId: string; name: string; color: string } | null = null;
  let canEditBoard = false;

  socket.on('disconnect', async () => {
    if (currentBoardId && currentUser) {
      const leavingBoardId = currentBoardId;
      const leavingUserId = currentUser.userId;
      await removeUser(leavingBoardId, socket.id);
      socket.to(`board-${leavingBoardId}`).emit('user-left', {
        userId: leavingUserId,
        socketId: socket.id,
      });
      await flushBoardNow(leavingBoardId, leavingUserId);
    }
  });

  socket.on('join-board', async (data: { boardId: string; user: { id: string; name: string; email: string } }) => {
    const access = await getBoardAccess(data.boardId, data.user.id);
    if (access.error) {
      socket.emit('join-error', access.error.body);
      return;
    }

    currentBoardId = data.boardId;
    currentUser = {
      userId: data.user.id,
      name: data.user.name,
      color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
    };
    canEditBoard = Boolean(access.canEdit);

    socket.join(`board-${data.boardId}`);
    await setUser(data.boardId, socket.id, currentUser);
    const state = await getLiveBoardState(data.boardId);

    socket.emit('board-state', {
      objects: state.objects,
      drawings: state.drawings,
      users: state.users,
      cursors: state.cursors,
      viewport: state.viewport,
      elements: [...state.objects, ...state.drawings],
    });

    socket.to(`board-${data.boardId}`).emit('user-joined', {
      user: currentUser,
      socketId: socket.id,
    });
  });

  socket.on('leave-board', async () => {
    if (currentBoardId && currentUser) {
      const leavingBoardId = currentBoardId;
      const leavingUserId = currentUser.userId;
      await removeUser(leavingBoardId, socket.id);
      socket.to(`board-${leavingBoardId}`).emit('user-left', {
        userId: leavingUserId,
        socketId: socket.id,
      });
      socket.leave(`board-${leavingBoardId}`);
      currentBoardId = null;
      currentUser = null;
      await flushBoardNow(leavingBoardId, leavingUserId);
    }
  });

  socket.on('cursor-move', (data: { boardId: string; x: number; y: number }) => {
    if (!currentBoardId || !currentUser) return;
    if (!isInHardWorld(data.x, data.y)) return;

    socket.to(`board-${data.boardId}`).emit('cursor-update', {
      socketId: socket.id,
      userId: currentUser.userId,
      x: data.x,
      y: data.y,
      name: currentUser.name,
      color: currentUser.color,
    });
  });

  socket.on('drawing-start', async (data: { boardId: string; element: any }) => {
    if (!currentBoardId || !canEditBoard) return;
    const accepted = await upsertLiveItem(
      data.boardId,
      data.element,
      'add',
      currentUser?.userId || ''
    );
    if (!accepted) return;

    socket.to(`board-${data.boardId}`).emit('element-added', {
      element: data.element,
      userId: currentUser?.userId,
    });
  });

  socket.on('drawing-update', async (data: { boardId: string; elementId: string; updates: any }) => {
    if (!currentBoardId || !canEditBoard) return;
    const existing = await getLiveItem(data.boardId, data.elementId);
    if (!existing) return;

    const updatedElement = { ...existing, ...data.updates };
    const accepted = await upsertLiveItem(
      data.boardId,
      updatedElement,
      'update',
      currentUser?.userId || '',
      { history: false }
    );
    if (!accepted) return;

    socket.to(`board-${data.boardId}`).emit('element-updated', {
      elementId: data.elementId,
      updates: data.updates,
      userId: currentUser?.userId,
    });
  });

  socket.on('element-delete', async (data: { boardId: string; elementId: string }) => {
    if (!currentBoardId || !canEditBoard) return;
    const deleted = await deleteLiveItem(data.boardId, data.elementId, currentUser?.userId || '');
    if (!deleted) return;

    scheduleBoardFlush(data.boardId, currentUser?.userId);
    socket.to(`board-${data.boardId}`).emit('element-deleted', {
      elementId: data.elementId,
      userId: currentUser?.userId,
    });
  });

  socket.on('undo', async (data: { boardId: string }) => {
    if (!currentBoardId || !canEditBoard) return;
    const lastAction = await popHistory(data.boardId);
    if (!lastAction) return;

    if (lastAction.action === 'add') {
      await deleteLiveItem(data.boardId, lastAction.element.id, currentUser?.userId || '');
      socket.to(`board-${data.boardId}`).emit('undo-applied', {
        action: 'delete',
        elementId: lastAction.element.id,
        userId: currentUser?.userId,
      });
    } else if (lastAction.action === 'delete') {
      await restoreLiveItem(data.boardId, lastAction.element);
      socket.to(`board-${data.boardId}`).emit('undo-applied', {
        action: 'add',
        element: lastAction.element,
        userId: currentUser?.userId,
      });
    } else if (lastAction.action === 'update') {
      socket.to(`board-${data.boardId}`).emit('undo-applied', {
        action: 'update',
        elementId: lastAction.element.id,
        previousState: lastAction.element,
        userId: currentUser?.userId,
      });
    }
  });

  socket.on('sync-elements', async (data: { boardId: string; elements: any[] }) => {
    if (!canEditBoard) return;
    await syncLiveItems(data.boardId, data.elements);
    scheduleBoardFlush(data.boardId, currentUser?.userId);
  });

  socket.on('viewport-update', async (data: { boardId: string; viewport: { x: number; y: number; zoom: number } }) => {
    if (!currentBoardId || data.boardId !== currentBoardId) return;
    await setLiveViewport(data.boardId, data.viewport);
  });

  socket.on('drawing-commit', async (data: { boardId: string }) => {
    if (!currentBoardId || data.boardId !== currentBoardId) return;
    scheduleBoardFlush(data.boardId, currentUser?.userId);
  });

  socket.on('flush-board', async (data: { boardId: string }) => {
    if (!currentBoardId || data.boardId !== currentBoardId) return;
    await flushBoardNow(data.boardId, currentUser?.userId);
    socket.emit('board-flushed', { boardId: data.boardId });
  });

  socket.on('clear-board', async (data: { boardId: string }) => {
    if (!currentBoardId || data.boardId !== currentBoardId || !canEditBoard) return;
    await clearBoardLiveItems(data.boardId);
    await flushBoardNow(data.boardId, currentUser?.userId);
    socket.to(`board-${data.boardId}`).emit('board-cleared', {
      userId: currentUser?.userId,
    });
  });
});

app.use(errorHandler);
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', code: 'NOT_FOUND' });
});

async function start() {
  await connectDatabase();
  await migrateLegacyElements();
  await seedDevelopmentUser();
  const redis = await connectRedis();
  const pubClient = redis;
  const subClient = createRedisClient();
  io.adapter(createAdapter(pubClient, subClient));

  httpServer.listen(PORT, () => {
    const mode = isProduction ? 'production' : 'development';
    console.log(`Collaboard API listening on http://localhost:${PORT} (${mode})`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
