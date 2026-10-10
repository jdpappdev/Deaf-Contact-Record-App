import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { BottomNavigation } from './components/navigation/BottomNavigation';
import { RecordList } from './components/records/RecordList';
import { RecordDetail } from './components/records/RecordDetail';
import { TerritoryList } from './components/territories/TerritoryList';
import { ContactMapView } from './components/map/ContactMapView';
import { SettingsView } from './components/settings/SettingsView';
import { ToastContainer } from './components/common/ToastContainer';
import { Contact, MapPin, Map, Settings, Loader2, WifiOff } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    selectedPersonId,
    setSelectedPersonId,
    people,
    territories,
    isLoading,
    user,
    signOut,
    cloudSyncStatus,
  } = useApp();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F3F1EC] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-[#0F766E] animate-spin mb-3" />
        <p className="text-sm font-medium text-[#5B6470]">Loading local records...</p>
      </div>
    );
  }

  const selectedPerson = selectedPersonId
    ? people.find((p) => p.id === selectedPersonId) || null
    : null;

  const peopleWithLocationsCount = people.filter(
    (p) => p.latitude !== null && p.longitude !== null
  ).length;

  return (
    <div className="min-h-screen bg-canvas-gradient text-[#14213D] flex flex-col selection:bg-[#0F766E]/20 selection:text-[#0F766E]">
      {/* Toast notifications */}
      <ToastContainer />

      {/* Offline Indicator Banner */}
      {(cloudSyncStatus === 'offline' || (typeof navigator !== 'undefined' && !navigator.onLine)) && (
        <div className="bg-amber-500 text-slate-900 px-4 py-2 text-xs font-semibold text-center flex items-center justify-center gap-2 shadow-sm z-50">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>You are offline. Changes are saved locally and will sync when internet returns.</span>
        </div>
      )}

      {/* 1. Desktop Fixed Left Sidebar (visible on lg: screens and above) */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-64 xl:w-72 bg-white border-r border-[#E7E3DA] z-40 shadow-e1 justify-between select-none">
        {/* Sidebar Header with Brand */}
        <div className="p-5">
          <div className="flex items-center gap-3 pb-6 border-b border-[#E7E3DA]">
            <img
              src="/icon-192.png"
              alt="Deaf Contact Record"
              className="w-10 h-10 rounded-[12px] object-cover shadow-sm ring-1 ring-black/5 shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-base font-bold text-[#14213D] tracking-tight leading-tight truncate">
                Deaf Contact Record
              </h1>
              <p className="text-xs text-[#5B6470] mt-0.5 truncate">
                Local Field Ministry
              </p>
            </div>
          </div>

          {/* Sidebar Navigation Items */}
          <nav className="mt-5 space-y-1.5" aria-label="Desktop Navigation">
            <button
              type="button"
              onClick={() => {
                setSelectedPersonId(null);
                setActiveTab('records');
              }}
              className={`w-full min-h-[46px] px-3.5 py-2.5 rounded-[14px] flex items-center justify-between text-sm font-semibold transition-all duration-200 cursor-pointer ${
                activeTab === 'records'
                  ? 'bg-[#0F766E] text-white shadow-sm'
                  : 'text-[#5B6470] hover:text-[#14213D] hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Contact className={`w-5 h-5 ${activeTab === 'records' ? 'text-white' : 'text-[#5B6470]'}`} />
                <span>Contacts</span>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-mono tabular-nums ${
                  activeTab === 'records'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#F3F1EC] text-[#5B6470]'
                }`}
              >
                {people.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('territories')}
              className={`w-full min-h-[46px] px-3.5 py-2.5 rounded-[14px] flex items-center justify-between text-sm font-semibold transition-all duration-200 cursor-pointer ${
                activeTab === 'territories'
                  ? 'bg-[#0F766E] text-white shadow-sm'
                  : 'text-[#5B6470] hover:text-[#14213D] hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <MapPin className={`w-5 h-5 ${activeTab === 'territories' ? 'text-white' : 'text-[#5B6470]'}`} />
                <span>Territories</span>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-mono tabular-nums ${
                  activeTab === 'territories'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#F3F1EC] text-[#5B6470]'
                }`}
              >
                {territories.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('map')}
              className={`w-full min-h-[46px] px-3.5 py-2.5 rounded-[14px] flex items-center justify-between text-sm font-semibold transition-all duration-200 cursor-pointer ${
                activeTab === 'map'
                  ? 'bg-[#0F766E] text-white shadow-sm'
                  : 'text-[#5B6470] hover:text-[#14213D] hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Map className={`w-5 h-5 ${activeTab === 'map' ? 'text-white' : 'text-[#5B6470]'}`} />
                <span>Map</span>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-mono tabular-nums ${
                  activeTab === 'map'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#F3F1EC] text-[#5B6470]'
                }`}
              >
                {peopleWithLocationsCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`w-full min-h-[46px] px-3.5 py-2.5 rounded-[14px] flex items-center justify-between text-sm font-semibold transition-all duration-200 cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-[#0F766E] text-white shadow-sm'
                  : 'text-[#5B6470] hover:text-[#14213D] hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Settings className={`w-5 h-5 ${activeTab === 'settings' ? 'text-white' : 'text-[#5B6470]'}`} />
                <span>Settings</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[#E7E3DA]">
          {user ? (
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || user.email || 'User'}
                    className="w-6 h-6 rounded-full border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[#0F766E] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate leading-tight">
                    {user.displayName || user.email?.split('@')[0]}
                  </p>
                  <p className="text-[10px] text-emerald-600 font-medium">Cloud Synced</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => signOut()}
                className="text-[11px] text-slate-400 hover:text-rose-600 cursor-pointer ml-1"
                title="Sign Out"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="w-full py-2 px-2.5 rounded-[10px] bg-slate-50 hover:bg-slate-100 border border-[#E7E3DA] text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              <span>Sign In (Settings)</span>
            </button>
          )}
        </div>
      </aside>

      {/* 2. Tablet Top Header with Compact Centered Navigation (visible on md: to lg: screens) */}
      <header className="hidden md:flex lg:hidden items-center justify-between px-6 py-2.5 bg-white border-b border-[#E7E3DA] sticky top-0 z-40 shadow-xs">
        {/* Brand Left */}
        <div className="flex items-center gap-2.5 shrink-0 min-w-[180px]">
          <img
            src="/icon-192.png"
            alt="Deaf Contact Record"
            className="w-8 h-8 rounded-[10px] object-cover shadow-2xs ring-1 ring-black/5 shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-[#14213D] tracking-tight truncate">
              Deaf Contact Record
            </h1>
            <p className="text-[11px] text-[#5B6470] truncate">Field Ministry</p>
          </div>
        </div>

        {/* Compact Centered Navigation Pill */}
        <nav className="flex items-center gap-1 bg-[#F3F1EC] p-1 rounded-[16px] border border-[#E7E3DA] shadow-2xs" aria-label="Tablet Navigation">
          <button
            type="button"
            onClick={() => {
              setSelectedPersonId(null);
              setActiveTab('records');
            }}
            className={`min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-[12px] flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
              activeTab === 'records'
                ? 'bg-[#0F766E] text-white shadow-sm'
                : 'text-[#5B6470] hover:text-[#14213D] hover:bg-white/60'
            }`}
          >
            <Contact className="w-4 h-4" />
            <span>Contacts</span>
            <span
              className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded-full ${
                activeTab === 'records' ? 'bg-white/20 text-white' : 'bg-[#E7E3DA] text-[#5B6470]'
              }`}
            >
              {people.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('territories')}
            className={`min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-[12px] flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
              activeTab === 'territories'
                ? 'bg-[#0F766E] text-white shadow-sm'
                : 'text-[#5B6470] hover:text-[#14213D] hover:bg-white/60'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Territories</span>
            <span
              className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded-full ${
                activeTab === 'territories' ? 'bg-white/20 text-white' : 'bg-[#E7E3DA] text-[#5B6470]'
              }`}
            >
              {territories.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className={`min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-[12px] flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
              activeTab === 'map'
                ? 'bg-[#0F766E] text-white shadow-sm'
                : 'text-[#5B6470] hover:text-[#14213D] hover:bg-white/60'
            }`}
          >
            <Map className="w-4 h-4" />
            <span>Map</span>
            <span
              className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded-full ${
                activeTab === 'map' ? 'bg-white/20 text-white' : 'bg-[#E7E3DA] text-[#5B6470]'
              }`}
            >
              {peopleWithLocationsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-[12px] flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-[#0F766E] text-white shadow-sm'
                : 'text-[#5B6470] hover:text-[#14213D] hover:bg-white/60'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </nav>

        {/* Right Info Spacer for balanced centering */}
        <div className="shrink-0 min-w-[180px] flex justify-end items-center gap-2">
          {user ? (
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-2 py-1 rounded-[10px] text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span className="truncate max-w-[100px]">{user.displayName || user.email?.split('@')[0] || 'Synced'}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="text-xs font-semibold text-[#0F766E] hover:text-[#0D655E] bg-teal-50 px-2.5 py-1 rounded-[10px] border border-teal-200 cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* 3. Main Content Area (Offset on desktop for fixed left sidebar) */}
      <div className="flex-1 lg:pl-64 xl:pl-72 flex flex-col min-w-0">
        {activeTab === 'records' && (
          <>
            {selectedPerson ? (
              <RecordDetail
                person={selectedPerson}
                onBack={() => setSelectedPersonId(null)}
              />
            ) : (
              <RecordList />
            )}
          </>
        )}

        {activeTab === 'territories' && <TerritoryList />}

        {activeTab === 'map' && <ContactMapView />}

        {activeTab === 'settings' && <SettingsView />}
      </div>

      {/* 4. Fixed Mobile Bottom Navigation (visible only on mobile) */}
      <BottomNavigation />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}
