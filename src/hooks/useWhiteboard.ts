/**
 * Custom hook for whiteboard state management
 * Extracted from Whiteboard component for better organization
 */

import { useState, useCallback, useRef } from 'react';
import type { DrawingElement, Tool } from '@/types';

export const useWhiteboard = () => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<Tool>('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [elements, setElements] = useState<DrawingElement[]>([]);
  const [history, setHistory] = useState<DrawingElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [isTextMode, setIsTextMode] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 });

  const addToHistory = useCallback((newElements: DrawingElement[]) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push([...newElements]);
      return newHistory.slice(-50); // Keep last 50 states
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 49));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setElements([...history[newIndex]]);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setElements([...history[newIndex]]);
    }
  }, [history, historyIndex]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return {
    isDrawing,
    setIsDrawing,
    currentTool,
    setCurrentTool,
    currentColor,
    setCurrentColor,
    strokeWidth,
    setStrokeWidth,
    elements,
    setElements,
    selectedElement,
    setSelectedElement,
    isTextMode,
    setIsTextMode,
    textInput,
    setTextInput,
    textPosition,
    setTextPosition,
    undo,
    redo,
    canUndo,
    canRedo,
    addToHistory,
  };
};

