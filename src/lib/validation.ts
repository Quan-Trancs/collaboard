import { z } from "zod";
import { SHAPE_IDS } from "@/components/whiteboard/shapes";

// Authentication schemas
export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signupSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name must be less than 50 characters"),
});

// Board schemas
const boardTitleSchema = z.string().min(1, "Title is required").max(200, "Title must be 200 characters or less");
const hexColorSchema = z.string().regex(/^#[0-9A-F]{6}$/i, "Color must be a valid hex color");
const fillColorSchema = z.union([
  hexColorSchema,
  z.literal("transparent"),
]);

export const createBoardSchema = z.object({
  title: boardTitleSchema,
  description: z.string().optional(),
  isPublic: z.boolean().default(false),
});

export const updateBoardSchema = z.object({
  title: boardTitleSchema.optional(),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
});

// Element schemas
export const elementPositionSchema = z.object({
  x: z.number().min(-32000).max(32000),
  y: z.number().min(-32000).max(32000),
});

export const elementSizeSchema = z.object({
  width: z.number().min(1, "Width must be at least 1"),
  height: z.number().min(1, "Height must be at least 1"),
});

export const elementDataSchema = z.object({
  color: hexColorSchema,
  strokeWidth: z.number().min(1, "Stroke width must be at least 1").max(20, "Stroke width must be at most 20"),
  text: z.string().optional(),
  points: z.array(z.object({
    x: z.number(),
    y: z.number(),
  })).optional(),
  src: z.string().refine(
    (value) => value.startsWith("data:image/") || /^https?:\/\//i.test(value),
    "Image source must be a URL or image data"
  ).optional(),
  alt: z.string().optional(),
  opacity: z.number().min(0, "Opacity must be between 0 and 1").max(1, "Opacity must be between 0 and 1").optional(),
  borderRadius: z.number().min(0, "Border radius must be non-negative").optional(),
  shapeType: z.string().optional(),
  fillColor: fillColorSchema.optional(),
  data: z.any().optional(), // For tables and charts - will be more specific later
  symbol: z.string().optional(),
  rows: z.number().min(1, "Rows must be at least 1").max(50, "Rows must be at most 50").optional(),
  cols: z.number().min(1, "Columns must be at least 1").max(50, "Columns must be at most 50").optional(),
  chartType: z.string().optional(),
  colors: z.array(hexColorSchema).optional(),
});

// Element type mapping from frontend to API
export const mapElementTypeToApi = (type: string): 'drawing' | 'text' | 'shape' | 'image' | 'table' | 'chart' | 'icon' => {
  switch (type) {
    case 'pen':
    case 'eraser':
      return 'drawing';
    case 'rectangle':
    case 'circle':
    case 'shape':
      return 'shape';
    case 'text':
      return 'text';
    case 'image':
      return 'image';
    case 'table':
      return 'table';
    case 'chart':
      return 'chart';
    case 'icon':
      return 'icon';
    default:
      return 'drawing';
  }
};

// API-specific schema that matches the exact API types
export const createElementApiSchema = z.object({
  board_id: z.string().min(1, "Board ID is required"),
  type: z.enum(["drawing", "text", "shape", "image", "table", "chart", "icon"]),
  data: elementDataSchema,
  position: elementPositionSchema,
  size: elementSizeSchema.optional(),
});

// Frontend schema for validation before API conversion
export const createElementSchema = z.object({
  board_id: z.string().min(1, "Board ID is required"),
  type: z.enum(["pen", "rectangle", "circle", "text", "eraser", "select", "image", "shape", "table", "chart", "icon", "template"]),
  data: elementDataSchema,
  position: elementPositionSchema,
  size: elementSizeSchema.optional(),
});

export const updateElementSchema = z.object({
  data: elementDataSchema.partial().optional(),
  position: z.object({
    x: z.number().min(-32000).max(32000),
    y: z.number().min(-32000).max(32000),
  }).optional(),
  size: z.object({
    width: z.number().min(1, "Width must be at least 1"),
    height: z.number().min(1, "Height must be at least 1"),
  }).optional(),
});

// Share schemas
export const shareBoardSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  permission: z.enum(["view", "edit", "admin"]).default("view"),
});

export const inviteCollaboratorSchema = z.object({
  boardId: z.string().min(1, "Board ID is required"),
  email: z.string().email("Please enter a valid email address"),
  permission: z.enum(["view", "edit", "admin"]).default("view"),
});
// Insert element schemas
export const insertImageSchema = z.object({
  src: z.string().refine(
    (value) => value.startsWith("data:image/") || /^https?:\/\//i.test(value),
    "Image source must be a URL or image data"
  ),
  name: z.string().min(1, "Image name is required"),
});

export const insertShapeSchema = z.object({
  type: z.enum([...SHAPE_IDS, "arrow"]),
});

export const insertTableSchema = z.object({
  rows: z.number().min(1, "Rows must be at least 1").max(20, "Rows must be at most 20"),
  cols: z.number().min(1, "Columns must be at least 1").max(20, "Columns must be at most 20"),
});

export const insertChartSchema = z.object({
  type: z.enum(["barChart", "pieChart"]),
});

export const insertIconSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
});

export const insertTemplateSchema = z.object({
  type: z.enum(["titleSlide", "contentSlide", "twoColumn", "comparison"]),
});

// Type exports for use in components
export type LoginFormData = z.infer<typeof loginSchema>;
export type SignupFormData = z.infer<typeof signupSchema>;
export type CreateBoardData = z.infer<typeof createBoardSchema>;
export type UpdateBoardData = z.infer<typeof updateBoardSchema>;
export type CreateElementData = z.infer<typeof createElementSchema>;
export type UpdateElementData = z.infer<typeof updateElementSchema>;
export type ShareBoardData = z.infer<typeof shareBoardSchema>;
export type InviteCollaboratorData = z.infer<typeof inviteCollaboratorSchema>;
export type InsertImageData = z.infer<typeof insertImageSchema>;
export type InsertShapeData = z.infer<typeof insertShapeSchema>;
export type InsertTableData = z.infer<typeof insertTableSchema>;
export type InsertChartData = z.infer<typeof insertChartSchema>;
export type InsertIconData = z.infer<typeof insertIconSchema>;
export type InsertTemplateData = z.infer<typeof insertTemplateSchema>; 