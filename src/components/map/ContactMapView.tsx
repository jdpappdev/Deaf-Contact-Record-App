import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Person, Territory } from '../../types';
import { Avatar } from '../common/Avatar';
import { PrimaryButton } from '../common/PrimaryButton';
import L from 'leaflet';
import {
  MapPin,
  Filter,
  Navigation,
  ExternalLink,
  ChevronRight,
  User,
  List,
} from 'lucide-react';

// Safeguard Leaflet against undefined map elements and race conditions during transition teardown
if (typeof window !== 'undefined') {
  if (L.DomUtil && L.DomUtil.getPosition) {
    const origGetPosition = L.DomUtil.getPosition;
    L.DomUtil.getPosition = function (el: HTMLElement) {
      if (!el) {
        return L.point(0, 0);
      }
      return origGetPosition.call(L.DomUtil, el);
    };
  }

  if ((L.Map.prototype as any)._onZoomTransitionEnd) {
    const origOnZoomTransitionEnd = (L.Map.prototype as any)._onZoomTransitionEnd;
    (L.Map.prototype as any)._onZoomTransitionEnd = function () {
      if (!this._mapPane || !this._container) {
        this._animatingZoom = false;
        return;
      }
      try {
        origOnZoomTransitionEnd.call(this);
      } catch {
        this._animatingZoom = false;
      }
    };
  }

  if ((L.Map.prototype as any)._getMapPanePos) {
    const origGetMapPanePos = (L.Map.prototype as any)._getMapPanePos;
    (L.Map.prototype as any)._getMapPanePos = function () {
      if (!this._mapPane) {
        return L.point(0, 0);
      }
      return origGetMapPanePos.call(this);
    };
  }
}

export const ContactMapView: React.FC = () => {
  const { people, territories, setSelectedPersonId, setActiveTab } = useApp();

  const [selectedTerritoryFilter, setSelectedTerritoryFilter] = useState<string>('all');
  const [selectedContact, setSelectedContact] = useState<Person | null>(null);
  const [showCoordinateList, setShowCoordinateList] = useState(false);
  const [isLocatingUser, setIsLocatingUser] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Territory map
  const territoryMap = useMemo(() => {
    const map = new Map<string, Territory>();
    for (const t of territories) {
      map.set(t.id, t);
    }
    return map;
  }, [territories]);

  // People with valid coordinates
  const peopleWithLocations = useMemo(() => {
    return people.filter(
      (p) =>
        typeof p.latitude === 'number' &&
        !isNaN(p.latitude) &&
        typeof p.longitude === 'number' &&
        !isNaN(p.longitude)
    );
  }, [people]);

  // Filtered by selected territory
  const filteredContacts = useMemo(() => {
    if (selectedTerritoryFilter === 'all') return peopleWithLocations;
    return peopleWithLocations.filter((p) => p.territoryId === selectedTerritoryFilter);
  }, [peopleWithLocations, selectedTerritoryFilter]);

  // Initialize Map ONCE on mount
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialLat = peopleWithLocations[0]?.latitude ?? 20.0;
    const initialLng = peopleWithLocations[0]?.longitude ?? 0.0;
    const initialZoom = peopleWithLocations.length > 0 ? 12 : 2;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      zoomControl: false,
    });

    // Add zoom control to top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // OpenStreetMap tile layer (gracefully fails or renders offline grid)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    mapInstanceRef.current = map;

    // Ensure map tiles and dimensions calculate properly
    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 120);

    // Watch container resizes (e.g. orientation changes, tab switching, responsive reflow)
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    const handleWindowResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleWindowResize);
    window.addEventListener('orientationchange', handleWindowResize);

    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener('orientationchange', handleWindowResize);
      resizeObserver?.disconnect();
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.stop();
          mapInstanceRef.current.off();
          mapInstanceRef.current.remove();
        } catch {
          // Ignore unmount errors on destroyed map
        }
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
      }
    };
  }, []);

  // Update Markers when filteredContacts change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    if (filteredContacts.length === 0) return;

    const bounds = L.latLngBounds([]);

    filteredContacts.forEach((person) => {
      if (person.latitude === null || person.longitude === null) return;

      const latLng = L.latLng(person.latitude, person.longitude);
      bounds.extend(latLng);

      // Custom marker icon with primary pin
      const icon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div style="
            background: #0F766E;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid white;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(20, 33, 61, 0.2);
          ">
            <div style="
              transform: rotate(45deg);
              font-size: 11px;
              font-weight: bold;
            ">📍</div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
      });

      const marker = L.marker([person.latitude, person.longitude], { icon });

      marker.on('click', () => {
        setSelectedContact(person);
      });

      markersLayer.addLayer(marker);
    });

    // Fit map view to pins without animated CSS transitions to prevent teardown collisions
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: false });
    }
  }, [filteredContacts]);

  // Trigger resize recalculation when locations list is populated
  useEffect(() => {
    if (mapInstanceRef.current && peopleWithLocations.length > 0) {
      const timer = setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [peopleWithLocations.length]);

  // Center on user's current GPS position (explicit action only)
  const handleLocateUser = () => {
    if (!navigator.geolocation || !mapInstanceRef.current) return;
    setIsLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingUser(false);
        const map = mapInstanceRef.current;
        if (map) {
          map.setView([pos.coords.latitude, pos.coords.longitude], 15, { animate: false });
        }
      },
      () => {
        setIsLocatingUser(false);
      },
      { timeout: 10000 }
    );
  };

  const handleOpenPersonDetail = (personId: string) => {
    setSelectedPersonId(personId);
    setActiveTab('records');
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] md:min-h-[calc(100vh-4.5rem)] flex flex-col pb-28 md:pb-8">
      {/* Unified Compact Header */}
      <header className="sticky top-0 md:top-[58px] lg:top-0 z-20 bg-white border-b border-[#E7E3DA] px-4 sm:px-6 py-3 shrink-0 shadow-e2">
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
                <span className="font-mono tabular-nums font-semibold text-[#14213D]">{peopleWithLocations.length}</span>{' '}
                {peopleWithLocations.length === 1 ? 'person with location' : 'people with locations'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowCoordinateList(!showCoordinateList)}
            className={`min-h-[44px] px-3.5 py-2 text-sm font-semibold rounded-[14px] border transition-colors flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer ${
              showCoordinateList
                ? 'bg-[#14213D] text-white border-[#14213D]'
                : 'bg-white text-[#14213D] border-[#E7E3DA] hover:bg-slate-50'
            }`}
          >
            <List className="w-4 h-4" />
            <span>Coordinates</span>
          </button>
        </div>
      </header>

      {/* 2. Filter Chips slider: All Territories and individual territories (Unassigned removed per requirements) */}
      <div className="z-20 bg-white/95 backdrop-blur-xs border-b border-[#E7E3DA] px-4 sm:px-6 py-2 shrink-0">
        <div className="max-w-6xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 text-sm">
          <span className="text-[#5B6470]/60 flex items-center gap-1 text-sm font-medium shrink-0 mr-0.5">
            <Filter className="w-4 h-4" />
          </span>
          <button
            type="button"
            onClick={() => setSelectedTerritoryFilter('all')}
            className={`min-h-[44px] px-3.5 py-2 rounded-[14px] whitespace-nowrap transition-colors font-semibold text-sm border shadow-xs cursor-pointer ${
              selectedTerritoryFilter === 'all'
                ? 'bg-[#0F766E] text-white border-[#0F766E]'
                : 'bg-white text-[#14213D] border-[#E7E3DA] hover:bg-slate-50'
            }`}
          >
            All Territories ({peopleWithLocations.length})
          </button>
          {territories.map((terr) => {
            const count = peopleWithLocations.filter((p) => p.territoryId === terr.id).length;
            return (
              <button
                key={terr.id}
                type="button"
                onClick={() => setSelectedTerritoryFilter(terr.id)}
                className={`min-h-[44px] px-3.5 py-2 rounded-[14px] whitespace-nowrap transition-colors font-semibold text-sm border shadow-xs cursor-pointer ${
                  selectedTerritoryFilter === terr.id
                    ? 'bg-[#0F766E] text-white border-[#0F766E]'
                    : 'bg-white text-[#14213D] border-[#E7E3DA] hover:bg-slate-50'
                }`}
              >
                {terr.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Dedicated Landscape Map Panel Container */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-3.5 sm:px-6 py-3 sm:py-5 flex flex-col justify-center items-center">
        <div className="w-full relative bg-white rounded-[20px] sm:rounded-[24px] border border-[#E7E3DA] shadow-e2 overflow-hidden h-[58vh] min-h-[350px] md:h-[62vh] md:min-h-[480px] lg:h-[calc(100vh-14rem)] lg:min-h-[520px] lg:max-h-[760px]">
          {/* Permanent Map DOM Container prevents unexpected unmount during transitions */}
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {peopleWithLocations.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-[#F3F1EC]">
              <div className="w-16 h-16 bg-white border border-[#E7E3DA] text-[#0F766E] rounded-[20px] shadow-e1 flex items-center justify-center mb-4">
                <MapPin className="w-8 h-8 stroke-[1.75]" />
              </div>
              <h2 className="text-xl font-bold text-[#14213D]">No saved locations</h2>
              <p className="text-sm text-[#5B6470] mt-1.5 max-w-sm leading-relaxed">
                Contacts do not have GPS coordinates yet. Record coordinates when editing contacts or visiting them in the field.
              </p>
              <div className="mt-5">
                <PrimaryButton
                  onClick={() => setActiveTab('records')}
                >
                  Go to Contacts
                </PrimaryButton>
              </div>
            </div>
          ) : (
            <>
              {/* Float My Location Button */}
              <button
                type="button"
                onClick={handleLocateUser}
                disabled={isLocatingUser}
                className="absolute top-3.5 left-3.5 z-10 w-11 h-11 bg-white hover:bg-slate-50 text-[#14213D] rounded-[14px] border border-[#E7E3DA] shadow-e2 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                aria-label="Center on my GPS location"
                title="Locate me"
              >
                <Navigation
                  className={`w-5 h-5 text-[#0F766E] ${isLocatingUser ? 'animate-spin' : ''}`}
                />
              </button>

              {/* Offline Coordinates List Overlay */}
              {showCoordinateList && (
                <div className="absolute inset-0 z-30 bg-white/95 backdrop-blur-xs p-4 overflow-y-auto">
                  <div className="max-w-xl mx-auto space-y-3">
                    <div className="flex items-center justify-between pb-3 border-b border-[#E7E3DA]">
                      <div>
                        <h3 className="text-base font-bold text-[#14213D]">
                          Saved Coordinates ({filteredContacts.length})
                        </h3>
                        <p className="text-sm text-[#5B6470] mt-0.5">
                          Stored coordinates are always available locally offline.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowCoordinateList(false)}
                        className="min-h-[44px] px-3.5 py-1.5 text-sm font-semibold text-[#0F766E] hover:underline cursor-pointer"
                      >
                        Close List
                      </button>
                    </div>

                    <div className="space-y-2.5 pt-1">
                      {filteredContacts.map((contact) => (
                        <div
                          key={contact.id}
                          className="p-3.5 bg-white rounded-[14px] border border-[#E7E3DA] shadow-e1 flex items-center justify-between"
                        >
                          <div className="min-w-0 flex-1">
                            <h4 className="text-base font-bold text-[#14213D] truncate">
                              {contact.name}
                            </h4>
                            <p className="font-mono text-sm text-[#5B6470] mt-0.5">
                              {contact.latitude?.toFixed(6)}, {contact.longitude?.toFixed(6)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${contact.latitude},${contact.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-h-[44px] px-3.5 py-2 text-sm font-semibold text-[#14213D] bg-white hover:bg-slate-50 border border-[#E7E3DA] rounded-[12px] flex items-center gap-1.5 shadow-xs"
                            >
                              <ExternalLink className="w-4 h-4 text-[#0F766E]" />
                              Maps
                            </a>
                            <button
                              type="button"
                              onClick={() => handleOpenPersonDetail(contact.id)}
                              className="min-h-[44px] px-4 py-2 text-sm font-semibold text-white bg-[#0F766E] hover:bg-[#0D655E] rounded-[12px] shadow-sm cursor-pointer"
                            >
                              Open
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Floating e3 Card for Selected Marker inside Map Panel */}
              {selectedContact && (
                <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-auto sm:w-[380px] z-30 max-w-sm mx-auto sm:mx-0 bg-white rounded-[16px] border border-[#E7E3DA] p-3.5 sm:p-4 shadow-e3 animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <div className="flex items-center gap-3">
                    <Avatar photoRef={selectedContact.photoRef} name={selectedContact.name} size="md" />

                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold text-[#14213D] truncate">
                        {selectedContact.name}
                      </h3>
                      <p className="text-sm text-[#5B6470] truncate">
                        {selectedContact.territoryId
                          ? territoryMap.get(selectedContact.territoryId)?.name || 'Territory'
                          : 'Unassigned territory'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedContact(null)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#5B6470] hover:text-[#14213D] rounded-[12px] cursor-pointer"
                      aria-label="Close selection"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[#E7E3DA] flex items-center justify-between">
                    <span className="font-mono text-sm text-[#5B6470]">
                      {selectedContact.latitude?.toFixed(5)}, {selectedContact.longitude?.toFixed(5)}
                    </span>

                    <div className="flex items-center gap-2">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${selectedContact.latitude},${selectedContact.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[44px] px-3.5 py-2 text-sm font-semibold text-[#14213D] bg-white hover:bg-slate-50 border border-[#E7E3DA] rounded-[12px] flex items-center gap-1.5 transition-colors shadow-xs"
                      >
                        <ExternalLink className="w-4 h-4 text-[#0F766E]" />
                        External
                      </a>
                      <button
                        type="button"
                        onClick={() => handleOpenPersonDetail(selectedContact.id)}
                        className="min-h-[44px] px-4 py-2 text-sm font-semibold text-white bg-[#0F766E] hover:bg-[#0D655E] rounded-[12px] flex items-center gap-1 transition-colors shadow-sm cursor-pointer"
                      >
                        <span>Open</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};
