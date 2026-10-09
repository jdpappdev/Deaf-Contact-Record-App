import React from 'react';
import { Territory } from '../../types';
import { X, ChevronDown, Check } from 'lucide-react';

export type SortMethod = 'name-asc' | 'name-desc' | 'visited-recent' | 'visited-oldest';

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  territories: Territory[];
  selectedTerritory: string;
  selectedSort: SortMethod;
  onApply: (territory: string, sort: SortMethod) => void;
  onClear: () => void;
}

export const FilterModal: React.FC<FilterModalProps> = ({
  isOpen,
  onClose,
  territories,
  selectedTerritory,
  selectedSort,
  onApply,
  onClear,
}) => {
  const [draftTerritory, setDraftTerritory] = React.useState(selectedTerritory);
  const [draftSort, setDraftSort] = React.useState<SortMethod>(selectedSort);

  // Sync draft state whenever modal opens
  React.useEffect(() => {
    if (isOpen) {
      setDraftTerritory(selectedTerritory);
      setDraftSort(selectedSort);
    }
  }, [isOpen, selectedTerritory, selectedSort]);

  if (!isOpen) return null;

  const handleApply = () => {
    onApply(draftTerritory, draftSort);
    onClose();
  };

  const handleClear = () => {
    onClear();
    onClose();
  };

  const sortOptions: { id: SortMethod; label: string }[] = [
    { id: 'name-asc', label: 'Name A–Z' },
    { id: 'name-desc', label: 'Name Z–A' },
    { id: 'visited-recent', label: 'Most recently visited' },
    { id: 'visited-oldest', label: 'Oldest visit' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#14213D]/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="filter-modal-title"
    >
      <div
        className="w-full max-w-[400px] bg-white rounded-[16px] border border-[#E7E3DA] shadow-e3 flex flex-col overflow-visible"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E7E3DA] flex items-center justify-between">
          <h2 id="filter-modal-title" className="text-base font-bold text-[#14213D] tracking-tight">
            Filter contacts
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] -mr-2 rounded-full flex items-center justify-center text-[#5B6470] hover:text-[#14213D] hover:bg-[#F3F1EC] transition-colors"
            aria-label="Close filter panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content: compact dropdown selectors */}
        <div className="px-5 py-4 space-y-4">
          {/* Territory Dropdown */}
          <div>
            <label
              htmlFor="filter-territory-select"
              className="block text-sm font-semibold text-[#14213D] mb-1.5"
            >
              Territory
            </label>
            <div className="relative">
              <select
                id="filter-territory-select"
                value={draftTerritory}
                onChange={(e) => setDraftTerritory(e.target.value)}
                className="w-full h-11 min-h-[44px] pl-3.5 pr-10 text-base text-[#14213D] bg-white border border-[#E7E3DA] rounded-[12px] appearance-none focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] transition-colors cursor-pointer"
              >
                <option value="all">All territories</option>
                <option value="unassigned">Unassigned</option>
                {territories.map((terr) => (
                  <option key={terr.id} value={terr.id}>
                    {terr.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5B6470]">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Sort By Dropdown */}
          <div>
            <label
              htmlFor="filter-sort-select"
              className="block text-sm font-semibold text-[#14213D] mb-1.5"
            >
              Sort by
            </label>
            <div className="relative">
              <select
                id="filter-sort-select"
                value={draftSort}
                onChange={(e) => setDraftSort(e.target.value as SortMethod)}
                className="w-full h-11 min-h-[44px] pl-3.5 pr-10 text-base text-[#14213D] bg-white border border-[#E7E3DA] rounded-[12px] appearance-none focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] transition-colors cursor-pointer"
              >
                {sortOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5B6470]">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Compact Footer */}
        <div className="px-5 py-3.5 bg-[#F3F1EC]/60 border-t border-[#E7E3DA] rounded-b-[16px] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleClear}
            className="min-h-[44px] px-3 -ml-2 text-sm font-semibold text-[#5B6470] hover:text-[#14213D] hover:bg-[#E7E3DA]/50 rounded-[12px] transition-colors"
          >
            Clear filters
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="h-11 min-h-[44px] px-6 text-sm font-semibold text-white bg-[#0F766E] hover:bg-[#0D655E] active:scale-[0.98] rounded-[12px] transition-colors shadow-sm cursor-pointer"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};
