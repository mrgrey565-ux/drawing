import React, { useState, useRef } from 'react';
import {
  Pen,
  Highlighter,
  Eraser,
  Square,
  Circle,
  ArrowRight,
  Minus,
  MousePointer2,
  Zap,
  Image,
  Trash2,
  ChevronDown,
  Palette,
  BookOpen,
  AlignJustify,
  LayoutGrid,
  Dot,
  Sun,
  Moon,
  Download,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import { ToolType, StrokeStyle, BackgroundType, BackgroundColor, PRESET_COLORS, VANISHING_COLORS, BG_COLORS } from '../types';

interface ToolbarProps {
  tool: ToolType;
  strokeStyle: StrokeStyle;
  backgroundType: BackgroundType;
  backgroundColor: BackgroundColor;
  onToolChange: (tool: ToolType) => void;
  onStyleChange: (style: Partial<StrokeStyle>) => void;
  onBgTypeChange: (type: BackgroundType) => void;
  onBgColorChange: (color: BackgroundColor) => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onAddImage: (dataUrl: string, w: number, h: number) => void;
  onExport: () => void;
  onToggleMagic: () => void;
  magicActive: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

const toolGroups = [
  {
    label: 'Draw',
    tools: [
      { id: 'select', icon: MousePointer2, label: 'Select' },
      { id: 'pen', icon: Pen, label: 'Pen (constant)' },
      { id: 'pressure-pen', icon: Pen, label: 'Pressure Pen', badge: '∿' },
      { id: 'highlighter', icon: Highlighter, label: 'Highlighter' },
      { id: 'vanishing-pen', icon: Zap, label: 'Vanishing Glow Pen' },
      { id: 'eraser', icon: Eraser, label: 'Eraser' },
    ],
  },
  {
    label: 'Shapes',
    tools: [
      { id: 'rectangle', icon: Square, label: 'Rectangle' },
      { id: 'circle', icon: Circle, label: 'Circle/Ellipse' },
      { id: 'arrow', icon: ArrowRight, label: 'Arrow' },
      { id: 'line', icon: Minus, label: 'Line' },
    ],
  },
];

export default function Toolbar({
  tool,
  strokeStyle,
  backgroundType,
  backgroundColor,
  onToolChange,
  onStyleChange,
  onBgTypeChange,
  onBgColorChange,
  onClear,
  onUndo,
  onRedo,
  onAddImage,
  onExport,
  onToggleMagic,
  magicActive,
  canUndo,
  canRedo,
}: ToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBgPanel, setShowBgPanel] = useState(false);
  const [showWidthPanel, setShowWidthPanel] = useState(false);
  const [customColor, setCustomColor] = useState(strokeStyle.color);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const isDark = backgroundColor === 'black';
  const toolbarBg = isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200';
  const btnBase = isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-gray-600 hover:bg-gray-100';
  const activeBg = isDark ? 'bg-indigo-700 text-white' : 'bg-indigo-600 text-white';
  const labelColor = isDark ? 'text-zinc-400' : 'text-gray-400';
  const panelBg = isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200';

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        const maxW = 600;
        const scale = Math.min(1, maxW / img.width);
        onAddImage(dataUrl, img.width * scale, img.height * scale);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const isVanishingTool = tool === 'vanishing-pen';
  const currentColors = isVanishingTool ? VANISHING_COLORS : PRESET_COLORS;

  return (
    <div className={`flex flex-col gap-1 p-2 border-r overflow-y-auto overflow-x-hidden select-none ${toolbarBg}`} style={{ width: 64, minHeight: 0 }}>
      {/* Magic Stream Button - TOP PRIORITY */}
      <button
        onClick={onToggleMagic}
        className={`w-full flex flex-col items-center justify-center gap-0.5 rounded-xl p-2 text-xs font-bold transition-all ${
          magicActive
            ? 'bg-gradient-to-b from-purple-600 to-indigo-700 text-white shadow-lg shadow-purple-500/40'
            : 'bg-gradient-to-b from-purple-100 to-indigo-100 text-purple-700 border border-purple-300'
        }`}
        title="Magic Stream Tool – Your private notes"
      >
        <BookOpen size={18} />
        <span style={{ fontSize: 9 }}>MAGIC</span>
      </button>

      <div className={`w-full border-t my-1 ${isDark ? 'border-zinc-700' : 'border-gray-200'}`} />

      {/* Tool Groups */}
      {toolGroups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <span className={`text-center font-semibold uppercase tracking-wide ${labelColor}`} style={{ fontSize: 8 }}>{group.label}</span>
          {group.tools.map(({ id, icon: Icon, label, badge }) => (
            <button
              key={id}
              onClick={() => onToolChange(id as ToolType)}
              className={`relative w-full flex flex-col items-center justify-center gap-0.5 rounded-lg p-1.5 transition-all ${
                tool === id ? activeBg : btnBase
              }`}
              title={label}
            >
              <Icon size={16} />
              {badge && <span className="absolute top-0.5 right-0.5 text-yellow-400 font-bold" style={{ fontSize: 8 }}>{badge}</span>}
              <span style={{ fontSize: 8 }}>{label.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      ))}

      <div className={`w-full border-t my-1 ${isDark ? 'border-zinc-700' : 'border-gray-200'}`} />

      {/* Color Section */}
      <span className={`text-center font-semibold uppercase tracking-wide ${labelColor}`} style={{ fontSize: 8 }}>Color</span>

      {/* Current color display */}
      <div
        className="w-8 h-8 rounded-full border-2 border-gray-300 mx-auto cursor-pointer shadow-sm"
        style={{ backgroundColor: strokeStyle.color }}
        onClick={() => colorInputRef.current?.click()}
        title="Pick custom color"
      />
      <input
        ref={colorInputRef}
        type="color"
        value={customColor}
        className="sr-only"
        onChange={(e) => {
          setCustomColor(e.target.value);
          onStyleChange({ color: e.target.value });
        }}
      />

      {/* Preset colors */}
      <div className="grid grid-cols-2 gap-1 px-0.5">
        {currentColors.slice(0, 8).map((c) => (
          <button
            key={c}
            className={`rounded-full transition-transform hover:scale-110 ${strokeStyle.color === c ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
            style={{ backgroundColor: c, width: 20, height: 20, border: c === '#FFFFFF' ? '1.5px solid #ccc' : 'none' }}
            onClick={() => onStyleChange({ color: c })}
            title={c}
          />
        ))}
      </div>
      <button
        className={`w-full flex items-center justify-center rounded-lg p-1 text-xs transition-all ${btnBase}`}
        onClick={() => setShowColorPicker((v) => !v)}
        title="More colors"
      >
        <Palette size={12} />
        <ChevronDown size={10} />
      </button>
      {showColorPicker && (
        <div className={`absolute left-16 z-50 rounded-xl shadow-xl border p-3 ${panelBg}`} style={{ width: 200, top: 140 }}>
          <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-zinc-300' : 'text-gray-600'}`}>
            {isVanishingTool ? '✨ Glow Colors' : 'Color Palette'}
          </p>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {(isVanishingTool ? VANISHING_COLORS : PRESET_COLORS).map((c) => (
              <button
                key={c}
                className={`rounded-full w-8 h-8 transition-transform hover:scale-110 ${strokeStyle.color === c ? 'ring-2 ring-indigo-500' : ''}`}
                style={{ backgroundColor: c, border: c === '#FFFFFF' ? '1.5px solid #ccc' : 'none' }}
                onClick={() => { onStyleChange({ color: c }); setShowColorPicker(false); }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={customColor}
              className="w-8 h-8 rounded cursor-pointer border-0"
              onChange={(e) => { setCustomColor(e.target.value); onStyleChange({ color: e.target.value }); }}
            />
            <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Custom</span>
          </div>
        </div>
      )}

      <div className={`w-full border-t my-1 ${isDark ? 'border-zinc-700' : 'border-gray-200'}`} />

      {/* Width */}
      <span className={`text-center font-semibold uppercase tracking-wide ${labelColor}`} style={{ fontSize: 8 }}>Width</span>
      <button
        className={`w-full flex items-center justify-center gap-1 rounded-lg p-1 text-xs ${btnBase}`}
        onClick={() => setShowWidthPanel((v) => !v)}
      >
        <span style={{ display: 'inline-block', width: strokeStyle.width * 2, height: strokeStyle.width * 2, borderRadius: '50%', backgroundColor: strokeStyle.color, maxWidth: 16, maxHeight: 16 }} />
        <ChevronDown size={10} />
      </button>
      {showWidthPanel && (
        <div className={`absolute left-16 z-50 rounded-xl shadow-xl border p-3 ${panelBg}`} style={{ width: 180, top: 340 }}>
          <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-zinc-300' : 'text-gray-600'}`}>Stroke Width</p>
          <input
            type="range"
            min={1}
            max={30}
            value={strokeStyle.width}
            onChange={(e) => onStyleChange({ width: Number(e.target.value) })}
            className="w-full"
          />
          <div className="flex justify-between mt-1">
            {[2, 4, 8, 14, 22].map((w) => (
              <button
                key={w}
                className={`rounded-full transition-transform hover:scale-110 ${strokeStyle.width === w ? 'ring-2 ring-indigo-500' : ''}`}
                style={{ width: w + 6, height: w + 6, backgroundColor: strokeStyle.color, border: '1px solid #ccc' }}
                onClick={() => { onStyleChange({ width: w }); setShowWidthPanel(false); }}
              />
            ))}
          </div>
        </div>
      )}

      <div className={`w-full border-t my-1 ${isDark ? 'border-zinc-700' : 'border-gray-200'}`} />

      {/* Background */}
      <span className={`text-center font-semibold uppercase tracking-wide ${labelColor}`} style={{ fontSize: 8 }}>Canvas</span>
      <button
        className={`w-full flex flex-col items-center justify-center gap-0.5 rounded-lg p-1 text-xs transition-all ${btnBase}`}
        onClick={() => setShowBgPanel((v) => !v)}
        title="Background options"
      >
        <LayoutGrid size={14} />
        <span style={{ fontSize: 8 }}>Background</span>
      </button>
      {showBgPanel && (
        <div className={`absolute left-16 z-50 rounded-xl shadow-xl border p-3 ${panelBg}`} style={{ width: 220, top: 500 }}>
          <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-zinc-300' : 'text-gray-600'}`}>Background Style</p>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {(['blank', 'grid', 'dots', 'lines'] as BackgroundType[]).map((bt) => (
              <button
                key={bt}
                onClick={() => onBgTypeChange(bt)}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${backgroundType === bt ? 'border-indigo-500 bg-indigo-50' : isDark ? 'border-zinc-600' : 'border-gray-200'}`}
              >
                {bt === 'blank' && <div className="w-8 h-8 rounded border border-gray-300 bg-white" />}
                {bt === 'grid' && <LayoutGrid size={20} className="text-gray-500" />}
                {bt === 'dots' && <Dot size={20} className="text-gray-500" />}
                {bt === 'lines' && <AlignJustify size={20} className="text-gray-500" />}
                <span className={`text-xs capitalize ${isDark ? 'text-zinc-300' : 'text-gray-600'}`}>{bt}</span>
              </button>
            ))}
          </div>
          <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-zinc-300' : 'text-gray-600'}`}>Background Color</p>
          <div className="flex gap-2">
            {(['white', 'pale-yellow', 'black'] as BackgroundColor[]).map((bc) => (
              <button
                key={bc}
                onClick={() => onBgColorChange(bc)}
                className={`rounded-full w-9 h-9 border-2 transition-all ${backgroundColor === bc ? 'border-indigo-500 scale-110' : 'border-gray-300'}`}
                style={{ backgroundColor: BG_COLORS[bc] }}
                title={bc}
              >
                {bc === 'black' && <Moon size={12} className="text-white mx-auto" />}
                {bc === 'white' && <Sun size={12} className="text-gray-400 mx-auto" />}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`w-full border-t my-1 ${isDark ? 'border-zinc-700' : 'border-gray-200'}`} />

      {/* Actions */}
      <span className={`text-center font-semibold uppercase tracking-wide ${labelColor}`} style={{ fontSize: 8 }}>Actions</span>

      <button onClick={onUndo} disabled={!canUndo} className={`w-full flex flex-col items-center justify-center gap-0.5 rounded-lg p-1.5 text-xs transition-all ${canUndo ? btnBase : 'opacity-30 cursor-not-allowed'}`} title="Undo">
        <RotateCcw size={14} />
        <span style={{ fontSize: 8 }}>Undo</span>
      </button>
      <button onClick={onRedo} disabled={!canRedo} className={`w-full flex flex-col items-center justify-center gap-0.5 rounded-lg p-1.5 text-xs transition-all ${canRedo ? btnBase : 'opacity-30 cursor-not-allowed'}`} title="Redo">
        <RotateCw size={14} />
        <span style={{ fontSize: 8 }}>Redo</span>
      </button>

      <button
        onClick={() => fileInputRef.current?.click()}
        className={`w-full flex flex-col items-center justify-center gap-0.5 rounded-lg p-1.5 text-xs transition-all ${btnBase}`}
        title="Add Image"
      >
        <Image size={14} />
        <span style={{ fontSize: 8 }}>Image</span>
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleImageUpload} />

      <button onClick={onExport} className={`w-full flex flex-col items-center justify-center gap-0.5 rounded-lg p-1.5 text-xs transition-all ${btnBase}`} title="Export as PNG">
        <Download size={14} />
        <span style={{ fontSize: 8 }}>Export</span>
      </button>

      <button
        onClick={onClear}
        className="w-full flex flex-col items-center justify-center gap-0.5 rounded-lg p-1.5 text-xs transition-all text-red-500 hover:bg-red-50"
        title="Clear page"
      >
        <Trash2 size={14} />
        <span style={{ fontSize: 8 }}>Clear</span>
      </button>
    </div>
  );
}
