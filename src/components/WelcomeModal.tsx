import { X, BookOpen, Pen, Zap, Highlighter, Square, LayoutGrid } from 'lucide-react';

interface WelcomeModalProps {
  onClose: () => void;
}

export default function WelcomeModal({ onClose }: WelcomeModalProps) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div
        className="relative rounded-3xl p-6 max-w-lg w-full shadow-2xl overflow-y-auto"
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #1e3a8a 100%)',
          border: '2px solid rgba(139, 92, 246, 0.5)',
          boxShadow: '0 0 60px rgba(139,92,246,0.3)',
          maxHeight: '90vh',
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-purple-300 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={18} />
        </button>

        {/* Logo */}
        <div className="text-center mb-5">
          <div className="text-5xl mb-2">🎓</div>
          <h1 className="text-2xl font-bold text-white">StreamBoard</h1>
          <p className="text-purple-300 text-sm mt-1">NEET PG Live Teaching Whiteboard</p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { icon: <Pen size={16} />, title: 'Multi-Pen Tools', desc: 'Constant pen, pressure-sensitive, highlighter & vanishing glow pen' },
            { icon: <Zap size={16} />, title: 'Vanishing Glow Pen', desc: 'Bright glowing strokes that fade away automatically' },
            { icon: <Square size={16} />, title: 'Shapes', desc: 'Rectangle, circle, arrow, line — all customizable after drawing' },
            { icon: <LayoutGrid size={16} />, title: 'Canvas Styles', desc: 'Blank, grid, dots, or lined background in white, yellow, or dark mode' },
            { icon: <Highlighter size={16} />, title: 'Highlighter', desc: 'Semi-transparent highlight over your drawings and notes' },
            { icon: <BookOpen size={16} />, title: 'Magic Stream Tool ✨', desc: 'Private notes/PDF panel only you can see — hidden from stream viewers' },
          ].map((f, i) => (
            <div key={i} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(139,92,246,0.3)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-purple-400">{f.icon}</span>
                <span className="text-white font-semibold text-xs">{f.title}</span>
              </div>
              <p className="text-purple-200/70 text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Magic Stream Tips */}
        <div className="rounded-2xl p-4 mb-5" style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.4)' }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">✨</span>
            <span className="text-yellow-300 font-bold text-sm">Magic Stream Tool – How to Use</span>
          </div>
          <div className="space-y-1.5 text-yellow-100/80 text-xs leading-relaxed">
            <p>📌 Click <strong className="text-yellow-300">"Magic Notes"</strong> button in the header to open your private notes panel.</p>
            <p>📱 <strong className="text-yellow-300">iPad + StreamChamp:</strong> Use StreamChamp's screen capture source area to capture <em>only the whiteboard canvas</em>. Drag the Magic panel to a corner outside StreamChamp's capture zone — viewers will never see it.</p>
            <p>📄 Paste text notes or upload a PDF — navigate pages while teaching without viewers knowing.</p>
            <p>🎯 The panel is <strong className="text-yellow-300">freely draggable</strong> so you can position it anywhere that's off-stream.</p>
          </div>
        </div>

        {/* Shortcuts */}
        <div className="mb-5">
          <p className="text-purple-300 font-semibold text-xs mb-2">⌨ Keyboard Shortcuts</p>
          <div className="grid grid-cols-3 gap-1">
            {[
              ['P', 'Pen'], ['Shift+P', 'Pressure Pen'], ['H', 'Highlighter'],
              ['V', 'Vanish Pen'], ['E', 'Eraser'], ['S', 'Select'],
              ['R', 'Rectangle'], ['C', 'Circle'], ['A', 'Arrow'],
              ['M', 'Magic Notes'], ['⌘+Z', 'Undo'], ['⌘+Y', 'Redo'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded text-xs font-mono text-white" style={{ background: 'rgba(255,255,255,0.15)' }}>{k}</kbd>
                <span className="text-purple-200/70 text-xs">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl text-white font-bold text-base transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', boxShadow: '0 4px 20px rgba(124,58,237,0.4)' }}
        >
          Start Teaching! 🚀
        </button>
      </div>
    </div>
  );
}
