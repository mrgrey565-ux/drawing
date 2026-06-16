import { Point, DrawingElement, StrokeStyle } from '../types';

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

export function getSmoothedPoints(points: Point[]): Point[] {
  if (points.length < 3) return points;
  const smoothed: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    smoothed.push({
      x: (points[i - 1].x + points[i].x + points[i + 1].x) / 3,
      y: (points[i - 1].y + points[i].y + points[i + 1].y) / 3,
      pressure: points[i].pressure,
      timestamp: points[i].timestamp,
    });
  }
  smoothed.push(points[points.length - 1]);
  return smoothed;
}

export function drawStroke(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  style: StrokeStyle,
  isPressureSensitive: boolean = false
) {
  if (points.length < 2) return;

  const smoothed = getSmoothedPoints(points);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (style.isHighlighter) {
    ctx.globalAlpha = 0.38;
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = style.color;
    // Draw thick highlight stroke
    ctx.lineWidth = style.width * 3;
    ctx.beginPath();
    ctx.moveTo(smoothed[0].x, smoothed[0].y);
    for (let i = 1; i < smoothed.length; i++) {
      ctx.lineTo(smoothed[i].x, smoothed[i].y);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (style.isVanishing) {
    ctx.globalAlpha = style.opacity;
    ctx.shadowBlur = 18;
    ctx.shadowColor = style.glowColor || style.color;
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = style.color;
    // Draw glow outline
    ctx.lineWidth = style.width + 4;
    ctx.globalAlpha = style.opacity * 0.3;
    ctx.beginPath();
    ctx.moveTo(smoothed[0].x, smoothed[0].y);
    for (let i = 1; i < smoothed.length; i++) ctx.lineTo(smoothed[i].x, smoothed[i].y);
    ctx.stroke();
    // Draw bright core
    ctx.lineWidth = style.width;
    ctx.globalAlpha = style.opacity;
    ctx.strokeStyle = '#FFFFFF';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(smoothed[0].x, smoothed[0].y);
    for (let i = 1; i < smoothed.length; i++) ctx.lineTo(smoothed[i].x, smoothed[i].y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.globalAlpha = style.opacity;
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = style.color;

  if (!isPressureSensitive) {
    ctx.lineWidth = style.width;
    ctx.beginPath();
    ctx.moveTo(smoothed[0].x, smoothed[0].y);
    for (let i = 1; i < smoothed.length; i++) {
      // Use quadratic curves for smoother strokes
      if (i < smoothed.length - 1) {
        const mx = (smoothed[i].x + smoothed[i + 1].x) / 2;
        const my = (smoothed[i].y + smoothed[i + 1].y) / 2;
        ctx.quadraticCurveTo(smoothed[i].x, smoothed[i].y, mx, my);
      } else {
        ctx.lineTo(smoothed[i].x, smoothed[i].y);
      }
    }
    ctx.stroke();
  } else {
    // Pressure-sensitive: vary width based on pressure
    for (let i = 1; i < smoothed.length; i++) {
      const p = Math.max(0.1, smoothed[i].pressure ?? 0.5);
      ctx.beginPath();
      ctx.lineWidth = Math.max(0.5, style.width * p * 2.2);
      ctx.moveTo(smoothed[i - 1].x, smoothed[i - 1].y);
      ctx.lineTo(smoothed[i].x, smoothed[i].y);
      ctx.stroke();
    }
  }

  ctx.restore();
}

export function drawRectangle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  style: StrokeStyle,
  fill: boolean = false
) {
  ctx.save();
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.width;
  ctx.globalAlpha = style.opacity;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (fill) {
    ctx.fillStyle = style.color;
    ctx.globalAlpha = 0.2;
    ctx.fillRect(x, y, width, height);
    ctx.globalAlpha = style.opacity;
  }
  ctx.strokeRect(x, y, width, height);
  ctx.restore();
}

export function drawCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  style: StrokeStyle,
  fill: boolean = false
) {
  ctx.save();
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.width;
  ctx.globalAlpha = style.opacity;
  ctx.lineCap = 'round';
  const cx = x + width / 2;
  const cy = y + height / 2;
  const rx = Math.abs(width / 2);
  const ry = Math.abs(height / 2);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = style.color;
    ctx.globalAlpha = 0.2;
    ctx.fill();
    ctx.globalAlpha = style.opacity;
  }
  ctx.stroke();
  ctx.restore();
}

export function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  style: StrokeStyle
) {
  ctx.save();
  ctx.strokeStyle = style.color;
  ctx.fillStyle = style.color;
  ctx.lineWidth = style.width;
  ctx.globalAlpha = style.opacity;
  ctx.lineCap = 'round';

  const dx = x2 - x1;
  const dy = y2 - y1;
  const angle = Math.atan2(dy, dx);
  const headLen = Math.max(15, style.width * 4);

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Arrow head
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLen * Math.cos(angle - Math.PI / 6),
    y2 - headLen * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    x2 - headLen * Math.cos(angle + Math.PI / 6),
    y2 - headLen * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  style: StrokeStyle
) {
  ctx.save();
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.width;
  ctx.globalAlpha = style.opacity;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bgType: string,
  bgColor: string
) {
  ctx.save();
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  if (bgType === 'grid') {
    const size = 40;
    ctx.strokeStyle = bgColor === '#111111' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += size) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += size) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  } else if (bgType === 'dots') {
    const size = 30;
    ctx.fillStyle = bgColor === '#111111' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)';
    for (let x = size; x < width; x += size) {
      for (let y = size; y < height; y += size) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (bgType === 'lines') {
    const size = 36;
    ctx.strokeStyle = bgColor === '#111111' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    for (let y = size; y <= height; y += size) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  ctx.restore();
}

export function getElementBounds(el: DrawingElement): { x: number; y: number; w: number; h: number } {
  if (el.type === 'stroke' && el.points && el.points.length > 0) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of el.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const pad = (el.style.width || 4) + 5;
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  }
  return {
    x: el.x ?? 0,
    y: el.y ?? 0,
    w: el.width ?? 100,
    h: el.height ?? 100,
  };
}

export function pointInBounds(px: number, py: number, bounds: { x: number; y: number; w: number; h: number }) {
  return px >= bounds.x && px <= bounds.x + bounds.w && py >= bounds.y && py <= bounds.y + bounds.h;
}
