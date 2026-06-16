export type ToolType =
  | 'pen'
  | 'pressure-pen'
  | 'highlighter'
  | 'vanishing-pen'
  | 'eraser'
  | 'select'
  | 'rectangle'
  | 'circle'
  | 'arrow'
  | 'line'
  | 'text'
  | 'image';

export type BackgroundType = 'blank' | 'grid' | 'dots' | 'lines';
export type BackgroundColor = 'white' | 'pale-yellow' | 'black';

export interface Point {
  x: number;
  y: number;
  pressure?: number;
  timestamp?: number;
}

export interface StrokeStyle {
  color: string;
  width: number;
  opacity: number;
  isHighlighter?: boolean;
  isVanishing?: boolean;
  glowColor?: string;
}

export interface DrawingElement {
  id: string;
  type: 'stroke' | 'rectangle' | 'circle' | 'arrow' | 'line' | 'text' | 'image';
  points?: Point[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  imageData?: string;
  style: StrokeStyle;
  createdAt: number;
  vanishAt?: number; // for vanishing pen
  isVanishing?: boolean;
}

export interface Page {
  id: string;
  elements: DrawingElement[];
  background: BackgroundType;
  backgroundColor: BackgroundColor;
  thumbnail?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'pdf';
  pdfPages?: string[]; // base64 images of PDF pages
  currentPage?: number;
}

export const PRESET_COLORS = [
  '#000000', // Black
  '#FFFFFF', // White
  '#EF4444', // Red
  '#F97316', // Orange
  '#EAB308', // Yellow
  '#22C55E', // Green
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#F59E0B', // Amber
  '#6366F1', // Indigo
];

export const VANISHING_COLORS = [
  '#FF0000', // Bright Red
  '#00FF88', // Neon Green
  '#00BFFF', // Electric Blue
  '#FF00FF', // Magenta
  '#FFD700', // Gold
  '#FF6600', // Neon Orange
];

export const BG_COLORS: Record<BackgroundColor, string> = {
  'white': '#FFFFFF',
  'pale-yellow': '#FEFCE8',
  'black': '#111111',
};
