import React, { useState, useMemo } from 'react';
import { Territory, Person } from '../../types';
import { useApp } from '../../context/AppContext';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Avatar } from '../common/Avatar';
import { PrimaryButton, PrimaryFAB } from '../common/PrimaryButton';
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Users,
  X,
  ChevronRight,
  MoreVertical,
} from 'lucide-react';

export const TerritoryList: React.FC = () => {
  const {
    territories,
    people,
    saveTerritory,
    deleteTerritory,
    showToast,
    setSelectedPersonId,
    setActiveTab,
  } = useApp();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTerritoryName, setNewTerritoryName] = useState('');
  const [editingTerritory, setEditingTerritory] = useState<Territory | null>(null);
  const [editTerritoryName, setEditTerritoryName] = useState('');
  const [openMenuTerritoryId, setOpenMenuTerritoryId] = useState<string | null>(null);

  // Confirmation dialogs
  const [showEditConfirmDialog, setShowEditConfirmDialog] = useState(false);
  const [territoryToDelete, setTerritoryToDelete] = useState<Territory | null>(null);

  // View territory contacts drawer/modal
  const [viewingTerritory, setViewingTerritory] = useState<Territory | null>(null);

  // Group people by territory
  const countByTerritory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of people) {
      if (p.territoryId) {
        counts.set(p.territoryId, (counts.get(p.territoryId) || 0) + 1);
      }
    }
    return counts;
  }, [people]);

  // People in currently viewed territory
  const viewingPeople = useMemo(() => {
    if (!viewingTerritory) return [];
    return people.filter((p) => p.territoryId === viewingTerritory.id);
  }, [people, viewingTerritory]);

  const handleCreateTerritory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTerritoryName.trim()) return;

    try {
      await saveTerritory({ name: newTerritoryName.trim() });
      showToast('Territory created', 'success');
      setNewTerritoryName('');
      setIsAddModalOpen(false);
    } catch {
      showToast('Failed to create territory', 'error');
    }
  };

  const handleInitiateEdit = (terr: Territory) => {
    setEditingTerritory(terr);
    setEditTerritoryName(terr.name);
  };

  const handleRequestSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTerritoryName.trim()) return;
    if (editingTerritory && editTerritoryName.trim() === editingTerritory.name) {
      setEditingTerritory(null);
      return;
    }
    // Prompt confirmation per instructions:
    // "The confirmation should remind the user to contact the Admin before making structural territory changes."
    setShowEditConfirmDialog(true);
  };

  const handleConfirmEdit = async () => {
    if (!editingTerritory) return;
    try {
      await saveTerritory({
        id: editingTerritory.id,
        name: editTerritoryName.trim(),
      });
      showToast('Territory updated', 'success');
      setShowEditConfirmDialog(false);
      setEditingTerritory(null);
    } catch {
      showToast('Failed to update territory', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!territoryToDelete) return;
    try {
      await deleteTerritory(territoryToDelete.id);
      showToast('Territory deleted', 'info');
      setTerritoryToDelete(null);
      if (viewingTerritory?.id === territoryToDelete.id) {
        setViewingTerritory(null);
      }
    } catch {
      showToast('Failed to delete territory', 'error');
    }
  };

  const handleOpenPerson = (person: Person) => {
    setSelectedPersonId(person.id);
    setActiveTab('records');
  };

  return (
    <div className="pb-28 md:pb-12">
      {/* Unified Compact Header */}
      <header className="sticky top-0 md:top-[58px] lg:top-0 z-30 bg-white border-b border-[#E7E3DA] px-4 sm:px-6 py-3 shadow-e2">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 min-h-[44px]">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/icon-192.png"
              alt="Deaf Contact Record"
              className="w-8 h-8 rounded-[10px] object-cover shadow-2xs ring-1 ring-black/5 shrink-0"
            />
            <div className="min-w-0">
              <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[11px] sm:text-xs font-semibold tracking-[0.14em] uppercase text-[#14213D] leading-tight select-none">
                DEAF CONTACT RECORD
              </p>
              <p className="text-sm text-[#5B6470] font-normal mt-0.5">
                <span className="font-mono tabular-nums font-semibold text-[#14213D]">{territories.length}</span>{' '}
                {territories.length === 1 ? 'territory' : 'territories'}
              </p>
            </div>
          </div>

          {/* Desktop/Tablet Header Action */}
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="hidden sm:inline-flex h-11 px-4 text-sm font-semibold text-white bg-[#0F766E] hover:bg-[#0D655E] active:scale-[0.98] rounded-[14px] items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Territory</span>
          </button>
        </div>
      </header>

      {/* Main List */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        {territories.length === 0 ? (
          <div className="py-16 text-center max-w-sm mx-auto">
            <div className="w-16 h-16 bg-white border border-[#E7E3DA] text-[#0F766E] rounded-[20px] shadow-e1 flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 stroke-[1.75]" />
            </div>
            <h2 className="text-xl font-bold text-[#14213D]">No territories yet</h2>
            <p className="text-sm text-[#5B6470] mt-1.5 leading-relaxed">
              Create geographic or organizational territories to group your deaf contact records.
            </p>
            <div className="mt-5">
              <PrimaryButton
                onClick={() => setIsAddModalOpen(true)}
                icon={<Plus className="w-5 h-5 stroke-[2.5]" />}
              >
                Add your first territory
              </PrimaryButton>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {territories.map((terr) => {
              const memberCount = countByTerritory.get(terr.id) || 0;
              const isMenuOpen = openMenuTerritoryId === terr.id;

              return (
                <div
                  key={terr.id}
                  onClick={() => setViewingTerritory(terr)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setViewingTerritory(terr);
                    }
                  }}
                  className="w-full flex items-center justify-between p-4 bg-white rounded-[16px] border border-[#E7E3DA] shadow-e1 hover:bg-slate-50/80 active:bg-slate-100 transition-all duration-200 cursor-pointer group text-left min-h-[64px]"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1 mr-2">
                    <div className="w-10 h-10 rounded-[14px] bg-[#0F766E]/10 border border-[#0F766E]/20 text-[#0F766E] flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold text-[#14213D] break-words line-clamp-2 leading-snug group-hover:text-[#0F766E] transition-colors">
                        {terr.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-sm text-[#5B6470] mt-0.5">
                        <Users className="w-4 h-4 text-[#5B6470]/70 shrink-0" />
                        <span className="font-mono tabular-nums font-medium text-[#14213D]">{memberCount}</span>{' '}
                        <span>{memberCount === 1 ? 'contact' : 'contacts'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Overflow "⋯" menu */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuTerritoryId(isMenuOpen ? null : terr.id);
                        }}
                        className="min-h-[44px] min-w-[44px] p-2 text-[#5B6470] hover:text-[#14213D] hover:bg-slate-100 rounded-[12px] flex items-center justify-center transition-colors"
                        aria-label={`Options for ${terr.name}`}
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>

                      {isMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuTerritoryId(null);
                            }}
                          />
                          <div
                            className="absolute right-0 top-full mt-1 z-50 w-36 bg-white rounded-[14px] border border-[#E7E3DA] shadow-e3 py-1.5 overflow-hidden animate-in fade-in duration-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuTerritoryId(null);
                                handleInitiateEdit(terr);
                              }}
                              className="w-full min-h-[44px] px-3.5 py-2 text-left text-sm font-semibold text-[#14213D] hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                            >
                              <Edit2 className="w-4 h-4 text-[#5B6470]" />
                              <span>Rename</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuTerritoryId(null);
                                setTerritoryToDelete(terr);
                              }}
                              className="w-full min-h-[44px] px-3.5 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    <ChevronRight className="w-5 h-5 text-[#5B6470]/60 group-hover:text-[#0F766E] shrink-0 transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modern Circular FAB for Add Territory matching Contacts FAB exactly */}
      <PrimaryFAB
        onClick={() => setIsAddModalOpen(true)}
        ariaLabel="Add territory"
      />

      {/* Add Territory Modal */}
      {isAddModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14213D]/40 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            className="w-full max-w-sm bg-white rounded-[16px] border border-[#E7E3DA] shadow-e3 overflow-hidden p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E3DA]">
              <h2 className="text-base font-bold text-[#14213D]">Add Territory</h2>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="min-h-[44px] min-w-[44px] p-2 text-[#5B6470] hover:text-[#14213D] rounded-[12px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTerritory} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#14213D] mb-1.5">
                  Territory Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newTerritoryName}
                  onChange={(e) => setNewTerritoryName(e.target.value)}
                  placeholder="e.g. North District, Downtown, West Zone"
                  className="w-full h-12 px-3.5 text-base text-[#14213D] bg-white border border-[#E7E3DA] rounded-[14px] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="min-h-[52px] px-5 py-2 text-base font-medium text-[#14213D] bg-white border border-[#E7E3DA] hover:bg-slate-50 rounded-[14px] transition-colors"
                >
                  Cancel
                </button>
                <PrimaryButton type="submit">
                  Create Territory
                </PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Territory Form Modal */}
      {editingTerritory && !showEditConfirmDialog && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14213D]/40 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            className="w-full max-w-sm bg-white rounded-[16px] border border-[#E7E3DA] shadow-e3 overflow-hidden p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E3DA]">
              <h2 className="text-base font-bold text-[#14213D]">Rename Territory</h2>
              <button
                type="button"
                onClick={() => setEditingTerritory(null)}
                className="min-h-[44px] min-w-[44px] p-2 text-[#5B6470] hover:text-[#14213D] rounded-[12px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRequestSaveEdit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#14213D] mb-1.5">
                  Territory Name
                </label>
                <input
                  type="text"
                  required
                  value={editTerritoryName}
                  onChange={(e) => setEditTerritoryName(e.target.value)}
                  className="w-full h-12 px-3.5 text-base text-[#14213D] bg-white border border-[#E7E3DA] rounded-[14px] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTerritory(null)}
                  className="min-h-[52px] px-5 py-2 text-base font-medium text-[#14213D] bg-white border border-[#E7E3DA] hover:bg-slate-50 rounded-[14px] transition-colors"
                >
                  Cancel
                </button>
                <PrimaryButton type="submit">
                  Save
                </PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Territory Contacts Drawer */}
      {viewingTerritory && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#14213D]/40 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            className="w-full max-w-md bg-white rounded-[16px] border border-[#E7E3DA] shadow-e3 overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E7E3DA] shrink-0">
              <div>
                <h2 className="text-base font-bold text-[#14213D] flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#0F766E]" />
                  {viewingTerritory.name}
                </h2>
                <p className="text-sm text-[#5B6470] font-normal mt-0.5">
                  {viewingPeople.length} {viewingPeople.length === 1 ? 'contact' : 'contacts'} in this territory
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingTerritory(null)}
                className="min-h-[44px] min-w-[44px] p-2 text-[#5B6470] hover:text-[#14213D] rounded-[12px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
              {viewingPeople.length === 0 ? (
                <div className="py-8 text-center text-[#5B6470]">
                  <Users className="w-8 h-8 mx-auto text-[#5B6470]/40 mb-2" />
                  <p className="text-base font-semibold text-[#14213D]">No contacts in this territory</p>
                  <p className="text-sm text-[#5B6470] mt-1">
                    Assign contacts to this territory by editing them in the Contacts tab.
                  </p>
                </div>
              ) : (
                viewingPeople.map((person) => (
                  <div
                    key={person.id}
                    onClick={() => {
                      setViewingTerritory(null);
                      handleOpenPerson(person);
                    }}
                    className="flex items-center justify-between p-3.5 rounded-[14px] border border-[#E7E3DA] bg-white hover:bg-slate-50 cursor-pointer transition-colors shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar photoRef={person.photoRef} name={person.name} size="sm" />
                      <span className="text-base font-semibold text-[#14213D] truncate">
                        {person.name}
                      </span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#5B6470]/60" />
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-[#E7E3DA] bg-white flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setViewingTerritory(null)}
                className="min-h-[44px] px-5 py-2 text-sm font-semibold text-[#14213D] bg-white border border-[#E7E3DA] hover:bg-slate-50 rounded-[12px] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Territory Confirmation with Admin warning */}
      <ConfirmDialog
        isOpen={showEditConfirmDialog}
        title="Rename Territory?"
        message="Territory changes affect organizational structure. Please contact your Admin before making structural changes.\n\nDo you want to proceed with renaming this territory?"
        confirmLabel="Rename"
        cancelLabel="Cancel"
        onConfirm={handleConfirmEdit}
        onCancel={() => setShowEditConfirmDialog(false)}
      />

      {/* Delete Territory Confirmation with Admin warning */}
      <ConfirmDialog
        isOpen={territoryToDelete !== null}
        title="Delete Territory?"
        message={`Territory changes affect organizational structure. Please contact your Admin before making structural changes.\n\nDeleting "${territoryToDelete?.name}" will unassign all contacts currently in it. Contacts will not be deleted.`}
        confirmLabel="Delete Territory"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setTerritoryToDelete(null)}
      />
    </div>
  );
};
