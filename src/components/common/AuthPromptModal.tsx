import React from 'react';
import { Lock, ShieldAlert, LogIn, X, CloudDownload } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface AuthPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionName?: string;
}

export const AuthPromptModal: React.FC<AuthPromptModalProps> = ({
  isOpen,
  onClose,
  actionName = 'modify records',
}) => {
  const { user, setActiveTab } = useApp();

  if (!isOpen) return null;

  // Since membership logic was removed, all signed-in users are treated as authorized/approved
  const isPending = false; 

  const handleGoToSignIn = () => {
    setActiveTab('settings');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-prompt-title"
        className="relative w-full max-w-md bg-white rounded-[20px] border border-[#E7E3DA] shadow-2xl p-6 overflow-hidden z-10 animate-in zoom-in-95 duration-150"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-[14px] bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-amber-600">
            {isPending ? (
              <ShieldAlert className="w-6 h-6 stroke-[2]" />
            ) : (
              <Lock className="w-6 h-6 stroke-[2]" />
            )}
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id="auth-prompt-title" className="text-lg font-bold text-slate-900 tracking-tight">
              {isPending ? 'Membership Approval Required' : 'Sign In Required'}
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Read-Only Guest Mode
            </p>
          </div>
        </div>

        <div className="mt-4 text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-[12px] p-3.5 border border-slate-200/80">
          {isPending ? (
            <p>
              Your account (<strong className="text-slate-800">{user?.email}</strong>) is signed in but pending administrator approval for workspace <code className="text-xs font-mono bg-white px-1 py-0.5 rounded border border-slate-200">/workspaces/default</code>. Only approved members may {actionName}.
            </p>
          ) : (
            <p>
              You are currently in <strong>Read-Only Guest Mode</strong>. Guests can browse local records and pull shared data from the cloud. To {actionName}, please sign in with an authorized workspace member account.
            </p>
          )}
        </div>

        <div className="mt-3 text-xs text-slate-500 flex items-center gap-1.5">
          <CloudDownload className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>You can still download and view public workspace records in Settings.</span>
        </div>

        <div className="mt-6 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-[12px] text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 transition-colors cursor-pointer"
          >
            Stay in Guest Mode
          </button>

          <button
            type="button"
            onClick={handleGoToSignIn}
            className="w-full sm:w-auto px-5 py-2.5 rounded-[12px] text-xs font-semibold text-white bg-[#0F766E] hover:bg-[#0D655E] shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>{isPending ? 'View Account Status' : 'Sign In to Workspace'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
