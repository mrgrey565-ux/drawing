import { useState, useRef, useCallback, useEffect } from 'react';
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

// localStorage keys for C6 persistence.
const STORAGE_KEY = 'streamboard:v1';
const WELCOME_KEY = 'streamboard:welcome-dismissed:v1';

type PersistedState = {
  pages: Page[];
  currentPageIdx: number;
  tool: ToolType;
  strokeStyle: StrokeStyle;
  backgroundType: BackgroundType;
  backgroundColor: BackgroundColor;
  history: Record<string, DrawingElement[][]>;
  historyIdx: Record<string, number>;
};

function loadPersisted(): Partial<PersistedState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    // Minimal validation: must have at least one page with an id.
    if (!parsed.pages || !Array.isArray(parsed.pages) || parsed.pages.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export default function App() {
  // Hydrate from localStorage on first render so a refresh doesn't wipe
  // the teacher's pages, drawings, and history (C6). Fall back to fresh
  // defaults if storage is missing/corrupt.
  const persisted = loadPersisted();

  const [pages, setPages] = useState<Page[]>(persisted?.pages ?? [createPage()]);
  const [currentPageIdx, setCurrentPageIdx] = useState<number>(persisted?.currentPageIdx ?? 0);
  const [tool, setTool] = useState<ToolType>(persisted?.tool ?? 'pen');
  const [strokeStyle, setStrokeStyle] = useState<StrokeStyle>(persisted?.strokeStyle ?? defaultStyle);
  const [backgroundType, setBackgroundType] = useState<BackgroundType>(persisted?.backgroundType ?? 'blank');
  const [backgroundColor, setBackgroundColor] = useState<BackgroundColor>(persisted?.backgroundColor ?? 'white');
  const [showMagic, setShowMagic] = useState(false);
  const [showWelcome, setShowWelcome] = useState<boolean>(() => {
    try {
      return localStorage.getItem(WELCOME_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Undo/Redo per page
  const [history, setHistory] = useState<Record<string, DrawingElement[][]>>(persisted?.history ?? {});
  const [historyIdx, setHistoryIdx] = useState<Record<string, number>>(persisted?.historyIdx ?? {});

  const canvasRef = useRef<CanvasHandle>(null);

  const currentPage = pages[Math.min(currentPageIdx, pages.length - 1)];
  const pageId = currentPage.id;

  // Keep a ref mirror of `historyIdx` so `pushHistory` can read the latest
  // value inside its `setHistory` updater without depending on a closure
  // (H1). State remains the source of truth for renders.
  const historyIdxRef = useRef<Record<string, number>>({});
  // Keep the ref in sync on every render.
  historyIdxRef.current = historyIdx;

  const pushHistory = useCallback((id: string, elements: DrawingElement[]) => {
    // Deep-clone the elements array so subsequent mutations to the live
    // `pages` state don't alias into history. Without this, every history
    // entry ended up pointing at the same array as the most recent state —
    // undo/redo collapsed, and the 50-step limit broke (C5).
    const snapshot = elements.map((el) => ({ ...el }));
    setHistory((prev) => {
      const cur = prev[id] ?? [[]];
      const idx = historyIdxRef.current[id] ?? 0;
      // Truncate the redo branch (undo → draw) before appending.
      const truncated = cur.slice(0, idx + 1);
      const next = [...truncated, snapshot];
      const capped = next.length > 50 ? next.slice(next.length - 50) : next;
      return { ...prev, [id]: capped };
    });
    // Bump the index in a separate setter; the new stack's last index is
    // `capped.length - 1`, but since we cap at 50, the highest valid index is
    // 49, and after a truncate the new last index is also the just-pushed one.
    setHistoryIdx((prev) => ({
      ...prev,
      [id]: Math.min((prev[id] ?? 0) + 1, 49),
    }));
  }, []);

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

  // C6: Auto-save the critical teaching state to localStorage on change
  // (debounced) so a refresh, iPad sleep, or Safari tab-purge doesn't lose
  // the teacher's work. PDF page dataURLs are large and excluded from the
  // main snapshot to keep the storage budget reasonable; the live `pages`
  // don't store PDFs in this state shape — only Magic notes do, and those
  // are persisted separately inside MagicStreamTool.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      try {
        const snapshot: PersistedState = {
          pages,
          currentPageIdx,
          tool,
          strokeStyle,
          backgroundType,
          backgroundColor,
          history,
          historyIdx,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        // Quota errors or storage disabled — silently skip; the in-memory
        // state still works for the current session.
      }
    }, 400);
    return () => window.clearTimeout(handle);
  }, [pages, currentPageIdx, tool, strokeStyle, backgroundType, backgroundColor, history, historyIdx]);

  // C6: Warn before reload so a careless refresh doesn't lose the latest
  // unsaved strokes (the debounce above gives a 400ms grace window, but a
  // user can still hit reload mid-debounce).
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore the return value but require returnValue set.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // C6: Persist the welcome-dismissed flag so the modal doesn't reappear
  // on every reload.
  useEffect(() => {
    if (!showWelcome) {
      try {
        localStorage.setItem(WELCOME_KEY, '1');
      } catch {
        /* ignore */
      }
    }
  }, [showWelcome]);

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
