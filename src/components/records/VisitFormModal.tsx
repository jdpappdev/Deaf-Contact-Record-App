import React, { useState, useEffect } from 'react';
import { Visit } from '../../types';
import { PrimaryButton } from '../common/PrimaryButton';
import { X, Calendar, FileText } from 'lucide-react';

interface VisitFormModalProps {
  isOpen: boolean;
  personId: string;
  initialVisit?: Visit | null;
  onSave: (visitData: { id?: string; personId: string; visitedAt: string; remarks: string }) => Promise<void>;
  onClose: () => void;
}

export const VisitFormModal: React.FC<VisitFormModalProps> = ({
  isOpen,
  personId,
  initialVisit,
  onSave,
  onClose,
}) => {
  const getTodayDateString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const [visitedDate, setVisitedDate] = useState<string>(() => {
    return initialVisit ? initialVisit.visitedAt.split('T')[0] : getTodayDateString();
  });
  const [remarks, setRemarks] = useState<string>(() => {
    return initialVisit?.remarks || '';
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ensure new visit form always starts completely clean with empty remarks
  useEffect(() => {
    if (isOpen) {
      if (initialVisit) {
        setVisitedDate(initialVisit.visitedAt ? initialVisit.visitedAt.split('T')[0] : getTodayDateString());
        setRemarks(initialVisit.remarks || '');
      } else {
        // New visit form MUST strictly start with empty remarks
        setVisitedDate(getTodayDateString());
        setRemarks('');
      }
      setError(null);
      setIsSaving(false);
    }
  }, [isOpen, initialVisit]);

  if (!isOpen) return null;

  const handleClose = () => {
    setRemarks('');
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitedDate) {
      setError('Visit date is required.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      await onSave({
        id: initialVisit?.id,
        personId,
        visitedAt: new Date(visitedDate).toISOString(),
        remarks: remarks.trim(),
      });
      // Clear form state
      setRemarks('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save visit record.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14213D]/40 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-md bg-white rounded-[16px] border border-[#E7E3DA] shadow-e3 overflow-hidden p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#E7E3DA]">
          <h2 className="text-base font-bold text-[#14213D]">
            {initialVisit ? 'Edit Visit' : 'Add New Visit'}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="min-h-[44px] min-w-[44px] p-2 text-[#5B6470] hover:text-[#14213D] rounded-[12px] flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-white rounded-[14px] border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-[#14213D] mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#0F766E]" />
              Visit Date
            </label>
            <input
              type="date"
              required
              value={visitedDate}
              onChange={(e) => setVisitedDate(e.target.value)}
              className="w-full h-12 px-3.5 text-base text-[#14213D] bg-white border border-[#E7E3DA] rounded-[14px] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#14213D] mb-1.5 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#0F766E]" />
              Remarks & Notes
            </label>
            <textarea
              rows={4}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter details, conversation topics, return visit notes..."
              className="w-full p-3.5 text-base text-[#14213D] bg-white border border-[#E7E3DA] rounded-[14px] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E7E3DA]">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSaving}
              className="h-[52px] min-h-[52px] px-5 text-base font-medium text-[#14213D] bg-white border border-[#E7E3DA] hover:bg-slate-50 rounded-[14px] transition-colors"
            >
              Cancel
            </button>
            <PrimaryButton
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : initialVisit ? 'Update Visit' : 'Save Visit'}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
};
