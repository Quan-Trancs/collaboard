// CRITICAL: Load environment variables FIRST before any other imports
// This must happen before routes are imported, as they read process.env at module load time
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

// Get current directory (ES modules compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables - try multiple locations to find .env file
const possiblePaths = [
  path.resolve(process.cwd(), '.env'), // Current working directory (backend/)
  path.resolve(__dirname, '../.env'), // One level up from src/ (backend/.env)
  path.resolve(__dirname, '../../.env'), // Two levels up (root/.env)
  path.join(process.cwd(), 'backend', '.env'), // Explicit backend/.env
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

// Fallback to default location if none found
if (!envLoaded) {
  dotenv.config();
}

// NOW import other modules after .env is loaded
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import rateLimit from 'express-rate-limit';
import { connectDatabase } from './config/database.js';

// Connect to MongoDB
connectDatabase();

const app = express();
const PORT = process.env.PORT || 3001;

// Create HTTP server and Socket.IO instance
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// In-memory storage for real-time collaboration
interface BoardState {
  elements: Map<string, any>;
  history: Array<{
    id: string;
    action: 'add' | 'update' | 'delete';
    element: any;
    userId: string;
    timestamp: number;
  }>;
  cursors: Map<string, { userId: string; x: number; y: number; name: string; color: string }>;
  users: Map<string, { userId: string; name: string; color: string }>;
}

const boardStates = new Map<string, BoardState>();

// Helper to get or create board state
function getBoardState(boardId: string): BoardState {
  if (!boardStates.has(boardId)) {
    boardStates.set(boardId, {
      elements: new Map(),
      history: [],
      cursors: new Map(),
      users: new Map(),
    });
  }
  return boardStates.get(boardId)!;
}

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('dev'));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting - more lenient in development
const isDevelopment = process.env.NODE_ENV === 'development';
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || (isDevelopment ? '500' : '100'), 10),
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Import routes AFTER .env is loaded
import authRoutes from './routes/auth.js';
import boardRoutes from './routes/boards.js';
import elementRoutes from './routes/elements.js';

// API routes
app.get('/api', (req, res) => {
  res.json({ message: 'Collaboard API is running' });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/elements', elementRoutes);

// Socket.IO connection handling
io.on('connection', (socket: Socket) => {
  let currentBoardId: string | null = null;
  let currentUser: { userId: string; name: string; color: string } | null = null;

  socket.on('disconnect', () => {
    if (currentBoardId && currentUser) {
      const boardState = getBoardState(currentBoardId);
      boardState.cursors.delete(socket.id);
      boardState.users.delete(socket.id);
      
      // Notify others that user left
      socket.to(`board-${currentBoardId}`).emit('user-left', {
        userId: currentUser.userId,
        socketId: socket.id,
      });
    }
  });

  // Join board with user info
  socket.on('join-board', (data: { boardId: string; user: { id: string; name: string; email: string } }) => {
    currentBoardId = data.boardId;
    currentUser = {
      userId: data.user.id,
      name: data.user.name,
      color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
    };

    socket.join(`board-${data.boardId}`);
    const boardState = getBoardState(data.boardId);
    boardState.users.set(socket.id, currentUser);

    // Send current board state to new user
    socket.emit('board-state', {
      elements: Array.from(boardState.elements.values()),
      users: Array.from(boardState.users.values()),
      cursors: Array.from(boardState.cursors.values()),
    });

    // Notify others that user joined
    socket.to(`board-${data.boardId}`).emit('user-joined', {
      user: currentUser,
      socketId: socket.id,
    });
  });

  socket.on('leave-board', () => {
    if (currentBoardId && currentUser) {
      const boardState = getBoardState(currentBoardId);
      boardState.cursors.delete(socket.id);
      boardState.users.delete(socket.id);
      
      socket.to(`board-${currentBoardId}`).emit('user-left', {
        userId: currentUser.userId,
        socketId: socket.id,
      });
      
      socket.leave(`board-${currentBoardId}`);
      currentBoardId = null;
      currentUser = null;
    }
  });

  // Cursor tracking
  socket.on('cursor-move', (data: { boardId: string; x: number; y: number }) => {
    if (!currentBoardId || !currentUser) return;
    
    const boardState = getBoardState(data.boardId);
    boardState.cursors.set(socket.id, {
      userId: currentUser.userId,
      x: data.x,
      y: data.y,
      name: currentUser.name,
      color: currentUser.color,
    });

    // Broadcast cursor position to others (throttled by client)
    socket.to(`board-${data.boardId}`).emit('cursor-update', {
      socketId: socket.id,
      userId: currentUser.userId,
      x: data.x,
      y: data.y,
      name: currentUser.name,
      color: currentUser.color,
    });
  });

  // Drawing events
  socket.on('drawing-start', (data: { boardId: string; element: any }) => {
    if (!currentBoardId) return;
    
    const boardState = getBoardState(data.boardId);
    boardState.elements.set(data.element.id, data.element);
    
    // Add to history
    boardState.history.push({
      id: Date.now().toString(),
      action: 'add',
      element: data.element,
      userId: currentUser?.userId || '',
      timestamp: Date.now(),
    });

    // Keep last 200 actions
    if (boardState.history.length > 200) {
      boardState.history.shift();
    }

    // Broadcast to others
    socket.to(`board-${data.boardId}`).emit('element-added', {
      element: data.element,
      userId: currentUser?.userId,
    });
  });

  socket.on('drawing-update', (data: { boardId: string; elementId: string; updates: any }) => {
    if (!currentBoardId) return;
    
    const boardState = getBoardState(data.boardId);
    const existingElement = boardState.elements.get(data.elementId);
    
    if (existingElement) {
      const updatedElement = { ...existingElement, ...data.updates };
      boardState.elements.set(data.elementId, updatedElement);
      
      // Add to history
      boardState.history.push({
        id: Date.now().toString(),
        action: 'update',
        element: updatedElement,
        userId: currentUser?.userId || '',
        timestamp: Date.now(),
      });

      // Broadcast to others
      socket.to(`board-${data.boardId}`).emit('element-updated', {
        elementId: data.elementId,
        updates: data.updates,
        userId: currentUser?.userId,
      });
    }
  });

  socket.on('element-delete', (data: { boardId: string; elementId: string }) => {
    if (!currentBoardId) return;
    
    const boardState = getBoardState(data.boardId);
    const element = boardState.elements.get(data.elementId);
    
    if (element) {
      boardState.elements.delete(data.elementId);
      
      // Add to history
      boardState.history.push({
        id: Date.now().toString(),
        action: 'delete',
        element: element,
        userId: currentUser?.userId || '',
        timestamp: Date.now(),
      });

      // Broadcast to others
      socket.to(`board-${data.boardId}`).emit('element-deleted', {
        elementId: data.elementId,
        userId: currentUser?.userId,
      });
    }
  });

  // Undo/Redo
  socket.on('undo', (data: { boardId: string }) => {
    if (!currentBoardId) return;
    
    const boardState = getBoardState(data.boardId);
    if (boardState.history.length === 0) return;

    const lastAction = boardState.history.pop();
    if (!lastAction) return;

    // Apply inverse operation
    if (lastAction.action === 'add') {
      boardState.elements.delete(lastAction.element.id);
      socket.to(`board-${data.boardId}`).emit('undo-applied', {
        action: 'delete',
        elementId: lastAction.element.id,
        userId: currentUser?.userId,
      });
    } else if (lastAction.action === 'delete') {
      boardState.elements.set(lastAction.element.id, lastAction.element);
      socket.to(`board-${data.boardId}`).emit('undo-applied', {
        action: 'add',
        element: lastAction.element,
        userId: currentUser?.userId,
      });
    } else if (lastAction.action === 'update') {
      // For updates, we'd need to store previous state - simplified here
      socket.to(`board-${data.boardId}`).emit('undo-applied', {
        action: 'update',
        elementId: lastAction.element.id,
        previousState: lastAction.element,
        userId: currentUser?.userId,
      });
    }
  });

  // Batch element updates (for persistence sync)
  socket.on('sync-elements', (data: { boardId: string; elements: any[] }) => {
    // This is for syncing from database, not broadcasting
    const boardState = getBoardState(data.boardId);
    data.elements.forEach((element) => {
      boardState.elements.set(element.id, element);
    });
  });
});

// Import error handler
import { errorHandler } from './middleware/errorHandler.js';

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', code: 'NOT_FOUND' });
});

// Start server
httpServer.listen(PORT, () => {
});
