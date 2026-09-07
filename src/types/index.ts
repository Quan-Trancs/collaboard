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

export type BoardViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type BoardBackground = {
  color?: string;
  image?: string | null;
};

export type BoardPermission = 'owner' | 'view' | 'edit' | 'admin';

export type Collaborator = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  avatar_url?: string | null;
  permission: BoardPermission;
};

export type BoardShareInfo = {
  owner: Collaborator | null;
  collaborators: Collaborator[];
  is_public: boolean;
  can_manage: boolean;
};

export type Board = {
  id: string;
  title: string;
  description?: string;
  owner_id: string;
  thumbnail_url?: string | null;
  is_public: boolean;
  permission?: BoardPermission;
  can_edit?: boolean;
  owner?: Collaborator | null;
  collaborators?: Collaborator[];
  background?: BoardBackground;
  viewport?: BoardViewport;
  objects?: SlideObject[];
  drawings?: InkStroke[];
  created_at: string;
  updated_at: string;
};

export type SlideObjectType = 'text' | 'shape' | 'image' | 'table' | 'chart' | 'icon';

export type SlideObject = {
  id: string;
  board_id: string;
  type: SlideObjectType;
  transform: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  };
  zIndex: number;
  locked: boolean;
  visible: boolean;
  props: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type InkStroke = {
  id: string;
  board_id: string;
  type: 'drawing';
  points: Array<{ x: number; y: number }>;
  color: string;
  strokeWidth: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

/** @deprecated Use SlideObject or InkStroke */
export type BoardElementType = 'drawing' | SlideObjectType;

/** @deprecated Use SlideObject or InkStroke */
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

export type Tool = 'pen' | 'rectangle' | 'circle' | 'text' | 'eraser' | 'select' | 'shape';

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
  fontSize?: number;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  align?: 'left' | 'center' | 'right';
  lineHeight?: number;
}

export type ApiResponse<T> = {
  data?: T;
  error?: string;
  code?: string;
  details?: unknown;
};
