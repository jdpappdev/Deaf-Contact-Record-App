import React from 'react';
import { useApp } from '../../context/AppContext';
import { ActiveTab } from '../../types';
import { Contact, MapPin, Map, Settings } from 'lucide-react';

export const BottomNavigation: React.FC = () => {
  const { activeTab, setActiveTab, setSelectedPersonId } = useApp();

  const handleTabClick = (tab: ActiveTab) => {
    // If moving to records from another tab or clicking records, we clear selected person to show record list
    if (tab !== activeTab) {
      if (tab === 'records') {
        setSelectedPersonId(null);
      }
    }
    setActiveTab(tab);
  };

  const navItems: { tab: ActiveTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { tab: 'records', label: 'Contacts', icon: Contact },
    { tab: 'territories', label: 'Territories', icon: MapPin },
    { tab: 'map', label: 'Map', icon: Map },
    { tab: 'settings', label: 'Settings', icon: Settings },
  ];

  const activeIndex = navItems.findIndex((item) => item.tab === activeTab);

  return (
    <nav
      aria-label="Main Navigation"
      className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-auto sm:w-[480px] sm:left-1/2 sm:-translate-x-1/2 z-40 pb-safe md:hidden"
    >
      <div className="relative bg-white/95 backdrop-blur-md rounded-[24px] border border-[#E7E3DA] shadow-e3 px-2 py-1.5 h-16">
        {/* Sliding teal pill behind active icon/tab */}
        <div
          className="absolute top-1.5 bottom-1.5 rounded-[18px] bg-[#0F766E] shadow-sm transition-all duration-300 ease-out pointer-events-none"
          style={{
            width: 'calc((100% - 16px) / 4)',
            transform: `translateX(calc(${activeIndex >= 0 ? activeIndex : 0} * (100% + 0px)))`,
            left: '8px',
          }}
          aria-hidden="true"
        />

        <div className="relative grid grid-cols-4 h-full items-center z-10">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.tab;
            return (
              <button
                key={item.tab}
                type="button"
                onClick={() => handleTabClick(item.tab)}
                className={`flex flex-col items-center justify-center h-full min-h-[44px] min-w-[44px] py-1 rounded-[16px] transition-colors duration-200 select-none relative ${
                  isActive
                    ? 'text-white font-semibold'
                    : 'text-[#5B6470] hover:text-[#14213D] font-medium'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <Icon
                    className={`w-5 h-5 transition-transform duration-200 ${
                      isActive ? 'scale-110 stroke-[2.25]' : 'stroke-[1.75]'
                    }`}
                  />
                </div>
                <span
                  className={`text-[11px] leading-tight tracking-tight mt-1 transition-colors duration-200 ${
                    isActive ? 'text-white' : 'text-[#5B6470]'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
