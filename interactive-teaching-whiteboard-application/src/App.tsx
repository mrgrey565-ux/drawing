import { useState, useRef, useCallback } from 'react';
import Canvas, { CanvasHandle } from './components/Canvas';
import Toolbar from './components/Toolbar';
import PageManager from './components/PageManager';
import MagicStreamTool from './components/MagicStreamTool';
import ElementEditor from './components/ElementEditor';
import WelcomeModal from './components/WelcomeModal';
import {
  ToolType,
  StrokeStyle,
  DrawingElement,
  Page,
  BackgroundType,
  BackgroundColor,
} from './types';
import { generateId } from './utils/drawing';

const defaultStyle: StrokeStyle = {
  color: '#000000',
  width: 4,
  opacity: 1,
};

const createPage = (bgType: BackgroundType = 'blank', bgColor: BackgroundColor = 'white'): Page => ({
  id: generateId(),
  elements: [],
  background: bgType,
  backgroundColor: bgColor,
});

export default function App() {
  const [pages, setPages] = useState<Page[]>([createPage()]);
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [tool, setTool] = useState<ToolType>('pen');
  const [strokeStyle, setStrokeStyle] = useState<StrokeStyle>(defaultStyle);
  const [backgroundType, setBackgroundType] = useState<BackgroundType>('blank');
  const [backgroundColor, setBackgroundColor] = useState<BackgroundColor>('white');
  const [showMagic, setShowMagic] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Undo/Redo per page
  const [history, setHistory] = useState<Record<string, DrawingElement[][]>>({});
  const [historyIdx, setHistoryIdx] = useState<Record<string, number>>({});

  const canvasRef = useRef<CanvasHandle>(null);

  const currentPage = pages[currentPageIdx];
  const pageId = currentPage.id;

  const pushHistory = useCallback(
    (id: string, elements: DrawingElement[]) => {
      setHistory((prev) => {
        const stack = [...(prev[id] ?? [[]]).slice(0, (historyIdx[id] ?? 0) + 1), elements];
        return { ...prev, [id]: stack.slice(-50) }; // keep 50 steps
      });
      setHistoryIdx((prev) => {
        const cur = (prev[id] ?? 0);
        const newStack = [...((history[id] ?? [[]]).slice(0, cur + 1)), elements];
        return { ...prev, [id]: Math.min(newStack.length - 1, 49) };
      });
    },
    [history, historyIdx]
  );

  const handleElementsChange = useCallback(
    (elements: DrawingElement[]) => {
      setPages((prev) =>
        prev.map((p, i) => (i === currentPageIdx ? { ...p, elements } : p))
      );
      pushHistory(pageId, elements);
    },
    [currentPageIdx, pageId, pushHistory]
  );

  const handleUndo = useCallback(() => {
    const stack = history[pageId] ?? [[]];
    const idx = historyIdx[pageId] ?? 0;
    if (idx > 0) {
      const newIdx = idx - 1;
      setHistoryIdx((prev) => ({ ...prev, [pageId]: newIdx }));
      setPages((prev) =>
        prev.map((p, i) => (i === currentPageIdx ? { ...p, elements: stack[newIdx] } : p))
      );
    }
  }, [history, historyIdx, pageId, currentPageIdx]);

  const handleRedo = useCallback(() => {
    const stack = history[pageId] ?? [[]];
    const idx = historyIdx[pageId] ?? 0;
    if (idx < stack.length - 1) {
      const newIdx = idx + 1;
      setHistoryIdx((prev) => ({ ...prev, [pageId]: newIdx }));
      setPages((prev) =>
        prev.map((p, i) => (i === currentPageIdx ? { ...p, elements: stack[newIdx] } : p))
      );
    }
  }, [history, historyIdx, pageId, currentPageIdx]);

  const canUndo = (historyIdx[pageId] ?? 0) > 0;
  const canRedo = (historyIdx[pageId] ?? 0) < ((history[pageId] ?? [[]]).length - 1);

  const handleStyleChange = useCallback((partial: Partial<StrokeStyle>) => {
    setStrokeStyle((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleBgTypeChange = useCallback((type: BackgroundType) => {
    setBackgroundType(type);
    setPages((prev) =>
      prev.map((p, i) => (i === currentPageIdx ? { ...p, background: type } : p))
    );
  }, [currentPageIdx]);

  const handleBgColorChange = useCallback((color: BackgroundColor) => {
    setBackgroundColor(color);
    setPages((prev) =>
      prev.map((p, i) => (i === currentPageIdx ? { ...p, backgroundColor: color } : p))
    );
  }, [currentPageIdx]);

  const handlePageChange = useCallback(
    (idx: number) => {
      setCurrentPageIdx(idx);
      const page = pages[idx];
      setBackgroundType(page.background);
      setBackgroundColor(page.backgroundColor);
    },
    [pages]
  );

  const handleAddPage = useCallback(() => {
    const newPage = createPage(backgroundType, backgroundColor);
    setPages((prev) => [...prev, newPage]);
    setCurrentPageIdx(pages.length);
  }, [pages.length, backgroundType, backgroundColor]);

  const handleDeletePage = useCallback(
    (idx: number) => {
      if (pages.length === 1) return;
      setPages((prev) => prev.filter((_, i) => i !== idx));
      setCurrentPageIdx((prev) => Math.min(prev, pages.length - 2));
    },
    [pages.length]
  );

  const handleAddImage = useCallback(
    (dataUrl: string, w: number, h: number) => {
      const el: DrawingElement = {
        id: generateId(),
        type: 'image',
        x: 100,
        y: 100,
        width: w,
        height: h,
        imageData: dataUrl,
        style: { ...strokeStyle },
        createdAt: Date.now(),
      };
      const newElements = [...currentPage.elements, el];
      handleElementsChange(newElements);
    },
    [currentPage.elements, strokeStyle, handleElementsChange]
  );

  const handleExport = useCallback(() => {
    const dataUrl = canvasRef.current?.exportImage();
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `streamboard-page-${currentPageIdx + 1}.png`;
    link.click();
  }, [currentPageIdx]);

  const handleClear = useCallback(() => {
    handleElementsChange([]);
  }, [handleElementsChange]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
      if (e.key === 'Escape') setShowMagic(false);
      // Tool shortcuts
      if (!e.metaKey && !e.ctrlKey) {
        switch (e.key) {
          case 'p': setTool('pen'); break;
          case 'P': setTool('pressure-pen'); break;
          case 'h': setTool('highlighter'); break;
          case 'v': setTool('vanishing-pen'); break;
          case 'e': setTool('eraser'); break;
          case 's': setTool('select'); break;
          case 'r': setTool('rectangle'); break;
          case 'c': setTool('circle'); break;
          case 'a': setTool('arrow'); break;
          case 'l': setTool('line'); break;
          case 'm': setShowMagic((v) => !v); break;
        }
      }
    },
    [handleUndo, handleRedo]
  );

  const isDark = backgroundColor === 'black';
  const appBg = isDark ? '#0f0f0f' : '#f1f5f9';

  return (
    <div
      className="flex flex-col"
      style={{ width: '100vw', height: '100vh', background: appBg, overflow: 'hidden' }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Top Header Bar */}
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{
          background: isDark ? '#1a1a2e' : 'linear-gradient(90deg, #312e81, #1e40af)',
          borderBottom: '1px solid rgba(99,102,241,0.3)',
          minHeight: 44,
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
              <span style={{ fontSize: 16 }}>🎓</span>
            </div>
            <div>
              <span className="text-white font-bold text-sm">StreamBoard</span>
              <span className="text-indigo-200 text-xs ml-2">NEET PG Live Teaching</span>
            </div>
          </div>
        </div>

        {/* Tool indicator */}
        <div className="hidden sm:flex items-center gap-2">
          <div
            className="px-3 py-1 rounded-full text-xs font-semibold text-white flex items-center gap-1.5"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <span>{
              tool === 'pen' ? '✏️' :
              tool === 'pressure-pen' ? '🖊' :
              tool === 'highlighter' ? '🖌' :
              tool === 'vanishing-pen' ? '⚡' :
              tool === 'eraser' ? '🧹' :
              tool === 'select' ? '👆' :
              tool === 'rectangle' ? '▭' :
              tool === 'circle' ? '○' :
              tool === 'arrow' ? '→' :
              tool === 'line' ? '╱' : '✏️'
            }</span>
            {tool.replace(/-/g, ' ').toUpperCase()}
          </div>
          <div
            className="w-5 h-5 rounded-full border-2 border-white/50"
            style={{ backgroundColor: strokeStyle.color }}
            title="Current color"
          />
          <div className="text-white/70 text-xs">
            W:{strokeStyle.width}px
          </div>
        </div>

        {/* Magic Button - Header */}
        <button
          onClick={() => setShowMagic((v) => !v)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold transition-all"
          style={{
            background: showMagic
              ? 'linear-gradient(135deg, #7c3aed, #6d28d9)'
              : 'rgba(255,255,255,0.15)',
            color: 'white',
            border: showMagic ? '2px solid rgba(167,139,250,0.8)' : '2px solid rgba(255,255,255,0.2)',
            boxShadow: showMagic ? '0 0 20px rgba(124,58,237,0.5)' : 'none',
          }}
        >
          <span>✨</span>
          <span>Magic Notes</span>
          {showMagic && <span className="text-yellow-300 animate-pulse">●</span>}
        </button>
      </div>

      {/* Keyboard shortcuts hint */}
      <div
        className="flex items-center gap-4 px-4 py-1 flex-shrink-0 overflow-x-auto"
        style={{
          background: isDark ? 'rgba(30,30,50,0.8)' : 'rgba(238,242,255,0.8)',
          borderBottom: `1px solid ${isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.2)'}`,
          fontSize: 10,
        }}
      >
        <span className={`font-medium whitespace-nowrap ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>⌨ Shortcuts:</span>
        {[
          ['p', 'Pen'], ['P', 'Pressure'], ['h', 'Highlight'], ['v', 'Vanish'], ['e', 'Erase'],
          ['r', 'Rect'], ['c', 'Circle'], ['a', 'Arrow'], ['m', 'Magic'], ['⌘Z', 'Undo'],
        ].map(([key, label]) => (
          <span key={key} className={`whitespace-nowrap ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
            <kbd
              className="px-1 py-0.5 rounded text-xs font-mono"
              style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}
            >{key}</kbd> {label}
          </span>
        ))}
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Toolbar */}
        <Toolbar
          tool={tool}
          strokeStyle={strokeStyle}
          backgroundType={backgroundType}
          backgroundColor={backgroundColor}
          onToolChange={setTool}
          onStyleChange={handleStyleChange}
          onBgTypeChange={handleBgTypeChange}
          onBgColorChange={handleBgColorChange}
          onClear={handleClear}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onAddImage={handleAddImage}
          onExport={handleExport}
          onToggleMagic={() => setShowMagic((v) => !v)}
          magicActive={showMagic}
          canUndo={canUndo}
          canRedo={canRedo}
        />

        {/* Canvas area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
          <div className="flex-1 min-h-0">
            <Canvas
              ref={canvasRef}
              tool={tool}
              strokeStyle={strokeStyle}
              elements={currentPage.elements}
              backgroundType={currentPage.background}
              backgroundColor={currentPage.backgroundColor}
              onElementsChange={handleElementsChange}
              onSelectElement={setSelectedElementId}
            />
          </div>

          {/* Element Editor Panel */}
          {selectedElementId && tool === 'select' && (() => {
            const el = currentPage.elements.find((e) => e.id === selectedElementId);
            if (!el) return null;
            return (
              <ElementEditor
                element={el}
                isDark={backgroundColor === 'black'}
                onUpdate={(updated) => {
                  handleElementsChange(
                    currentPage.elements.map((e) => (e.id === updated.id ? updated : e))
                  );
                }}
                onDelete={() => {
                  handleElementsChange(currentPage.elements.filter((e) => e.id !== selectedElementId));
                  setSelectedElementId(null);
                }}
                onClose={() => setSelectedElementId(null)}
              />
            );
          })()}

          {/* Page Manager */}
          <PageManager
            pages={pages}
            currentPage={currentPageIdx}
            onPageChange={handlePageChange}
            onAddPage={handleAddPage}
            onDeletePage={handleDeletePage}
            backgroundColor={backgroundColor}
          />
        </div>
      </div>

      {/* Magic Stream Tool - Floating overlay */}
      {showMagic && (
        <MagicStreamTool onClose={() => setShowMagic(false)} />
      )}

      {/* Welcome Modal */}
      {showWelcome && (
        <WelcomeModal onClose={() => setShowWelcome(false)} />
      )}
    </div>
  );
}
