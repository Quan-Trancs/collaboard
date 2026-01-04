import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketOptions {
  boardId: string;
  user: { id: string; name: string; email: string };
  enabled?: boolean;
}

interface BoardState {
  elements: any[];
  users: Array<{ userId: string; name: string; color: string }>;
  cursors: Array<{ socketId: string; userId: string; x: number; y: number; name: string; color: string }>;
}

export const useSocket = ({ boardId, user, enabled = true }: UseSocketOptions) => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [boardState, setBoardState] = useState<BoardState | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize socket connection
  useEffect(() => {
    // Only connect if enabled, boardId is valid, and user exists
    if (!enabled || !boardId || !user || !user.id) {
      // Clean up any existing connection
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        if (socketRef.current.connected) {
          try {
            socketRef.current.emit('leave-board');
          } catch (e) {
            // Ignore errors during cleanup
          }
        }
        try {
          socketRef.current.disconnect();
        } catch (e) {
          // Ignore errors if socket is already closing/closed
        }
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Check if boardId is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidUUID = uuidRegex.test(boardId);
    
    // Also check for MongoDB ObjectId format (24 hex characters)
    const mongoIdRegex = /^[0-9a-f]{24}$/i;
    const isValidMongoId = mongoIdRegex.test(boardId);
    
    if (!isValidUUID && !isValidMongoId) {
      // Invalid board ID format, don't connect
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        if (socketRef.current.connected) {
          try {
            socketRef.current.emit('leave-board');
          } catch (e) {
            // Ignore errors during cleanup
          }
        }
        try {
          socketRef.current.disconnect();
        } catch (e) {
          // Ignore errors if socket is already closing/closed
        }
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Disconnect existing socket if boardId changed
    if (socketRef.current) {
      // Remove all event listeners first
      socketRef.current.removeAllListeners();
      
      if (socketRef.current.connected) {
        try {
          socketRef.current.emit('leave-board');
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
      
      try {
        socketRef.current.disconnect();
      } catch (e) {
        // Ignore errors if socket is already closing/closed
      }
      
      socketRef.current = null;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);
      
      // Join board
      socket.emit('join-board', { boardId, user });
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      // Only set error if it's not a manual disconnect
      if (reason === 'io server disconnect' || reason === 'io client disconnect') {
        setError(null);
      } else {
        setError('Connection lost');
      }
    });

    socket.on('connect_error', (err) => {
      setError('Failed to connect to server');
      setIsConnected(false);
    });

    // Receive board state when joining
    socket.on('board-state', (state: BoardState) => {
      setBoardState(state);
    });

    // User joined/left events
    socket.on('user-joined', (data: { user: any; socketId: string }) => {
    });

    socket.on('user-left', (data: { userId: string; socketId: string }) => {
    });

    return () => {
      if (socketRef.current) {
        const socket = socketRef.current;
        
        // Remove all event listeners to prevent errors during cleanup
        socket.removeAllListeners();
        
        // Check socket state before attempting operations
        const isConnected = socket.connected;
        
        // Only emit leave-board if connected
        if (isConnected) {
          try {
            socket.emit('leave-board');
          } catch (e) {
            // Ignore errors during cleanup
          }
        }
        
        // Disconnect gracefully
        // Note: In React StrictMode, the socket may still be connecting when cleanup runs
        // This is expected behavior and the error can be safely ignored
        try {
          // Check socket state more carefully
          const io = (socket as any).io;
          const isConnecting = io && (io.connecting || io.reconnecting);
          
          if (isConnecting) {
            // Socket is still connecting, close the connection manager directly
            // This prevents the "WebSocket is closed before connection established" error
            if (io && typeof io.close === 'function') {
              io.close();
            }
          } else if (isConnected) {
            // Socket is connected, safe to disconnect normally
            socket.disconnect();
          } else {
            // Socket is already disconnected, nothing to do
          }
        } catch (e: any) {
          // Ignore all errors during cleanup
          // In React StrictMode, cleanup may run before connection is established
          // This is expected and harmless
        }
        
        socketRef.current = null;
      }
      setIsConnected(false);
    };
  }, [boardId, user?.id, user?.name, user?.email, enabled]);

  // Send cursor position
  const sendCursorMove = useCallback((x: number, y: number) => {
    if (!socketRef.current || !isConnected) return;
    socketRef.current.emit('cursor-move', { 
      boardId, 
      x, 
      y,
      name: user.name,
      color: `#${Math.floor(Math.random() * 16777215).toString(16)}`
    });
  }, [boardId, isConnected, user.name]);

  // Send drawing start
  const sendDrawingStart = useCallback((element: any) => {
    if (!socketRef.current || !isConnected) return;
    socketRef.current.emit('drawing-start', { boardId, element });
  }, [boardId, isConnected]);

  // Send drawing update
  const sendDrawingUpdate = useCallback((elementId: string, updates: any) => {
    if (!socketRef.current || !isConnected) return;
    socketRef.current.emit('drawing-update', { boardId, elementId, updates });
  }, [boardId, isConnected]);

  // Send element delete
  const sendElementDelete = useCallback((elementId: string) => {
    if (!socketRef.current || !isConnected) return;
    socketRef.current.emit('element-delete', { boardId, elementId });
  }, [boardId, isConnected]);

  // Send undo
  const sendUndo = useCallback(() => {
    if (!socketRef.current || !isConnected) return;
    socketRef.current.emit('undo', { boardId });
  }, [boardId, isConnected]);

  // Listen to real-time events - these are stable functions
  const onElementAdded = useCallback((callback: (data: any) => void) => {
    if (!socketRef.current || !isConnected) return () => {};
    socketRef.current.on('element-added', callback);
    return () => {
      socketRef.current?.off('element-added', callback);
    };
  }, [isConnected]);

  const onElementUpdated = useCallback((callback: (data: any) => void) => {
    if (!socketRef.current || !isConnected) return () => {};
    socketRef.current.on('element-updated', callback);
    return () => {
      socketRef.current?.off('element-updated', callback);
    };
  }, [isConnected]);

  const onElementDeleted = useCallback((callback: (data: any) => void) => {
    if (!socketRef.current || !isConnected) return () => {};
    socketRef.current.on('element-deleted', callback);
    return () => {
      socketRef.current?.off('element-deleted', callback);
    };
  }, [isConnected]);

  const onUndoApplied = useCallback((callback: (data: any) => void) => {
    if (!socketRef.current || !isConnected) return () => {};
    socketRef.current.on('undo-applied', callback);
    return () => {
      socketRef.current?.off('undo-applied', callback);
    };
  }, [isConnected]);

  const onCursorUpdate = useCallback((callback: (data: any) => void) => {
    if (!socketRef.current || !isConnected) return () => {};
    socketRef.current.on('cursor-update', callback);
    return () => {
      socketRef.current?.off('cursor-update', callback);
    };
  }, [isConnected]);

  return {
    socket: socketRef.current,
    isConnected,
    boardState,
    error,
    sendCursorMove,
    sendDrawingStart,
    sendDrawingUpdate,
    sendElementDelete,
    sendUndo,
    onElementAdded,
    onElementUpdated,
    onElementDeleted,
    onUndoApplied,
    onCursorUpdate,
  };
};

