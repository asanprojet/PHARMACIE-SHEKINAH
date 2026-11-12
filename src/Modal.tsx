export default function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children,
  maxWidth = 'max-w-md'
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  children: React.ReactNode;
  maxWidth?: string;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in">
      <div className={`bg-[#0c1222] border border-slate-700/80 rounded-2xl p-6 w-full ${maxWidth} shadow-2xl relative`}>
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
          <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
