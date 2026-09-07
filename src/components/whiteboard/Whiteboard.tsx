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
import TextStylePanel from "./TextStylePanel";
import ColorPicker from "./ColorPicker";
import ShapeGraphic from "./ShapeGraphic";
import { getShape } from "./shapes";
import { normalizeHex } from "./colorPalette";
import TextBoxEditor, { TextBoxHandles } from "./TextBoxEditor";
import {
  DEFAULT_TEXT_BOX_WIDTH,
  DEFAULT_TEXT_STYLE,
  MIN_TEXT_BOX_HEIGHT,
  MIN_TEXT_BOX_WIDTH,
  TEXT_BOX_PADDING,
  TEXT_WRAP_WIDTH,
  cssFont,
  styleFromElement,
  textBoxContentWidth,
  textBoxMinHeight,
  wrapPlainText,
  type TextStyle,
} from "./textStyle";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ImageElement, ShapeElement, TableElement, ChartElement, IconElement } from "./InsertableElements";
import { elementApi, boardApi, objectApi, drawingApi } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import {
  boundsFromItems,
  clampCameraPan,
  clampPointToHardWorld,
  clampPointToRect,
  clampZoom,
  contentLeash,
  MIN_ZOOM,
  MAX_ZOOM,
} from "@/lib/canvasBounds";
import type { DrawingElement, SlideObject, InkStroke, BoardViewport, BoardShareInfo, Tool } from "@/types";
import { ErrorHandler, handleAsyncError } from "@/lib/errorHandler";
import {
  createElementApiSchema,
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
import {
  cloneElements,
  dataTransferHasFiles,
  fitImageSize,
  isImageFile,
  isTypingTarget,
  newElementId,
  parseClipboardText,
  PASTE_OFFSET,
  readImageFile,
  serializeElements,
  toDrawingElements,
} from "./boardClipboard";
import {
  compactElementPatch,
  createThrottle,
  interpolateCursors,
  PREVIEW_INTERVAL_MS,
  type CursorPresence,
} from "@/lib/livePresence";

// Constants - moved outside component to prevent recreation on every render
const STROKE_WIDTHS = [1, 2, 4, 8] as const;

// Utility function - extracted to prevent duplication
const isValidBoardId = (id: string | undefined): boolean => {
  if (!id) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const mongoIdRegex = /^[0-9a-f]{24}$/i;
  return uuidRegex.test(id) || mongoIdRegex.test(id);
};

const isInkType = (type: string) => type === "pen" || type === "drawing";

function elementBounds(element: {
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  strokeWidth: number;
}) {
  if (element.type === "text") {
    const style = styleFromElement(element);
    const width = element.width || DEFAULT_TEXT_BOX_WIDTH;
    const height = element.height || textBoxMinHeight(style);
    return { x: element.x, y: element.y, width, height };
  }
  const width = element.width || 0;
  const height = element.height || 0;
  return {
    x: Math.min(element.x, element.x + width),
    y: Math.min(element.y, element.y + height),
    width: Math.abs(width),
    height: Math.abs(height),
  };
}

function hitTestElement(
  elements: DrawingElement[],
  x: number,
  y: number
) {
  for (let index = elements.length - 1; index >= 0; index -= 1) {
    const element = elements[index];
    if (isInkType(element.type) || element.type === "eraser" || element.type === "select") continue;
    const box = elementBounds(element);
    if (x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) {
      return element;
    }
  }
  return null;
}

const DEFAULT_CAMERA: BoardViewport = { x: -2000, y: -2000, zoom: 1 };

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

function normalizeElementBox(element: DrawingElement): DrawingElement {
  let { x, y } = element;
  let width = element.width || 0;
  let height = element.height || 0;
  if (width < 0) {
    x += width;
    width = -width;
  }
  if (height < 0) {
    y += height;
    height = -height;
  }
  return { ...element, x, y, width, height };
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
  const isDrawingRef = useRef(false);
  const [currentTool, setCurrentTool] = useState<Tool>("pen");
  const [activeShape, setActiveShape] = useState<string | null>(null);
  const [currentColor, setCurrentColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [elements, setElements] = useState<DrawingElement[]>([]);
  const elementsRef = useRef<DrawingElement[]>([]);
  elementsRef.current = elements;
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<DrawingElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isTextMode, setIsTextMode] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const committingTextRef = useRef(false);
  const [textStyle, setTextStyle] = useState<TextStyle>(DEFAULT_TEXT_STYLE);
  const [highlightLayout, setHighlightLayout] = useState(false);
  const creatingTextBoxRef = useRef<{ id: string; startX: number; startY: number } | null>(null);
  const justCreatedTextRef = useRef(false);
  const editingSnapshotRef = useRef("");
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const selectedElementRef = useRef<string | null>(null);
  selectedElementRef.current = selectedElement;
  const clipboardRef = useRef<DrawingElement[]>([]);
  const pasteCountRef = useRef(0);
  const dragDepthRef = useRef(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const canEditRef = useRef(canEdit);
  canEditRef.current = canEdit;
  const isTextModeRef = useRef(isTextMode);
  isTextModeRef.current = isTextMode;
  const currentColorRef = useRef(currentColor);
  currentColorRef.current = currentColor;
  const currentToolRef = useRef(currentTool);
  currentToolRef.current = currentTool;
  const [shareInfo, setShareInfo] = useState<BoardShareInfo | null>(null);
  const movingElementRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const selectConsumedClickRef = useRef(false);
  const [eraserPosition, setEraserPosition] = useState<{ x: number; y: number } | null>(null);
  const [camera, setCamera] = useState<BoardViewport>(DEFAULT_CAMERA);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const [isPanning, setIsPanning] = useState(false);
  const spacePressedRef = useRef(false);
  const shiftPressedRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; cameraX: number; cameraY: number } | null>(null);
  const cameraSaveTimerRef = useRef<number | null>(null);
  const { toast } = useToast();
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showDeleteBoardDialog, setShowDeleteBoardDialog] = useState(false);
  const [deleteBoardError, setDeleteBoardError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [clearError, setClearError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [remoteCursors, setRemoteCursors] = useState<Map<string, CursorPresence>>(new Map());
  const cursorTargetsRef = useRef<Map<string, CursorPresence>>(new Map());
  const displayedCursorsRef = useRef<Map<string, CursorPresence>>(new Map());
  const cursorRafRef = useRef(0);
  const previewThrottleRef = useRef(createThrottle(PREVIEW_INTERVAL_MS));

  const pumpRemoteCursors = useCallback(() => {
    if (cursorRafRef.current) return;
    const tick = () => {
      const next = interpolateCursors(displayedCursorsRef.current, cursorTargetsRef.current);
      if (next !== displayedCursorsRef.current) {
        displayedCursorsRef.current = next;
        setRemoteCursors(next);
        cursorRafRef.current = window.requestAnimationFrame(tick);
        return;
      }
      cursorRafRef.current = 0;
    };
    cursorRafRef.current = window.requestAnimationFrame(tick);
  }, []);
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
        return isValidSize(element.width, element.height, false) && (element.width || 0) > 0 && (element.height || 0) > 0;
      
      case "image":
        if (!element.src || typeof element.src !== 'string') return false;
        return !element.width || !element.height || isValidSize(element.width, element.height);
      
      case "shape":
        if (!element.shapeType || typeof element.shapeType !== "string") return false;
        return isValidSize(element.width, element.height, false) && element.width !== 0 && element.height !== 0;
      
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
    if (socket.isConnected) {
      pendingSaveRef.current.clear();
      socket.commitDrawing();
      return;
    }
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
      
      const ink = validElementsToSave.filter((el) => isInkType(el.type) && el.points && el.points.length >= 2);
      const objects = validElementsToSave.filter((el) => !isInkType(el.type));

      if (ink.length > 0) {
        try {
          await drawingApi.batchSave(actualBoardId, ink.map((el) => ({
            id: /^[0-9a-f]{24}$/i.test(el.id) ? el.id : undefined,
            points: el.points!,
            color: el.color,
            strokeWidth: el.strokeWidth,
          })));
        } catch (error) {
        }
      }

      for (const element of objects) {
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
              shapeType: element.shapeType || (element.type === "circle" ? "circle" : element.type === "rectangle" ? "rectangle" : undefined),
              fillColor: element.fillColor,
              data: element.data,
              symbol: element.symbol,
              rows: element.rows,
              cols: element.cols,
              chartType: element.chartType,
              colors: element.colors,
              fontSize: element.fontSize,
              fontFamily: element.fontFamily,
              bold: element.bold,
              italic: element.italic,
              underline: element.underline,
              strikethrough: element.strikethrough,
              align: element.align,
              lineHeight: element.lineHeight,
            },
            position: clampPointToHardWorld({ x: element.x, y: element.y }),
            size: element.width && element.height ? { width: element.width, height: element.height } : undefined,
          };
          
          await elementApi.createElement(elementPayload);
        } catch (error) {
        }
      }
    } catch (error) {
      ErrorHandler.logError(ErrorHandler.createError(error, "Debounced save to database"), "debouncedSaveToDatabase");
    }
  }, [elements, actualBoardId, isValidElement, socket.isConnected, socket.commitDrawing]);

  // Use constants defined outside component
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

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(
      dpr * camera.zoom,
      0,
      0,
      dpr * camera.zoom,
      -camera.x * dpr * camera.zoom,
      -camera.y * dpr * camera.zoom
    );

    // Ink plus toolbar-drawn primitives share the canvas layer
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
          if (editingTextId === element.id) {
            break;
          }
          {
            const style = styleFromElement(element);
            const box = elementBounds(element);
            const showLayout = highlightLayout || selectedElement === element.id;
            if (showLayout || !element.text) {
              ctx.save();
              if (highlightLayout) {
                ctx.fillStyle = "rgba(59, 130, 246, 0.06)";
                ctx.fillRect(box.x, box.y, box.width, box.height);
              }
              ctx.strokeStyle = highlightLayout ? "#38BDF8" : !element.text ? "#CBD5E1" : "#93C5FD";
              ctx.lineWidth = 1 / camera.zoom;
              ctx.setLineDash(highlightLayout ? [] : [4 / camera.zoom, 3 / camera.zoom]);
              ctx.strokeRect(box.x, box.y, box.width, box.height);
              if (highlightLayout) {
                ctx.setLineDash([3 / camera.zoom, 3 / camera.zoom]);
                ctx.strokeStyle = "rgba(56, 189, 248, 0.85)";
                ctx.strokeRect(
                  box.x + TEXT_BOX_PADDING,
                  box.y + TEXT_BOX_PADDING,
                  Math.max(0, box.width - TEXT_BOX_PADDING * 2),
                  Math.max(0, box.height - TEXT_BOX_PADDING * 2)
                );
              }
              ctx.restore();
            }
            if (element.text) {
              const fontPx = style.fontSize;
              const lineStep = fontPx * style.lineHeight;
              const wrapWidth = textBoxContentWidth(box.width);
              ctx.font = cssFont(style);
              ctx.textBaseline = "top";
              ctx.textAlign = "left";
              ctx.fillStyle = element.color;
              const lines = wrapPlainText(
                element.text,
                (value) => ctx.measureText(value).width,
                wrapWidth
              );
              lines.forEach((line, index) => {
                const lineWidth = ctx.measureText(line).width;
                let lineX = element.x + TEXT_BOX_PADDING;
                if (style.align === "center") lineX = element.x + TEXT_BOX_PADDING + (wrapWidth - lineWidth) / 2;
                if (style.align === "right") lineX = element.x + TEXT_BOX_PADDING + wrapWidth - lineWidth;
                const lineY = element.y + TEXT_BOX_PADDING + index * lineStep;
                ctx.fillText(line, lineX, lineY);
                if ((style.underline || style.strikethrough) && line) {
                  ctx.save();
                  ctx.strokeStyle = element.color;
                  ctx.lineWidth = Math.max(1, fontPx / 16);
                  if (style.underline) {
                    ctx.beginPath();
                    ctx.moveTo(lineX, lineY + fontPx);
                    ctx.lineTo(lineX + lineWidth, lineY + fontPx);
                    ctx.stroke();
                  }
                  if (style.strikethrough) {
                    ctx.beginPath();
                    ctx.moveTo(lineX, lineY + fontPx * 0.55);
                    ctx.lineTo(lineX + lineWidth, lineY + fontPx * 0.55);
                    ctx.stroke();
                  }
                  ctx.restore();
                }
              });
            }
          }
          break;
      }

      if (selectedElement === element.id) {
        const box = elementBounds(element);
        ctx.save();
        ctx.strokeStyle = "#3B82F6";
        ctx.lineWidth = 1 / camera.zoom;
        ctx.setLineDash([4 / camera.zoom, 3 / camera.zoom]);
        ctx.strokeRect(box.x, box.y, box.width, box.height);
        ctx.restore();
      }
    });
  }, [elements, camera, selectedElement, editingTextId, highlightLayout]);

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
    const elementsCopy = elementsRef.current.map(el => ({ ...el, points: el.points ? [...el.points] : undefined }));
    
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
      x: (el as any).transform?.x ?? el.position?.x ?? 0,
      y: (el as any).transform?.y ?? el.position?.y ?? 0,
      width: (el as any).transform?.width ?? el.size?.width,
      height: (el as any).transform?.height ?? el.size?.height,
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
      fontSize: (el.data as { fontSize?: number } | undefined)?.fontSize,
      fontFamily: (el.data as { fontFamily?: string } | undefined)?.fontFamily,
      bold: (el.data as { bold?: boolean } | undefined)?.bold,
      italic: (el.data as { italic?: boolean } | undefined)?.italic,
      underline: (el.data as { underline?: boolean } | undefined)?.underline,
      strikethrough: (el.data as { strikethrough?: boolean } | undefined)?.strikethrough,
      align: (el.data as { align?: TextStyle["align"] } | undefined)?.align,
      lineHeight: (el.data as { lineHeight?: number } | undefined)?.lineHeight,
    };
  }

  function mapSlideObjectToDrawing(object: SlideObject): DrawingElement {
    const props = (object.props || {}) as Record<string, any>;
    return {
      id: object.id,
      type: object.type,
      x: object.transform.x,
      y: object.transform.y,
      width: object.transform.width,
      height: object.transform.height,
      color: props.color || "#000000",
      strokeWidth: props.strokeWidth || 2,
      text: props.text,
      src: props.src,
      alt: props.alt,
      opacity: props.opacity,
      borderRadius: props.borderRadius,
      shapeType: props.shapeType,
      fillColor: props.fillColor,
      data: props.data,
      symbol: props.symbol,
      rows: props.rows,
      cols: props.cols,
      chartType: props.chartType,
      colors: props.colors,
      fontSize: props.fontSize,
      fontFamily: props.fontFamily,
      bold: props.bold,
      italic: props.italic,
      underline: props.underline,
      strikethrough: props.strikethrough,
      align: props.align,
      lineHeight: props.lineHeight,
    };
  }

  function mapInkStrokeToDrawing(stroke: InkStroke): DrawingElement {
    const first = stroke.points[0] || { x: 0, y: 0 };
    return {
      id: stroke.id,
      type: "pen",
      x: first.x,
      y: first.y,
      points: stroke.points,
      color: stroke.color,
      strokeWidth: stroke.strokeWidth,
    };
  }
  // Helper to map database collaborator to Collaborator
  function mapDatabaseCollaborator(c: DatabaseCollaborator | { id?: string; name?: string; email?: string; avatar_url?: string; permission?: string }): Collaborator {
    return {
      id: (c as DatabaseCollaborator).user?.id || c.id || "",
      name: (c as DatabaseCollaborator).user?.name || c.name || "Unknown",
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

          if (boardError instanceof ApiError && (boardError.status === 401 || boardError.status === 403)) {
            throw boardError;
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

        if (board.viewport) {
          setCamera(applyCamera(board.viewport));
        }
        
        let mappedElements: DrawingElement[] = [];
        try {
          const objects = Array.isArray(board.objects)
            ? board.objects
            : await objectApi.getObjects(currentBoardId);
          const drawings = Array.isArray(board.drawings)
            ? board.drawings
            : await drawingApi.getDrawings(currentBoardId);
          mappedElements = [
            ...drawings.map(mapInkStrokeToDrawing),
            ...objects.map(mapSlideObjectToDrawing),
          ];
        } catch (elementsError: unknown) {
          if (abortController.signal.aborted) return;
          const errorMessage = (elementsError instanceof Error ? elementsError.message : String(elementsError)) || String(elementsError);
          if (errorMessage.includes('404') || errorMessage.includes('not found') || errorMessage.includes('PGRST116')) {
            mappedElements = [];
          } else {
            throw elementsError;
          }
        }
        
        if (abortController.signal.aborted) return;
        
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
        const boardPeople = board as {
          owner?: BoardShareInfo["owner"];
          collaborators?: BoardShareInfo["collaborators"];
          is_public?: boolean;
          permission?: string;
          can_edit?: boolean;
        };
        const loadedShare: BoardShareInfo = {
          owner: boardPeople.owner || {
            id: user.id,
            name: user.name,
            email: user.email,
            permission: "owner",
          },
          collaborators: boardPeople.collaborators || [],
          is_public: Boolean(boardPeople.is_public),
          can_manage: boardPeople.permission === "owner" || boardPeople.permission === "admin",
        };
        setShareInfo(loadedShare);
        setCollaborators(
          loadedShare.collaborators.map((person) => ({
            id: person.id,
            name: person.name,
            color: "#3B82F6",
            cursor: null,
          }))
        );
        boardApi.getCollaborators(currentBoardId).then((info) => {
          setShareInfo(info);
          setCollaborators(
            info.collaborators.map((person) => ({
              id: person.id,
              name: person.name,
              color: "#3B82F6",
              cursor: null,
            }))
          );
        }).catch(() => {});
        const editable = boardPeople.can_edit !== false;
        setCanEdit(editable);
        if (!editable) {
          setCurrentTool("select");
        }
        
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
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          toast({
            title: "Can't open this board",
            description: "It is not available for the current account.",
          });
          onBackToDashboard?.();
          return;
        }
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
      const drawings = socket.boardState.drawings?.length
        ? socket.boardState.drawings.map(mapInkStrokeToDrawing)
        : [];
      const objects = socket.boardState.objects?.length
        ? socket.boardState.objects.map(mapSlideObjectToDrawing)
        : [];
      const serverElements = drawings.length || objects.length
        ? [...drawings, ...objects]
        : socket.boardState.elements.map((el: DatabaseElement) => mapDatabaseElementToDrawingElement(el));
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
    const unsubscribeUndo = socket.onUndoApplied((data: { action: string; elementId?: string; element?: DatabaseElement; previousState?: DatabaseElement; userId: string }) => {
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
    const unsubscribeCleared = socket.onBoardCleared(() => {
      setElements([]);
      setHasUnsavedChanges(false);
    });

    const unsubscribeCursor = socket.onCursorUpdate((data: { socketId: string; userId: string; x: number; y: number; name: string; color: string }) => {
      if (data.userId !== user.id) {
        cursorTargetsRef.current.set(data.socketId, { x: data.x, y: data.y, name: data.name, color: data.color });
        pumpRemoteCursors();
      }
    });

    const unsubscribeUserLeft = socket.onUserLeft((data) => {
      cursorTargetsRef.current.delete(data.socketId);
      pumpRemoteCursors();
    });

    return () => {
      unsubscribeAdded();
      unsubscribeUpdated();
      unsubscribeDeleted();
      unsubscribeUndo();
      unsubscribeCleared();
      unsubscribeCursor();
      unsubscribeUserLeft();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket.isConnected, user.id]);

  useEffect(() => {
    return () => {
      if (cursorRafRef.current) window.cancelAnimationFrame(cursorRafRef.current);
      previewThrottleRef.current.cancel();
    };
  }, []);

  // Helper function to get correct coordinates
  const getLeash = useCallback(() => {
    return contentLeash(boundsFromItems(elements));
  }, [elements]);

  const applyCamera = useCallback((next: BoardViewport) => {
    const container = containerRef.current;
    const viewport = {
      width: container?.clientWidth || window.innerWidth,
      height: container?.clientHeight || window.innerHeight,
    };
    return clampCameraPan({ ...next, zoom: clampZoom(next.zoom) }, viewport, getLeash());
  }, [getLeash]);

  const persistViewport = useCallback((next: BoardViewport) => {
    if (!isValidBoardId(actualBoardId)) return;
    if (cameraSaveTimerRef.current) window.clearTimeout(cameraSaveTimerRef.current);
    cameraSaveTimerRef.current = window.setTimeout(() => {
      if (socket.isConnected) {
        socket.sendViewport(next);
        return;
      }
      boardApi.updateBoard(actualBoardId, { viewport: next }).catch(() => {});
    }, 800);
  }, [actualBoardId, socket.isConnected, socket.sendViewport]);

  const moveElementLocal = useCallback((id: string, x: number, y: number) => {
    const point = clampPointToHardWorld({ x, y });
    elementsRef.current = elementsRef.current.map((element) =>
      element.id === id ? { ...element, x: point.x, y: point.y } : element
    );
    setElements(elementsRef.current);
    setHasUnsavedChanges(true);
    if (socket.isConnected) {
      previewThrottleRef.current.schedule(() => {
        socket.sendDrawingUpdate(id, { x: point.x, y: point.y });
      });
    }
  }, [socket.isConnected, socket.sendDrawingUpdate]);

  const commitElement = useCallback((id: string, extra?: Partial<DrawingElement>) => {
    const current = elementsRef.current.find((element) => element.id === id);
    if (!current) return;
    const next = extra ? { ...current, ...extra } : current;
    if (extra) {
      elementsRef.current = elementsRef.current.map((element) =>
        element.id === id ? next : element
      );
      setElements(elementsRef.current);
    }
    if (socket.isConnected) {
      previewThrottleRef.current.flush();
      socket.sendDrawingUpdate(id, compactElementPatch({
        x: next.x,
        y: next.y,
        ...(extra || {
          width: next.width,
          height: next.height,
          points: next.points,
          text: next.text,
        }),
      } as Record<string, unknown>));
      socket.commitDrawing();
    }
    saveToHistory();
  }, [socket.isConnected, socket.sendDrawingUpdate, socket.commitDrawing, saveToHistory]);

  const getCanvasCoordinates = useCallback((e: { clientX: number; clientY: number }) => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    
    const rect = container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = {
      x: camera.x + screenX / camera.zoom,
      y: camera.y + screenY / camera.zoom,
    };
    return clampPointToRect(world, getLeash());
  }, [camera, getLeash]);

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

  useEffect(() => {
    const container = containerRef.current;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
    };
    container?.addEventListener("wheel", onWheel, { passive: false });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") spacePressedRef.current = true;
      if (e.key === "Shift") shiftPressedRef.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") spacePressedRef.current = false;
      if (e.key === "Shift") shiftPressedRef.current = false;
    };
    const shouldPan = (e: MouseEvent) =>
      e.button === 1 || e.shiftKey || spacePressedRef.current || shiftPressedRef.current;

    const onPointerDownCapture = (e: MouseEvent) => {
      if (!shouldPan(e)) return;
      e.preventDefault();
      e.stopPropagation();
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        cameraX: cameraRef.current.x,
        cameraY: cameraRef.current.y,
      };
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    container?.addEventListener("mousedown", onPointerDownCapture, true);
    return () => {
      container?.removeEventListener("wheel", onWheel);
      container?.removeEventListener("mousedown", onPointerDownCapture, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [loading]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldX = camera.x + screenX / camera.zoom;
    const worldY = camera.y + screenY / camera.zoom;
    const nextZoom = clampZoom(camera.zoom * (e.deltaY > 0 ? 0.9 : 1.1));
    const next = applyCamera({
      zoom: nextZoom,
      x: worldX - screenX / nextZoom,
      y: worldY - screenY / nextZoom,
    });
    setCamera(next);
    persistViewport(next);
  };

  const zoomBy = (factor: number) => {
    const container = containerRef.current;
    const width = container?.clientWidth || window.innerWidth;
    const height = container?.clientHeight || window.innerHeight;
    const centerX = camera.x + width / camera.zoom / 2;
    const centerY = camera.y + height / camera.zoom / 2;
    const nextZoom = clampZoom(camera.zoom * factor);
    const next = applyCamera({
      zoom: nextZoom,
      x: centerX - width / nextZoom / 2,
      y: centerY - height / nextZoom / 2,
    });
    setCamera(next);
    persistViewport(next);
  };

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement> | React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || e.shiftKey || spacePressedRef.current || shiftPressedRef.current || (currentTool === "select" && e.button === 0 && e.altKey)) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY, cameraX: camera.x, cameraY: camera.y };
      return;
    }

    if (isTextMode) return;
    if (!canEdit && currentTool !== "select") {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = getCanvasCoordinates(e);

    if (currentTool === "text") {
      const hit = hitTestElement(elementsRef.current, x, y);
      if (hit?.type === "text") return;
      const clamped = clampPointToHardWorld({ x, y });
      const id = `${Date.now()}-${Math.random()}`;
      const newElement: DrawingElement = {
        id,
        type: "text",
        x: clamped.x,
        y: clamped.y,
        width: DEFAULT_TEXT_BOX_WIDTH,
        height: textBoxMinHeight(textStyle),
        text: "",
        color: currentColor,
        strokeWidth,
        ...textStyle,
      };
      elementsRef.current = [...elementsRef.current, newElement];
      setElements(elementsRef.current);
      creatingTextBoxRef.current = { id, startX: clamped.x, startY: clamped.y };
      return;
    }

    if (currentTool === "select") {
      const hit = hitTestElement(elementsRef.current, x, y);
      if (hit) {
        selectConsumedClickRef.current = true;
        setSelectedElement(hit.id);
        if (hit.type === "text") {
          setTextStyle(styleFromElement(hit));
        }
        movingElementRef.current = {
          id: hit.id,
          startX: x,
          startY: y,
          origX: hit.x,
          origY: hit.y,
        };
        return;
      }
      setSelectedElement(null);
      return;
    }

    // Eraser tool - erase on mouse down
    if (currentTool === "eraser") {
      isDrawingRef.current = true;
      setIsDrawing(true);
      eraseAtPosition(x, y);
      return;
    }

    isDrawingRef.current = true;
    setIsDrawing(true);

    const clamped = clampPointToHardWorld({ x, y });
    const drawingShape = currentTool === "shape";
    const newElement: DrawingElement = {
      id: `${Date.now()}-${Math.random()}`,
      type: drawingShape ? "shape" : currentTool,
      x: clamped.x,
      y: clamped.y,
      color: currentColor,
      strokeWidth,
      points: currentTool === "pen" ? [{ x: clamped.x, y: clamped.y }] : undefined,
      width: currentTool !== "pen" ? 0 : undefined,
      height: currentTool !== "pen" ? 0 : undefined,
      shapeType: drawingShape ? activeShape || "rectangle" : undefined,
      fillColor: drawingShape ? currentColor : undefined,
    };

    setElements((prev) => [...prev, newElement]);
    
    if (socket.isConnected) {
      socket.sendDrawingStart(newElement);
    } else {
      setHasUnsavedChanges(true);
      if (currentTool !== "pen") {
        pendingSaveRef.current.add(newElement.id);
        debouncedSaveToDatabase();
      }
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
            } else {
              handleAsyncError(async () => {
                try {
                  await elementApi.deleteElement(element.id);
                } catch (error) {
                  // Ignore errors - element will be removed from UI anyway
                }
              });
            }
            
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

  useEffect(() => {
    if (!isPanning) return;

    const onMove = (e: MouseEvent) => {
      if (!panStartRef.current) return;
      const current = cameraRef.current;
      const next = applyCamera({
        ...current,
        x: panStartRef.current.cameraX - (e.clientX - panStartRef.current.x) / current.zoom,
        y: panStartRef.current.cameraY - (e.clientY - panStartRef.current.y) / current.zoom,
      });
      setCamera(next);
    };

    const onUp = () => {
      setIsPanning(false);
      panStartRef.current = null;
      persistViewport(cameraRef.current);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isPanning, applyCamera, persistViewport]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement> | React.PointerEvent<HTMLCanvasElement>) => {
    if (isPanning) return;

    if (
      (isDrawingRef.current || movingElementRef.current || creatingTextBoxRef.current) &&
      e.buttons === 0
    ) {
      handleMouseUp();
      return;
    }

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

    const creating = creatingTextBoxRef.current;
    if (creating) {
      elementsRef.current = elementsRef.current.map((element) =>
        element.id === creating.id
          ? { ...element, width: x - creating.startX, height: y - creating.startY }
          : element
      );
      setElements(elementsRef.current);
      return;
    }

    const moving = movingElementRef.current;
    if (moving) {
      moveElementLocal(moving.id, moving.origX + (x - moving.startX), moving.origY + (y - moving.startY));
      return;
    }

    if (!isDrawing || isTextMode || currentTool === "select") return;

    setElements((prev) => {
      const newElements = [...prev];
      const currentElement = newElements[newElements.length - 1];
      if (!currentElement) return prev;

      if (currentTool === "pen") {
        currentElement.points = [...(currentElement.points || []), { x, y }];
      } else {
        currentElement.width = (x - currentElement.x);
        currentElement.height = (y - currentElement.y);
      }
      elementsRef.current = newElements;
      return newElements;
    });

    if (socket.isConnected) {
      const currentElement = elementsRef.current[elementsRef.current.length - 1];
      if (!currentElement) return;
      if (currentTool === "pen") {
        const points = currentElement.points;
        previewThrottleRef.current.schedule(() => {
          socket.sendDrawingUpdate(currentElement.id, { points });
        });
      } else {
        previewThrottleRef.current.schedule(() => {
          socket.sendDrawingUpdate(currentElement.id, {
            width: currentElement.width,
            height: currentElement.height,
          });
        });
      }
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
      persistViewport(camera);
    }
    const creating = creatingTextBoxRef.current;
    if (creating) {
      creatingTextBoxRef.current = null;
      const current = elementsRef.current.find((element) => element.id === creating.id);
      if (current) {
        let nextX = current.x;
        let nextY = current.y;
        let nextWidth = current.width || 0;
        let nextHeight = current.height || 0;
        if (nextWidth < 0) {
          nextX += nextWidth;
          nextWidth = -nextWidth;
        }
        if (nextHeight < 0) {
          nextY += nextHeight;
          nextHeight = -nextHeight;
        }
        if (nextWidth < MIN_TEXT_BOX_WIDTH) nextWidth = DEFAULT_TEXT_BOX_WIDTH;
        if (nextHeight < MIN_TEXT_BOX_HEIGHT) nextHeight = textBoxMinHeight(textStyle);
        const next = { ...current, x: nextX, y: nextY, width: nextWidth, height: nextHeight };
        elementsRef.current = elementsRef.current.map((element) =>
          element.id === creating.id ? next : element
        );
        setElements(elementsRef.current);
        if (socket.isConnected) {
          socket.sendDrawingStart(next);
        }
        setEditingTextId(next.id);
        setSelectedElement(next.id);
        setTextInput(next.text || "");
        editingSnapshotRef.current = next.text || "";
        setIsTextMode(true);
        justCreatedTextRef.current = true;
      }
      return;
    }

    const moving = movingElementRef.current;
    if (moving) {
      commitElement(moving.id);
      movingElementRef.current = null;
    }
    const wasDrawing = isDrawingRef.current;
    isDrawingRef.current = false;
    if (wasDrawing) setIsDrawing(false);
    if (wasDrawing && currentTool !== "select") {
      const lastElement = elementsRef.current[elementsRef.current.length - 1];
      if (lastElement) {
        const boxed =
          lastElement.type === "shape" || lastElement.type === "rectangle" || lastElement.type === "circle"
            ? normalizeElementBox(lastElement)
            : lastElement;
        if (boxed !== lastElement) {
          elementsRef.current = elementsRef.current.map((element) =>
            element.id === boxed.id ? boxed : element
          );
          setElements(elementsRef.current);
        }
        if (isValidElement(boxed)) {
          commitElement(boxed.id, boxed !== lastElement ? boxed : undefined);
        } else {
          elementsRef.current = elementsRef.current.filter((element) => element.id !== lastElement.id);
          setElements(elementsRef.current);
          if (socket.isConnected) {
            socket.sendElementDelete(lastElement.id);
          }
        }
      }
    }
    
    // Clear eraser position when mouse is released (optional - comment out if you want it to persist)
    // if (currentTool === "eraser") {
    //   setEraserPosition(null);
    // }
  };

  const handleMouseUpRef = useRef(handleMouseUp);
  handleMouseUpRef.current = handleMouseUp;

  useEffect(() => {
    const endStroke = () => handleMouseUpRef.current();
    window.addEventListener("mouseup", endStroke);
    window.addEventListener("pointerup", endStroke);
    window.addEventListener("blur", endStroke);
    return () => {
      window.removeEventListener("mouseup", endStroke);
      window.removeEventListener("pointerup", endStroke);
      window.removeEventListener("blur", endStroke);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button === 0 || e.button === 1) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // jsdom and some browsers do not implement capture
      }
    }
    handleMouseDown(e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (typeof e.currentTarget.hasPointerCapture === "function" && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    handleMouseUp();
  };

  const measureTextBlock = (text: string, style: TextStyle, wrapWidth = TEXT_WRAP_WIDTH) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const fontPx = style.fontSize;
    const lineStep = fontPx * style.lineHeight;
    if (!ctx) {
      const lines = wrapPlainText(text, (value) => value.length * fontPx * 0.5, wrapWidth);
      return {
        width: wrapWidth,
        height: lines.length * lineStep,
      };
    }
    ctx.save();
    ctx.font = cssFont(style);
    const lines = wrapPlainText(text, (value) => ctx.measureText(value).width, wrapWidth);
    const width = Math.min(
      wrapWidth,
      Math.max(fontPx, ...lines.map((line) => ctx.measureText(line).width))
    );
    ctx.restore();
    return {
      width,
      height: Math.max(lineStep, lines.length * lineStep),
    };
  };

  const measureTextBox = (text: string, style: TextStyle, boxWidth: number) => {
    const content = measureTextBlock(text, style, textBoxContentWidth(boxWidth));
    return {
      width: boxWidth,
      height: Math.max(textBoxMinHeight(style), content.height + TEXT_BOX_PADDING * 2),
    };
  };

  const selectedText = elements.find(
    (element) => element.id === (editingTextId || selectedElement) && element.type === "text"
  );
  const editingText = elements.find((element) => element.id === editingTextId && element.type === "text");
  const showTextStyle = currentTool === "text" || isTextMode || Boolean(selectedText);

  const beginTextEdit = (hit: DrawingElement) => {
    setEditingTextId(hit.id);
    setSelectedElement(hit.id);
    setTextStyle(styleFromElement(hit));
    setTextInput(hit.text || "");
    editingSnapshotRef.current = hit.text || "";
    setIsTextMode(true);
    setCurrentTool("text");
    if (hit.color) setCurrentColor(hit.color);
  };

  const applyTextStyle = (next: TextStyle) => {
    setTextStyle(next);
    const targetId = editingTextId || selectedText?.id;
    if (!targetId) return;
    const current = elementsRef.current.find((element) => element.id === targetId);
    if (!current) return;
    const boxWidth = current.width || DEFAULT_TEXT_BOX_WIDTH;
    const size = measureTextBox(isTextMode ? textInput : current.text || "", next, boxWidth);
    const extra = {
      ...next,
      width: boxWidth,
      height: Math.max(current.height || 0, size.height),
    };
    if (isTextMode) {
      elementsRef.current = elementsRef.current.map((element) =>
        element.id === targetId ? { ...element, ...extra } : element
      );
      setElements(elementsRef.current);
      return;
    }
    commitElement(targetId, extra);
  };

  const applyColor = useCallback((nextColor: string) => {
    const next = normalizeHex(nextColor) || nextColor;
    setCurrentColor(next);
    const targetId = editingTextId || selectedElement;
    if (!targetId) return;
    const current = elementsRef.current.find((element) => element.id === targetId);
    if (!current) return;
    if (isTextMode) {
      elementsRef.current = elementsRef.current.map((element) =>
        element.id === targetId ? { ...element, color: next } : element
      );
      setElements(elementsRef.current);
      return;
    }
    if (current.type === "shape") {
      commitElement(targetId, { color: next, fillColor: next });
      return;
    }
    commitElement(targetId, { color: next });
  }, [commitElement, editingTextId, isTextMode, selectedElement]);

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canEdit) return;
    const { x, y } = getCanvasCoordinates(e);
    const hit = hitTestElement(elementsRef.current, x, y);
    if (hit?.type !== "text") return;
    beginTextEdit(hit);
  };

  // Canvas click for text tool and selection
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (justCreatedTextRef.current) {
      justCreatedTextRef.current = false;
      return;
    }
    if (!canEdit && currentTool === "text") return;
    if (currentTool === "text" && !isTextMode) {
      const { x, y } = getCanvasCoordinates(e);
      const hit = hitTestElement(elementsRef.current, x, y);
      if (hit?.type === "text") {
        beginTextEdit(hit);
      }
    } else if (currentTool === "select") {
      if (selectConsumedClickRef.current) {
        selectConsumedClickRef.current = false;
        return;
      }
      setSelectedElement(null);
    }
  };

  // Add text to canvas
  const finishTextEdit = () => {
    if (committingTextRef.current) return;
    committingTextRef.current = true;
    const id = editingTextId;
    if (id) {
      const current = elementsRef.current.find((element) => element.id === id);
      if (current) {
        const boxWidth = current.width || DEFAULT_TEXT_BOX_WIDTH;
        const size = measureTextBox(textInput, textStyle, boxWidth);
        commitElement(id, {
          text: textInput,
          color: currentColor,
          strokeWidth,
          width: boxWidth,
          height: Math.max(current.height || 0, size.height),
          ...textStyle,
        });
        setSelectedElement(id);
      }
    }
    setIsTextMode(false);
    setTextInput("");
    setEditingTextId(null);
    committingTextRef.current = false;
  };

  const cancelTextEdit = () => {
    if (editingTextId) {
      elementsRef.current = elementsRef.current.map((element) =>
        element.id === editingTextId ? { ...element, text: editingSnapshotRef.current } : element
      );
      setElements(elementsRef.current);
      setSelectedElement(editingTextId);
    }
    setIsTextMode(false);
    setTextInput("");
    setEditingTextId(null);
  };

  const addText = finishTextEdit;

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
      if (socket.isConnected) {
        socket.clearBoard();
      }
      
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

      if (socket.isConnected) {
        socket.flushBoard();
        if (boardTitle.trim()) {
          await boardApi.updateBoard(actualBoardId, { title: boardTitle.trim() }).catch(() => {});
        }
        pendingSaveRef.current.clear();
        setHasUnsavedChanges(false);
        toast({
          title: "Board saved!",
          description: "Live board flushed to storage.",
        });
        return;
      }
      
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
    if (!canEdit) return;
    const host = containerRef.current || canvasRef.current;
    if (!host) return;

    const rect = host.getBoundingClientRect();
    const cam = cameraRef.current;
    const centerX = cam.x + rect.width / cam.zoom / 2;
    const centerY = cam.y + rect.height / cam.zoom / 2;

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
        setActiveShape(validated.type === "arrow" ? "rightArrow" : String(validated.type));
        setCurrentTool("shape");
        currentToolRef.current = "shape";
        return;

      case "table":
        validated = validateAndToast(insertTableSchema, data, "Table");
        if (!validated) return;
        const tableRows = Number(validated.rows);
        const tableCols = Number(validated.cols);
        newElement = {
          id: Date.now().toString(),
          type: "table",
          x: centerX - 150,
          y: centerY - 100,
          width: 300,
          height: 200,
          rows: tableRows,
          cols: tableCols,
          data: Array.from({ length: tableRows }, () =>
            Array.from({ length: tableCols }, () => "")
          ),
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
        setCurrentTool("select");
        currentToolRef.current = "select";
        if (templateElements[0]) setSelectedElement(templateElements[0].id);
        if (socket.isConnected) {
          templateElements.forEach((element) => socket.sendDrawingStart(element));
          socket.commitDrawing();
        }
        return;

      default:
        return;
    }

    setElements(prev => [...prev, newElement]);
    saveToHistory();
    setCurrentTool("select");
    currentToolRef.current = "select";
    setSelectedElement(newElement.id);
    if (socket.isConnected) {
      socket.sendDrawingStart(newElement);
      socket.commitDrawing();
    }
  };

  const addBoardElements = useCallback((items: DrawingElement[]) => {
    if (!items.length) return;
    elementsRef.current = [...elementsRef.current, ...items];
    setElements(elementsRef.current);
    setHasUnsavedChanges(true);
    saveToHistory();
    if (currentToolRef.current === "select") {
      setSelectedElement(items[items.length - 1].id);
    }
    if (socket.isConnected) {
      items.forEach((element) => socket.sendDrawingStart(element));
      socket.commitDrawing();
    }
  }, [saveToHistory, socket]);

  const viewportCenterWorld = () => {
    const container = containerRef.current;
    const width = container?.clientWidth || 800;
    const height = container?.clientHeight || 600;
    const cam = cameraRef.current;
    return { x: cam.x + width / cam.zoom / 2, y: cam.y + height / cam.zoom / 2 };
  };

  const clientToWorld = (clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return viewportCenterWorld();
    const rect = container.getBoundingClientRect();
    const cam = cameraRef.current;
    return {
      x: cam.x + (clientX - rect.left) / cam.zoom,
      y: cam.y + (clientY - rect.top) / cam.zoom,
    };
  };

  const addImagesAt = async (files: File[], x: number, y: number) => {
    let offset = 0;
    for (const file of files.filter(isImageFile)) {
      try {
        const read = await readImageFile(file);
        const size = fitImageSize(read.width, read.height);
        addBoardElements([
          {
            id: newElementId(),
            type: "image",
            x: x - size.width / 2 + offset,
            y: y - size.height / 2 + offset,
            width: size.width,
            height: size.height,
            src: read.src,
            alt: read.name,
            color: currentColorRef.current,
            strokeWidth: 1,
            opacity: 1,
            borderRadius: 0,
          },
        ]);
        offset += PASTE_OFFSET;
      } catch {
        toast({ title: "Could not add image", description: file.name, variant: "destructive" });
      }
    }
  };

  const copySelected = (event?: ClipboardEvent) => {
    if (isTextModeRef.current || isTypingTarget(event?.target ?? document.activeElement)) return false;
    const current = elementsRef.current.find((element) => element.id === selectedElementRef.current);
    if (!current) return false;
    clipboardRef.current = [current];
    pasteCountRef.current = 0;
    event?.clipboardData?.setData("text/plain", serializeElements([current]));
    event?.preventDefault();
    return true;
  };

  const pasteElements = (event?: ClipboardEvent) => {
    if (!canEditRef.current) return false;
    if (isTextModeRef.current || isTypingTarget(event?.target ?? document.activeElement)) return false;

    const files = event?.clipboardData?.files
      ? Array.from(event.clipboardData.files).filter(isImageFile)
      : [];
    if (files.length) {
      event?.preventDefault();
      const center = viewportCenterWorld();
      void addImagesAt(files, center.x, center.y);
      return true;
    }

    const parsed = parseClipboardText(event?.clipboardData?.getData("text/plain"));
    const source = parsed?.length ? toDrawingElements(parsed) : clipboardRef.current;
    if (!source.length) return false;
    event?.preventDefault();
    pasteCountRef.current += 1;
    addBoardElements(cloneElements(source, PASTE_OFFSET * pasteCountRef.current));
    clipboardRef.current = source;
    return true;
  };

  const copySelectedRef = useRef(copySelected);
  const pasteElementsRef = useRef(pasteElements);
  copySelectedRef.current = copySelected;
  pasteElementsRef.current = pasteElements;

  useEffect(() => {
    const onCopy = (event: ClipboardEvent) => {
      copySelectedRef.current(event);
    };
    const onPaste = (event: ClipboardEvent) => {
      pasteElementsRef.current(event);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || isTypingTarget(event.target) || isTextModeRef.current) return;
      if (event.key.toLowerCase() === "c") copySelectedRef.current();
    };
    window.addEventListener("copy", onCopy);
    window.addEventListener("paste", onPaste);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("copy", onCopy);
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const handleCanvasDragEnter = (event: React.DragEvent) => {
    if (!canEdit || !dataTransferHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDragOver(true);
  };

  const handleCanvasDragOver = (event: React.DragEvent) => {
    if (!canEdit || !dataTransferHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleCanvasDragLeave = () => {
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDragOver(false);
    }
  };

  const handleCanvasDrop = (event: React.DragEvent) => {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDragOver(false);
    if (!canEdit) return;
    const files = Array.from(event.dataTransfer.files || []).filter(isImageFile);
    if (!files.length) return;
    const point = clientToWorld(event.clientX, event.clientY);
    void addImagesAt(files, point.x, point.y);
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

      case "comparison":
        elements.push(
          {
            id: Date.now().toString() + "-title",
            type: "text",
            x: centerX - 100,
            y: centerY - 90,
            text: "Comparison",
            color: "#000000",
            strokeWidth: 3,
          },
          {
            id: Date.now().toString() + "-left",
            type: "text",
            x: centerX - 140,
            y: centerY - 20,
            text: "Option A",
            color: "#333333",
            strokeWidth: 2,
          },
          {
            id: Date.now().toString() + "-right",
            type: "text",
            x: centerX + 40,
            y: centerY - 20,
            text: "Option B",
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
    const selected = elementsRef.current.find((element) => element.id === elementId);
    if (selected?.type === "text") {
      setTextStyle(styleFromElement(selected));
    }
    if (selected?.color) setCurrentColor(selected.color);
  };

  // Handle element update
  const handleElementUpdate = (elementId: string, updates: Partial<DrawingElement>) => {
    setUpdateError(null);
    setHasUnsavedChanges(true);
    commitElement(elementId, updates);
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
      } else {
        try {
          await elementApi.deleteElement(elementId);
        } catch (error) {
        }
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (!canEditRef.current) return;
      if (isTextModeRef.current || isTypingTarget(event.target)) return;
      const id = selectedElementRef.current;
      if (!id) return;
      event.preventDefault();
      void handleElementDelete(id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleElementDelete]);

  // Add error state UI
  if (error && !loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50 gap-3">
        <RetryButton
          error={error}
          onRetry={() => window.location.reload()}
          isLoading={loading}
        />
        {onBackToDashboard && (
          <Button variant="outline" onClick={onBackToDashboard}>
            Back to boards
          </Button>
        )}
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
              onClick={() => canEdit && setCurrentTool("pen")}
              disabled={!canEdit}
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
              onClick={() => canEdit && setCurrentTool("rectangle")}
              disabled={!canEdit}
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
              onClick={() => canEdit && setCurrentTool("circle")}
              disabled={!canEdit}
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
              onClick={() => canEdit && setCurrentTool("text")}
              disabled={!canEdit}
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
              onClick={() => canEdit && setCurrentTool("eraser")}
              disabled={!canEdit}
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
        {canEdit && <InsertPanel onInsert={handleInsert} />}
        {activeShape && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={currentTool === "shape" ? "default" : "ghost"}
                size="icon"
                onClick={() => canEdit && setCurrentTool("shape")}
                disabled={!canEdit}
                aria-label={`${getShape(activeShape).name} tool`}
                tabIndex={0}
                className="focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <ShapeGraphic
                  type={activeShape}
                  fill={currentColor}
                  stroke={currentColor === "#FFFFFF" ? "#111827" : currentColor}
                  strokeWidth={1.5}
                  className="h-5 w-5"
                  title={getShape(activeShape).name}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{getShape(activeShape).name}</TooltipContent>
          </Tooltip>
        )}
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
          <ColorPicker
            color={currentColor}
            onChange={applyColor}
            disabled={!canEdit}
            side="right"
          />
        </div>
      </div>
      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
          <div className="flex items-center space-x-4 flex-1">
            <div className="flex items-center space-x-1 mr-2">
              <Button variant="ghost" size="icon" onClick={() => zoomBy(0.9)} aria-label="Zoom out">
                <Minus className="h-4 w-4" />
              </Button>
              <span className="text-xs w-12 text-center">{Math.round(camera.zoom * 100)}%</span>
              <Button variant="ghost" size="icon" onClick={() => zoomBy(1.1)} aria-label="Zoom in">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
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
            {!canEdit && <Badge variant="outline">View only</Badge>}
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
          <div className="shrink-0 flex items-center gap-2 pl-3 border-l border-gray-200" aria-label="Collaborator list">
            <button
              type="button"
              className="flex items-center gap-2 text-left hover:bg-gray-50 rounded-md px-2 py-1"
              onClick={() => setShowShareModal(true)}
            >
              <div className="flex -space-x-2">
                {(shareInfo
                  ? [shareInfo.owner, ...shareInfo.collaborators].filter(Boolean)
                  : [{ id: user.id, name: user.name }]
                ).slice(0, 5).map((person) => (
                  <Avatar key={person!.id} className="h-8 w-8 border-2 border-white">
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${person!.name}`} />
                    <AvatarFallback className="text-xs">{person!.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <div className="hidden md:block min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate max-w-[160px]">
                  {(shareInfo
                    ? [shareInfo.owner?.name, ...shareInfo.collaborators.map((person) => person.name)].filter(Boolean)
                    : [user.name]
                  ).join(", ")}
                </p>
                <p className="text-xs text-gray-500">
                  {(shareInfo ? 1 + shareInfo.collaborators.length : 1)} people · View list
                </p>
              </div>
            </button>
          </div>
        </div>
        {showTextStyle && (
          <TextStylePanel
            style={textStyle}
            color={currentColor}
            onColorChange={applyColor}
            onChange={applyTextStyle}
            highlightLayout={highlightLayout}
            onToggleHighlightLayout={() => setHighlightLayout((value) => !value)}
          />
        )}
        {/* Canvas Container */}
        <div
          ref={containerRef}
          className="relative flex-1 overflow-hidden bg-white"
          aria-label="Whiteboard canvas area"
          onWheel={handleWheel}
          onDragEnter={handleCanvasDragEnter}
          onDragOver={handleCanvasDragOver}
          onDragLeave={handleCanvasDragLeave}
          onDrop={handleCanvasDrop}
        >
          {isDragOver && (
            <div
              className="pointer-events-none absolute inset-3 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-blue-400 bg-blue-50/70"
              aria-label="Drop image to add"
            >
              <p className="text-sm font-medium text-blue-700">Drop image to add it</p>
            </div>
          )}
          {/* Drawing Canvas */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full bg-transparent"
            style={{
              ...cursorStyle,
              cursor: isPanning || spacePressedRef.current || shiftPressedRef.current ? "grab" : cursorStyle.cursor,
              zIndex: currentTool === "select" || isTextMode ? 1 : 4,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handleMouseMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onMouseLeave={() => {
              setEraserPosition(null);
            }}
            onClick={handleCanvasClick}
            onDoubleClick={handleCanvasDoubleClick}
            role="region"
            aria-label="Drawing canvas"
            tabIndex={0}
          />
          
          {/* Slide objects — world layer, no page border */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              transform: `translate(${-camera.x * camera.zoom}px, ${-camera.y * camera.zoom}px) scale(${camera.zoom})`,
              transformOrigin: "0 0",
              zIndex: currentTool === "select" || isTextMode ? 4 : 1,
            }}
          >
          <div
            className={currentTool === "select" ? "pointer-events-auto" : "pointer-events-none"}
            data-testid="overlay-objects"
            data-interactive={currentTool === "select" ? "true" : "false"}
          >
          {elements
            .filter(element => ["image", "shape", "table", "chart", "icon"].includes(element.type))
            .map((element) => {
              const isSelected = selectedElement === element.id;
              const interactive = currentTool === "select";
              
              switch (element.type) {
                case "image":
                  return (
                    <ImageElement
                      key={element.id}
                      element={element}
                      isSelected={isSelected}
                      interactive={interactive}
                      zoom={camera.zoom}
                      onSelect={() => handleElementSelect(element.id)}
                      onUpdate={(updates) => handleElementUpdate(element.id, updates)}
                      onDelete={() => handleElementDelete(element.id)}
                      onMove={(x, y) => moveElementLocal(element.id, x, y)}
                      onDragEnd={() => commitElement(element.id)}
                      onResize={(width, height) => handleElementUpdate(element.id, { width, height })}
                    />
                  );
                case "shape":
                  return (
                    <ShapeElement
                      key={element.id}
                      element={element}
                      isSelected={isSelected}
                      interactive={interactive}
                      zoom={camera.zoom}
                      onSelect={() => handleElementSelect(element.id)}
                      onUpdate={(updates) => handleElementUpdate(element.id, updates)}
                      onDelete={() => handleElementDelete(element.id)}
                      onMove={(x, y) => moveElementLocal(element.id, x, y)}
                      onDragEnd={() => commitElement(element.id)}
                      onResize={(width, height) => handleElementUpdate(element.id, { width, height })}
                    />
                  );
                case "table":
                  return (
                    <TableElement
                      key={element.id}
                      element={element}
                      isSelected={isSelected}
                      interactive={interactive}
                      zoom={camera.zoom}
                      onSelect={() => handleElementSelect(element.id)}
                      onUpdate={(updates) => handleElementUpdate(element.id, updates)}
                      onDelete={() => handleElementDelete(element.id)}
                      onMove={(x, y) => moveElementLocal(element.id, x, y)}
                      onDragEnd={() => commitElement(element.id)}
                      onResize={(width, height) => handleElementUpdate(element.id, { width, height })}
                    />
                  );
                case "chart":
                  return (
                    <ChartElement
                      key={element.id}
                      element={element}
                      isSelected={isSelected}
                      interactive={interactive}
                      zoom={camera.zoom}
                      onSelect={() => handleElementSelect(element.id)}
                      onUpdate={(updates) => handleElementUpdate(element.id, updates)}
                      onDelete={() => handleElementDelete(element.id)}
                      onMove={(x, y) => moveElementLocal(element.id, x, y)}
                      onDragEnd={() => commitElement(element.id)}
                      onResize={(width, height) => handleElementUpdate(element.id, { width, height })}
                    />
                  );
                case "icon":
                  return (
                    <IconElement
                      key={element.id}
                      element={element}
                      isSelected={isSelected}
                      interactive={interactive}
                      zoom={camera.zoom}
                      onSelect={() => handleElementSelect(element.id)}
                      onUpdate={(updates) => handleElementUpdate(element.id, updates)}
                      onDelete={() => handleElementDelete(element.id)}
                      onMove={(x, y) => moveElementLocal(element.id, x, y)}
                      onDragEnd={() => commitElement(element.id)}
                      onResize={(width, height) => handleElementUpdate(element.id, { width, height })}
                    />
                  );
                default:
                  return null;
              }
            })}
          </div>
          <div className="pointer-events-auto">
          {isTextMode && editingText && (
            <TextBoxEditor
              x={editingText.x}
              y={editingText.y}
              width={editingText.width || DEFAULT_TEXT_BOX_WIDTH}
              height={editingText.height || textBoxMinHeight(textStyle)}
              value={textInput}
              style={textStyle}
              color={currentColor}
              zoom={camera.zoom}
              highlightLayout={highlightLayout}
              onChange={(value) => {
                setTextInput(value);
                elementsRef.current = elementsRef.current.map((element) =>
                  element.id === editingText.id ? { ...element, text: value } : element
                );
                setElements(elementsRef.current);
              }}
              onCommit={finishTextEdit}
              onCancel={cancelTextEdit}
              onResize={(width, height) => {
                elementsRef.current = elementsRef.current.map((element) =>
                  element.id === editingText.id ? { ...element, width, height } : element
                );
                setElements(elementsRef.current);
              }}
              onResizeEnd={() => commitElement(editingText.id)}
            />
          )}
          {!isTextMode && selectedText && (
            <TextBoxHandles
              x={selectedText.x}
              y={selectedText.y}
              width={selectedText.width || DEFAULT_TEXT_BOX_WIDTH}
              height={selectedText.height || textBoxMinHeight(styleFromElement(selectedText))}
              zoom={camera.zoom}
              highlightLayout={highlightLayout}
              onResize={(width, height) => {
                elementsRef.current = elementsRef.current.map((element) =>
                  element.id === selectedText.id ? { ...element, width, height } : element
                );
                setElements(elementsRef.current);
              }}
              onResizeEnd={() => commitElement(selectedText.id)}
            />
          )}
          </div>
          </div>
          
          {/* Eraser Preview */}
          {currentTool === "eraser" && eraserPosition && (
            <div
              className="absolute pointer-events-none z-20"
              style={{
                left: (eraserPosition.x - camera.x) * camera.zoom,
                top: (eraserPosition.y - camera.y) * camera.zoom,
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
                left: (cursor.x - camera.x) * camera.zoom,
                top: (cursor.y - camera.y) * camera.zoom,
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
        </div>
      </div>
      {/* Share Modal */}
      <ShareModal
        open={showShareModal}
        onOpenChange={setShowShareModal}
        boardTitle={boardTitle}
        boardId={actualBoardId}
        currentUser={{ id: user.id, name: user.name, email: user.email }}
        onShareChange={(info) => {
          if (!info) return;
          setShareInfo((current) => ({
            owner: info.owner,
            collaborators: info.collaborators,
            is_public: current?.is_public ?? false,
            can_manage: current?.can_manage ?? true,
          }));
          setCollaborators(
            info.collaborators.map((person) => ({
              id: person.id,
              name: person.name,
              color: "#3B82F6",
              cursor: null,
            }))
          );
        }}
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
