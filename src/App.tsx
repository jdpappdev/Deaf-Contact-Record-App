import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { BottomNavigation } from './components/navigation/BottomNavigation';
import { RecordList } from './components/records/RecordList';
import { RecordDetail } from './components/records/RecordDetail';
import { TerritoryList } from './components/territories/TerritoryList';
import { ContactMapView } from './components/map/ContactMapView';
import { SettingsView } from './components/settings/SettingsView';
import { ToastContainer } from './components/common/ToastContainer';
import { Contact, MapPin, Map, Settings, Loader2 } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    selectedPersonId,
    setSelectedPersonId,
    people,
    isLoading,
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

  return (
    <div className="min-h-screen bg-canvas-gradient text-[#14213D] flex flex-col selection:bg-[#0F766E]/20 selection:text-[#0F766E]">
      {/* Toast notifications */}
      <ToastContainer />

      {/* Desktop Top Bar (visible on md: screens and above) */}
      <header className="hidden md:flex items-center justify-between px-6 py-3.5 bg-white border-b border-[#E7E3DA] sticky top-0 z-40 shadow-e2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[14px] bg-[#0F766E] text-white flex items-center justify-center font-bold text-sm shadow-sm">
            D
          </div>
          <div>
            <h1 className="text-base font-bold text-[#14213D] tracking-tight leading-none">
              Deaf Contact Record
            </h1>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="flex items-center gap-1.5 bg-[#F3F1EC] p-1.5 rounded-[16px] border border-[#E7E3DA]">
          <button
            type="button"
            onClick={() => {
              setSelectedPersonId(null);
              setActiveTab('records');
            }}
            className={`min-h-[44px] px-4 py-2 text-sm font-semibold rounded-[12px] flex items-center gap-2 transition-all duration-200 ${
              activeTab === 'records'
                ? 'bg-[#0F766E] text-white shadow-sm'
                : 'text-[#5B6470] hover:text-[#14213D] hover:bg-white/60'
            }`}
          >
            <Contact className="w-4 h-4" />
            <span>Contacts</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('territories')}
            className={`min-h-[44px] px-4 py-2 text-sm font-semibold rounded-[12px] flex items-center gap-2 transition-all duration-200 ${
              activeTab === 'territories'
                ? 'bg-[#0F766E] text-white shadow-sm'
                : 'text-[#5B6470] hover:text-[#14213D] hover:bg-white/60'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Territories</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className={`min-h-[44px] px-4 py-2 text-sm font-semibold rounded-[12px] flex items-center gap-2 transition-all duration-200 ${
              activeTab === 'map'
                ? 'bg-[#0F766E] text-white shadow-sm'
                : 'text-[#5B6470] hover:text-[#14213D] hover:bg-white/60'
            }`}
          >
            <Map className="w-4 h-4" />
            <span>Map</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`min-h-[44px] px-4 py-2 text-sm font-semibold rounded-[12px] flex items-center gap-2 transition-all duration-200 ${
              activeTab === 'settings'
                ? 'bg-[#0F766E] text-white shadow-sm'
                : 'text-[#5B6470] hover:text-[#14213D] hover:bg-white/60'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <div className="flex-1">
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

      {/* Fixed Mobile Bottom Navigation */}
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
