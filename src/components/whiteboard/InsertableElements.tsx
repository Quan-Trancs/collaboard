import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trash2,
  Edit,
} from "lucide-react";
import { useWorldDrag } from "./useWorldDrag";
import ShapeGraphic from "./ShapeGraphic";
import { getShape } from "./shapes";
import { getInsertIcon } from "./insertIcons";

interface InsertableElementProps {
  element: any;
  isSelected: boolean;
  zoom: number;
  interactive?: boolean;
  onSelect: () => void;
  onUpdate: (updates: any) => void;
  onDelete: () => void;
  onMove: (x: number, y: number) => void;
  onDragEnd: () => void;
  onResize: (width: number, height: number) => void;
}

export const ImageElement = ({ element, isSelected, zoom, interactive = true, onSelect, onUpdate, onDelete, onMove, onDragEnd }: InsertableElementProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const { isDragging, onMouseDown } = useWorldDrag(element, zoom, onMove, onDragEnd, onSelect, interactive);
  const [editData, setEditData] = useState({
    alt: element.alt || "",
    opacity: element.opacity || 1,
    borderRadius: element.borderRadius || 0,
  });

  const handleSave = () => {
    onUpdate(editData);
    setIsEditing(false);
  };

  return (
    <>
      <div
        className={`absolute ${isSelected && interactive ? 'ring-2 ring-blue-500' : ''} ${interactive ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
        style={{
          left: element.x,
          top: element.y,
          width: element.width,
          height: element.height,
          zIndex: isDragging ? 1000 : 'auto',
        }}
        onMouseDown={interactive ? onMouseDown : undefined}
      >
        <img
          src={element.src}
          alt={editData.alt}
          className="w-full h-full object-cover pointer-events-none"
          style={{
            opacity: editData.opacity,
            borderRadius: `${editData.borderRadius}px`,
          }}
          draggable={false}
        />
        
        {isSelected && interactive && (
          <div
            className="absolute -top-8 left-0 bg-white border border-gray-300 rounded shadow-lg flex items-center gap-1 p-1"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsEditing(true)}
              className="h-6 w-6 p-0"
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
              className="h-6 w-6 p-0 text-red-500"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Image</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Alt Text</Label>
              <Input
                value={editData.alt}
                onChange={(e) => setEditData({ ...editData, alt: e.target.value })}
                placeholder="Image description"
              />
            </div>
            <div>
              <Label>Opacity</Label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={editData.opacity}
                onChange={(e) => setEditData({ ...editData, opacity: parseFloat(e.target.value) })}
                className="w-full"
              />
              <span className="text-sm text-gray-500">{Math.round(editData.opacity * 100)}%</span>
            </div>
            <div>
              <Label>Border Radius</Label>
              <input
                type="range"
                min="0"
                max="50"
                value={editData.borderRadius}
                onChange={(e) => setEditData({ ...editData, borderRadius: parseInt(e.target.value) })}
                className="w-full"
              />
              <span className="text-sm text-gray-500">{editData.borderRadius}px</span>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const ShapeElement = ({ element, isSelected, zoom, interactive = true, onSelect, onUpdate, onDelete, onMove, onDragEnd }: InsertableElementProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const { isDragging, onMouseDown } = useWorldDrag(element, zoom, onMove, onDragEnd, onSelect, interactive);
  const [editData, setEditData] = useState({
    color: element.color || "#000000",
    fillColor: element.fillColor || "transparent",
    strokeWidth: element.strokeWidth || 2,
  });

  const renderShape = () => (
    <ShapeGraphic
      type={element.shapeType}
      fill={element.fillColor}
      stroke={element.color || "#111827"}
      strokeWidth={element.strokeWidth || 2}
      className="w-full h-full"
      title={getShape(element.shapeType).name}
    />
  );

  return (
    <>
      <div
        className={`absolute ${isSelected && interactive ? 'ring-2 ring-blue-500' : ''} ${interactive ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
        style={{
          left: element.x,
          top: element.y,
          width: element.width,
          height: element.height,
          zIndex: isDragging ? 1000 : 'auto',
        }}
        onMouseDown={interactive ? onMouseDown : undefined}
      >
        <div className="w-full h-full pointer-events-none">
          {renderShape()}
        </div>
        
        {isSelected && interactive && (
          <div
            className="absolute -top-8 left-0 bg-white border border-gray-300 rounded shadow-lg flex items-center gap-1 p-1"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsEditing(true)}
              className="h-6 w-6 p-0"
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
              className="h-6 w-6 p-0 text-red-500"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Shape</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Border Color</Label>
              <input
                type="color"
                value={editData.color}
                onChange={(e) => setEditData({ ...editData, color: e.target.value })}
                className="w-full h-10 border rounded"
              />
            </div>
            <div>
              <Label>Fill Color</Label>
              <Select value={editData.fillColor} onValueChange={(value) => setEditData({ ...editData, fillColor: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transparent">Transparent</SelectItem>
                  <SelectItem value="#ffffff">White</SelectItem>
                  <SelectItem value="#000000">Black</SelectItem>
                  <SelectItem value="#ff0000">Red</SelectItem>
                  <SelectItem value="#00ff00">Green</SelectItem>
                  <SelectItem value="#0000ff">Blue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Stroke Width</Label>
              <input
                type="range"
                min="1"
                max="10"
                value={editData.strokeWidth}
                onChange={(e) => setEditData({ ...editData, strokeWidth: parseInt(e.target.value) })}
                className="w-full"
              />
              <span className="text-sm text-gray-500">{editData.strokeWidth}px</span>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={() => { onUpdate(editData); setIsEditing(false); }}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const TableElement = ({ element, isSelected, zoom, interactive = true, onSelect, onUpdate, onDelete, onMove, onDragEnd }: InsertableElementProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const { isDragging, onMouseDown } = useWorldDrag(element, zoom, onMove, onDragEnd, onSelect, interactive);
  const [tableData, setTableData] = useState(() => {
    if (element.data) return element.data;
    // Create separate arrays for each row to avoid reference issues
    return Array(element.rows).fill(null).map(() => Array(element.cols).fill(""));
  });

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const newData = tableData.map((row: string[], r: number) =>
      r === rowIndex ? row.map((cell: string, c: number) => c === colIndex ? value : cell) : row
    );
    setTableData(newData);
  };

  return (
    <>
      <div
        className={`absolute ${isSelected && interactive ? 'ring-2 ring-blue-500' : ''} ${interactive ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
        style={{
          left: element.x,
          top: element.y,
          width: element.width,
          height: element.height,
          zIndex: isDragging ? 1000 : 'auto',
        }}
        onMouseDown={interactive ? onMouseDown : undefined}
      >
        <table className="w-full h-full border-collapse border border-gray-300 pointer-events-none">
          <tbody>
            {tableData.map((row: string[], rowIndex: number) => (
              <tr key={rowIndex}>
                {row.map((cell: string, colIndex: number) => (
                  <td
                    key={colIndex}
                    className="border border-gray-300 p-2 text-sm"
                    style={{ width: `${100 / element.cols}%`, height: `${100 / element.rows}%` }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        
        {isSelected && interactive && (
          <div
            className="absolute -top-8 left-0 bg-white border border-gray-300 rounded shadow-lg flex items-center gap-1 p-1"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsEditing(true)}
              className="h-6 w-6 p-0"
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
              className="h-6 w-6 p-0 text-red-500"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit Table</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <table className="w-full border-collapse border border-gray-300">
              <tbody>
                {tableData.map((row: string[], rowIndex: number) => (
                  <tr key={rowIndex}>
                    {row.map((cell: string, colIndex: number) => (
                      <td key={colIndex} className="border border-gray-300 p-1">
                        <Input
                          value={cell}
                          onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                          className="w-full h-8 text-sm"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={() => { onUpdate({ data: tableData }); setIsEditing(false); }}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const ChartElement = ({ element, isSelected, zoom, interactive = true, onSelect, onDelete, onMove, onDragEnd }: InsertableElementProps) => {
  const { isDragging, onMouseDown } = useWorldDrag(element, zoom, onMove, onDragEnd, onSelect, interactive);

  const renderChart = () => {
    const { chartType, data, colors } = element;
    
    if (chartType === "barChart") {
      const maxValue = Math.max(...data);
      return (
        <div className="w-full h-full flex items-end justify-around p-4">
          {data.map((value: number, index: number) => (
            <div
              key={index}
              className="bg-blue-500 min-w-[20px]"
              style={{
                height: `${(value / maxValue) * 100}%`,
                backgroundColor: colors?.[index] || "#3B82F6",
              }}
            />
          ))}
        </div>
      );
    }
    
    if (chartType === "pieChart") {
      const total = data.reduce((sum: number, value: number) => sum + value, 0);
      let currentAngle = 0;
      
      return (
        <svg width="100%" height="100%" viewBox="0 0 100 100">
          {data.map((value: number, index: number) => {
            const percentage = value / total;
            const angle = percentage * 360;
            const x1 = 50 + 40 * Math.cos((currentAngle * Math.PI) / 180);
            const y1 = 50 + 40 * Math.sin((currentAngle * Math.PI) / 180);
            const x2 = 50 + 40 * Math.cos(((currentAngle + angle) * Math.PI) / 180);
            const y2 = 50 + 40 * Math.sin(((currentAngle + angle) * Math.PI) / 180);
            
            const largeArcFlag = angle > 180 ? 1 : 0;
            
            const pathData = [
              `M 50 50`,
              `L ${x1} ${y1}`,
              `A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2}`,
              `Z`,
            ].join(" ");
            
            currentAngle += angle;
            
            return (
              <path
                key={index}
                d={pathData}
                fill={colors?.[index] || "#3B82F6"}
                stroke="#fff"
                strokeWidth="0.5"
              />
            );
          })}
        </svg>
      );
    }
    
    return <div className="w-full h-full bg-gray-100 flex items-center justify-center">Chart</div>;
  };

  return (
    <div
      className={`absolute ${isSelected && interactive ? 'ring-2 ring-blue-500' : ''} ${interactive ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        zIndex: isDragging ? 1000 : 'auto',
      }}
      onMouseDown={interactive ? onMouseDown : undefined}
    >
      <div className="w-full h-full pointer-events-none">
        {renderChart()}
      </div>
      
      {isSelected && interactive && (
        <div
          className="absolute -top-8 left-0 bg-white border border-gray-300 rounded shadow-lg flex items-center gap-1 p-1"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="h-6 w-6 p-0 text-red-500"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
};

export const IconElement = ({ element, isSelected, zoom, interactive = true, onSelect, onDelete, onMove, onDragEnd }: InsertableElementProps) => {
  const { isDragging, onMouseDown } = useWorldDrag(element, zoom, onMove, onDragEnd, onSelect, interactive);

  return (
    <div
      className={`absolute ${isSelected && interactive ? 'ring-2 ring-blue-500' : ''} ${interactive ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        fontSize: `${Math.min(element.width, element.height)}px`,
        zIndex: isDragging ? 1000 : 'auto',
      }}
      onMouseDown={interactive ? onMouseDown : undefined}
    >
      <div className="w-full h-full flex items-center justify-center pointer-events-none text-gray-800">
        {(() => {
          const icon = getInsertIcon(element.symbol);
          if (!icon) return element.symbol;
          const Graphic = icon.Icon;
          return <Graphic className="h-[80%] w-[80%]" strokeWidth={1.75} />;
        })()}
      </div>
      
      {isSelected && interactive && (
        <div
          className="absolute -top-8 left-0 bg-white border border-gray-300 rounded shadow-lg flex items-center gap-1 p-1"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="h-6 w-6 p-0 text-red-500"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}; 