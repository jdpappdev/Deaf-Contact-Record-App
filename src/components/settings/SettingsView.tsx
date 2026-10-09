import React from 'react';
import { Wifi, Info } from 'lucide-react';

export const SettingsView: React.FC = () => {
  return (
    <div className="pb-28 md:pb-12">
      {/* Unified Compact Header */}
      <header className="sticky top-0 md:top-[58px] lg:top-0 z-30 bg-white border-b border-[#E7E3DA] px-4 sm:px-6 py-3 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 min-h-[44px]">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/icon-192.png"
              alt="Deaf Contact Record"
              className="w-8 h-8 rounded-[10px] object-cover shadow-2xs ring-1 ring-black/5 shrink-0"
            />
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
        </div>
      </header>

      {/* Main Settings Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {/* Section 1: Offline Access */}
          <section className="bg-white rounded-[16px] border border-[#E7E3DA] shadow-xs p-5">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-[12px] bg-[#0F766E]/10 border border-[#0F766E]/20 flex items-center justify-center shrink-0 text-[#0F766E]">
                <Wifi className="w-5 h-5 stroke-[2]" />
              </div>
              <div className="min-w-0 pt-0.5">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Offline access
                </h2>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                  Your saved records, territories, and visit notes remain available offline on this device.
                </p>
              </div>
            </div>
          </section>

          {/* Section 2: App Information */}
          <section className="bg-white rounded-[16px] border border-[#E7E3DA] shadow-xs p-5">
            <div className="flex items-start gap-3.5 mb-3.5">
              <div className="w-10 h-10 rounded-[12px] bg-[#0F766E]/10 border border-[#0F766E]/20 flex items-center justify-center shrink-0 text-[#0F766E]">
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

            <div className="divide-y divide-[#E7E3DA] pt-1">
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
                <span className="text-slate-500 font-medium">Storage</span>
                <span className="font-semibold text-slate-900 font-mono">IndexedDB Local</span>
              </div>
              <div className="py-2.5 flex items-center justify-between text-sm">
                <span className="text-slate-500 font-medium">Version</span>
                <span className="font-semibold text-slate-900 font-mono">1.0.0</span>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

