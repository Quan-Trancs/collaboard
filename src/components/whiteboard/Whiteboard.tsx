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
} from "lucide-react";
import ShareModal from "./ShareModal";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface WhiteboardProps {
  boardId?: string;
  user?: { id: string; email: string; name: string };
  onBackToDashboard?: () => void;
  onLogout?: () => void;
}

type Tool = "pen" | "rectangle" | "circle" | "text" | "eraser";

interface DrawingElement {
  id: string;
  type: Tool;
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: { x: number; y: number }[];
  text?: string;
  color: string;
  strokeWidth: number;
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
  const [history, setHistory] = useState<DrawingElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isTextMode, setIsTextMode] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 });
  const [collaborators] = useState<Collaborator[]>([
    {
      id: "2",
      name: "Jane Smith",
      color: "#3B82F6",
      cursor: { x: 150, y: 200 },
    },
    {
      id: "3",
      name: "Mike Johnson",
      color: "#10B981",
      cursor: { x: 300, y: 150 },
    },
  ]);
  const { toast } = useToast();
  const [showClearDialog, setShowClearDialog] = useState(false);

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

    // Draw all elements
    elements.forEach((element) => {
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

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isTextMode) return;

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
    if (!isDrawing || isTextMode) return;

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
    if (isDrawing) {
      setIsDrawing(false);
      saveToHistory();
    }
  };

  // Canvas click for text tool
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
    }
  };

  // Add text to canvas
  const addText = () => {
    if (textInput.trim()) {
      const newElement: DrawingElement = {
        id: Date.now().toString(),
        type: "text",
        x: textPosition.x,
        y: textPosition.y,
        text: textInput,
        color: currentColor,
        strokeWidth,
      };

      setElements((prev) => [...prev, newElement]);
      saveToHistory();
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
  const clearCanvas = () => {
    setElements([]);
    saveToHistory();
    toast({
      title: "Canvas cleared",
      description: "All elements have been removed from the board.",
    });
    setShowClearDialog(false);
  };

  // Save board
  const saveBoard = () => {
    // In a real app, this would save to a backend
    console.log("Saving board:", { boardId, elements });
    toast({
      title: "Board saved!",
      description: "Your whiteboard has been saved.",
    });
  };

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
            <Badge variant="secondary">Auto-saved</Badge>
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
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full cursor-crosshair bg-white"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={handleCanvasClick}
            style={{
              cursor:
                currentTool === "eraser"
                  ? "grab"
                  : currentTool === "text"
                    ? "text"
                    : "crosshair",
            }}
            role="region"
            aria-label="Drawing canvas"
            tabIndex={0}
          />
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
    </div>
  );
};

export default Whiteboard;
