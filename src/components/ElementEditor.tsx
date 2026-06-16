import { DrawingElement, PRESET_COLORS } from '../types';
import { X, Trash2 } from 'lucide-react';

interface ElementEditorProps {
  element: DrawingElement;
  onUpdate: (el: DrawingElement) => void;
  onDelete: () => void;
  onClose: () => void;
  isDark: boolean;
}

export default function ElementEditor({ element, onUpdate, onDelete, onClose, isDark }: ElementEditorProps) {
  const panelBg = isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-gray-200 text-gray-800';
  const inputCls = isDark
    ? 'bg-zinc-800 border-zinc-600 text-white rounded-lg px-2 py-1 text-sm w-full outline-none focus:border-indigo-500'
    : 'bg-gray-50 border-gray-300 text-gray-800 rounded-lg px-2 py-1 text-sm w-full outline-none focus:border-indigo-500';

  const label = isDark ? 'text-zinc-400 text-xs' : 'text-gray-500 text-xs';

  return (
    <div className={`absolute right-4 top-16 z-50 rounded-2xl shadow-2xl border p-4 flex flex-col gap-3 ${panelBg}`} style={{ width: 240 }}>
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">Edit {element.type}</span>
        <div className="flex gap-1">
          <button onClick={onDelete} className="p-1 rounded text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 size={14} />
          </button>
          <button onClick={onClose} className={`p-1 rounded hover:bg-gray-100 transition-colors ${isDark ? 'hover:bg-zinc-800' : ''}`}>
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Color */}
      <div>
        <p className={label}>Color</p>
        <div className="grid grid-cols-6 gap-1 mt-1">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              className={`rounded-full w-6 h-6 transition-transform hover:scale-110 ${element.style.color === c ? 'ring-2 ring-indigo-500' : ''}`}
              style={{ backgroundColor: c, border: c === '#FFFFFF' ? '1.5px solid #ccc' : 'none' }}
              onClick={() => onUpdate({ ...element, style: { ...element.style, color: c } })}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <input
            type="color"
            value={element.style.color}
            className="w-8 h-8 rounded cursor-pointer border-0"
            onChange={(e) => onUpdate({ ...element, style: { ...element.style, color: e.target.value } })}
          />
          <span className={label}>Custom color</span>
        </div>
      </div>

      {/* Width */}
      <div>
        <p className={label}>Stroke Width: {element.style.width}px</p>
        <input
          type="range"
          min={1}
          max={30}
          value={element.style.width}
          onChange={(e) => onUpdate({ ...element, style: { ...element.style, width: Number(e.target.value) } })}
          className="w-full mt-1"
        />
      </div>

      {/* Opacity */}
      <div>
        <p className={label}>Opacity: {Math.round(element.style.opacity * 100)}%</p>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={element.style.opacity}
          onChange={(e) => onUpdate({ ...element, style: { ...element.style, opacity: Number(e.target.value) } })}
          className="w-full mt-1"
        />
      </div>

      {/* Position/Size for shapes */}
      {(element.type === 'rectangle' || element.type === 'circle' || element.type === 'image') && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className={label}>X</p>
            <input
              type="number"
              value={Math.round(element.x ?? 0)}
              onChange={(e) => onUpdate({ ...element, x: Number(e.target.value) })}
              className={`${inputCls} border`}
            />
          </div>
          <div>
            <p className={label}>Y</p>
            <input
              type="number"
              value={Math.round(element.y ?? 0)}
              onChange={(e) => onUpdate({ ...element, y: Number(e.target.value) })}
              className={`${inputCls} border`}
            />
          </div>
          <div>
            <p className={label}>Width</p>
            <input
              type="number"
              value={Math.round(element.width ?? 0)}
              onChange={(e) => onUpdate({ ...element, width: Number(e.target.value) })}
              className={`${inputCls} border`}
            />
          </div>
          <div>
            <p className={label}>Height</p>
            <input
              type="number"
              value={Math.round(element.height ?? 0)}
              onChange={(e) => onUpdate({ ...element, height: Number(e.target.value) })}
              className={`${inputCls} border`}
            />
          </div>
        </div>
      )}

      <button
        onClick={onDelete}
        className="w-full py-2 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
      >
        Delete Element
      </button>
    </div>
  );
}
