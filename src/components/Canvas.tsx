import React, { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import {
  DrawingElement,
  ToolType,
  StrokeStyle,
  Point,
  BackgroundType,
  BackgroundColor,
  BG_COLORS,
} from '../types';
import {
  generateId,
  drawStroke,
  drawRectangle,
  drawCircle,
  drawArrow,
  drawLine,
  drawBackground,
  getElementBounds,
  pointInBounds,
} from '../utils/drawing';

interface CanvasProps {
  tool: ToolType;
  strokeStyle: StrokeStyle;
  elements: DrawingElement[];
  backgroundType: BackgroundType;
  backgroundColor: BackgroundColor;
  onElementsChange: (elements: DrawingElement[]) => void;
  onSelectElement?: (id: string | null) => void;
}

export interface CanvasHandle {
  exportImage: () => string;
  clearCanvas: () => void;
}

const VANISH_DURATION = 2500;

const Canvas = forwardRef<CanvasHandle, CanvasProps>(
  ({ tool, strokeStyle, elements, backgroundType, backgroundColor, onElementsChange, onSelectElement }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDrawingRef = useRef(false);
    const currentElementRef = useRef<DrawingElement | null>(null);
    const startPointRef = useRef<Point | null>(null);
    const vanishTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });
  const animFrameRef = useRef<number>(0);

    const bgColor = BG_COLORS[backgroundColor];

    // Resize observer
    useEffect(() => {
      const obs = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          setCanvasSize({ width: Math.floor(width), height: Math.floor(height) });
        }
      });
      if (containerRef.current) obs.observe(containerRef.current);
      return () => obs.disconnect();
    }, []);

    const getPos = useCallback((e: React.PointerEvent<HTMLCanvasElement>): Point => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
        pressure: e.pressure > 0 ? e.pressure : 0.5,
        timestamp: Date.now(),
      };
    }, []);

    const renderAll = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;
      const now = Date.now();

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawBackground(ctx, canvas.width, canvas.height, backgroundType, bgColor);

      const activeElements = elements.filter((el) => {
        if (!el.isVanishing) return true;
        return el.vanishAt !== undefined && now < el.vanishAt;
      });

      for (const el of activeElements) {
        const age = el.isVanishing && el.vanishAt ? 1 - (el.vanishAt - now) / VANISH_DURATION : 1;
        const fadeOpacity = el.isVanishing ? Math.max(0, 1 - age * 1.5) : el.style.opacity;
        const effectiveStyle = { ...el.style, opacity: fadeOpacity };

        if (el.type === 'stroke' && el.points) {
          drawStroke(ctx, el.points, effectiveStyle, tool === 'pressure-pen');
        } else if (el.type === 'rectangle' && el.x !== undefined) {
          drawRectangle(ctx, el.x, el.y!, el.width!, el.height!, effectiveStyle);
        } else if (el.type === 'circle' && el.x !== undefined) {
          drawCircle(ctx, el.x, el.y!, el.width!, el.height!, effectiveStyle);
        } else if (el.type === 'arrow' && el.points) {
          const p = el.points;
          drawArrow(ctx, p[0].x, p[0].y, p[p.length - 1].x, p[p.length - 1].y, effectiveStyle);
        } else if (el.type === 'line' && el.points) {
          const p = el.points;
          drawLine(ctx, p[0].x, p[0].y, p[p.length - 1].x, p[p.length - 1].y, effectiveStyle);
        } else if (el.type === 'image' && el.imageData) {
          const img = new Image();
          img.src = el.imageData;
          ctx.drawImage(img, el.x!, el.y!, el.width!, el.height!);
        }

        // Selection indicator
        if (selectedId === el.id) {
          const bounds = getElementBounds(el);
          ctx.save();
          ctx.strokeStyle = '#6366F1';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 3]);
          ctx.strokeRect(bounds.x - 4, bounds.y - 4, bounds.w + 8, bounds.h + 8);
          ctx.restore();
        }
      }

      // Draw current in-progress element
      if (currentElementRef.current) {
        const cur = currentElementRef.current;
        if (cur.type === 'stroke' && cur.points) {
          drawStroke(ctx, cur.points, cur.style, tool === 'pressure-pen');
        } else if (cur.type === 'rectangle' && cur.x !== undefined) {
          drawRectangle(ctx, cur.x, cur.y!, cur.width!, cur.height!, cur.style);
        } else if (cur.type === 'circle' && cur.x !== undefined) {
          drawCircle(ctx, cur.x, cur.y!, cur.width!, cur.height!, cur.style);
        } else if (cur.type === 'arrow' && cur.points) {
          const p = cur.points;
          drawArrow(ctx, p[0].x, p[0].y, p[p.length - 1].x, p[p.length - 1].y, cur.style);
        } else if (cur.type === 'line' && cur.points) {
          const p = cur.points;
          drawLine(ctx, p[0].x, p[0].y, p[p.length - 1].x, p[p.length - 1].y, cur.style);
        }
      }

      // Check if any vanishing elements still active
      const hasVanishing = elements.some((el) => el.isVanishing && el.vanishAt && now < el.vanishAt);
      if (hasVanishing) {
        animFrameRef.current = requestAnimationFrame(renderAll);
      }
    }, [elements, backgroundType, bgColor, selectedId, tool]);

    useEffect(() => {
      renderAll();
    }, [renderAll, canvasSize]);

    useImperativeHandle(ref, () => ({
      exportImage: () => canvasRef.current?.toDataURL('image/png') ?? '',
      clearCanvas: () => onElementsChange([]),
    }));

    const onPointerDown = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const canvas = canvasRef.current!;
        canvas.setPointerCapture(e.pointerId);
        const pos = getPos(e);

        if (tool === 'select') {
          // Find topmost element at position
          let found: string | null = null;
          for (let i = elements.length - 1; i >= 0; i--) {
            const bounds = getElementBounds(elements[i]);
            if (pointInBounds(pos.x, pos.y, bounds)) {
              found = elements[i].id;
              break;
            }
          }
          setSelectedId(found);
          onSelectElement?.(found);
          return;
        }

        if (tool === 'eraser') {
          isDrawingRef.current = true;
          // Erase elements at pos
          const newElements = elements.filter((el) => {
            const bounds = getElementBounds(el);
            return !pointInBounds(pos.x, pos.y, bounds);
          });
          onElementsChange(newElements);
          return;
        }

        isDrawingRef.current = true;
        startPointRef.current = pos;

        const isVanishing = tool === 'vanishing-pen';
        const isHighlighter = tool === 'highlighter';

        const el: DrawingElement = {
          id: generateId(),
          type:
            tool === 'rectangle'
              ? 'rectangle'
              : tool === 'circle'
              ? 'circle'
              : tool === 'arrow'
              ? 'arrow'
              : tool === 'line'
              ? 'line'
              : 'stroke',
          points: ['pen', 'pressure-pen', 'highlighter', 'vanishing-pen', 'arrow', 'line'].includes(tool)
            ? [pos]
            : undefined,
          x: ['rectangle', 'circle'].includes(tool) ? pos.x : undefined,
          y: ['rectangle', 'circle'].includes(tool) ? pos.y : undefined,
          width: ['rectangle', 'circle'].includes(tool) ? 0 : undefined,
          height: ['rectangle', 'circle'].includes(tool) ? 0 : undefined,
          style: {
            ...strokeStyle,
            isHighlighter,
            isVanishing,
            glowColor: isVanishing ? strokeStyle.color : undefined,
          },
          isVanishing,
          createdAt: Date.now(),
        };
        currentElementRef.current = el;
      },
      [tool, elements, strokeStyle, getPos, onElementsChange]
    );

    const onPointerMove = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawingRef.current) return;
        e.preventDefault();
        const pos = getPos(e);

        if (tool === 'eraser') {
          const eraserRadius = strokeStyle.width * 4;
          const newElements = elements.filter((el) => {
            if (el.type === 'stroke' && el.points) {
              // Check if any point is within eraser radius
              return !el.points.some(
                (p) => Math.hypot(p.x - pos.x, p.y - pos.y) < eraserRadius
              );
            }
            const bounds = getElementBounds(el);
            return !pointInBounds(pos.x, pos.y, bounds);
          });
          if (newElements.length !== elements.length) onElementsChange(newElements);
          return;
        }

        const cur = currentElementRef.current;
        if (!cur) return;
        const start = startPointRef.current!;

        if (cur.type === 'stroke') {
          cur.points = [...(cur.points ?? []), pos];
        } else if (cur.type === 'rectangle' || cur.type === 'circle') {
          cur.x = Math.min(start.x, pos.x);
          cur.y = Math.min(start.y, pos.y);
          cur.width = Math.abs(pos.x - start.x);
          cur.height = Math.abs(pos.y - start.y);
        } else if (cur.type === 'arrow' || cur.type === 'line') {
          cur.points = [start, pos];
        }

        renderAll();
      },
      [tool, elements, getPos, onElementsChange, renderAll]
    );

    const onPointerUp = useCallback(
      (_e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;
        const cur = currentElementRef.current;
        currentElementRef.current = null;

        if (!cur) return;
        if (tool === 'eraser') return;

        // Skip tiny elements
        if (cur.type === 'stroke' && (cur.points?.length ?? 0) < 2) return;
        if (
          (cur.type === 'rectangle' || cur.type === 'circle') &&
          Math.abs(cur.width ?? 0) < 4 &&
          Math.abs(cur.height ?? 0) < 4
        )
          return;

        if (cur.isVanishing) {
          cur.vanishAt = Date.now() + VANISH_DURATION;
          const newEls = [...elements, cur];
          onElementsChange(newEls);
          animFrameRef.current = requestAnimationFrame(renderAll);
          // Remove after vanish
          const capturedId = cur.id;
          const timer = setTimeout(() => {
            onElementsChange(elements.filter((el) => el.id !== capturedId));
          }, VANISH_DURATION + 100);
          vanishTimersRef.current.set(cur.id, timer);
        } else {
          onElementsChange([...elements, cur]);
        }
        renderAll();
      },
      [tool, elements, onElementsChange, renderAll]
    );

    const getCursor = () => {
      if (tool === 'eraser') return 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\'%3E%3Ccircle cx=\'12\' cy=\'12\' r=\'10\' fill=\'white\' stroke=\'black\' stroke-width=\'2\'/%3E%3C/svg%3E") 12 12, crosshair';
      if (tool === 'select') return 'default';
      return 'crosshair';
    };

    return (
      <div ref={containerRef} className="w-full h-full relative overflow-hidden">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          style={{ width: '100%', height: '100%', touchAction: 'none', cursor: getCursor() }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
      </div>
    );
  }
);

Canvas.displayName = 'Canvas';
export default Canvas;
