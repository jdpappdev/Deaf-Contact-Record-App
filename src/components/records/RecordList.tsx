import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { RecordCard } from './RecordCard';
import { RecordFormModal } from './RecordFormModal';
import { FilterModal, SortMethod } from './FilterModal';
import { PrimaryButton, PrimaryFAB } from '../common/PrimaryButton';
import { Search, Plus, UserPlus, Filter, X } from 'lucide-react';

export const RecordList: React.FC = () => {
  const { people, territories, visits, setSelectedPersonId } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedTerritoryFilter, setSelectedTerritoryFilter] = useState<string>('all');
  const [selectedSortMethod, setSelectedSortMethod] = useState<SortMethod>('name-asc');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Map territory id to Territory for rapid O(1) lookup
  const territoryMap = useMemo(() => {
    const map = new Map();
    for (const terr of territories) {
      map.set(terr.id, terr);
    }
    return map;
  }, [territories]);

  // Map person id to latest visit for rapid O(1) lookup
  const latestVisitMap = useMemo(() => {
    const map = new Map();
    for (const visit of visits) {
      const currentLatest = map.get(visit.personId);
      if (!currentLatest || new Date(visit.visitedAt).getTime() > new Date(currentLatest.visitedAt).getTime()) {
        map.set(visit.personId, visit);
      }
    }
    return map;
  }, [visits]);

  // Filtered and sorted contacts
  const filteredPeople = useMemo(() => {
    const matched = people.filter((person) => {
      // Search filter
      const matchesSearch =
        !searchQuery.trim() ||
        person.name.toLowerCase().includes(searchQuery.toLowerCase().trim());

      // Territory filter
      let matchesTerritory = true;
      if (selectedTerritoryFilter === 'all') {
        matchesTerritory = true;
      } else if (selectedTerritoryFilter === 'unassigned') {
        matchesTerritory = !person.territoryId;
      } else {
        matchesTerritory = person.territoryId === selectedTerritoryFilter;
      }

      return matchesSearch && matchesTerritory;
    });

    // Apply sorting
    return [...matched].sort((a, b) => {
      if (selectedSortMethod === 'name-asc') {
        return a.name.localeCompare(b.name);
      }
      if (selectedSortMethod === 'name-desc') {
        return b.name.localeCompare(a.name);
      }
      if (selectedSortMethod === 'visited-recent') {
        const visitA = latestVisitMap.get(a.id);
        const visitB = latestVisitMap.get(b.id);
        const timeA = visitA ? new Date(visitA.visitedAt).getTime() : 0;
        const timeB = visitB ? new Date(visitB.visitedAt).getTime() : 0;
        if (timeA !== timeB) {
          return timeB - timeA; // Most recently visited first
        }
        return a.name.localeCompare(b.name);
      }
      if (selectedSortMethod === 'visited-oldest') {
        const visitA = latestVisitMap.get(a.id);
        const visitB = latestVisitMap.get(b.id);
        // Contacts with recorded visits appear before those with no visits
        if (visitA && !visitB) return -1;
        if (!visitA && visitB) return 1;
        if (visitA && visitB) {
          const timeA = new Date(visitA.visitedAt).getTime();
          const timeB = new Date(visitB.visitedAt).getTime();
          if (timeA !== timeB) {
            return timeA - timeB; // Oldest visit first
          }
        }
        return a.name.localeCompare(b.name);
      }
      return 0;
    });
  }, [people, searchQuery, selectedTerritoryFilter, selectedSortMethod, latestVisitMap]);

  const isFilterActive = selectedTerritoryFilter !== 'all' || selectedSortMethod !== 'name-asc';

  return (
    <div className="pb-28">
      {/* Top Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-[#E7E3DA] px-4 py-3 shadow-e2">
        <div className="max-w-4xl mx-auto">
          {/* Main Bar: Brand Wordmark (Left), Secondary Count (below brand), Search Trigger (Right) */}
          <div className="flex items-center justify-between gap-3 min-h-[44px]">
            <div className="min-w-0">
              <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[11px] sm:text-xs font-semibold tracking-[0.14em] uppercase text-[#14213D] leading-tight select-none">
                DEAF CONTACT RECORD
              </p>
              <p className="text-sm text-[#5B6470] font-normal mt-0.5">
                <span className="font-mono tabular-nums font-semibold text-[#14213D]">{people.length}</span>{' '}
                {people.length === 1 ? 'person' : 'people'}
              </p>
            </div>

            {/* Compact Search Trigger Button */}
            <button
              type="button"
              onClick={() => {
                if (!isSearchOpen) {
                  setIsSearchOpen(true);
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                } else {
                  setIsSearchOpen(false);
                  setSearchQuery('');
                }
              }}
              className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-[14px] flex items-center justify-center transition-all duration-200 border select-none ${
                isSearchOpen || searchQuery
                  ? 'bg-[#0F766E]/10 text-[#0F766E] border-[#0F766E]/30'
                  : 'text-[#5B6470] hover:text-[#14213D] hover:bg-slate-100 border-transparent active:bg-slate-200'
              }`}
              aria-label={isSearchOpen ? 'Close search' : 'Search contacts'}
              title={isSearchOpen ? 'Close search' : 'Search contacts'}
            >
              <Search className="w-5 h-5 stroke-[2]" />
            </button>
          </div>

          {/* Expanded Search Field (shown when opened) */}
          {isSearchOpen && (
            <div className="mt-2.5 pt-2.5 border-t border-[#E7E3DA] flex items-center gap-2 animate-in fade-in duration-150">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5B6470]" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by contact name..."
                  className="w-full h-11 pl-10 pr-10 text-base text-[#14213D] bg-white border border-[#E7E3DA] rounded-[14px] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-[#5B6470] hover:text-[#14213D]"
                    aria-label="Clear search text"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery('');
                }}
                className="min-h-[44px] px-3.5 text-sm font-semibold text-[#5B6470] hover:text-[#14213D] hover:bg-slate-100 rounded-[14px] transition-colors whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 pt-4">
        {/* Compact Filter Button below header */}
        <div className="mb-3.5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            className={`h-11 min-h-[44px] px-4 inline-flex items-center gap-2 rounded-[14px] border text-sm font-medium transition-all select-none ${
              isFilterActive
                ? 'bg-[#0F766E]/10 border-[#0F766E]/30 text-[#0F766E] font-semibold'
                : 'bg-white border-[#E7E3DA] text-[#14213D] hover:bg-slate-50 active:bg-slate-100 shadow-e1'
            }`}
          >
            <Filter className={`w-4 h-4 ${isFilterActive ? 'text-[#0F766E]' : 'text-[#5B6470]'}`} />
            <span>Filter</span>
            {isFilterActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#0F766E]" />
            )}
          </button>

          {/* Active territory filter indicator if filtered */}
          {selectedTerritoryFilter !== 'all' && (
            <span className="text-xs text-[#5B6470] truncate max-w-[200px]">
              Territory: <strong className="font-semibold text-[#14213D]">{selectedTerritoryFilter === 'unassigned' ? 'Unassigned' : territoryMap.get(selectedTerritoryFilter)?.name || 'Filtered'}</strong>
            </span>
          )}
        </div>
        {people.length === 0 ? (
          /* Empty state when no people in DB */
          <div className="py-16 text-center max-w-sm mx-auto">
            <div className="w-16 h-16 bg-white border border-[#E7E3DA] text-[#0F766E] rounded-[20px] shadow-e1 flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-8 h-8 stroke-[1.75]" />
            </div>
            <h2 className="text-xl font-bold text-[#14213D]">No contacts yet</h2>
            <p className="text-sm text-[#5B6470] mt-1.5 leading-relaxed">
              Start by adding your first deaf contact record for field visits and territory tracking.
            </p>
            <div className="mt-5">
              <PrimaryButton
                onClick={() => setIsAddModalOpen(true)}
                icon={<Plus className="w-5 h-5 stroke-[2.5]" />}
              >
                Add your first contact
              </PrimaryButton>
            </div>
          </div>
        ) : filteredPeople.length === 0 ? (
          /* Filtered empty state */
          <div className="py-12 text-center text-[#5B6470]">
            <p className="text-base font-semibold text-[#14213D]">No matching contacts found</p>
            <p className="text-sm text-[#5B6470] mt-1">
              Try adjusting your search query or territory filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedTerritoryFilter('all');
                setSelectedSortMethod('name-asc');
                setIsSearchOpen(false);
              }}
              className="mt-3 min-h-[44px] px-4 text-sm font-semibold text-[#0F766E] hover:underline"
            >
              Reset filters
            </button>
          </div>
        ) : (
          /* Contact list: each contact is a separate raised row (e1) with 8px gaps */
          <div className="flex flex-col gap-2">
            {filteredPeople.map((person) => (
              <RecordCard
                key={person.id}
                person={person}
                territory={person.territoryId ? territoryMap.get(person.territoryId) || null : null}
                latestVisit={latestVisitMap.get(person.id) || null}
                onClick={() => setSelectedPersonId(person.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modern Circular FAB for Add Contact with e3 elevation */}
      <PrimaryFAB
        onClick={() => setIsAddModalOpen(true)}
        ariaLabel="Add contact"
      />

      {/* Add Contact Modal */}
      <RecordFormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSaved={(newPerson) => {
          setSelectedPersonId(newPerson.id);
        }}
      />

      {/* Filter and Sort Modal */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        territories={territories}
        selectedTerritory={selectedTerritoryFilter}
        selectedSort={selectedSortMethod}
        onApply={(territory, sort) => {
          setSelectedTerritoryFilter(territory);
          setSelectedSortMethod(sort);
        }}
        onClear={() => {
          setSelectedTerritoryFilter('all');
          setSelectedSortMethod('name-asc');
        }}
      />
    </div>
  );
};
