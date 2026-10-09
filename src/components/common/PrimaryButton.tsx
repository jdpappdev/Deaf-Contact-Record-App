import React from 'react';
import { Plus } from 'lucide-react';

export const PRIMARY_BUTTON_CLASSES =
  'h-[52px] min-h-[52px] px-6 text-base font-semibold text-white bg-[#0F766E] hover:bg-[#0D655E] active:scale-[0.98] rounded-[16px] inline-flex items-center justify-center gap-2 shadow-e2 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none';

export const PRIMARY_FAB_CLASSES =
  'fixed bottom-24 right-4 sm:right-6 z-30 w-14 h-14 min-w-[56px] min-h-[56px] rounded-full bg-[#0F766E] hover:bg-[#0D655E] active:scale-[0.92] text-white flex items-center justify-center shadow-e3 transition-all duration-180 ease-out focus:outline-none focus:ring-4 focus:ring-[#0F766E]/30 select-none cursor-pointer';

export interface PrimaryButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

/**
 * Shared primary button component used for every primary action in the app.
 * Enforces consistent primary teal color (#0F766E), 52px height, 16px radius, shadow-e2, font-semibold.
 */
export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  children,
  icon,
  className = '',
  type = 'button',
  ...props
}) => {
  return (
    <button
      type={type}
      className={`${PRIMARY_BUTTON_CLASSES} ${className}`}
      {...props}
    >
      {icon}
      {children && <span>{children}</span>}
    </button>
  );
};

export interface PrimaryFABProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  ariaLabel: string;
  icon?: React.ReactNode;
  className?: string;
}

/**
 * Shared circular Floating Action Button (FAB) component.
 * Uses the exact same primary teal color (#0F766E), 56x56 size, full radius, shadow-e3, white + icon style.
 */
export const PrimaryFAB: React.FC<PrimaryFABProps> = ({
  ariaLabel,
  icon = <Plus className="w-7 h-7 text-white stroke-[2.75]" />,
  className = '',
  type = 'button',
  ...props
}) => {
  return (
    <button
      type={type}
      className={`${PRIMARY_FAB_CLASSES} ${className}`}
      aria-label={ariaLabel}
      {...props}
    >
      {icon}
    </button>
  );
};
