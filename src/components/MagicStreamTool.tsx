import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  BookOpen,
  X,
  Upload,
  FileText,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Minimize2,
  Maximize2,
  GripHorizontal,
  AlertTriangle,
  Type,
} from 'lucide-react';
import { Note } from '../types';
import { generateId } from '../utils/drawing';

interface MagicStreamToolProps {
  onClose: () => void;
}

// localStorage key for Magic notes (C6). We keep this separate from the
// main app snapshot so PDF-heavy notes (large base64 dataURLs) don't blow
// the budget for page state.
const NOTES_KEY = 'streamboard:magic-notes:v1';

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Note[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function MagicStreamTool({ onClose }: MagicStreamToolProps) {
  // C6: Hydrate notes from localStorage so a refresh doesn't wipe the
  // teacher's prepared private notes.
  const [notes, setNotes] = useState<Note[]>(() => loadNotes());

  // C6: Auto-save notes on change (debounced) so refreshes / tab purges
  // don't lose the teacher's prepared material.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      try {
        localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
      } catch {
        // Quota exceeded (likely from large PDF page dataURLs) — skip.
      }
    }, 400);
    return () => window.clearTimeout(handle);
  }, [notes]);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [pdfCurrentPage, setPdfCurrentPage] = useState<Record<string, number>>({});
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [showAddNote, setShowAddNote] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  // Default to a "safe corner" so StreamChamp screen-mirroring doesn't capture the
  // panel by default. Bottom-left keeps it away from the header's "Magic Notes"
  // button and the typical front-camera top crop.
  const [position, setPosition] = useState({ x: 20, y: window.innerHeight - 360 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentNote = notes.find((n) => n.id === selectedNote);

  // Drag to move
  const onDragStart = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [position]);

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    setPosition({
      x: Math.max(0, Math.min(window.innerWidth - 420, e.clientX - dragOffset.current.x)),
      y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.current.y)),
    });
  }, [isDragging]);

  const onDragEnd = useCallback(() => setIsDragging(false), []);

  const addTextNote = () => {
    if (!newNoteTitle.trim() && !newNoteContent.trim()) return;
    const note: Note = {
      id: generateId(),
      title: newNoteTitle || 'Untitled Note',
      content: newNoteContent,
      type: 'text',
    };
    setNotes((prev) => [...prev, note]);
    setSelectedNote(note.id);
    setNewNoteTitle('');
    setNewNoteContent('');
    setShowAddNote(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/pdf') {
      setPdfLoading(true);
      try {
        // Dynamic import of pdfjs
        const pdfjsLib = await import('pdfjs-dist');
        // Bundle the worker locally via Vite's ?url import so it works offline
        // and in the single-file build, instead of relying on a version-pinned CDN URL.
        const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pages: string[] = [];

        for (let i = 1; i <= Math.min(pdf.numPages, 50); i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await page.render({ canvasContext: ctx as any, viewport, canvas } as any).promise;
          pages.push(canvas.toDataURL('image/jpeg', 0.85));
        }

        const note: Note = {
          id: generateId(),
          title: file.name.replace('.pdf', ''),
          content: '',
          type: 'pdf',
          pdfPages: pages,
          currentPage: 0,
        };
        setNotes((prev) => [...prev, note]);
        setSelectedNote(note.id);
        setPdfCurrentPage((prev) => ({ ...prev, [note.id]: 0 }));
      } catch (err) {
        console.error('PDF load error', err);
        alert('Error loading PDF. Please try a different file.');
      } finally {
        setPdfLoading(false);
      }
    } else if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const note: Note = {
          id: generateId(),
          title: file.name,
          content: ev.target?.result as string,
          type: 'text',
        };
        setNotes((prev) => [...prev, note]);
        setSelectedNote(note.id);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const deleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (selectedNote === id) setSelectedNote(notes.find((n) => n.id !== id)?.id ?? null);
  };

  const getPdfPage = (noteId: string) => pdfCurrentPage[noteId] ?? 0;

  const width = isFullscreen ? window.innerWidth - 80 : 420;
  const height = isFullscreen ? window.innerHeight - 80 : isMinimized ? 48 : 560;
  const posX = isFullscreen ? 40 : position.x;
  const posY = isFullscreen ? 40 : position.y;

  return (
    <div
      ref={containerRef}
      className="fixed z-[9999] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
      style={{
        left: posX,
        top: posY,
        width,
        height,
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e40af 100%)',
        border: '2px solid rgba(139, 92, 246, 0.6)',
        boxShadow: '0 0 40px rgba(139, 92, 246, 0.4), 0 20px 60px rgba(0,0,0,0.5)',
        transition: isDragging ? 'none' : 'height 0.2s ease',
        cursor: isDragging ? 'grabbing' : 'default',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing select-none flex-shrink-0"
        style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(139,92,246,0.3)' }}
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
      >
        <GripHorizontal size={14} className="text-purple-300" />
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          <BookOpen size={14} className="text-purple-300" />
          <span className="text-sm font-bold text-white">Magic Stream Tool</span>
          <span className="text-xs text-purple-300 font-medium">— Private Notes</span>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setShowHint((v) => !v)}
            className="p-1 rounded text-purple-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Toggle hint"
          >
            {showHint ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
          <button
            onClick={() => setIsMinimized((v) => !v)}
            className="p-1 rounded text-purple-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Minimize2 size={12} />
          </button>
          <button
            onClick={() => setIsFullscreen((v) => !v)}
            className="p-1 rounded text-purple-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded text-red-400 hover:text-white hover:bg-red-500/30 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Stream Hint Banner */}
          {showHint && (
            <div className="flex items-start gap-2 px-3 py-2 flex-shrink-0" style={{ background: 'rgba(234, 179, 8, 0.15)', borderBottom: '1px solid rgba(234,179,8,0.3)' }}>
              <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-yellow-300 font-semibold" style={{ fontSize: 11 }}>📱 StreamChamp / Screen Mirror Setup</p>
                <p className="text-yellow-200/80" style={{ fontSize: 10, lineHeight: 1.4 }}>
                  Position this window <strong>outside</strong> the screen-mirrored area. On iPad: use StreamChamp's crop/source area feature to capture only the whiteboard canvas — not this panel. Drag this to a corner your viewers can't see.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-1 min-h-0">
            {/* Sidebar - Notes List */}
            <div className="flex flex-col flex-shrink-0 border-r" style={{ width: 140, borderColor: 'rgba(139,92,246,0.3)', background: 'rgba(0,0,0,0.2)' }}>
              <div className="flex items-center justify-between px-2 py-1.5 flex-shrink-0" style={{ borderBottom: '1px solid rgba(139,92,246,0.2)' }}>
                <span className="text-xs font-semibold text-purple-300">Notes</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setShowAddNote(true); setSelectedNote(null); }}
                    className="p-1 rounded text-purple-300 hover:text-white hover:bg-white/10 transition-colors"
                    title="Add text note"
                  >
                    <Type size={11} />
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1 rounded text-purple-300 hover:text-white hover:bg-white/10 transition-colors"
                    title="Upload PDF / Image"
                  >
                    <Upload size={11} />
                  </button>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept=".pdf,image/*" className="sr-only" onChange={handleFileUpload} />

              <div className="flex-1 overflow-y-auto">
                {notes.length === 0 && (
                  <div className="p-3 text-center">
                    <FileText size={20} className="text-purple-400/50 mx-auto mb-1" />
                    <p className="text-purple-300/60" style={{ fontSize: 10 }}>No notes yet. Add text or upload PDF.</p>
                  </div>
                )}
                {notes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => { setSelectedNote(note.id); setShowAddNote(false); }}
                    className={`group relative px-2 py-2 cursor-pointer transition-all border-b ${
                      selectedNote === note.id
                        ? 'bg-purple-600/40 border-purple-500/30'
                        : 'hover:bg-white/10 border-transparent'
                    }`}
                    style={{ borderBottomColor: 'rgba(139,92,246,0.15)' }}
                  >
                    <div className="flex items-start gap-1">
                      {note.type === 'pdf' ? (
                        <FileText size={11} className="text-purple-300 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Type size={11} className="text-purple-300 flex-shrink-0 mt-0.5" />
                      )}
                      <span className="text-white font-medium truncate flex-1" style={{ fontSize: 11 }}>{note.title}</span>
                    </div>
                    {note.type === 'pdf' && (
                      <p className="text-purple-300/60 mt-0.5" style={{ fontSize: 9 }}>
                        {(note.pdfPages?.length ?? 0)} pages
                      </p>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                      className="absolute top-1 right-1 hidden group-hover:flex items-center justify-center w-4 h-4 bg-red-500/80 text-white rounded"
                    >
                      <Trash2 size={8} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Quick add */}
              <button
                onClick={() => { setShowAddNote(true); setSelectedNote(null); }}
                className="flex items-center justify-center gap-1 p-2 text-purple-300 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
                style={{ borderTop: '1px solid rgba(139,92,246,0.2)', fontSize: 11 }}
              >
                <Plus size={12} />
                Add Note
              </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              {pdfLoading && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-purple-300 text-sm">Loading PDF...</p>
                  </div>
                </div>
              )}

              {!pdfLoading && showAddNote && (
                <div className="flex-1 flex flex-col p-3 gap-3">
                  <p className="text-white font-semibold text-sm">Add Text Note / Paste Content</p>
                  <input
                    type="text"
                    placeholder="Note title..."
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    className="rounded-lg px-3 py-2 text-sm text-white placeholder-purple-300/60 outline-none"
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(139,92,246,0.4)' }}
                  />
                  <textarea
                    placeholder="Paste your notes here... You can also paste from anywhere (Ctrl+V / Cmd+V). This is ONLY visible to you, not to stream viewers."
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    className="flex-1 rounded-lg px-3 py-2 text-sm text-white placeholder-purple-300/60 outline-none resize-none"
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(139,92,246,0.4)', lineHeight: 1.6 }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={addTextNote}
                      className="flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-all"
                      style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}
                    >
                      Save Note
                    </button>
                    <button
                      onClick={() => setShowAddNote(false)}
                      className="px-3 py-2 rounded-lg text-sm text-purple-300 hover:text-white transition-colors"
                      style={{ background: 'rgba(255,255,255,0.1)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {!pdfLoading && !showAddNote && currentNote && currentNote.type === 'text' && (
                <div className="flex-1 overflow-y-auto p-3">
                  <h3 className="text-white font-bold text-sm mb-2 pb-2" style={{ borderBottom: '1px solid rgba(139,92,246,0.3)' }}>
                    {currentNote.title}
                  </h3>
                  {currentNote.content.startsWith('data:image') ? (
                    <img src={currentNote.content} alt={currentNote.title} className="max-w-full rounded-lg" />
                  ) : (
                    <div
                      className="text-purple-100 leading-relaxed whitespace-pre-wrap"
                      style={{ fontSize: 13, lineHeight: 1.7 }}
                    >
                      {currentNote.content || <span className="text-purple-300/50 italic">Empty note</span>}
                    </div>
                  )}
                </div>
              )}

              {!pdfLoading && !showAddNote && currentNote && currentNote.type === 'pdf' && currentNote.pdfPages && (
                <div className="flex-1 flex flex-col min-h-0">
                  {/* PDF Navigation */}
                  <div className="flex items-center justify-between px-3 py-1.5 flex-shrink-0" style={{ borderBottom: '1px solid rgba(139,92,246,0.3)', background: 'rgba(0,0,0,0.2)' }}>
                    <button
                      onClick={() => setPdfCurrentPage((prev) => ({ ...prev, [currentNote.id]: Math.max(0, getPdfPage(currentNote.id) - 1) }))}
                      disabled={getPdfPage(currentNote.id) === 0}
                      className={`p-1 rounded text-purple-300 hover:text-white hover:bg-white/10 transition-colors ${getPdfPage(currentNote.id) === 0 ? 'opacity-30' : ''}`}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-xs text-purple-200 font-medium">
                      Page {getPdfPage(currentNote.id) + 1} / {currentNote.pdfPages.length}
                    </span>
                    <button
                      onClick={() => setPdfCurrentPage((prev) => ({ ...prev, [currentNote.id]: Math.min(currentNote.pdfPages!.length - 1, getPdfPage(currentNote.id) + 1) }))}
                      disabled={getPdfPage(currentNote.id) === currentNote.pdfPages.length - 1}
                      className={`p-1 rounded text-purple-300 hover:text-white hover:bg-white/10 transition-colors ${getPdfPage(currentNote.id) === currentNote.pdfPages.length - 1 ? 'opacity-30' : ''}`}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                  {/* PDF Page View */}
                  <div className="flex-1 overflow-auto p-2">
                    <img
                      src={currentNote.pdfPages[getPdfPage(currentNote.id)]}
                      alt={`Page ${getPdfPage(currentNote.id) + 1}`}
                      className="w-full rounded-lg shadow-lg"
                      style={{ border: '1px solid rgba(139,92,246,0.3)' }}
                    />
                  </div>
                  {/* PDF page strip */}
                  <div className="flex gap-1 p-2 overflow-x-auto flex-shrink-0" style={{ borderTop: '1px solid rgba(139,92,246,0.2)', background: 'rgba(0,0,0,0.2)' }}>
                    {currentNote.pdfPages.map((page, idx) => (
                      <button
                        key={idx}
                        onClick={() => setPdfCurrentPage((prev) => ({ ...prev, [currentNote.id]: idx }))}
                        className={`flex-shrink-0 rounded transition-all ${getPdfPage(currentNote.id) === idx ? 'ring-2 ring-purple-400' : 'opacity-60 hover:opacity-100'}`}
                        style={{ width: 40, height: 52 }}
                      >
                        <img src={page} alt={`pg ${idx + 1}`} className="w-full h-full object-cover rounded" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!pdfLoading && !showAddNote && !currentNote && (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.2)' }}>
                    <BookOpen size={28} className="text-purple-400" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-base mb-1">Magic Stream Tool</p>
                    <p className="text-purple-300/70 text-xs leading-relaxed max-w-xs">
                      Your private teaching notes panel. Only you can see this. Add text notes, paste content, or upload PDFs.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAddNote(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                      style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}
                    >
                      <Type size={14} />
                      Add Notes
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                      style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(139,92,246,0.4)' }}
                    >
                      <Upload size={14} />
                      Upload PDF
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
