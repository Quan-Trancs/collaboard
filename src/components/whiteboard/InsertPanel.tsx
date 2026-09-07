import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  Table,
  BarChart3,
  PieChart,
  Plus,
  Upload,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import ShapeGraphic from "./ShapeGraphic";
import { SHAPE_GROUP_LABELS, SHAPE_GROUPS, shapesInGroup } from "./shapes";
import { INSERT_ICONS } from "./insertIcons";

interface InsertPanelProps {
  onInsert: (type: string, data: Record<string, unknown>) => void;
}

const CHARTS = [
  { name: "Bar Chart", icon: BarChart3, type: "barChart" },
  { name: "Pie Chart", icon: PieChart, type: "pieChart" },
] as const;

const TEMPLATES = [
  { name: "Title Slide", type: "titleSlide", preview: "T" },
  { name: "Content Slide", type: "contentSlide", preview: "C" },
  { name: "Two Column", type: "twoColumn", preview: "2C" },
  { name: "Comparison", type: "comparison", preview: "CP" },
] as const;

const TABLE_SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const InsertPanel = ({ onInsert }: InsertPanelProps) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [tableRows, setTableRows] = useState("3");
  const [tableCols, setTableCols] = useState("3");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showError = (description: string) => {
    toast({ title: "Could not insert", description, variant: "destructive" });
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      showError("Please select a JPG, PNG, GIF, or WebP image.");
      setIsUploading(false);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showError("File size must be less than 5MB.");
      setIsUploading(false);
      return;
    }

    if (file.name.length > 100) {
      showError("File name is too long. Please use a shorter name.");
      setIsUploading(false);
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const imageData = e.target?.result as string;
        if (!imageData) {
          throw new Error("Failed to read image data");
        }

        const img = document.createElement("img");
        img.onload = () => {
          onInsert("image", {
            src: imageData,
            name: file.name,
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
          setIsOpen(false);
          setIsUploading(false);
        };
        img.onerror = () => {
          showError("Invalid image file. Please select a valid image.");
          setIsUploading(false);
        };
        img.src = imageData;
      } catch {
        showError("Error processing image. Please try again.");
        setIsUploading(false);
      }
    };

    reader.onerror = () => {
      showError("Error reading file. Please try again.");
      setIsUploading(false);
    };

    reader.readAsDataURL(file);
    event.target.value = "";
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
    onInsert("table", { rows: Number(tableRows), cols: Number(tableCols) });
    setIsOpen(false);
  };

  const handleTemplateInsert = (templateType: string) => {
    onInsert("template", { type: templateType });
    setIsOpen(false);
  };

  const handleIconInsert = (iconId: string) => {
    onInsert("icon", { symbol: iconId });
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Insert elements"
            tabIndex={0}
            onClick={() => setIsOpen(true)}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Insert</TooltipContent>
      </Tooltip>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
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

          <TabsContent value="shapes" className="space-y-5" aria-label="Shape gallery">
            {SHAPE_GROUPS.map((group) => (
              <div key={group} className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  {SHAPE_GROUP_LABELS[group]}
                </p>
                <div className="grid grid-cols-6 gap-2">
                  {shapesInGroup(group).map((shape) => (
                    <Button
                      key={shape.id}
                      variant="outline"
                      className="h-[76px] px-1 flex flex-col items-center justify-center gap-1"
                      aria-label={`Insert ${shape.name}`}
                      onClick={() => handleShapeInsert(shape.id)}
                    >
                      <ShapeGraphic
                        type={shape.id}
                        fill="#4A86E3"
                        stroke="#1C4587"
                        strokeWidth={1.5}
                        className="h-8 w-8"
                      />
                      <span className="text-[10px] leading-tight text-center line-clamp-2">{shape.name}</span>
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="images" className="space-y-4">
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
              <Badge variant="secondary">JPG, PNG, GIF, WebP up to 5MB</Badge>
            </div>
            <Separator />
            <p className="text-sm text-gray-500">
              Upload an image from your computer, or drop one onto the board.
            </p>
          </TabsContent>

          <TabsContent value="charts" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {CHARTS.map((chart) => (
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
          </TabsContent>

          <TabsContent value="tables" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="table-rows">Rows</Label>
                <Select value={tableRows} onValueChange={setTableRows}>
                  <SelectTrigger id="table-rows" aria-label="Table rows">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TABLE_SIZES.map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="table-cols">Columns</Label>
                <Select value={tableCols} onValueChange={setTableCols}>
                  <SelectTrigger id="table-cols" aria-label="Table columns">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TABLE_SIZES.map((num) => (
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
          </TabsContent>

          <TabsContent value="icons" className="space-y-4">
            <div className="grid grid-cols-10 gap-2">
              {INSERT_ICONS.map((icon) => {
                const Graphic = icon.Icon;
                return (
                  <Button
                    key={icon.id}
                    variant="outline"
                    size="sm"
                    className="h-10 w-10 p-0"
                    aria-label={`Insert ${icon.name} icon`}
                    onClick={() => handleIconInsert(icon.id)}
                  >
                    <Graphic className="h-5 w-5" />
                  </Button>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {TEMPLATES.map((template) => (
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
