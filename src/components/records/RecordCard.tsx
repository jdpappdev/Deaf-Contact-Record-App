import React from 'react';
import { Person, Territory, Visit } from '../../types';
import { Avatar } from '../common/Avatar';
import { ChevronRight, Calendar, MapPin } from 'lucide-react';

interface RecordCardProps {
  person: Person;
  territory: Territory | null;
  latestVisit: Visit | null;
  onClick: () => void;
}

export const RecordCard: React.FC<RecordCardProps> = ({
  person,
  territory,
  latestVisit,
  onClick,
}) => {
  // Format visit date
  const formattedVisitDate = latestVisit
    ? new Date(latestVisit.visitedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50/80 active:bg-slate-100 rounded-[16px] border border-[#E7E3DA] shadow-e1 transition-all duration-200 cursor-pointer select-none group text-left min-h-[64px]"
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <Avatar photoRef={person.photoRef} name={person.name} size="md" />

        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-[#14213D] truncate group-hover:text-[#0F766E] transition-colors duration-200">
            {person.name}
          </h3>

          <div className="flex items-center gap-2 mt-0.5 text-sm text-[#5B6470] font-normal">
            <span className="truncate max-w-[140px] flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#5B6470]/70 shrink-0" />
              {territory ? territory.name : 'Unassigned'}
            </span>

            <span aria-hidden="true" className="text-[#E7E3DA]">·</span>

            <span className="truncate flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#5B6470]/70 shrink-0" />
              {formattedVisitDate ? formattedVisitDate : 'No visits'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 text-[#5B6470]/60 group-hover:text-[#0F766E] shrink-0 ml-2 transition-colors">
        <ChevronRight className="w-5 h-5 stroke-[2]" />
      </div>
    </div>
  );
};
