import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Pen,
  Square,
  Circle,
  Type,
  Eraser,
  Undo,
  Redo,
  Save,
  Share2,
  ArrowLeft,
  LogOut,
  Minus,
  Plus,
  Move,
  Trash2,
} from "lucide-react";
import ShareModal from "./ShareModal";
import InsertPanel from "./InsertPanel";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ImageElement, ShapeElement, TableElement, ChartElement, IconElement } from "./InsertableElements";
import { elementApi, boardApi } from "@/lib/api";
import { ErrorHandler, handleAsyncError } from "@/lib/errorHandler";
import {
  createElementApiSchema,
  updateElementSchema,
  insertImageSchema,
  insertShapeSchema,
  insertTableSchema,
  insertChartSchema,
  insertIconSchema,
  insertTemplateSchema,
  mapElementTypeToApi,
} from "@/lib/validation";
import { validateAndToast } from "@/lib/validationUtils";
import { WhiteboardSkeleton, RetryButton, LoadingOverlay } from "@/components/ui/loading";
import { useSocket } from "@/hooks/useSocket";

// Constants - moved outside component to prevent recreation on every render
const COLORS = [
  "#000000",
  "#EF4444",
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#6B7280",
] as const;

const STROKE_WIDTHS = [1, 2, 4, 8] as const;

// Utility function - extracted to prevent duplication
const isValidBoardId = (id: string | undefined): boolean => {
  if (!id) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const mongoIdRegex = /^[0-9a-f]{24}$/i;
  return uuidRegex.test(id) || mongoIdRegex.test(id);
};

// Type definitions for database responses
interface DatabaseElement {
  id: string;
  type: string;
  position?: { x: number; y: number } | null;
  size?: { width: number; height: number } | null;
  data?: {
    color?: string;
    strokeWidth?: number;
    points?: Array<{ x: number; y: number }>;
    text?: string;
    src?: string;
    alt?: string;
    opacity?: number;
    borderRadius?: number;
    shapeType?: string;
    fillColor?: string;
    data?: unknown;
    symbol?: string;
    rows?: number;
    cols?: number;
    chartType?: string;
    colors?: string[];
  } | null;
}

interface DatabaseCollaborator {
  id?: string;
  user?: {
    id: string;
    name: string;
  };
  name?: string;
}

interface DatabaseBoard {
  id: string;
  title?: string;
  collaborators?: DatabaseCollaborator[];
}

interface WhiteboardProps {
  boardId?: string;
  user?: { id: string; email: string; name: string };
  onBackToDashboard?: () => void;
  onLogout?: () => void;
}

type Tool = "pen" | "rectangle" | "circle" | "text" | "eraser" | "select";

interface DrawingElement {
  id: string;
  type: Tool | "image" | "shape" | "table" | "chart" | "icon" | "template";
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: { x: number; y: number }[];
  text?: string;
  color: string;
  strokeWidth: number;
  // Additional properties for insertable elements
  src?: string; // for images
  alt?: string; // for images
  opacity?: number; // for images
  borderRadius?: number; // for images
  shapeType?: string; // for shapes
  fillColor?: string; // for shapes
  data?: any; // for tables and charts
  symbol?: string; // for icons
  rows?: number; // for tables
  cols?: number; // for tables
  chartType?: string; // for charts
  colors?: string[]; // for charts
}

interface Collaborator {
  id: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
}

const Whiteboard = ({
  boardId = "board-123",
  user = { id: "1", email: "user@example.com", name: "John Doe" },
  onBackToDashboard,
  onLogout,
}: WhiteboardProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const redrawCanvasRef = useRef<(() => void) | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<Tool>("pen");
  const [currentColor, setCurrentColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [elements, setElements] = useState<DrawingElement[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<DrawingElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isTextMode, setIsTextMode] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 });
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [eraserPosition, setEraserPosition] = useState<{ x: number; y: number } | null>(null);
  const { toast } = useToast();
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showDeleteBoardDialog, setShowDeleteBoardDialog] = useState(false);
  const [deleteBoardError, setDeleteBoardError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [clearError, setClearError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [remoteCursors, setRemoteCursors] = useState<Map<string, { x: number; y: number; name: string; color: string }>>(new Map());
  const [actualBoardId, setActualBoardId] = useState<string>(boardId);
  const [boardTitle, setBoardTitle] = useState<string>("Untitled Board");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const fetchingRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const creatingBoardRef = useRef<boolean>(false);
  const pendingBoardIdRef = useRef<string | null>(null);

  // WebSocket connection - use actualBoardId once it's determined and valid
  const socket = useSocket({
    boardId: actualBoardId,
    user,
    enabled: isValidBoardId(actualBoardId) && !!user && !!user.id,
  });

  // Persistence to database
  const pendingSaveRef = useRef<Set<string>>(new Set());

  // Helper to validate width/height (reusable)
  const isValidSize = useCallback((width: number | undefined, height: number | undefined, allowZero: boolean = false): boolean => {
    if (width === undefined || height === undefined) return true; // Optional
    if (typeof width !== 'number' || typeof height !== 'number' || isNaN(width) || isNaN(height)) return false;
    return allowZero ? true : (width > 0 && height > 0);
  }, []);

  // Helper to validate if an element is valid before saving
  const isValidElement = useCallback((element: DrawingElement): boolean => {
    // Check position
    if (typeof element.x !== 'number' || typeof element.y !== 'number' || isNaN(element.x) || isNaN(element.y)) {
      return false;
    }
    
    // Validate based on type
    switch (element.type) {
      case "pen":
        return !!(element.points && Array.isArray(element.points) && element.points.length >= 2);
      
      case "rectangle":
      case "circle":
        return isValidSize(element.width, element.height, false) && element.width !== 0 && element.height !== 0;
      
      case "text":
        return !!(element.text && typeof element.text === 'string' && element.text.trim().length > 0);
      
      case "image":
        if (!element.src || typeof element.src !== 'string') return false;
        return !element.width || !element.height || isValidSize(element.width, element.height);
      
      case "shape":
        if (!element.shapeType || typeof element.shapeType !== 'string') return false;
        return !element.width || !element.height || isValidSize(element.width, element.height);
      
      case "table":
        if (typeof element.rows !== 'number' || typeof element.cols !== 'number' || element.rows <= 0 || element.cols <= 0) {
          return false;
        }
        return !element.width || !element.height || isValidSize(element.width, element.height);
      
      case "icon":
        return !!(element.symbol && typeof element.symbol === 'string');
      
      default:
        // chart, template - basic validation passed
        return true;
    }
  }, [isValidSize]);

  const debouncedSaveToDatabase = useCallback(async () => {
    if (pendingSaveRef.current.size === 0) return;
    
    const elementIds = Array.from(pendingSaveRef.current);
    pendingSaveRef.current.clear();

    try {
      const elementsToSave = elements.filter(el => elementIds.includes(el.id));
      
      // Validate elements before saving
      const validElementsToSave = elementsToSave.filter(el => {
        const isValid = isValidElement(el);
        if (!isValid) {
          // Skip invalid elements silently
        }
        return isValid;
      });
      
      if (validElementsToSave.length === 0) {
        return;
      }
      
      // Batch save to database
      for (const element of validElementsToSave) {
        try {
          const elementPayload = {
            board_id: actualBoardId,
            type: mapElementTypeToApi(element.type),
            data: {
              color: element.color,
              strokeWidth: element.strokeWidth,
              points: element.points,
              text: element.text,
              src: element.src,
              alt: element.alt,
              opacity: element.opacity,
              borderRadius: element.borderRadius,
              shapeType: element.shapeType,
              fillColor: element.fillColor,
              data: element.data,
              symbol: element.symbol,
              rows: element.rows,
              cols: element.cols,
              chartType: element.chartType,
              colors: element.colors,
            },
            position: { x: element.x, y: element.y },
            size: element.width && element.height ? { width: element.width, height: element.height } : undefined,
          };
          
          await elementApi.createElement(elementPayload);
        } catch (error) {
        }
      }
    } catch (error) {
      ErrorHandler.logError(ErrorHandler.createError(error, "Debounced save to database"), "debouncedSaveToDatabase");
    }
  }, [elements, actualBoardId, isValidElement]);

  // Use constants defined outside component
  const colors = COLORS;
  const strokeWidths = STROKE_WIDTHS;

  // Clear eraser position when tool changes
  useEffect(() => {
    if (currentTool !== "eraser") {
      setEraserPosition(null);
    }
  }, [currentTool]);

  // Generate cursor style based on current color
  const cursorStyle = useMemo(() => {
    // Only show custom dot cursor for drawing tools (pen, rectangle, circle, text, eraser)
    if (currentTool === "select") {
      return { cursor: "default" };
    }

    // Create a simple dot cursor SVG with crosshairs (fixed size, not based on stroke width)
    const size = 16; // Fixed cursor size
    const center = size / 2;
    const radius = 1; // Fixed dot radius (half of previous size)
    const offset = 4; // Crosshairs offset from center
    const crossLength = 8; // Fixed length of crosshair lines
    
    // Build SVG with dot at center and crosshairs with 2px gap from center
    // Horizontal line: left segment, gap, right segment
    // Vertical line: top segment, gap, bottom segment
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${center}" cy="${center}" r="${radius}" fill="${currentColor}"/>
      <line x1="${center - offset - crossLength}" y1="${center}" x2="${center - offset}" y2="${center}" stroke="${currentColor}" stroke-width="1" stroke-linecap="round"/>
      <line x1="${center + offset}" y1="${center}" x2="${center + offset + crossLength}" y2="${center}" stroke="${currentColor}" stroke-width="1" stroke-linecap="round"/>
      <line x1="${center}" y1="${center - offset - crossLength}" x2="${center}" y2="${center - offset}" stroke="${currentColor}" stroke-width="1" stroke-linecap="round"/>
      <line x1="${center}" y1="${center + offset}" x2="${center}" y2="${center + offset + crossLength}" stroke="${currentColor}" stroke-width="1" stroke-linecap="round"/>
    </svg>`;
    
    // Encode the entire SVG for the data URI
    const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    
    return {
      cursor: `url("${dataUri}") ${center} ${center}, auto`,
    };
  }, [currentTool, currentColor]);

  // Initialize canvas
  useEffect(() => {
    // Don't initialize if still loading (canvas won't be rendered yet)
    if (loading) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const updateCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      // Call redrawCanvas via ref to avoid dependency issues
      if (redrawCanvasRef.current) {
        redrawCanvasRef.current();
      }
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);

    return () => window.removeEventListener("resize", updateCanvasSize);
  }, [loading]);

  // Redraw canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw only drawing elements (pen, rectangle, circle, text)
    const drawingElements = elements.filter(element => 
      ["pen", "rectangle", "circle", "text"].includes(element.type)
    );

    drawingElements.forEach((element) => {
      ctx.strokeStyle = element.color;
      ctx.lineWidth = element.strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      switch (element.type) {
        case "pen":
          if (element.points && element.points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(element.points[0].x, element.points[0].y);
            element.points.forEach((point) => {
              ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
          }
          break;

        case "rectangle":
          if (element.width && element.height) {
            ctx.strokeRect(element.x, element.y, element.width, element.height);
          }
          break;

        case "circle":
          if (element.width && element.height) {
            const radius =
              Math.min(Math.abs(element.width), Math.abs(element.height)) / 2;
            const centerX = element.x + element.width / 2;
            const centerY = element.y + element.height / 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.stroke();
          }
          break;

        case "text":
          if (element.text) {
            ctx.font = `${element.strokeWidth * 8}px Arial`;
            ctx.fillStyle = element.color;
            ctx.fillText(element.text, element.x, element.y);
          }
          break;
      }
    });
  }, [elements]);

  // Keep redrawCanvas ref updated
  useEffect(() => {
    redrawCanvasRef.current = redrawCanvas;
  }, [redrawCanvas]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Save to history - use ref to avoid stale closure issues
  const historyRef = useRef<DrawingElement[][]>([]);
  const historyIndexRef = useRef<number>(-1);
  
  // Keep refs in sync with state
  useEffect(() => {
    historyRef.current = history;
    historyIndexRef.current = historyIndex;
  }, [history, historyIndex]);

  const saveToHistory = useCallback(() => {
    // Create a deep copy of current elements
    const elementsCopy = elements.map(el => ({ ...el, points: el.points ? [...el.points] : undefined }));
    
    // Use refs to get current values (avoid stale closures)
    const currentHistory = historyRef.current;
    const currentIndex = historyIndexRef.current;
    
    const newHistory = currentHistory.slice(0, currentIndex + 1);
    newHistory.push(elementsCopy);
    
    // Update both states
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [elements]);

  // Helper to map database element to DrawingElement
  function mapDatabaseElementToDrawingElement(el: DatabaseElement): DrawingElement {
    // Map database type back to frontend type
    let elementType: DrawingElement["type"] = el.type as DrawingElement["type"];
    
    // If type is "drawing", we need to infer the specific tool type (pen, rectangle, circle)
    if (el.type === "drawing") {
      // Check if it has points (pen stroke)
      if (el.data?.points && Array.isArray(el.data.points) && el.data.points.length > 0) {
        elementType = "pen";
      } 
      // Check if it has width/height but no points (shape: rectangle or circle)
      else if (el.size?.width && el.size?.height) {
        // We can't distinguish rectangle vs circle from saved data alone
        // Default to rectangle, or check if it's a perfect circle/square
        const width = Math.abs(el.size.width);
        const height = Math.abs(el.size.height);
        // If it's roughly circular/square, it's likely a circle
        // Otherwise default to rectangle
        elementType = Math.abs(width - height) < 2 ? "circle" : "rectangle";
      } else {
        // Default to pen if nothing else matches
        elementType = "pen";
      }
    }
    
    return {
      id: el.id,
      type: elementType,
      x: el.position?.x ?? 0,
      y: el.position?.y ?? 0,
      width: el.size?.width,
      height: el.size?.height,
      color: el.data?.color || "#000000",
      strokeWidth: el.data?.strokeWidth || 2,
      points: el.data?.points,
      text: el.data?.text,
      src: el.data?.src,
      alt: el.data?.alt,
      opacity: el.data?.opacity,
      borderRadius: el.data?.borderRadius,
      shapeType: el.data?.shapeType,
      fillColor: el.data?.fillColor,
      data: el.data?.data,
      symbol: el.data?.symbol,
      rows: el.data?.rows,
      cols: el.data?.cols,
      chartType: el.data?.chartType,
      colors: el.data?.colors,
    };
  }
  // Helper to map database collaborator to Collaborator
  function mapDatabaseCollaborator(c: DatabaseCollaborator): Collaborator {
    return {
      id: c.user?.id || c.id || "",
      name: c.user?.name || c.name || "Unknown",
      color: "#3B82F6",
      cursor: null,
    };
  }

  // Fetch initial elements from database and initialize WebSocket
  useEffect(() => {
    // Prevent concurrent fetches
    if (fetchingRef.current) return;
    
    // Prevent duplicate board creation in React StrictMode
    // If we're already creating a board for this invalid boardId, wait
    const isBoardIdValid = isValidBoardId(boardId);
    
    if (!isBoardIdValid && creatingBoardRef.current && pendingBoardIdRef.current === boardId) {
      // Already creating a board for this invalid boardId, skip
      return;
    }
    
    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    fetchingRef.current = true;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        // Try to fetch board first to check if it exists
        let board;
        try {
          if (!isValidBoardId) {
            // If boardId is not valid, mark that we're creating a board
            creatingBoardRef.current = true;
            pendingBoardIdRef.current = boardId;
            // Create a new board
            board = await boardApi.createBoard({
              title: "Untitled Board",
              description: "New whiteboard",
            });
            creatingBoardRef.current = false;
            pendingBoardIdRef.current = null;
          } else {
            board = await boardApi.getBoard(boardId);
          }
        } catch (boardError: unknown) {
          // If request was aborted, don't process
          if (abortController.signal.aborted) {
            creatingBoardRef.current = false;
            pendingBoardIdRef.current = null;
            return;
          }
          
          // If board doesn't exist (404), create it
          const errorMessage = (boardError instanceof Error ? boardError.message : String(boardError)) || String(boardError);
          if (errorMessage.includes('404') || errorMessage.includes('not found') || errorMessage.includes('PGRST116')) {
            // Only create if we're not already creating
            if (!creatingBoardRef.current) {
              creatingBoardRef.current = true;
              pendingBoardIdRef.current = boardId;
              board = await boardApi.createBoard({
                title: "Untitled Board",
                description: "New whiteboard",
              });
              creatingBoardRef.current = false;
              pendingBoardIdRef.current = null;
            } else {
              // Wait a bit and retry fetching
              await new Promise(resolve => setTimeout(resolve, 100));
              board = await boardApi.getBoard(pendingBoardIdRef.current || boardId);
            }
          } else {
            creatingBoardRef.current = false;
            pendingBoardIdRef.current = null;
            throw boardError;
          }
        }
        
        // If request was aborted, don't process
        if (abortController.signal.aborted) return;
        
        // Use the actual board ID (from fetched or created board)
        const currentBoardId = board.id;
        
        // Only update actualBoardId if it's different to prevent infinite loops
        if (currentBoardId !== actualBoardId) {
          setActualBoardId(currentBoardId);
        }
        
        // Update board title from fetched board data
        if (board.title) {
          setBoardTitle(board.title);
        } else {
          setBoardTitle("Untitled Board");
        }
        
        // Fetch initial elements from database using actual board ID
        let dbElements: DatabaseElement[] = [];
        try {
          const elements = await elementApi.getElements(currentBoardId);
          // Map API response to DatabaseElement format
          dbElements = elements.map((el) => ({
            id: el.id,
            type: el.type,
            position: el.position ?? undefined,
            size: el.size ?? undefined,
            data: el.data ?? undefined,
          }));
        } catch (elementsError: unknown) {
          // If request was aborted, don't process
          if (abortController.signal.aborted) return;
          
          // If elements query fails, it might be a new board - just use empty array
          const errorMessage = (elementsError instanceof Error ? elementsError.message : String(elementsError)) || String(elementsError);
          if (errorMessage.includes('404') || errorMessage.includes('not found') || errorMessage.includes('PGRST116')) {
            dbElements = [];
          } else {
            throw elementsError;
          }
        }
        
        // If request was aborted, don't process
        if (abortController.signal.aborted) return;
        
        const mappedElements: DrawingElement[] = dbElements.map(mapDatabaseElementToDrawingElement);
        
        setElements(mappedElements);
        // Initialize history with loaded elements
        const initialHistory = [[...mappedElements]];
        setHistory(initialHistory);
        setHistoryIndex(0);
        // Update refs immediately
        historyRef.current = initialHistory;
        historyIndexRef.current = 0;
        setHasUnsavedChanges(false); // Reset unsaved changes when loading from database
        
        // Fetch collaborators
        const collaboratorsArray = (board && Array.isArray((board as DatabaseBoard).collaborators)) 
          ? (board as DatabaseBoard).collaborators 
          : [];
        const mappedCollaborators: Collaborator[] = (collaboratorsArray || []).map((c: DatabaseCollaborator) => mapDatabaseCollaborator(c));
        setCollaborators(mappedCollaborators);
        
        setError(null);
      } catch (error: unknown) {
        // Don't show error if request was aborted
        if (abortController.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
          creatingBoardRef.current = false;
          pendingBoardIdRef.current = null;
          return;
        }
        
        creatingBoardRef.current = false;
        pendingBoardIdRef.current = null;
        const appError = ErrorHandler.createError(error, "Loading board data");
        ErrorHandler.logError(appError, "Loading board data");
        toast(ErrorHandler.getToastConfig(appError));
        setError(appError.message);
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
        fetchingRef.current = false;
      }
    };
    
    fetchData();
    
    // Cleanup function
    return () => {
      abortController.abort();
      fetchingRef.current = false;
      // Don't reset creatingBoardRef here - let it complete if in progress
    };
  }, [boardId, toast]); // Changed from actualBoardId to boardId to prevent infinite loops

  // Handle WebSocket real-time events
  useEffect(() => {
    if (!socket.isConnected) return;

    // Handle board state from server (only on initial connection)
    if (socket.boardState) {
      const serverElements = socket.boardState.elements.map((el: DatabaseElement) => mapDatabaseElementToDrawingElement(el));
      setElements(serverElements);
    }

    // Listen for element additions
    const unsubscribeAdded = socket.onElementAdded((data: { element: DatabaseElement; userId: string }) => {
      if (data.userId !== user.id) {
        const newElement = mapDatabaseElementToDrawingElement(data.element);
        setElements((prev) => {
          // Avoid duplicates
          if (prev.find(el => el.id === newElement.id)) return prev;
          return [...prev, newElement];
        });
      }
    });

    // Listen for element updates
    const unsubscribeUpdated = socket.onElementUpdated((data: { elementId: string; updates: Partial<DatabaseElement['data']>; userId: string }) => {
      if (data.userId !== user.id) {
        setElements((prev) =>
          prev.map((el) =>
            el.id === data.elementId ? { ...el, ...data.updates } : el
          )
        );
      }
    });

    // Listen for element deletions
    const unsubscribeDeleted = socket.onElementDeleted((data: { elementId: string; userId: string }) => {
      if (data.userId !== user.id) {
        setElements((prev) => prev.filter((el) => el.id !== data.elementId));
      }
    });

    // Listen for undo/redo
    const unsubscribeUndo = socket.onUndoApplied((data: { action: string; elementId?: string; element?: DatabaseElement; previousState?: DrawingElement; userId: string }) => {
      if (data.userId !== user.id) {
        if (data.action === 'delete') {
          setElements((prev) => prev.filter((el) => el.id !== data.elementId));
        } else if (data.action === 'add' && data.element) {
          const newElement = mapDatabaseElementToDrawingElement(data.element);
          setElements((prev) => {
            if (prev.find(el => el.id === newElement.id)) return prev;
            return [...prev, newElement];
          });
        } else if (data.action === 'update' && data.previousState) {
          const restoredElement = mapDatabaseElementToDrawingElement(data.previousState);
          setElements((prev) =>
            prev.map((el) => (el.id === data.elementId ? restoredElement : el))
          );
        }
      }
    });

    // Listen for cursor updates
    const unsubscribeCursor = socket.onCursorUpdate((data: { socketId: string; userId: string; x: number; y: number; name: string; color: string }) => {
      if (data.userId !== user.id) {
        setRemoteCursors((prev) => {
          const newCursors = new Map(prev);
          newCursors.set(data.socketId, { x: data.x, y: data.y, name: data.name, color: data.color });
          return newCursors;
        });
      }
    });

    return () => {
      unsubscribeAdded();
      unsubscribeUpdated();
      unsubscribeDeleted();
      unsubscribeUndo();
      unsubscribeCursor();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket.isConnected, user.id]);

  // Helper function to get correct coordinates
  const getCanvasCoordinates = useCallback((e: { clientX: number; clientY: number }) => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    return { x, y };
  }, []);

  // Cursor tracking
  useEffect(() => {
    if (!socket.isConnected) return;

    const handleMouseMove = (e: MouseEvent) => {
      const { x, y } = getCanvasCoordinates(e);

      // Send cursor updates immediately
      if (socket.isConnected) {
        socket.sendCursorMove(x, y);
      }
    };

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('mousemove', handleMouseMove);
      return () => {
        canvas.removeEventListener('mousemove', handleMouseMove);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket.isConnected, getCanvasCoordinates]);

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isTextMode || currentTool === "select") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = getCanvasCoordinates(e);

    // Eraser tool - erase on mouse down
    if (currentTool === "eraser") {
      setIsDrawing(true);
      eraseAtPosition(x, y);
      return;
    }

    setIsDrawing(true);

    const newElement: DrawingElement = {
      id: `${Date.now()}-${Math.random()}`,
      type: currentTool,
      x,
      y,
      color: currentColor,
      strokeWidth,
      points: currentTool === "pen" ? [{ x, y }] : undefined,
      width: currentTool !== "pen" ? 0 : undefined,
      height: currentTool !== "pen" ? 0 : undefined,
    };

    setElements((prev) => [...prev, newElement]);
    
    // Send via WebSocket for real-time collaboration
    if (socket.isConnected) {
      socket.sendDrawingStart(newElement);
    }
    
    // Mark as having unsaved changes
    setHasUnsavedChanges(true);
    
    // Only add to pending save if element is valid
    // For pen, wait until we have at least 2 points (after mouse move)
    // For shapes, wait until they have valid size (after mouse up)
    if (currentTool === "pen") {
      // Pen will be saved after mouse move when it has enough points
    } else {
      // Shapes and text will be validated before saving in mouse up
      pendingSaveRef.current.add(newElement.id);
      debouncedSaveToDatabase();
    }
  };

  // Helper function to erase elements at a position
  const eraseAtPosition = useCallback((x: number, y: number) => {
    const eraserRadius = strokeWidth * 4; // Make eraser size relative to stroke width (increased for better visibility)
    
    setElements((prev) => {
      const newElements = prev.map((element) => {
        // For pen strokes, remove points within eraser radius
        if (element.type === "pen" && element.points) {
          const remainingPoints = element.points.filter((point) => {
            const dx = point.x - x;
            const dy = point.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance > eraserRadius;
          });
          
          // If all points are removed or too few points remain, mark for deletion
          if (remainingPoints.length < 2) {
            return null; // Mark for deletion
          }
          
          // Update points if any were removed
          if (remainingPoints.length < element.points.length) {
            const updatedElement = { ...element, points: remainingPoints };
            
            // Send update via WebSocket
            if (socket.isConnected) {
              socket.sendDrawingUpdate(element.id, { points: remainingPoints });
            }
            
            // If element was significantly modified, save to database
            if (remainingPoints.length < element.points.length * 0.5) {
              pendingSaveRef.current.add(element.id);
              debouncedSaveToDatabase();
            }
            
            return updatedElement;
          }
          
          return element;
        }
        
        // For other drawing elements, check if eraser touches them
        if (["rectangle", "circle", "text"].includes(element.type)) {
          let shouldDelete = false;
          
          // For shapes with width and height, check if eraser touches the shape
          if (element.width !== undefined && element.height !== undefined) {
            const left = Math.min(element.x, element.x + element.width);
            const right = Math.max(element.x, element.x + element.width);
            const top = Math.min(element.y, element.y + element.height);
            const bottom = Math.max(element.y, element.y + element.height);
            
            // Check if eraser position is within bounding box with margin
            if (x >= left - eraserRadius && x <= right + eraserRadius &&
                y >= top - eraserRadius && y <= bottom + eraserRadius) {
              
              // For rectangles, check distance to edges
              if (element.type === "rectangle") {
                const closestX = Math.max(left, Math.min(x, right));
                const closestY = Math.max(top, Math.min(y, bottom));
                const dx = x - closestX;
                const dy = y - closestY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                shouldDelete = distance <= eraserRadius;
              } 
              // For circles, check distance to center
              else if (element.type === "circle") {
                const centerX = element.x + element.width / 2;
                const centerY = element.y + element.height / 2;
                const radius = Math.min(Math.abs(element.width), Math.abs(element.height)) / 2;
                const dx = x - centerX;
                const dy = y - centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                shouldDelete = Math.abs(distance - radius) <= eraserRadius;
              }
              // For text, delete if within eraser radius
              else {
                const dx = element.x - x;
                const dy = element.y - y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                shouldDelete = distance <= eraserRadius;
              }
            }
          } 
          // For elements without width/height, check distance to position
          else {
            const dx = element.x - x;
            const dy = element.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            shouldDelete = distance <= eraserRadius;
          }
          
          if (shouldDelete) {
            // Send delete via WebSocket
            if (socket.isConnected) {
              socket.sendElementDelete(element.id);
            }
            
            // Delete from database
            handleAsyncError(async () => {
              try {
                await elementApi.deleteElement(element.id);
              } catch (error) {
                // Ignore errors - element will be removed from UI anyway
              }
            });
            
            return null; // Mark for deletion
          }
        }
        
        return element;
      }).filter((element) => element !== null) as DrawingElement[];
      
      // If any elements were deleted, save history
      if (newElements.length < prev.length) {
        setTimeout(() => saveToHistory(), 0);
      }
      
      return newElements;
    });
  }, [strokeWidth, socket, debouncedSaveToDatabase, saveToHistory]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = getCanvasCoordinates(e);

    // Update eraser preview position when eraser tool is selected
    if (currentTool === "eraser") {
      setEraserPosition({ x, y });
      
      // Erase as mouse moves if drawing (mouse is pressed)
      if (isDrawing) {
        eraseAtPosition(x, y);
      }
      return;
    } else {
      // Clear eraser position when using other tools
      if (eraserPosition) {
        setEraserPosition(null);
      }
    }

    if (!isDrawing || isTextMode || currentTool === "select") return;

    setElements((prev) => {
      const newElements = [...prev];
      const currentElement = newElements[newElements.length - 1];

      if (currentTool === "pen") {
        currentElement.points = [...(currentElement.points || []), { x, y }];
      } else {
        currentElement.width = (x - currentElement.x);
        currentElement.height = (y - currentElement.y);
      }

      // Send update via WebSocket (throttled)
      if (socket.isConnected && currentElement.id) {
        const updates: Partial<DrawingElement> = {};
        if (currentTool === "pen") {
          updates.points = currentElement.points;
        } else {
          updates.width = currentElement.width;
          updates.height = currentElement.height;
        }
        socket.sendDrawingUpdate(currentElement.id, updates);
      }

      return newElements;
    });
  };

  const handleMouseUp = () => {
    if (isDrawing && currentTool !== "select") {
      setIsDrawing(false);
      
      // Validate and save the completed element
      setElements((prev) => {
        if (prev.length > 0) {
          const lastElement = prev[prev.length - 1];
          
          // Validate before saving
          if (isValidElement(lastElement)) {
            if (!pendingSaveRef.current.has(lastElement.id)) {
              pendingSaveRef.current.add(lastElement.id);
              debouncedSaveToDatabase();
            }
          } else {
            // Completed element is invalid, removing from canvas
            // Remove invalid element
            return prev.filter(el => el.id !== lastElement.id);
          }
        }
        return prev;
      });
      
      saveToHistory();
    }
    
    // Clear eraser position when mouse is released (optional - comment out if you want it to persist)
    // if (currentTool === "eraser") {
    //   setEraserPosition(null);
    // }
  };

  // Canvas click for text tool and selection
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (currentTool === "text" && !isTextMode) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const { x, y } = getCanvasCoordinates(e);

      setTextPosition({ x, y });
      setIsTextMode(true);
      setTextInput("");
    } else if (currentTool === "select") {
      // Deselect when clicking on empty canvas
      setSelectedElement(null);
    }
  };

  // Add text to canvas
  const addText = async () => {
    if (textInput.trim()) {
      try {
        setSaving(true);
        setAddError(null);
        
        const newElement: DrawingElement = {
          id: `${Date.now()}-${Math.random()}`,
          type: "text",
          x: textPosition.x,
          y: textPosition.y,
          text: textInput,
          color: currentColor,
          strokeWidth,
        };
        
        // Add locally
        setElements((prev) => [...prev, newElement]);
        saveToHistory();
        
        // Send via WebSocket for real-time
        if (socket.isConnected) {
          socket.sendDrawingStart(newElement);
        }
        
        // Validate and save text element (text is already validated above with trim check)
        if (isValidElement(newElement)) {
          pendingSaveRef.current.add(newElement.id);
          debouncedSaveToDatabase();
        } else {
          // Fallback: save directly to database if socket not connected
          if (!socket.isConnected) {
            const elementPayload = {
              board_id: actualBoardId,
              type: mapElementTypeToApi("text"),
              data: { text: textInput, color: currentColor, strokeWidth },
              position: { x: textPosition.x, y: textPosition.y },
            };
            const validated = validateAndToast(createElementApiSchema, elementPayload, "Element");
            if (validated) {
              await elementApi.createElement(validated);
            }
          }
        }
        
        toast({
          title: "Text added",
          description: "Text element has been added to the board.",
        });
      } catch (error) {
        const appError = ErrorHandler.createError(error, "Adding text element");
        ErrorHandler.logError(appError, "Adding text element");
        toast(ErrorHandler.getToastConfig(appError));
        setAddError(appError.message);
      } finally {
        setSaving(false);
      }
    }

    setIsTextMode(false);
    setTextInput("");
  };

  // Undo/Redo (collaborative via WebSocket)
  const undo = () => {
    const currentIndex = historyIndexRef.current;
    const currentHistory = historyRef.current;
    
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      if (currentHistory[newIndex]) {
        // Create a deep copy of the history state
        const elementsToRestore = currentHistory[newIndex].map(el => ({ ...el, points: el.points ? [...el.points] : undefined }));
        setElements(elementsToRestore);
        setHistoryIndex(newIndex);
      }
    }
    
    // Send undo via socket if connected (for collaboration)
    if (socket.isConnected) {
      socket.sendUndo();
    }
  };

  const redo = () => {
    // Redo is still local for now (can be extended to WebSocket)
    const currentIndex = historyIndexRef.current;
    const currentHistory = historyRef.current;
    
    if (currentIndex < currentHistory.length - 1) {
      const newIndex = currentIndex + 1;
      if (currentHistory[newIndex]) {
        // Create a deep copy of the history state
        const elementsToRestore = currentHistory[newIndex].map(el => ({ ...el, points: el.points ? [...el.points] : undefined }));
        setElements(elementsToRestore);
        setHistoryIndex(newIndex);
      }
    }
  };

  // Delete board
  const deleteBoard = async () => {
    try {
      setSaving(true);
      setDeleteBoardError(null);
      
      // Delete board from database
      await boardApi.deleteBoard(actualBoardId);
      
      toast({
        title: "Board deleted",
        description: "The board has been deleted successfully.",
      });
      
      // Navigate back to dashboard
      onBackToDashboard?.();
    } catch (error) {
      const appError = ErrorHandler.createError(error, "Deleting board");
      ErrorHandler.logError(appError, "Deleting board");
      toast(ErrorHandler.getToastConfig(appError));
      setDeleteBoardError(appError.message);
    } finally {
      setSaving(false);
      setShowDeleteBoardDialog(false);
    }
  };

  // Clear canvas
  const clearCanvas = async () => {
    try {
      setSaving(true);
      setClearError(null);
      // In a real implementation, you might want to delete all elements from the database
      // For now, well just clear the local state
      setElements([]);
      saveToHistory();
      
      toast({
        title: "Canvas cleared",
        description: "All elements have been removed from the board.",
      });
    } catch (error) {
      const appError = ErrorHandler.createError(error, "Clearing canvas");
      ErrorHandler.logError(appError, "Clearing canvas");
      toast(ErrorHandler.getToastConfig(appError));
      setClearError(appError.message);
    } finally {
      setSaving(false);
      setShowClearDialog(false);
    }
  };

  // Helper to create element payload for saving
  const createElementPayload = useCallback((element: DrawingElement) => {
    return {
      board_id: actualBoardId,
      type: mapElementTypeToApi(element.type),
      data: {
        color: element.color,
        strokeWidth: element.strokeWidth,
        points: element.points,
        text: element.text,
        src: element.src,
        alt: element.alt,
        opacity: element.opacity,
        borderRadius: element.borderRadius,
        shapeType: element.shapeType,
        fillColor: element.fillColor,
        data: element.data,
        symbol: element.symbol,
        rows: element.rows,
        cols: element.cols,
        chartType: element.chartType,
        colors: element.colors,
      },
      position: { x: element.x, y: element.y },
      size: element.width && element.height ? { width: element.width, height: element.height } : undefined,
    };
  }, [actualBoardId]);

  // Helper to check if element has been modified (simplified comparison)
  const isElementModified = useCallback((local: DrawingElement, saved: DatabaseElement): boolean => {
    // Compare key properties that matter
    return (
      local.x !== (saved.position?.x ?? 0) ||
      local.y !== (saved.position?.y ?? 0) ||
      local.width !== saved.size?.width ||
      local.height !== saved.size?.height ||
      local.color !== (saved.data?.color ?? "#000000") ||
      local.strokeWidth !== (saved.data?.strokeWidth ?? 2) ||
      JSON.stringify(local.points) !== JSON.stringify(saved.data?.points) ||
      local.text !== saved.data?.text
    );
  }, []);

  // Save board - incremental sync (more efficient: only update what changed)
  const saveBoard = async () => {
    try {
      setSaving(true);
      setSaveError(null);
      
      
      // Filter elements that should be saved
      const elementsToSync = elements.filter(el => {
        return ["pen", "rectangle", "circle", "text", "image", "shape", "table", "chart", "icon"].includes(el.type);
      });
      
      // Step 1: Fetch existing elements from database
      let savedElements: DatabaseElement[] = [];
      try {
        const elements = await elementApi.getElements(actualBoardId);
        // Map API response to DatabaseElement format
        savedElements = elements.map((el) => ({
          id: el.id,
          type: el.type,
          position: el.position ?? undefined,
          size: el.size ?? undefined,
          data: el.data ?? undefined,
        }));
      } catch (error) {
        ErrorHandler.logError(ErrorHandler.createError(error, "Fetching existing elements"), "saveBoard");
        savedElements = [];
      }
      
      // Step 2: Create maps for efficient lookup
      const localMap = new Map(elementsToSync.map(el => [el.id, el]));
      const savedMap = new Map(savedElements.map((el) => [el.id, el]));
      
      // Step 3: Identify changes
      const toCreate: DrawingElement[] = [];
      const toUpdate: Array<{ id: string; element: DrawingElement; saved: DatabaseElement }> = [];
      const toDelete: DatabaseElement[] = [];
      
      // Find new elements (in local but not in saved)
      for (const localEl of elementsToSync) {
        const savedEl = savedMap.get(localEl.id);
        if (!savedEl) {
          toCreate.push(localEl);
        } else if (isElementModified(localEl, savedEl)) {
          toUpdate.push({ id: localEl.id, element: localEl, saved: savedEl });
        }
      }
      
      // Find deleted elements (in saved but not in local)
      for (const savedEl of savedElements) {
        if (!localMap.has(savedEl.id)) {
          toDelete.push(savedEl);
        }
      }
      
      
      // Step 4: Apply changes in parallel where possible
      await Promise.allSettled([
        // Create new elements
        Promise.all(toCreate.map(async (element) => {
          try {
            await elementApi.createElement(createElementPayload(element));
          } catch (error) {
            ErrorHandler.logError(ErrorHandler.createError(error, `Creating element ${element.id}`), "saveBoard");
          }
        })),
        
        // Update modified elements
        Promise.all(toUpdate.map(async ({ id, element }) => {
          try {
            const payload = createElementPayload(element);
            await elementApi.updateElement(id, {
              data: payload.data,
              position: payload.position,
              size: payload.size,
            });
          } catch (error) {
            ErrorHandler.logError(ErrorHandler.createError(error, `Updating element ${id}`), "saveBoard");
          }
        })),
        
        // Delete removed elements
        Promise.all(toDelete.map(async (element) => {
          try {
            await elementApi.deleteElement(element.id, actualBoardId);
          } catch (error) {
            ErrorHandler.logError(ErrorHandler.createError(error, `Deleting element ${element.id}`), "saveBoard");
          }
        })),
      ]);
      
      // Count changes
      const created = toCreate.length;
      const updated = toUpdate.length;
      const deleted = toDelete.length;
      const totalChanges = created + updated + deleted;
      
      // Clear pending saves
      pendingSaveRef.current.clear();
      
      // Update board title if it changed
      try {
        await boardApi.updateBoard(actualBoardId, { title: boardTitle });
      } catch (error) {
        ErrorHandler.logError(ErrorHandler.createError(error, "Updating board title"), "saveBoard");
      }
      
      // Mark as saved
      setHasUnsavedChanges(false);
      
      // Show summary
      const summary = [];
      if (created > 0) summary.push(`${created} created`);
      if (updated > 0) summary.push(`${updated} updated`);
      if (deleted > 0) summary.push(`${deleted} deleted`);
      
      toast({
        title: "Board saved!",
        description: totalChanges > 0 
          ? `Changes: ${summary.join(', ')}.`
          : "No changes to save.",
      });
    } catch (error) {
      const appError = ErrorHandler.createError(error, "Saving board");
      ErrorHandler.logError(appError, "Saving board");
      toast(ErrorHandler.getToastConfig(appError));
      setSaveError(appError.message);
    } finally {
      setSaving(false);
    }
  };

  // Handle insert operations
  const handleInsert = (type: string, data: Record<string, unknown>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    let newElement: DrawingElement;
    let validated: Record<string, unknown> | null = null;

    switch (type) {
      case "image":
        validated = validateAndToast(insertImageSchema, data, "Image");
        if (!validated) return;
        newElement = {
          id: Date.now().toString(),
          type: "image",
          x: centerX - 100,
          y: centerY - 75,
          width: 200,
          height: 150,
          src: validated.src as string,
          alt: validated.name as string,
          color: currentColor,
          strokeWidth: 1,
          opacity: 1,
          borderRadius: 0,
        };
        break;

      case "shape":
        validated = validateAndToast(insertShapeSchema, data, "Shape");
        if (!validated) return;
        newElement = {
          id: Date.now().toString(),
          type: "shape",
          x: centerX - 50,
          y: centerY - 50,
          width: 100,
          height: 100,
          shapeType: validated.type as string,
          color: currentColor,
          strokeWidth: 2,
          fillColor: "transparent",
        };
        break;

      case "table":
        validated = validateAndToast(insertTableSchema, data, "Table");
        if (!validated) return;
        newElement = {
          id: Date.now().toString(),
          type: "table",
          x: centerX - 150,
          y: centerY - 100,
          width: 300,
          height: 200,
          rows: validated.rows as number,
          cols: validated.cols as number,
          data: Array(validated.rows).fill(Array(validated.cols).fill("")),
          color: currentColor,
          strokeWidth: 1,
        };
        break;

      case "chart":
        validated = validateAndToast(insertChartSchema, data, "Chart");
        if (!validated) return;
        const chartData = [10, 20, 15, 25, 30];
        const chartColors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];
        newElement = {
          id: Date.now().toString(),
          type: "chart",
          x: centerX - 100,
          y: centerY - 75,
          width: 200,
          height: 150,
          chartType: validated.type as string, // Keep chartType for chart-specific data
          data: chartData,
          colors: chartColors,
          color: currentColor,
          strokeWidth: 1,
        };
        break;

      case "icon":
        validated = validateAndToast(insertIconSchema, data, "Icon");
        if (!validated) return;
        newElement = {
          id: Date.now().toString(),
          type: "icon",
          x: centerX - 25,
          y: centerY - 25,
          width: 50,
          height: 50,
          symbol: validated.symbol as string,
          color: currentColor,
          strokeWidth: 1,
        };
        break;

      case "template":
        // Handle template insertion
        validated = validateAndToast(insertTemplateSchema, data, "Template");
        if (!validated) return;
        const templateElements = getTemplateElements((validated.type as string), centerX, centerY);
        setElements(prev => [...prev, ...templateElements]);
        saveToHistory();
        return;

      default:
        return;
    }

    setElements(prev => [...prev, newElement]);
    saveToHistory();
  };

  // Get template elements
  const getTemplateElements = (templateType: string, centerX: number, centerY: number) => {
    const elements: DrawingElement[] = [];
    
    switch (templateType) {
      case "titleSlide":
        elements.push(
          {
            id: Date.now().toString() + "-title",
            type: "text",
            x: centerX - 100,
            y: centerY - 50,
            text: "Title",
            color: "#000000",
            strokeWidth: 3,
          },
          {
            id: Date.now().toString() + "-subtitle",
            type: "text",
            x: centerX - 80,
            y: centerY + 20,
            text: "Subtitle",
            color: "#666666",
            strokeWidth: 2,
          }
        );
        break;

      case "contentSlide":
        elements.push(
          {
            id: Date.now().toString() + "-title",
            type: "text",
            x: centerX - 100,
            y: centerY - 80,
            text: "Content Title",
            color: "#000000",
            strokeWidth: 3,
          },
          {
            id: Date.now().toString() + "-bullet1",
            type: "text",
            x: centerX - 80,
            y: centerY - 20,
            text: "• Point 1",
            color: "#333333",
            strokeWidth: 2,
          },
          {
            id: Date.now().toString() + "-bullet2",
            type: "text",
            x: centerX - 80,
            y: centerY + 10,
            text: "• Point 2",
            color: "#333333",
            strokeWidth: 2,
          }
        );
        break;

      case "twoColumn":
        elements.push(
          {
            id: Date.now().toString() + "-title",
            type: "text",
            x: centerX - 100,
            y: centerY - 80,
            text: "Two Column Layout",
            color: "#000000",
            strokeWidth: 3,
          },
          {
            id: Date.now().toString() + "-col1",
            type: "text",
            x: centerX - 120,
            y: centerY - 20,
            text: "Left Column",
            color: "#333333",
            strokeWidth: 2,
          },
          {
            id: Date.now().toString() + "-col2",
            type: "text",
            x: centerX + 20,
            y: centerY - 20,
            text: "Right Column",
            color: "#333333",
            strokeWidth: 2,
          }
        );
        break;
    }
    
    return elements;
  };

  // Handle element selection
  const handleElementSelect = (elementId: string) => {
    setSelectedElement(elementId);
  };

  // Handle element update
  const handleElementUpdate = async (elementId: string, updates: Partial<DrawingElement>) => {
    try {
      setSaving(true);
      setUpdateError(null);
      setHasUnsavedChanges(true);
      const validated = validateAndToast(updateElementSchema, updates, "Element Update");
      if (!validated) {
        setSaving(false);
        return;
      }
      const updated = await elementApi.updateElement(elementId, validated);
      setElements(prev => prev.map(element => 
        element.id === elementId ? mapDatabaseElementToDrawingElement(updated) : element
      ));
      saveToHistory();
      
      toast({
        title: "Element updated",
        description: "Element has been updated successfully.",
      });
    } catch (error) {
      const appError = ErrorHandler.createError(error, "Updating element");
      ErrorHandler.logError(appError, "Updating element");
      toast(ErrorHandler.getToastConfig(appError));
      setUpdateError(appError.message);
    } finally {
      setSaving(false);
    }
  };

  // Handle element deletion
  const handleElementDelete = async (elementId: string) => {
    try {
      setSaving(true);
      setDeleteError(null);
      setHasUnsavedChanges(true);
      
      // Send via WebSocket for real-time
      if (socket.isConnected) {
        socket.sendElementDelete(elementId);
      }
      
      // Also delete from database
      try {
        await elementApi.deleteElement(elementId);
      } catch (error) {
      }
      
      setElements(prev => prev.filter(element => element.id !== elementId));
      setSelectedElement(null);
      saveToHistory();
      
      toast({
        title: "Element deleted",
        description: "Element has been removed from the board.",
      });
    } catch (error) {
      const appError = ErrorHandler.createError(error, "Deleting element");
      ErrorHandler.logError(appError, "Deleting element");
      toast(ErrorHandler.getToastConfig(appError));
      setDeleteError(appError.message);
    } finally {
      setSaving(false);
    }
  };

  // Add error state UI
  if (error && !loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <RetryButton
          error={error}
          onRetry={() => window.location.reload()}
          isLoading={loading}
        />
      </div>
    );
  }
  // Add loading state UI
  if (loading) {
    return <WhiteboardSkeleton />;
  }

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar Toolbar - Two Columns */}
      <div className="w-32 bg-white border-r border-gray-200 flex py-4" aria-label="Whiteboard toolbar">
        {/* Left Column - Tools */}
        <div className="w-16 flex flex-col items-center space-y-2">
        {/* Navigation */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onBackToDashboard}
              className="mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Back to dashboard"
              tabIndex={0}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Back to dashboard</TooltipContent>
        </Tooltip>
        <Separator className="w-8" />
        {/* Drawing Tools */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={currentTool === "select" ? "default" : "ghost"}
              size="icon"
              onClick={() => setCurrentTool("select")}
              aria-label="Select tool"
              tabIndex={0}
              className="focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Move className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Select</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={currentTool === "pen" ? "default" : "ghost"}
              size="icon"
              onClick={() => setCurrentTool("pen")}
              aria-label="Pen tool"
              tabIndex={0}
              className="focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Pen className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Pen</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={currentTool === "rectangle" ? "default" : "ghost"}
              size="icon"
              onClick={() => setCurrentTool("rectangle")}
              aria-label="Rectangle tool"
              tabIndex={0}
              className="focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Square className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Rectangle</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={currentTool === "circle" ? "default" : "ghost"}
              size="icon"
              onClick={() => setCurrentTool("circle")}
              aria-label="Circle tool"
              tabIndex={0}
              className="focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Circle className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Circle</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={currentTool === "text" ? "default" : "ghost"}
              size="icon"
              onClick={() => setCurrentTool("text")}
              aria-label="Text tool"
              tabIndex={0}
              className="focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Type className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Text</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={currentTool === "eraser" ? "default" : "ghost"}
              size="icon"
              onClick={() => setCurrentTool("eraser")}
              aria-label="Eraser tool"
              tabIndex={0}
              className="focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Eraser className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Eraser</TooltipContent>
        </Tooltip>
        <Separator className="w-8" />
        {/* Insert Panel */}
        <InsertPanel onInsert={handleInsert} />
        <Separator className="w-8" />
        {/* Stroke Width */}
        <div className="flex flex-col space-y-1" aria-label="Stroke width picker">
          {strokeWidths.map((width) => (
            <Tooltip key={width}>
              <TooltipTrigger asChild>
                <Button
                  variant={strokeWidth === width ? "default" : "ghost"}
                  size="icon"
                  onClick={() => setStrokeWidth(width)}
                  className="w-8 h-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label={`Stroke width ${width}`}
                  tabIndex={0}
                >
                  <div
                    className="rounded-full bg-current"
                    style={{
                      width: `${Math.max(width, 2)}px`,
                      height: `${Math.max(width, 2)}px`,
                    }}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{`Stroke width ${width}`}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        <Separator className="w-8" />
        {/* User Actions */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onLogout}
              aria-label="Log out"
              tabIndex={0}
              className="focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Log out</TooltipContent>
        </Tooltip>
        </div>
        {/* Right Column - Colors */}
        <div className="w-16 flex flex-col items-center py-4 space-y-2 border-l border-gray-200">
          <div className="flex flex-col space-y-1" aria-label="Color picker">
            {colors.map((color) => (
              <button
                key={color}
                className={`w-6 h-6 rounded border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  currentColor === color ? "border-gray-400" : "border-gray-200"
                }`}
                style={{ backgroundColor: color }}
                onClick={() => setCurrentColor(color)}
                aria-label={`Select color ${color}`}
                tabIndex={0}
              />
            ))}
          </div>
        </div>
      </div>
      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
          <div className="flex items-center space-x-4 flex-1">
            {isEditingTitle ? (
              <input
                type="text"
                value={boardTitle}
                onChange={(e) => {
                  setBoardTitle(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                onBlur={() => {
                  setIsEditingTitle(false);
                  // Optionally save title immediately on blur
                  if (boardTitle.trim()) {
                    boardApi.updateBoard(actualBoardId, { title: boardTitle.trim() }).catch((error) => {
                      ErrorHandler.logError(ErrorHandler.createError(error, "Updating board title"), "handleTitleUpdate");
                    });
                  } else {
                    setBoardTitle("Untitled Board");
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setIsEditingTitle(false);
                    if (boardTitle.trim()) {
                      boardApi.updateBoard(actualBoardId, { title: boardTitle.trim() }).catch((error) => {
                      ErrorHandler.logError(ErrorHandler.createError(error, "Updating board title"), "handleTitleUpdate");
                    });
                      setHasUnsavedChanges(true);
                    } else {
                      setBoardTitle("Untitled Board");
                    }
                  } else if (e.key === 'Escape') {
                    setIsEditingTitle(false);
                    // Restore original title
                    boardApi.getBoard(actualBoardId).then(board => {
                      if (board.title) setBoardTitle(board.title);
                    }).catch(() => {});
                  }
                }}
                className="text-lg font-semibold text-gray-900 bg-transparent border-b-2 border-blue-500 focus:outline-none focus:border-blue-600 px-1"
                autoFocus
              />
            ) : (
              <h1 
                className="text-lg font-semibold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                onClick={() => setIsEditingTitle(true)}
                title="Click to edit board name"
              >
                {boardTitle}
              </h1>
            )}
            <Badge variant={hasUnsavedChanges ? "outline" : "secondary"}>
              {saving ? "Saving..." : hasUnsavedChanges ? "Unsaved" : "Saved"}
            </Badge>
            {loading && (
              <Badge variant="outline" className="animate-pulse">
                Loading...
              </Badge>
            )}
            <Separator orientation="vertical" className="h-6" />
            {/* Actions */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={undo}
                  disabled={historyIndex <= 0}
                  aria-label="Undo"
                  tabIndex={0}
                  className="focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <Undo className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Undo</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={redo}
                  disabled={historyIndex >= history.length - 1}
                  aria-label="Redo"
                  tabIndex={0}
                  className="focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <Redo className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Redo</TooltipContent>
            </Tooltip>
            <Separator orientation="vertical" className="h-6" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={saveBoard}
                  aria-label="Save board"
                  tabIndex={0}
                  className="focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <Save className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowShareModal(true)}
                  aria-label="Share board"
                  tabIndex={0}
                  className="focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <Share2 className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Share</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowClearDialog(true)}
                  aria-label="Clear canvas"
                  tabIndex={0}
                  className="focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <Minus className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDeleteBoardDialog(true)}
                  aria-label="Delete board"
                  tabIndex={0}
                  className="focus:outline-none focus:ring-2 focus:ring-red-500 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete Board</TooltipContent>
            </Tooltip>
          </div>
          {/* Collaborators */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600 mr-2">
              {collaborators.length + 1} collaborators
            </span>
            {collaborators.map((collaborator) => (
              <Avatar key={collaborator.id} className="h-8 w-8">
                <AvatarImage
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${collaborator.name}`}
                />
                <AvatarFallback className="text-xs">
                  {collaborator.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
            ))}
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`}
              />
              <AvatarFallback className="text-xs">
                {user.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
        {/* Canvas Container */}
        <div ref={containerRef} className="relative flex-1" aria-label="Whiteboard canvas area">
          {/* Drawing Canvas */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full bg-white"
            style={cursorStyle}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => setEraserPosition(null)}
            onClick={handleCanvasClick}
            role="region"
            aria-label="Drawing canvas"
            tabIndex={0}
          />
          
          {/* Insertable Elements */}
          {elements
            .filter(element => ["image", "shape", "table", "chart", "icon"].includes(element.type))
            .map((element) => {
              const isSelected = selectedElement === element.id;
              
              switch (element.type) {
                case "image":
                  return (
                    <ImageElement
                      key={element.id}
                      element={element}
                      isSelected={isSelected}
                      onSelect={() => handleElementSelect(element.id)}
                      onUpdate={(updates) => handleElementUpdate(element.id, updates)}
                      onDelete={() => handleElementDelete(element.id)}
                      onMove={(x, y) => handleElementUpdate(element.id, { x, y })}
                      onResize={(width, height) => handleElementUpdate(element.id, { width, height })}
                    />
                  );
                case "shape":
                  return (
                    <ShapeElement
                      key={element.id}
                      element={element}
                      isSelected={isSelected}
                      onSelect={() => handleElementSelect(element.id)}
                      onUpdate={(updates) => handleElementUpdate(element.id, updates)}
                      onDelete={() => handleElementDelete(element.id)}
                      onMove={(x, y) => handleElementUpdate(element.id, { x, y })}
                      onResize={(width, height) => handleElementUpdate(element.id, { width, height })}
                    />
                  );
                case "table":
                  return (
                    <TableElement
                      key={element.id}
                      element={element}
                      isSelected={isSelected}
                      onSelect={() => handleElementSelect(element.id)}
                      onUpdate={(updates) => handleElementUpdate(element.id, updates)}
                      onDelete={() => handleElementDelete(element.id)}
                      onMove={(x, y) => handleElementUpdate(element.id, { x, y })}
                      onResize={(width, height) => handleElementUpdate(element.id, { width, height })}
                    />
                  );
                case "chart":
                  return (
                    <ChartElement
                      key={element.id}
                      element={element}
                      isSelected={isSelected}
                      onSelect={() => handleElementSelect(element.id)}
                      onUpdate={(updates) => handleElementUpdate(element.id, updates)}
                      onDelete={() => handleElementDelete(element.id)}
                      onMove={(x, y) => handleElementUpdate(element.id, { x, y })}
                      onResize={(width, height) => handleElementUpdate(element.id, { width, height })}
                    />
                  );
                case "icon":
                  return (
                    <IconElement
                      key={element.id}
                      element={element}
                      isSelected={isSelected}
                      onSelect={() => handleElementSelect(element.id)}
                      onUpdate={(updates) => handleElementUpdate(element.id, updates)}
                      onDelete={() => handleElementDelete(element.id)}
                      onMove={(x, y) => handleElementUpdate(element.id, { x, y })}
                      onResize={(width, height) => handleElementUpdate(element.id, { width, height })}
                    />
                  );
                default:
                  return null;
              }
            })}
          
          {/* Eraser Preview */}
          {currentTool === "eraser" && eraserPosition && (
            <div
              className="absolute pointer-events-none z-20"
              style={{
                left: eraserPosition.x,
                top: eraserPosition.y,
                width: strokeWidth * 8,
                height: strokeWidth * 8,
                borderRadius: "50%",
                border: "2px solid rgba(239, 68, 68, 0.6)",
                backgroundColor: "rgba(239, 68, 68, 0.2)",
                transform: "translate(-50%, -50%)",
              }}
              aria-label="Eraser preview"
            />
          )}
          
          {/* Collaborator Cursors */}
          {Array.from(remoteCursors.entries()).map(([socketId, cursor]) => (
            <div
              key={socketId}
              className="absolute pointer-events-none z-10"
              style={{
                left: cursor.x,
                top: cursor.y,
                transform: "translate(-2px, -2px)",
              }}
              aria-label={`Collaborator cursor: ${cursor.name}`}
            >
              <div
                className="w-4 h-4 rounded-full border-2 border-white"
                style={{ backgroundColor: cursor.color }}
              />
              <div
                className="absolute top-5 left-0 px-2 py-1 rounded text-xs text-white whitespace-nowrap"
                style={{ backgroundColor: cursor.color }}
              >
                {cursor.name}
              </div>
            </div>
          ))}
          {/* Text Input Overlay */}
          {isTextMode && (
            <div
              className="absolute z-20"
              style={{
                left: textPosition.x,
                top: textPosition.y - 30,
              }}
              aria-label="Text input overlay"
            >
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    addText();
                  } else if (e.key === "Escape") {
                    setIsTextMode(false);
                    setTextInput("");
                  }
                }}
                onBlur={addText}
                autoFocus
                className="px-2 py-1 border border-gray-300 rounded text-sm"
                placeholder="Type text..."
                style={{
                  color: currentColor,
                  fontSize: `${strokeWidth * 8}px`,
                }}
                aria-label="Text input"
              />
            </div>
          )}
        </div>
      </div>
      {/* Share Modal */}
      <ShareModal
        open={showShareModal}
        onOpenChange={setShowShareModal}
        boardTitle={boardTitle}
        boardId={actualBoardId}
      />
      {/* Clear Confirmation Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Canvas</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to clear the canvas? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowClearDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={clearCanvas}>
              Clear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Delete Board Confirmation Dialog */}
      <Dialog open={showDeleteBoardDialog} onOpenChange={setShowDeleteBoardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Board</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete this board? This action cannot be undone and all data will be permanently removed.</p>
          {deleteBoardError && (
            <p className="text-sm text-red-600">{deleteBoardError}</p>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowDeleteBoardDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteBoard} disabled={saving}>
              {saving ? "Deleting..." : "Delete Board"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Overlay spinner for blocking operations */}
      <LoadingOverlay isVisible={saving} message="Saving..." />
      {/* Error overlays for async actions */}
      {addError && (
        <div className="fixed top-4 right-4 z-50">
          <RetryButton
            error={addError}
            onRetry={addText}
            isLoading={saving}
          />
        </div>
      )}
      {updateError && (
        <div className="fixed top-4 right-4 z-50">
          <RetryButton
            error={updateError}
            onRetry={() => handleElementUpdate(selectedElement!, {})}
            isLoading={saving}
          />
        </div>
      )}
      {deleteError && (
        <div className="fixed top-4 right-4 z-50">
          <RetryButton
            error={deleteError}
            onRetry={() => handleElementDelete(selectedElement!)}
            isLoading={saving}
          />
        </div>
      )}
      {clearError && (
        <div className="fixed top-4 right-4 z-50">
          <RetryButton
            error={clearError}
            onRetry={clearCanvas}
            isLoading={saving}
          />
        </div>
      )}
      {saveError && (
        <div className="fixed top-4 right-4 z-50">
          <RetryButton
            error={saveError}
            onRetry={saveBoard}
            isLoading={saving}
          />
        </div>
      )}
    </div>
  );
};

export default Whiteboard;
