import React, { useState, useEffect, useRef } from 'react';
import { Person } from '../../types';
import { useApp } from '../../context/AppContext';
import { photoService, isValidUrl, getExternalUrl } from '../../services/dataService';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { PrimaryButton } from '../common/PrimaryButton';
import {
  X,
  Camera,
  MapPin,
  Trash2,
  Navigation,
  ExternalLink,
  MessageCircle,
  AlertCircle,
} from 'lucide-react';

interface RecordFormModalProps {
  isOpen: boolean;
  initialPerson?: Person | null;
  onClose: () => void;
  onSaved: (person: Person) => void;
}

export const RecordFormModal: React.FC<RecordFormModalProps> = ({
  isOpen,
  initialPerson,
  onClose,
  onSaved,
}) => {
  const { territories, savePerson, showToast, loadPhotoUrl } = useApp();

  const [name, setName] = useState('');
  const [territoryId, setTerritoryId] = useState<string>('');
  const [messengerUrl, setMessengerUrl] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [photoRef, setPhotoRef] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [isLocating, setIsLocating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Dialog states for location safety
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showReplaceLocationDialog, setShowReplaceLocationDialog] = useState(false);
  const [showClearLocationDialog, setShowClearLocationDialog] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialPerson) {
      setName(initialPerson.name);
      setTerritoryId(initialPerson.territoryId || '');
      setMessengerUrl(initialPerson.messengerUrl || '');
      setLatitude(initialPerson.latitude);
      setLongitude(initialPerson.longitude);
      setPhotoRef(initialPerson.photoRef);

      if (initialPerson.photoRef) {
        loadPhotoUrl(initialPerson.photoRef).then((url) => {
          setPhotoPreview(url);
        });
      } else {
        setPhotoPreview(null);
      }
    } else {
      setName('');
      setTerritoryId('');
      setMessengerUrl('');
      setLatitude(null);
      setLongitude(null);
      setPhotoRef(null);
      setPhotoPreview(null);
    }
    setFormError(null);
  }, [initialPerson, isOpen, loadPhotoUrl]);

  if (!isOpen) return null;

  // Handle Photo selection - stores original Blob directly into IndexedDB without canvas redraw
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Validate that it is an image
    if (!file.type || !file.type.startsWith('image/')) {
      setFormError('The selected file is not an image. Please choose a valid photograph.');
      return;
    }

    const oldPhotoRef = photoRef;

    try {
      // 2. Store original intact Blob in IndexedDB
      const newPhotoId = await photoService.savePhoto(file, file.type);

      // 3. Display new image directly via browser Object URL
      const previewUrl = URL.createObjectURL(file);
      setPhotoPreview(previewUrl);

      // 4. Replace image reference
      setPhotoRef(newPhotoId);

      // 5. Remove the old local image asset only after the new image has been successfully stored
      if (oldPhotoRef && oldPhotoRef !== newPhotoId) {
        await photoService.deletePhoto(oldPhotoRef).catch(() => {});
      }

      showToast('Photo uploaded successfully', 'success');
      setFormError(null);
    } catch (err: unknown) {
      console.error('Failed to store profile photo Blob:', err);
      // Keep existing image, do not delete old image, show clear error
      setFormError('Failed to save photo. Please try a different image.');
    }
  };

  const handleRemovePhoto = () => {
    setPhotoRef(null);
    setPhotoPreview(null);
  };

  // Location Handling with safety checks
  const handleRequestLocation = () => {
    if (!navigator.geolocation) {
      setFormError('Geolocation is not supported by your browser or device.');
      return;
    }

    setIsLocating(true);
    setFormError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const newLat = parseFloat(position.coords.latitude.toFixed(6));
        const newLng = parseFloat(position.coords.longitude.toFixed(6));

        // If location already exists and is different, confirm before replacing
        if (latitude !== null && longitude !== null) {
          if (latitude !== newLat || longitude !== newLng) {
            setPendingCoords({ lat: newLat, lng: newLng });
            setShowReplaceLocationDialog(true);
            return;
          }
        }

        setLatitude(newLat);
        setLongitude(newLng);
        showToast('Location captured', 'success');
      },
      (error) => {
        setIsLocating(false);
        let msg = 'Unable to retrieve location.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Location permission was denied. Please allow location access in your browser settings.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'Location information is currently unavailable.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'The request to get location timed out.';
        }
        setFormError(msg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const confirmReplaceLocation = () => {
    if (pendingCoords) {
      setLatitude(pendingCoords.lat);
      setLongitude(pendingCoords.lng);
      setPendingCoords(null);
      setShowReplaceLocationDialog(false);
      showToast('Location updated', 'success');
    }
  };

  const confirmClearLocation = () => {
    setLatitude(null);
    setLongitude(null);
    setShowClearLocationDialog(false);
    showToast('Location cleared', 'info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setFormError('Please enter the contact name.');
      return;
    }

    if (messengerUrl.trim() && !isValidUrl(messengerUrl.trim())) {
      setFormError('Please enter a valid Messenger URL (e.g. https://m.me/username or m.me/username).');
      return;
    }

    try {
      setIsSaving(true);
      setFormError(null);

      if (latitude !== null && (latitude < -90 || latitude > 90)) {
        setFormError('Latitude must be between -90 and 90.');
        return;
      }
      if (longitude !== null && (longitude < -180 || longitude > 180)) {
        setFormError('Longitude must be between -180 and 180.');
        return;
      }

      const saved = await savePerson({
        id: initialPerson?.id,
        name: name.trim(),
        photoRef,
        latitude,
        longitude,
        territoryId: territoryId || null,
        messengerUrl: messengerUrl.trim() ? getExternalUrl(messengerUrl.trim()) || messengerUrl.trim() : null,
      });

      showToast(initialPerson ? 'Contact updated' : 'Contact created', 'success');
      onSaved(saved);
      onClose();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save contact.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#14213D]/40 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      >
        <div
          className="w-full max-w-lg max-h-[92vh] flex flex-col bg-white rounded-[16px] border border-[#E7E3DA] shadow-e3 overflow-hidden my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E7E3DA] shrink-0">
            <h2 className="text-base font-bold text-[#14213D]">
              {initialPerson ? 'Edit Contact' : 'Add Contact'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] p-2 text-[#5B6470] hover:text-[#14213D] rounded-[12px] flex items-center justify-center"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
            {formError && (
              <div className="flex items-start gap-2 p-3 text-sm text-red-600 bg-white rounded-[14px] border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {/* Profile Photo Section */}
            <div>
              <label className="block text-sm font-semibold text-[#14213D] mb-2">
                Profile Photo
              </label>
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-full bg-white border border-[#E7E3DA] flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="w-full h-full object-cover object-center block"
                    />
                  ) : (
                    <Camera className="w-6 h-6 text-[#5B6470]" />
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[44px] px-4 py-2 text-sm font-semibold text-[#14213D] bg-white hover:bg-slate-50 border border-[#E7E3DA] rounded-[14px] transition-colors"
                  >
                    {photoPreview ? 'Change Photo' : 'Upload Photo'}
                  </button>
                  {photoPreview && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="min-h-[44px] px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 bg-white border border-red-200 rounded-[14px] transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Name */}
            <div>
              <label className="block text-sm font-semibold text-[#14213D] mb-1.5">
                Contact Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full or preferred name"
                className="w-full h-12 px-3.5 text-base text-[#14213D] bg-white border border-[#E7E3DA] rounded-[14px] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
              />
            </div>

            {/* Territory Selection */}
            <div>
              <label className="block text-sm font-semibold text-[#14213D] mb-1.5">
                Territory
              </label>
              <select
                value={territoryId}
                onChange={(e) => setTerritoryId(e.target.value)}
                className="w-full h-12 px-3 text-base text-[#14213D] bg-white border border-[#E7E3DA] rounded-[14px] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
              >
                <option value="">No territory assigned</option>
                {territories.map((terr) => (
                  <option key={terr.id} value={terr.id}>
                    {terr.name}
                  </option>
                ))}
              </select>
              {territories.length === 0 && (
                <p className="mt-1 text-sm text-[#5B6470]">
                  No territories created yet. You can create them in the Territories tab.
                </p>
              )}
            </div>

            {/* Messenger URL */}
            <div>
              <label className="block text-sm font-semibold text-[#14213D] mb-1.5 flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-[#0F766E]" />
                Messenger URL
              </label>
              <input
                type="text"
                value={messengerUrl}
                onChange={(e) => setMessengerUrl(e.target.value)}
                placeholder="https://m.me/username or profile URL"
                className="w-full h-12 px-3.5 text-base text-[#14213D] bg-white border border-[#E7E3DA] rounded-[14px] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
              />
              <p className="mt-1 text-sm text-[#5B6470]">
                Enter the direct link to their Messenger conversation or profile.
              </p>
            </div>

            {/* Location Section */}
            <div className="p-4 bg-white rounded-[14px] border border-[#E7E3DA] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#14213D] flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#0F766E]" />
                  Field Location
                </span>
                {latitude !== null && longitude !== null && (
                  <button
                    type="button"
                    onClick={() => setShowClearLocationDialog(true)}
                    className="min-h-[44px] px-2 text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    Clear Location
                  </button>
                )}
              </div>

              {/* Inputs always shown */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#5B6470] mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      min="-90"
                      max="90"
                      value={latitude ?? ''}
                      onChange={(e) => setLatitude(e.target.value === '' ? null : parseFloat(e.target.value))}
                      placeholder="e.g. 14.5995"
                      className="w-full h-10 px-3 text-sm font-mono text-[#14213D] bg-white border border-[#E7E3DA] rounded-[10px] focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5B6470] mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      min="-180"
                      max="180"
                      value={longitude ?? ''}
                      onChange={(e) => setLongitude(e.target.value === '' ? null : parseFloat(e.target.value))}
                      placeholder="e.g. 120.9842"
                      className="w-full h-10 px-3 text-sm font-mono text-[#14213D] bg-white border border-[#E7E3DA] rounded-[10px] focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isLocating}
                  onClick={handleRequestLocation}
                  className="w-full h-[52px] min-h-[52px] px-4 text-base font-semibold text-[#14213D] bg-white hover:bg-slate-50 border border-[#E7E3DA] rounded-[14px] flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Navigation className={`w-4 h-4 ${isLocating ? 'animate-spin text-[#0F766E]' : 'text-[#0F766E]'}`} />
                  <span>{isLocating ? 'Determining GPS...' : 'Autofill from GPS'}</span>
                </button>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E7E3DA]">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="h-[52px] min-h-[52px] px-5 text-base font-medium text-[#14213D] bg-white border border-[#E7E3DA] hover:bg-slate-50 rounded-[14px] transition-colors"
              >
                Cancel
              </button>
              <PrimaryButton
                type="submit"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : initialPerson ? 'Save Changes' : 'Add Contact'}
              </PrimaryButton>
            </div>
          </form>
        </div>
      </div>

      {/* Confirmation to replace existing location */}
      <ConfirmDialog
        isOpen={showReplaceLocationDialog}
        title="Replace Existing Location?"
        message={`This contact already has a saved location (${latitude}, ${longitude}).\n\nDo you want to replace it with the newly captured coordinates (${pendingCoords?.lat}, ${pendingCoords?.lng})?`}
        confirmLabel="Update Location"
        cancelLabel="Keep Existing"
        onConfirm={confirmReplaceLocation}
        onCancel={() => {
          setPendingCoords(null);
          setShowReplaceLocationDialog(false);
        }}
      />

      {/* Confirmation to clear existing location */}
      <ConfirmDialog
        isOpen={showClearLocationDialog}
        title="Clear Saved Location?"
        message="Are you sure you want to remove the saved geographic coordinates for this contact?"
        confirmLabel="Clear Location"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={confirmClearLocation}
        onCancel={() => setShowClearLocationDialog(false)}
      />
    </>
  );
};
