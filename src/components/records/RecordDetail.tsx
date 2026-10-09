import React, { useState } from 'react';
import { Person, Visit } from '../../types';
import { useApp } from '../../context/AppContext';
import { getExternalUrl } from '../../services/dataService';
import { Avatar } from '../common/Avatar';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { PrimaryButton } from '../common/PrimaryButton';
import { RecordFormModal } from './RecordFormModal';
import { VisitFormModal } from './VisitFormModal';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  MapPin,
  ExternalLink,
  Navigation,
  MessageCircle,
  Plus,
  Calendar,
  Clock,
  X,
  MoreVertical,
} from 'lucide-react';

interface RecordDetailProps {
  person: Person;
  onBack: () => void;
}

export const RecordDetail: React.FC<RecordDetailProps> = ({ person, onBack }) => {
  const {
    territories,
    getVisitsForPerson,
    deletePerson,
    savePerson,
    saveVisit,
    deleteVisit,
    showToast,
    loadPhotoUrl,
  } = useApp();

  const [isEditingContact, setIsEditingContact] = useState(false);
  const [showDeleteContactDialog, setShowDeleteContactDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [openVisitMenuId, setOpenVisitMenuId] = useState<string | null>(null);

  // Full photo view
  const [showFullPhoto, setShowFullPhoto] = useState(false);
  const [fullPhotoUrl, setFullPhotoUrl] = useState<string | null>(null);

  // Visit management state
  const [isAddingVisit, setIsAddingVisit] = useState(false);
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [visitToDelete, setVisitToDelete] = useState<Visit | null>(null);

  // Location updating
  const [isLocating, setIsLocating] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showReplaceLocationDialog, setShowReplaceLocationDialog] = useState(false);

  const visits = getVisitsForPerson(person.id);
  const territory = territories.find((t) => t.id === person.territoryId);

  // Delete contact confirmation
  const handleConfirmDeleteContact = async () => {
    try {
      setIsDeleting(true);
      await deletePerson(person.id);
      showToast('Contact and visit history deleted', 'info');
      onBack();
    } catch (err: unknown) {
      console.error(err);
      showToast('Failed to delete contact', 'error');
    } finally {
      setIsDeleting(false);
      setShowDeleteContactDialog(false);
    }
  };

  // Location update in detail view
  const handleUpdateLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported on this device', 'error');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setIsLocating(false);
        const newLat = parseFloat(pos.coords.latitude.toFixed(6));
        const newLng = parseFloat(pos.coords.longitude.toFixed(6));

        if (person.latitude !== null && person.longitude !== null) {
          if (person.latitude !== newLat || person.longitude !== newLng) {
            setPendingCoords({ lat: newLat, lng: newLng });
            setShowReplaceLocationDialog(true);
            return;
          }
        }

        try {
          await savePerson({
            ...person,
            latitude: newLat,
            longitude: newLng,
          });
          showToast('Location updated', 'success');
        } catch {
          showToast('Failed to update location', 'error');
        }
      },
      (err) => {
        setIsLocating(false);
        showToast(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied'
            : 'Unable to get GPS location',
          'error'
        );
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleConfirmReplaceLocation = async () => {
    if (!pendingCoords) return;
    try {
      await savePerson({
        ...person,
        latitude: pendingCoords.lat,
        longitude: pendingCoords.lng,
      });
      showToast('Location updated', 'success');
    } catch {
      showToast('Failed to update location', 'error');
    } finally {
      setPendingCoords(null);
      setShowReplaceLocationDialog(false);
    }
  };

  // Full photo modal opener
  const handleOpenFullPhoto = async () => {
    if (!person.photoRef) return;
    const url = await loadPhotoUrl(person.photoRef);
    if (url) {
      setFullPhotoUrl(url);
      setShowFullPhoto(true);
    }
  };

  // Maps external URL helper
  const getMapsUrl = (lat: number, lng: number) => {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  };

  // Messenger external opener
  const handleOpenMessenger = (e?: React.MouseEvent) => {
    if (!person.messengerUrl) {
      if (e) e.preventDefault();
      setIsEditingContact(true);
      showToast('Add a Messenger link in Edit contact', 'info');
      return;
    }
    const destination = getExternalUrl(person.messengerUrl);
    if (!destination) {
      if (e) e.preventDefault();
      showToast('Invalid Messenger URL', 'error');
      return;
    }

    // If invoked programmatically without an <a> element, open new window safely
    if (!e) {
      try {
        window.open(destination, '_blank', 'noopener,noreferrer');
      } catch {
        // Safe no-op inside iframe sandbox without navigating parent location
      }
    }
  };

  return (
    <div className="pb-28 md:pb-12">
      {/* Header: back arrow and a "⋯" menu, all tap targets at least 44px */}
      <div className="sticky top-0 md:top-[58px] lg:top-0 z-30 bg-white border-b border-[#E7E3DA] px-4 sm:px-6 py-3 shadow-e2">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[44px] px-3 -ml-2 text-[#14213D] hover:text-[#0F766E] rounded-[14px] flex items-center gap-1.5 transition-colors font-semibold text-base"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2]" />
            <span>Contacts</span>
          </button>

          {/* Overflow "⋯" menu in header */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
              className="min-h-[44px] min-w-[44px] p-2 text-[#5B6470] hover:text-[#14213D] hover:bg-slate-100 rounded-[14px] flex items-center justify-center transition-colors"
              aria-label="Contact options"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {isHeaderMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsHeaderMenuOpen(false)}
                />
                <div
                  className="absolute right-0 top-full mt-1 z-50 w-44 bg-white rounded-[16px] border border-[#E7E3DA] shadow-e3 py-1.5 overflow-hidden animate-in fade-in duration-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsHeaderMenuOpen(false);
                      setIsEditingContact(true);
                    }}
                    className="w-full min-h-[44px] px-4 py-2 text-left text-sm font-semibold text-[#14213D] hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                  >
                    <Edit2 className="w-4 h-4 text-[#5B6470]" />
                    <span>Edit contact</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsHeaderMenuOpen(false);
                      setShowDeleteContactDialog(true);
                    }}
                    className="w-full min-h-[44px] px-4 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                    <span>Delete contact</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column on Desktop: Profile, Actions, Location */}
          <div className="lg:col-span-5 xl:col-span-5 space-y-4 lg:sticky lg:top-[74px]">
            {/* 1. Profile: avatar (72px) overlaps the top edge of the profile card */}
            <div className="relative bg-white rounded-[16px] border border-[#E7E3DA] shadow-e1 p-5 pt-11">
              {/* Overlapping 72px avatar */}
              <div
                onClick={handleOpenFullPhoto}
                className={`absolute -top-9 left-5 ${person.photoRef ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
                title={person.photoRef ? 'Tap to view full photo' : undefined}
              >
                <div className="rounded-full p-1 bg-white shadow-e2 border border-[#E7E3DA]/60 inline-block">
                  <Avatar photoRef={person.photoRef} name={person.name} size="72" />
                </div>
              </div>

              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-[#14213D] tracking-tight leading-tight truncate">
                  {person.name}
                </h1>
                <div className="flex items-center gap-1.5 mt-1.5 text-sm text-[#5B6470] font-normal">
                  <MapPin className="w-4 h-4 text-[#0F766E] shrink-0" />
                  <span>Territory:</span>
                  <span className="font-semibold text-[#14213D]">
                    {territory ? territory.name : 'Unassigned'}
                  </span>
                </div>
                {person.messengerUrl && (
                  <div className="flex items-center gap-1.5 mt-1 text-sm text-[#5B6470] font-normal">
                    <MessageCircle className="w-4 h-4 text-[#0F766E] shrink-0" />
                    <span className="truncate max-w-[220px] sm:max-w-sm">{person.messengerUrl}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Primary Actions: sit in a raised row (e1) */}
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5 bg-white p-2.5 rounded-[16px] border border-[#E7E3DA] shadow-e1">
              {/* Message Action */}
              {person.messengerUrl ? (
                <a
                  href={getExternalUrl(person.messengerUrl) || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleOpenMessenger}
                  className="h-[52px] min-h-[44px] px-1.5 sm:px-3 bg-[#F3F1EC] hover:bg-slate-100 border border-[#E7E3DA] rounded-[14px] flex items-center justify-center gap-1.5 sm:gap-2 text-[#14213D] font-semibold text-xs sm:text-sm md:text-base transition-colors"
                >
                  <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#0F766E] shrink-0" />
                  <span className="truncate">Message</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => handleOpenMessenger()}
                  className="h-[52px] min-h-[44px] px-1.5 sm:px-3 bg-[#F3F1EC]/60 hover:bg-[#F3F1EC] border border-[#E7E3DA] rounded-[14px] flex items-center justify-center gap-1.5 sm:gap-2 text-[#5B6470] font-semibold text-xs sm:text-sm md:text-base transition-colors"
                >
                  <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#5B6470]/60 shrink-0" />
                  <span className="truncate">Message</span>
                </button>
              )}

              {/* Add Visit Action */}
              <PrimaryButton
                onClick={() => setIsAddingVisit(true)}
                icon={<Plus className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5] shrink-0" />}
                className="!px-1.5 sm:!px-3 !h-[52px] !min-h-[44px] !text-xs sm:!text-sm md:!text-base"
              >
                <span className="truncate">Add visit</span>
              </PrimaryButton>

              {/* Maps Action */}
              {person.latitude !== null && person.longitude !== null ? (
                <a
                  href={getMapsUrl(person.latitude, person.longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-[52px] min-h-[44px] px-1.5 sm:px-3 bg-[#F3F1EC] hover:bg-slate-100 border border-[#E7E3DA] rounded-[14px] flex items-center justify-center gap-1.5 sm:gap-2 text-[#14213D] font-semibold text-xs sm:text-sm md:text-base transition-colors"
                >
                  <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-[#0F766E] shrink-0" />
                  <span className="truncate">Maps</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={handleUpdateLocation}
                  disabled={isLocating}
                  className="h-[52px] min-h-[44px] px-1.5 sm:px-3 bg-[#F3F1EC]/60 hover:bg-[#F3F1EC] border border-[#E7E3DA] rounded-[14px] flex items-center justify-center gap-1.5 sm:gap-2 text-[#5B6470] font-semibold text-xs sm:text-sm md:text-base transition-colors disabled:opacity-50"
                >
                  <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-[#5B6470]/60 shrink-0" />
                  <span className="truncate">Maps</span>
                </button>
              )}
            </div>

            {/* 4. Location Section */}
            <div className="bg-white rounded-[16px] border border-[#E7E3DA] shadow-e1 p-5 space-y-3">
              <h2 className="text-base font-bold text-[#14213D] flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#0F766E]" />
                Location
              </h2>

              {person.latitude !== null && person.longitude !== null ? (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-[14px] border border-[#E7E3DA]">
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-base font-bold text-[#14213D]">Saved location</div>
                      <p className="text-xs text-[#5B6470] font-mono">
                        {person.latitude.toFixed(6)}, {person.longitude.toFixed(6)}
                      </p>
                    </div>
                    <a
                      href={getMapsUrl(person.latitude, person.longitude)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[44px] px-4 py-2 text-sm font-semibold text-[#0F766E] bg-white hover:bg-slate-50 border border-[#E7E3DA] rounded-[14px] flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow-xs"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Open in Maps</span>
                    </a>
                  </div>

                  <button
                    type="button"
                    onClick={handleUpdateLocation}
                    disabled={isLocating}
                    className="w-full h-[52px] min-h-[52px] px-5 text-base font-semibold text-[#14213D] bg-white hover:bg-slate-50 border border-[#E7E3DA] rounded-[16px] flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-xs"
                  >
                    <Navigation className={`w-4 h-4 ${isLocating ? 'animate-spin text-[#0F766E]' : 'text-[#0F766E]'}`} />
                    <span>{isLocating ? 'Determining GPS...' : 'Update Location'}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 bg-white rounded-[14px] border border-[#E7E3DA]">
                    <div className="text-base font-bold text-[#14213D]">No location saved</div>
                    <p className="text-sm text-[#5B6470] mt-0.5">Capture GPS coordinates for field navigation.</p>
                  </div>

                  <PrimaryButton
                    onClick={handleUpdateLocation}
                    disabled={isLocating}
                    className="w-full"
                    icon={<Navigation className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />}
                  >
                    {isLocating ? 'Determining GPS...' : 'Get Current Location'}
                  </PrimaryButton>
                </div>
              )}
            </div>
          </div>

          {/* Right Column on Desktop: Visit History */}
          <div className="lg:col-span-7 xl:col-span-7 space-y-4">
            {/* 3. Visit History Section */}
            <div className="bg-white rounded-[16px] border border-[#E7E3DA] shadow-e1 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-[#14213D] flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#0F766E]" />
                    Visit history
                  </h2>
                  <span className="text-sm font-mono font-medium text-[#5B6470]">
                    ({visits.length})
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddingVisit(true)}
                  className="min-h-[44px] px-3.5 py-2 text-sm font-semibold text-[#0F766E] hover:bg-[#0F766E]/10 rounded-[12px] flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Add visit</span>
                </button>
              </div>

              {visits.length === 0 ? (
                <div className="py-8 text-center text-[#5B6470]">
                  <Calendar className="w-8 h-8 mx-auto text-[#5B6470]/40 stroke-[1.5] mb-2" />
                  <p className="text-base font-semibold text-[#14213D]">No visits recorded yet</p>
                  <p className="text-sm text-[#5B6470] mt-0.5">
                    Record your first visit after speaking with this contact.
                  </p>
                  <div className="mt-4">
                    <PrimaryButton
                      onClick={() => setIsAddingVisit(true)}
                      icon={<Plus className="w-5 h-5 stroke-[2.5]" />}
                    >
                      Record first visit
                    </PrimaryButton>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 divide-y divide-[#E7E3DA]">
                  {visits.map((visit) => {
                    const visitDateStr = new Date(visit.visitedAt).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    });
                    const isVisitMenuOpen = openVisitMenuId === visit.id;

                    return (
                      <div key={visit.id} className="pt-3.5 first:pt-0 group">
                        <div className="flex items-center justify-between text-sm text-[#5B6470] mb-1.5">
                          <div className="flex items-center gap-2 font-bold text-[#14213D]">
                            <Calendar className="w-4 h-4 text-[#0F766E]" />
                            <span>{visitDateStr}</span>
                          </div>

                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenVisitMenuId(isVisitMenuOpen ? null : visit.id);
                              }}
                              className="min-h-[44px] min-w-[44px] p-2 text-[#5B6470] hover:text-[#14213D] hover:bg-slate-100 rounded-[12px] flex items-center justify-center transition-colors"
                              aria-label="Visit options"
                            >
                              <MoreVertical className="w-5 h-5" />
                            </button>

                            {isVisitMenuOpen && (
                              <>
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenVisitMenuId(null);
                                  }}
                                />
                                <div
                                  className="absolute right-0 top-full mt-1 z-50 w-32 bg-white rounded-[14px] border border-[#E7E3DA] shadow-e3 py-1 overflow-hidden animate-in fade-in duration-100"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenVisitMenuId(null);
                                      setEditingVisit(visit);
                                    }}
                                    className="w-full min-h-[44px] px-3.5 py-2 text-left text-sm font-semibold text-[#14213D] hover:bg-slate-50 flex items-center gap-2 transition-colors"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-[#5B6470]" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenVisitMenuId(null);
                                      setVisitToDelete(visit);
                                    }}
                                    className="w-full min-h-[44px] px-3.5 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="text-base text-[#14213D] leading-relaxed pl-6 whitespace-pre-wrap">
                          {visit.remarks ? (
                            visit.remarks
                          ) : (
                            <span className="italic text-[#5B6470] text-sm">No remarks entered.</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Contact Modal */}
      <RecordFormModal
        isOpen={isEditingContact}
        initialPerson={person}
        onClose={() => setIsEditingContact(false)}
        onSaved={() => {
          setIsEditingContact(false);
        }}
      />

      {/* Add Visit Modal */}
      {isAddingVisit && (
        <VisitFormModal
          isOpen={true}
          personId={person.id}
          initialVisit={null}
          onSave={async (vData) => {
            await saveVisit(vData);
            showToast('Visit added', 'success');
          }}
          onClose={() => setIsAddingVisit(false)}
        />
      )}

      {/* Edit Visit Modal */}
      {editingVisit && (
        <VisitFormModal
          isOpen={true}
          personId={person.id}
          initialVisit={editingVisit}
          onSave={async (vData) => {
            await saveVisit(vData);
            showToast('Visit updated', 'success');
          }}
          onClose={() => setEditingVisit(null)}
        />
      )}

      {/* Delete Contact Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteContactDialog}
        title="Delete this contact?"
        message="This will permanently remove the contact and their visit history from this device."
        confirmLabel="Delete Contact"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={handleConfirmDeleteContact}
        onCancel={() => setShowDeleteContactDialog(false)}
      />

      {/* Delete Visit Confirmation Dialog */}
      <ConfirmDialog
        isOpen={visitToDelete !== null}
        title="Delete this visit record?"
        message="Are you sure you want to delete this visit from this contact's history? This cannot be undone."
        confirmLabel="Delete Visit"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={async () => {
          if (visitToDelete) {
            await deleteVisit(visitToDelete.id);
            showToast('Visit deleted', 'info');
            setVisitToDelete(null);
          }
        }}
        onCancel={() => setVisitToDelete(null)}
      />

      {/* Replace Location Confirmation */}
      <ConfirmDialog
        isOpen={showReplaceLocationDialog}
        title="Replace Existing Location?"
        message={`This contact already has a saved location (${person.latitude}, ${person.longitude}).\n\nDo you want to update it with the new coordinates (${pendingCoords?.lat}, ${pendingCoords?.lng})?`}
        confirmLabel="Update Location"
        cancelLabel="Keep Existing"
        onConfirm={handleConfirmReplaceLocation}
        onCancel={() => {
          setPendingCoords(null);
          setShowReplaceLocationDialog(false);
        }}
      />

      {/* Full Size Profile Photo Viewer Modal */}
      {showFullPhoto && fullPhotoUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowFullPhoto(false)}
        >
          <div
            className="relative max-w-lg w-full bg-white rounded-[12px] p-4 shadow-2xl flex flex-col items-center max-h-[85vh] border border-[#E5E7EB]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-[#E5E7EB]">
              <span className="text-base font-semibold text-slate-900 truncate">{person.name}</span>
              <button
                type="button"
                onClick={() => setShowFullPhoto(false)}
                className="min-h-[44px] min-w-[44px] p-2 text-slate-400 hover:text-slate-700 rounded-[12px] flex items-center justify-center"
                aria-label="Close photo"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="w-full flex items-center justify-center overflow-hidden max-h-[70vh] rounded-[12px] bg-slate-50 border border-[#E5E7EB]">
              <img
                src={fullPhotoUrl}
                alt={person.name}
                referrerPolicy="no-referrer"
                className="max-w-full max-h-[68vh] object-contain rounded-[12px] block"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
