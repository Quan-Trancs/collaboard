import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Image,
  Square,
  Circle,
  Triangle,
  Star,
  ArrowRight,
  Table,
  BarChart3,
  PieChart,
  FileText,
  Plus,
  Upload,
  Palette,
  Type,
  Zap,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface InsertPanelProps {
  onInsert: (type: string, data: any) => void;
}

const InsertPanel = ({ onInsert }: InsertPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const shapes = [
    { name: "Rectangle", icon: Square, type: "rectangle" },
    { name: "Circle", icon: Circle, type: "circle" },
    { name: "Triangle", icon: Triangle, type: "triangle" },
    { name: "Star", icon: Star, type: "star" },
    { name: "Arrow", icon: ArrowRight, type: "arrow" },
  ];

  const charts = [
    { name: "Bar Chart", icon: BarChart3, type: "barChart" },
    { name: "Pie Chart", icon: PieChart, type: "pieChart" },
  ];

  const templates = [
    { name: "Title Slide", type: "titleSlide", preview: "T" },
    { name: "Content Slide", type: "contentSlide", preview: "C" },
    { name: "Two Column", type: "twoColumn", preview: "2C" },
    { name: "Comparison", type: "comparison", preview: "CP" },
  ];

  const icons = [
    "🚀", "💡", "⭐", "🎯", "📈", "💻", "🎨", "📱", "🌍", "⚡",
    "🔧", "📊", "🎪", "🏆", "💎", "🎭", "🔮", "🌟", "🎨", "🎪"
  ];

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Please select a valid image file (JPG, PNG, GIF, or WebP)');
      setIsUploading(false);
      return;
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      alert('File size must be less than 5MB');
      setIsUploading(false);
      return;
    }

    // Validate file name
    if (file.name.length > 100) {
      alert('File name is too long. Please use a shorter name.');
      setIsUploading(false);
      return;
    }

    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const imageData = e.target?.result as string;
        if (!imageData) {
          throw new Error('Failed to read image data');
        }
        
        // Validate that it's actually an image by creating an Image object
        const img = document.createElement('img');
        img.onload = () => {
          onInsert("image", { 
            src: imageData, 
            name: file.name,
            width: img.naturalWidth,
            height: img.naturalHeight
          });
          setIsOpen(false);
          setIsUploading(false);
        };
        img.onerror = () => {
          alert('Invalid image file. Please select a valid image.');
          setIsUploading(false);
        };
        img.src = imageData;
      } catch (error) {
        console.error('Error processing image:', error);
        alert('Error processing image. Please try again.');
        setIsUploading(false);
      }
    };

    reader.onerror = () => {
      alert('Error reading file. Please try again.');
      setIsUploading(false);
    };

    try {
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Error reading file. Please try again.');
      setIsUploading(false);
    }

    // Reset the input so the same file can be selected again
    event.target.value = '';
  };

  const handleShapeInsert = (shapeType: string) => {
    onInsert("shape", { type: shapeType });
    setIsOpen(false);
  };

  const handleChartInsert = (chartType: string) => {
    onInsert("chart", { type: chartType });
    setIsOpen(false);
  };

  const handleTableInsert = () => {
    onInsert("table", { rows: 3, cols: 3 });
    setIsOpen(false);
  };

  const handleTemplateInsert = (templateType: string) => {
    onInsert("template", { type: templateType });
    setIsOpen(false);
  };

  const handleIconInsert = (icon: string) => {
    onInsert("icon", { symbol: icon });
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Insert elements"
              tabIndex={0}
            >
              <Plus className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Insert</TooltipContent>
        </Tooltip>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Insert Elements
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="shapes" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="shapes">Shapes</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
            <TabsTrigger value="charts">Charts</TabsTrigger>
            <TabsTrigger value="tables">Tables</TabsTrigger>
            <TabsTrigger value="icons">Icons</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="shapes" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {shapes.map((shape) => (
                <Button
                  key={shape.type}
                  variant="outline"
                  className="h-20 flex flex-col items-center justify-center gap-2"
                  onClick={() => handleShapeInsert(shape.type)}
                >
                  <shape.icon className="h-6 w-6" />
                  <span className="text-xs">{shape.name}</span>
                </Button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="images" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2"
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Upload Image
                    </>
                  )}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Badge variant="secondary">JPG, PNG, GIF up to 5MB</Badge>
              </div>
              <Separator />
              <div className="grid grid-cols-4 gap-4">
                <div className="aspect-square bg-gray-100 rounded border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <span className="text-gray-500 text-sm">Stock Photos</span>
                </div>
                <div className="aspect-square bg-gray-100 rounded border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <span className="text-gray-500 text-sm">Icons</span>
                </div>
                <div className="aspect-square bg-gray-100 rounded border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <span className="text-gray-500 text-sm">Illustrations</span>
                </div>
                <div className="aspect-square bg-gray-100 rounded border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <span className="text-gray-500 text-sm">Backgrounds</span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="charts" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {charts.map((chart) => (
                <Button
                  key={chart.type}
                  variant="outline"
                  className="h-20 flex flex-col items-center justify-center gap-2"
                  onClick={() => handleChartInsert(chart.type)}
                >
                  <chart.icon className="h-6 w-6" />
                  <span className="text-xs">{chart.name}</span>
                </Button>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Chart Data</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Chart Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bar">Bar Chart</SelectItem>
                    <SelectItem value="pie">Pie Chart</SelectItem>
                    <SelectItem value="line">Line Chart</SelectItem>
                  </SelectContent>
                </Select>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Color Theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blue">Blue</SelectItem>
                    <SelectItem value="green">Green</SelectItem>
                    <SelectItem value="purple">Purple</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tables" className="space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Rows</Label>
                  <Select defaultValue="3">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Columns</Label>
                  <Select defaultValue="3">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full flex items-center gap-2"
                onClick={handleTableInsert}
              >
                <Table className="h-4 w-4" />
                Insert Table
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="icons" className="space-y-4">
            <div className="grid grid-cols-10 gap-2">
              {icons.map((icon, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="h-10 w-10 p-0 text-lg"
                  onClick={() => handleIconInsert(icon)}
                >
                  {icon}
                </Button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {templates.map((template) => (
                <Button
                  key={template.type}
                  variant="outline"
                  className="h-20 flex flex-col items-center justify-center gap-2"
                  onClick={() => handleTemplateInsert(template.type)}
                >
                  <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center text-sm font-bold">
                    {template.preview}
                  </div>
                  <span className="text-xs">{template.name}</span>
                </Button>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default InsertPanel; 