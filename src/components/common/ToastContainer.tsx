import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 bg-white rounded-[16px] shadow-e3 border border-[#E7E3DA] text-[#14213D] text-sm font-semibold animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {toast.type === 'success' && (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            {toast.type === 'error' && (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            {toast.type === 'info' && (
              <Info className="w-4 h-4 text-[#0F766E] shrink-0" />
            )}
            <span className="truncate">{toast.message}</span>
          </div>
          <button
            onClick={() => dismissToast(toast.id)}
            className="p-1 min-h-[36px] min-w-[36px] flex items-center justify-center text-[#5B6470] hover:text-[#14213D] rounded-[10px] shrink-0"
            aria-label="Dismiss toast"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
