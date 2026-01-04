/**
 * Whiteboard Toolbar Component
 * Extracted from Whiteboard for better organization
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
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
} from 'lucide-react';

export type Tool = 'pen' | 'rectangle' | 'circle' | 'text' | 'eraser' | 'select';

interface ToolbarProps {
  currentTool: Tool;
  currentColor: string;
  strokeWidth: number;
  onToolChange: (tool: Tool) => void;
  onColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onShare: () => void;
  onBack: () => void;
  onLogout: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  currentColor,
  strokeWidth,
  onToolChange,
  onColorChange,
  onStrokeWidthChange,
  onUndo,
  onRedo,
  onSave,
  onShare,
  onBack,
  onLogout,
  canUndo,
  canRedo,
}) => {
  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-2 flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
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
            variant={currentTool === 'select' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => onToolChange('select')}
            aria-label="Select tool"
          >
            <Move className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Select</TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={currentTool === 'pen' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => onToolChange('pen')}
            aria-label="Pen tool"
          >
            <Pen className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Pen</TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={currentTool === 'rectangle' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => onToolChange('rectangle')}
            aria-label="Rectangle tool"
          >
            <Square className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Rectangle</TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={currentTool === 'circle' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => onToolChange('circle')}
            aria-label="Circle tool"
          >
            <Circle className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Circle</TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={currentTool === 'text' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => onToolChange('text')}
            aria-label="Text tool"
          >
            <Type className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Text</TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={currentTool === 'eraser' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => onToolChange('eraser')}
            aria-label="Eraser tool"
          >
            <Eraser className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Eraser</TooltipContent>
      </Tooltip>
      
      <Separator className="w-8" />
      
      {/* Color Picker */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-gray-600" />
            <input
              type="color"
              value={currentColor}
              onChange={(e) => onColorChange(e.target.value)}
              className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
              aria-label="Color picker"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>Color</TooltipContent>
      </Tooltip>
      
      {/* Stroke Width */}
      <div className="flex items-center gap-2 px-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onStrokeWidthChange(Math.max(1, strokeWidth - 1))}
          aria-label="Decrease stroke width"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium w-8 text-center">{strokeWidth}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onStrokeWidthChange(Math.min(20, strokeWidth + 1))}
          aria-label="Increase stroke width"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      <Separator className="w-8" />
      
      {/* Actions */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="Undo"
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
            onClick={onRedo}
            disabled={!canRedo}
            aria-label="Redo"
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
            onClick={onSave}
            aria-label="Save"
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
            onClick={onShare}
            aria-label="Share"
          >
            <Share2 className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Share</TooltipContent>
      </Tooltip>
      
      <Separator className="w-8" />
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onLogout}
            aria-label="Logout"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Logout</TooltipContent>
      </Tooltip>
    </div>
  );
};

