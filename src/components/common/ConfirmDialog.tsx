import React, { useState, useEffect } from 'react';
import { AlertTriangle, AlertCircle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  confirmTextRequired?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  confirmTextRequired,
  onConfirm,
  onCancel,
}) => {
  const [typedText, setTypedText] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTypedText('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConfirmDisabled = Boolean(
    confirmTextRequired && typedText.trim().toUpperCase() !== confirmTextRequired.trim().toUpperCase()
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14213D]/40 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-sm bg-white rounded-[16px] border border-[#E7E3DA] overflow-hidden transform transition-all p-5 shadow-e3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3.5 mb-3.5">
          <div
            className={`w-10 h-10 rounded-[14px] border flex items-center justify-center shrink-0 ${
              isDestructive
                ? 'bg-red-50 text-red-600 border-red-200'
                : 'bg-[#0F766E]/10 text-[#0F766E] border-[#0F766E]/20'
            }`}
          >
            {isDestructive ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-[#14213D] leading-snug">
              {title}
            </h3>
            <p className="mt-1 text-sm text-[#5B6470] leading-relaxed whitespace-pre-line">
              {message}
            </p>
          </div>
        </div>

        {confirmTextRequired && (
          <div className="mt-3.5 pt-3 border-t border-[#E7E3DA]">
            <label className="block text-xs font-semibold text-[#14213D] mb-1.5">
              Type <span className="font-mono text-red-600 font-bold">{confirmTextRequired}</span> to confirm:
            </label>
            <input
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder={`Type ${confirmTextRequired}`}
              className="w-full h-11 px-3 text-sm text-[#14213D] bg-white border border-[#E7E3DA] rounded-[14px] font-mono focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 mt-5 pt-3 border-t border-[#E7E3DA]">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-4 py-2 text-sm font-semibold text-[#14213D] bg-white hover:bg-slate-50 border border-[#E7E3DA] rounded-[14px] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isConfirmDisabled}
            onClick={onConfirm}
            className={`min-h-[44px] px-5 py-2 text-sm font-semibold text-white rounded-[14px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#0F766E] hover:bg-[#0D655E]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

