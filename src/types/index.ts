/**
 * Centralized type definitions
 */

export type User = {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
  user_metadata?: {
    name?: string;
    avatar_url?: string;
  };
};

export type Board = {
  id: string;
  title: string;
  description?: string;
  owner_id: string;
  thumbnail_url?: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type BoardElementType = 'drawing' | 'text' | 'shape' | 'image' | 'table' | 'chart' | 'icon';

export type BoardElement = {
  id: string;
  board_id: string;
  type: BoardElementType;
  data: Record<string, unknown>;
  position: { x: number; y: number };
  size?: { width: number; height: number } | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type Collaborator = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  permission: 'view' | 'edit' | 'admin';
};

export type Tool = 'pen' | 'rectangle' | 'circle' | 'text' | 'eraser' | 'select';

export interface DrawingElement {
  id: string;
  type: Tool | 'image' | 'shape' | 'table' | 'chart' | 'icon' | 'template';
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: Array<{ x: number; y: number }>;
  text?: string;
  color: string;
  strokeWidth: number;
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
}

export type ApiResponse<T> = {
  data?: T;
  error?: string;
  code?: string;
  details?: unknown;
};

