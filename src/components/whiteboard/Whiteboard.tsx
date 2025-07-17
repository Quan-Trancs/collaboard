import React, { useRef, useEffect, useState, useCallback } from "react";
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
  Palette,
  Minus,
  Plus,
  Move,
} from "lucide-react";
import ShareModal from "./ShareModal";
import InsertPanel from "./InsertPanel";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ImageElement, ShapeElement, TableElement, ChartElement, IconElement } from "./InsertableElements";
import { elementApi, boardApi, realtimeApi } from "@/lib/api";
import { ErrorHandler, handleAsyncError } from "@/lib/errorHandler";
import {
  createElementSchema,
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
  const { toast } = useToast();
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [clearError, setClearError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const colors = [
    "#000000",
    "#EF4444",
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#8B5CF6",
    "#EC4899",
    "#6B7280",
  ];

  const strokeWidths = [1, 2, 4, 8];

  // Initialize canvas
  useEffect(() => {
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
      redrawCanvas();
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);

    return () => window.removeEventListener("resize", updateCanvasSize);
  }, []);

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

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Save to history
  const saveToHistory = useCallback(() => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...elements]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [elements, history, historyIndex]);

  // Helper to map Supabase element to DrawingElement
  function mapSupabaseElementToDrawingElement(el: any): DrawingElement {
    return {
      id: el.id,
      type: el.type,
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
  // Helper to map Supabase collaborator to Collaborator
  function mapSupabaseCollaborator(c: any): Collaborator {
    return {
      id: c.user?.id || c.id || "",
      name: c.user?.name || c.name || "Unknown",
      color: "#3B82F6",
      cursor: null,
    };
  }

  // Fetch elements and collaborators from Supabase
  useEffect(() => {
    let unsubscribeElements: any;
    let unsubscribeCollaborators: any;
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch elements
        const supabaseElements = await elementApi.getElements(boardId);
        const mappedElements: DrawingElement[] = (supabaseElements || []).map(mapSupabaseElementToDrawingElement);
        setElements(mappedElements);
        // Fetch collaborators
        const board = await boardApi.getBoard(boardId);
        const collaboratorsArray = (board && Array.isArray((board as any).collaborators)) ? (board as any).collaborators : [];
        const mappedCollaborators: Collaborator[] = collaboratorsArray.map(mapSupabaseCollaborator);
        setCollaborators(mappedCollaborators);
        // Subscribe to real-time updates
        unsubscribeElements = realtimeApi.subscribeToBoard(boardId, async () => {
          try {
            const updatedElements = await elementApi.getElements(boardId);
            setElements((updatedElements || []).map(mapSupabaseElementToDrawingElement));
          } catch (error) {
            const appError = ErrorHandler.createError(error, "Real-time board updates");
            ErrorHandler.logError(appError, "Real-time board updates");
            toast(ErrorHandler.getToastConfig(appError));
          }
        });
        unsubscribeCollaborators = realtimeApi.subscribeToCollaborators(boardId, async () => {
          try {
            const board = await boardApi.getBoard(boardId);
            const collaboratorsArray = (board && Array.isArray((board as any).collaborators)) ? (board as any).collaborators : [];
            setCollaborators(collaboratorsArray.map(mapSupabaseCollaborator));
          } catch (error) {
            const appError = ErrorHandler.createError(error, "Real-time collaborator updates");
            ErrorHandler.logError(appError, "Real-time collaborator updates");
            toast(ErrorHandler.getToastConfig(appError));
          }
        });
        setError(null);
      } catch (error) {
        const appError = ErrorHandler.createError(error, "Loading board data");
        ErrorHandler.logError(appError, "Loading board data");
        toast(ErrorHandler.getToastConfig(appError));
        setError(appError.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    return () => {
      if (unsubscribeElements) unsubscribeElements.unsubscribe();
      if (unsubscribeCollaborators) unsubscribeCollaborators.unsubscribe();
    };
  }, [boardId, toast]);

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isTextMode || currentTool === "select") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);

    const newElement: DrawingElement = {
      id: Date.now().toString(),
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
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || isTextMode || currentTool === "select") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setElements((prev) => {
      const newElements = [...prev];
      const currentElement = newElements[newElements.length - 1];

      if (currentTool === "pen") {
        currentElement.points = [...(currentElement.points || []), { x, y }];
      } else {
        currentElement.width = x - currentElement.x;
        currentElement.height = y - currentElement.y;
      }

      return newElements;
    });
  };

  const handleMouseUp = () => {
    if (isDrawing && currentTool !== "select") {
      setIsDrawing(false);
      saveToHistory();
    }
  };

  // Canvas click for text tool and selection
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (currentTool === "text" && !isTextMode) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

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
        const elementPayload = {
          board_id: boardId,
          type: mapElementTypeToApi("text"),
          data: { text: textInput, color: currentColor, strokeWidth },
          position: { x: textPosition.x, y: textPosition.y },
        };
        const validated = validateAndToast(createElementApiSchema, elementPayload, "Element");
        if (!validated) {
          setSaving(false);
          return;
        }
        const newElement = await elementApi.createElement(validated);
        setElements((prev) => [...prev, mapSupabaseElementToDrawingElement(newElement)]);
        saveToHistory();
        
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

  // Undo/Redo
  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setElements(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setElements(history[historyIndex + 1]);
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

  // Save board
  const saveBoard = async () => {
    try {
      setSaving(true);
      setSaveError(null);
      // In a real app, this would save to a backend
      console.log("Saving board:", { boardId, elements });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 100));
      toast({
        title: "Board saved!",
        description: "Your whiteboard has been saved successfully.",
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
  const handleInsert = (type: string, data: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    let newElement: DrawingElement;
    let validated: any;

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
          src: validated.src,
          alt: validated.name,
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
          shapeType: validated.type,
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
          rows: validated.rows,
          cols: validated.cols,
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
          chartType: validated.type, // Keep chartType for chart-specific data
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
          symbol: validated.symbol,
          color: currentColor,
          strokeWidth: 1,
        };
        break;

      case "template":
        // Handle template insertion
        validated = validateAndToast(insertTemplateSchema, data, "Template");
        if (!validated) return;
        const templateElements = getTemplateElements(validated.type, centerX, centerY);
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
  const handleElementUpdate = async (elementId: string, updates: any) => {
    try {
      setSaving(true);
      setUpdateError(null);
      const validated = validateAndToast(updateElementSchema, updates, "Element Update");
      if (!validated) {
        setSaving(false);
        return;
      }
      const updated = await elementApi.updateElement(elementId, validated);
      setElements(prev => prev.map(element => 
        element.id === elementId ? mapSupabaseElementToDrawingElement(updated) : element
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
      await elementApi.deleteElement(elementId);
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
      {/* Sidebar Toolbar */}
      <div className="w-16 bg-white border-r border-gray-200 flex flex-col items-center py-4 space-y-2" aria-label="Whiteboard toolbar">
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
        {/* Colors */}
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
      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-semibold text-gray-900">
              Untitled Board
            </h1>
            <Badge variant="secondary">
              {saving ? "Saving..." : "Saved"}
            </Badge>
            {loading && (
              <Badge variant="outline" className="animate-pulse">
                Loading...
              </Badge>
            )}
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
        <div className="relative flex-1" aria-label="Whiteboard canvas area">
          {/* Drawing Canvas */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full cursor-crosshair bg-white"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={handleCanvasClick}
            style={{
              cursor:
                currentTool === "select"
                  ? "default"
                  : currentTool === "eraser"
                  ? "grab"
                  : currentTool === "text"
                    ? "text"
                    : "crosshair",
            }}
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
          
          {/* Collaborator Cursors */}
          {collaborators.map(
            (collaborator) =>
              collaborator.cursor && (
                <div
                  key={collaborator.id}
                  className="absolute pointer-events-none z-10"
                  style={{
                    left: collaborator.cursor.x,
                    top: collaborator.cursor.y,
                    transform: "translate(-2px, -2px)",
                  }}
                  aria-label={`Collaborator cursor: ${collaborator.name}`}
                >
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white"
                    style={{ backgroundColor: collaborator.color }}
                  />
                  <div
                    className="absolute top-5 left-0 px-2 py-1 rounded text-xs text-white whitespace-nowrap"
                    style={{ backgroundColor: collaborator.color }}
                  >
                    {collaborator.name}
                  </div>
                </div>
              ),
          )}
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
        boardTitle="Untitled Board"
        boardId={boardId}
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
