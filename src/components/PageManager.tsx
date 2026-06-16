
import { Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Page, BackgroundColor } from '../types';

interface PageManagerProps {
  pages: Page[];
  currentPage: number;
  onPageChange: (index: number) => void;
  onAddPage: () => void;
  onDeletePage: (index: number) => void;
  backgroundColor: BackgroundColor;
}

export default function PageManager({
  pages,
  currentPage,
  onPageChange,
  onAddPage,
  onDeletePage,
  backgroundColor,
}: PageManagerProps) {
  const isDark = backgroundColor === 'black';
  const barBg = isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200';
  const btnBase = isDark ? 'text-zinc-300 hover:bg-zinc-800 border-zinc-600' : 'text-gray-600 hover:bg-gray-100 border-gray-300';
  const activeBtn = isDark ? 'bg-indigo-700 text-white border-indigo-700' : 'bg-indigo-600 text-white border-indigo-600';

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 border-t ${barBg} overflow-x-auto`} style={{ minHeight: 48 }}>
      {/* Nav arrows */}
      <button
        onClick={() => onPageChange(Math.max(0, currentPage - 1))}
        disabled={currentPage === 0}
        className={`p-1 rounded-lg border transition-all ${currentPage === 0 ? 'opacity-30 cursor-not-allowed' : btnBase}`}
      >
        <ChevronLeft size={16} />
      </button>

      {/* Page thumbnails */}
      <div className="flex gap-2 overflow-x-auto flex-1 py-1">
        {pages.map((page, idx) => (
          <div key={page.id} className="relative flex-shrink-0 group">
            <button
              onClick={() => onPageChange(idx)}
              className={`flex items-center justify-center rounded-lg border-2 text-xs font-semibold transition-all ${
                idx === currentPage ? activeBtn : btnBase
              }`}
              style={{ width: 48, height: 32, fontSize: 11 }}
            >
              {idx + 1}
            </button>
            {pages.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); onDeletePage(idx); }}
                className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center justify-center w-4 h-4 bg-red-500 text-white rounded-full"
                style={{ fontSize: 10 }}
              >
                <Trash2 size={8} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add page */}
      <button
        onClick={onAddPage}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium transition-all ${btnBase}`}
      >
        <Plus size={14} />
        <span>Page</span>
      </button>

      <button
        onClick={() => onPageChange(Math.min(pages.length - 1, currentPage + 1))}
        disabled={currentPage === pages.length - 1}
        className={`p-1 rounded-lg border transition-all ${currentPage === pages.length - 1 ? 'opacity-30 cursor-not-allowed' : btnBase}`}
      >
        <ChevronRight size={16} />
      </button>

      {/* Page indicator */}
      <span className={`text-xs font-medium whitespace-nowrap ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
        {currentPage + 1} / {pages.length}
      </span>
    </div>
  );
}
