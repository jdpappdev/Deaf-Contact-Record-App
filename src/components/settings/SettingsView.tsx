import React from 'react';
import { Wifi, Info } from 'lucide-react';

export const SettingsView: React.FC = () => {
  return (
    <div className="pb-28">
      {/* Unified Compact Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB] px-4 py-3 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 min-h-[44px]">
          <div className="min-w-0">
            <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[11px] sm:text-xs font-semibold tracking-[0.14em] uppercase text-slate-900 leading-tight select-none">
              DEAF CONTACT RECORD
            </p>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight mt-0.5">
              Settings
            </h1>
            <p className="text-sm text-slate-500 font-normal">
              Preferences and app information
            </p>
          </div>
        </div>
      </header>

      {/* Main Settings Content */}
      <main className="max-w-4xl mx-auto px-4 pt-4 space-y-4">
        {/* Section 1: Offline Access */}
        <section className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-xs p-5">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-[12px] bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 text-[#1D4ED8]">
              <Wifi className="w-5 h-5 stroke-[2]" />
            </div>
            <div className="min-w-0 pt-0.5">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Offline access
              </h2>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                Your saved records remain available offline.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: App Information */}
        <section className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-xs p-5">
          <div className="flex items-start gap-3.5 mb-3.5">
            <div className="w-10 h-10 rounded-[12px] bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 text-[#1D4ED8]">
              <Info className="w-5 h-5 stroke-[2]" />
            </div>
            <div className="min-w-0 pt-0.5">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                App information
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Application and version details
              </p>
            </div>
          </div>

          <div className="divide-y divide-[#E5E7EB] pt-1">
            <div className="py-2.5 flex items-center justify-between text-sm">
              <span className="text-slate-500 font-medium">Application</span>
              <div className="flex items-center gap-2">
                <img
                  src="/icon-192.png"
                  alt="App Icon"
                  className="w-5 h-5 rounded-[6px] object-cover shadow-2xs"
                />
                <span className="font-semibold text-slate-900">Deaf Contact Record</span>
              </div>
            </div>
            <div className="py-2.5 flex items-center justify-between text-sm">
              <span className="text-slate-500 font-medium">Version</span>
              <span className="font-semibold text-slate-900">1.0.0</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

